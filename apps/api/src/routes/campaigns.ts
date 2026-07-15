import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { defaultIssueHeaderConfig, defaultIssueArticlesConfig } from '@shacky/shared';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  generateNewsletterHtml,
  generateWhatsAppDigest,
  generateWhatsAppChannelMessages,
  getNewsletterSettings,
  type EmailBlock,
} from '../services/newsletter.js';
import { sendMail, getEmailConfig } from '../services/email.js';
import { sendMessagesToGroups } from '../services/botsab.js';
import { audit } from '../utils/audit.js';

const emailBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.any()),
});

const campaignBodySchema = z.object({
  name: z.string().min(1),
  issueId: z.string(),
  subscriberListId: z.string(),
  scheduledAt: z.string().datetime().optional(),
  blocks: z.array(emailBlockSchema).optional(),
});

export function defaultCampaignBlocks(subscribeUrl: string): EmailBlock[] {
  return [
    { id: randomUUID(), type: 'issue_header', config: defaultIssueHeaderConfig() },
    { id: randomUUID(), type: 'issue_articles', config: defaultIssueArticlesConfig() },
    { id: randomUUID(), type: 'button_row', config: { buttons: [{ label: 'Subscribe for Free', url: subscribeUrl, variant: 'primary', newTab: false }], align: 'center' } },
  ];
}

const canManage = requireRoles('superadmin', 'editor', 'subscriber_manager');

const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /campaigns
  fastify.get('/', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { page = 1, pageSize = 20 } = req.query as any;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prisma.campaign.findMany({
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          issue: { select: { id: true, title: true, volumeNumber: true, issueNumber: true } },
          subscriberList: { select: { id: true, name: true } },
        },
      }),
      prisma.campaign.count(),
    ]);
    return reply.send({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  // GET /campaigns/:id
  fastify.get('/:id', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        issue: { select: { id: true, title: true, volumeNumber: true, issueNumber: true } },
        subscriberList: { select: { id: true, name: true } },
      },
    });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Campaign not found' });
    return reply.send(campaign);
  });

  // POST /campaigns
  fastify.post('/', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const body = campaignBodySchema.parse(req.body);
    let blocks = body.blocks;
    if (!blocks || blocks.length === 0) {
      const settings = await getNewsletterSettings();
      blocks = defaultCampaignBlocks(settings.subscribeUrl);
    }
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        issueId: body.issueId,
        subscriberListId: body.subscriberListId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        blocks: blocks as any,
      },
    });
    await audit(req, 'campaign.created', { entity: 'campaign', entityId: campaign.id });
    return reply.status(201).send(campaign);
  });

  // PATCH /campaigns/:id
  fastify.patch('/:id', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = campaignBodySchema.partial().parse(req.body);
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    if (campaign.status === 'sent') {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Cannot edit a sent campaign' });
    }
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.issueId && { issueId: body.issueId }),
        ...(body.subscriberListId && { subscriberListId: body.subscriberListId }),
        ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
        ...(body.blocks !== undefined && { blocks: body.blocks as any }),
      },
    });
    await audit(req, 'campaign.updated', { entity: 'campaign', entityId: id });
    return reply.send(updated);
  });

  // POST /campaigns/:id/test-send
  fastify.post('/:id/test-send', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = await generateNewsletterHtml(issue, { subscriberToken: 'test-preview' }, campaign.blocks as any);
    await sendMail({ to: email, subject: `[TEST] ${issue.title}`, html });
    return reply.send({ success: true, sentTo: email });
  });

  // POST /campaigns/:id/preview-blocks — render draft (unsaved) blocks for the builder's live preview
  fastify.post('/:id/preview-blocks', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { blocks } = z.object({ blocks: z.array(emailBlockSchema) }).parse(req.body);

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = await generateNewsletterHtml(issue as any, { subscriberToken: 'preview-token' }, blocks as any);
    return reply.send({ html });
  });

  // GET /campaigns/:id/newsletter — return HTML for copy-paste
  fastify.get('/:id/newsletter', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = await generateNewsletterHtml(issue, { subscriberToken: 'preview-token' }, campaign.blocks as any);

    // Cache on the campaign record
    if (campaign.htmlContent !== html) {
      await prisma.campaign.update({ where: { id }, data: { htmlContent: html } });
    }

    return reply.send({ html });
  });

  // GET /campaigns/:id/preview — browser preview (served as HTML)
  fastify.get('/:id/preview', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = await generateNewsletterHtml(issue, { subscriberToken: 'preview-token' }, campaign.blocks as any);

    if (campaign.htmlContent !== html) {
      await prisma.campaign.update({ where: { id }, data: { htmlContent: html } });
    }

    reply.header('Content-Type', 'text/html');
    return reply.send(html);
  });

  // GET /campaigns/:id/whatsapp — digest parts + per-channel per-article messages
  fastify.get('/:id/whatsapp', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const [digest, channels] = await Promise.all([
      generateWhatsAppDigest(issue),
      generateWhatsAppChannelMessages(issue),
    ]);

    return reply.send({ digest, channels });
  });

  // POST /campaigns/:id/send
  fastify.post('/:id/send', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    if (campaign.status === 'sent') {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Campaign already sent' });
    }

    await prisma.campaign.update({ where: { id }, data: { status: 'sending' } });

    const issue = await fetchIssueWithPosts(campaign.issueId);

    const subscribers = await prisma.subscriber.findMany({
      where: {
        status: 'active',
        channels: { in: ['email', 'both'] },
        lists: { some: { listId: campaign.subscriberListId } },
        email: { not: null },
      },
    });

    const emailCfg = await getEmailConfig();
    let sent = 0;
    for (const sub of subscribers) {
      try {
        const html = await generateNewsletterHtml(issue as any, { subscriberToken: sub.unsubscribeToken }, campaign.blocks as any);
        await sendMail({ to: sub.email!, subject: issue!.title, html }, emailCfg);
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${sub.email}:`, err);
      }
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), sentCount: sent },
    });

    await audit(req, 'campaign.sent', { entity: 'campaign', entityId: id, meta: { sent } });
    return reply.send({ success: true, sent });
  });

  // POST /campaigns/:id/botsab-send — send WA messages to groups via Botsab
  fastify.post('/:id/botsab-send', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { groupJids, mode, channelId } = z.object({
      groupJids: z.array(z.string()).min(1),
      mode: z.enum(['digest', 'channel']),
      channelId: z.string().optional(),
    }).parse(req.body);

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await fetchIssueWithPosts(campaign.issueId);
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    let messages: string[];
    if (mode === 'digest') {
      messages = await generateWhatsAppDigest(issue);
    } else {
      const channels = await generateWhatsAppChannelMessages(issue);
      const ch = channels.find((c) => c.id === channelId);
      if (!ch) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Channel '${channelId}' not found` });
      messages = ch.messages;
    }

    try {
      const result = await sendMessagesToGroups(groupJids, messages);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(502).send({ statusCode: 502, error: 'Bad Gateway', message: err.message || 'Botsab send failed' });
    }
  });

  // DELETE /campaigns/:id
  fastify.delete('/:id', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.campaign.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

// ─── Shared DB query ──────────────────────────────────────────────────────────

async function fetchIssueWithPosts(issueId: string) {
  return prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      posts: {
        where: { status: 'published' },
        orderBy: { issueOrder: 'asc' },
        include: { featuredMedia: true, authors: { include: { author: true } } },
      },
    },
  });
}

export default campaignsRoutes;
