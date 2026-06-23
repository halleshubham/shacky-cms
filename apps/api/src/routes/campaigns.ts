import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { generateNewsletterHtml, generateWhatsAppMessage } from '../services/newsletter.js';
import { sendMail } from '../services/email.js';
import { audit } from '../utils/audit.js';
import { env } from '../utils/env.js';

const campaignBodySchema = z.object({
  name: z.string().min(1),
  issueId: z.string(),
  subscriberListId: z.string(),
  scheduledAt: z.string().datetime().optional(),
});

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
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        issueId: body.issueId,
        subscriberListId: body.subscriberListId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });
    await audit(req, 'campaign.created', { entity: 'campaign', entityId: campaign.id });
    return reply.status(201).send(campaign);
  });

  // PATCH /campaigns/:id — update campaign
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
      },
    });
    await audit(req, 'campaign.updated', { entity: 'campaign', entityId: id });
    return reply.send(updated);
  });

  // POST /campaigns/:id/test-send — send to a single email address for testing
  fastify.post('/:id/test-send', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await prisma.issue.findUnique({
      where: { id: campaign.issueId },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: { featuredMedia: true, authors: { include: { author: true } } },
        },
      },
    });
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = generateNewsletterHtml(issue as any, { subscriberToken: 'test-preview' });
    await sendMail({ to: email, subject: `[TEST] ${issue.title}`, html });

    return reply.send({ success: true, sentTo: email });
  });

  // GET /campaigns/:id/preview — generate HTML preview
  fastify.get('/:id/preview', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await prisma.issue.findUnique({
      where: { id: campaign.issueId },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: {
            featuredMedia: true,
            authors: { include: { author: true } },
          },
        },
      },
    });
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    const html = generateNewsletterHtml(issue as any, {
      subscriberToken: 'preview-token',
    });

    if (campaign.htmlContent !== html) {
      await prisma.campaign.update({ where: { id }, data: { htmlContent: html } });
    }

    reply.header('Content-Type', 'text/html');
    return reply.send(html);
  });

  // GET /campaigns/:id/whatsapp — generate WhatsApp messages
  fastify.get('/:id/whatsapp', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    const issue = await prisma.issue.findUnique({
      where: { id: campaign.issueId },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: { authors: { include: { author: true } } },
        },
      },
    });
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });

    return reply.send({
      janata: generateWhatsAppMessage(issue as any, 'janata', env.APP_URL),
      lokayat: generateWhatsAppMessage(issue as any, 'lokayat', env.APP_URL),
      abhivyakti: generateWhatsAppMessage(issue as any, 'abhivyakti', env.APP_URL),
    });
  });

  // POST /campaigns/:id/send — send the campaign
  fastify.post('/:id/send', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    if (campaign.status === 'sent') {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Campaign already sent' });
    }

    await prisma.campaign.update({ where: { id }, data: { status: 'sending' } });

    const issue = await prisma.issue.findUnique({
      where: { id: campaign.issueId },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: { featuredMedia: true, authors: { include: { author: true } } },
        },
      },
    });

    const subscribers = await prisma.subscriber.findMany({
      where: {
        status: 'active',
        channels: { in: ['email', 'both'] },
        lists: { some: { listId: campaign.subscriberListId } },
        email: { not: null },
      },
    });

    let sent = 0;
    for (const sub of subscribers) {
      try {
        const html = generateNewsletterHtml(issue as any, {
          subscriberToken: sub.unsubscribeToken,
        });
        await sendMail({ to: sub.email!, subject: issue!.title, html });
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

  // DELETE /campaigns/:id
  fastify.delete('/:id', { preHandler: [authenticate, canManage] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.campaign.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default campaignsRoutes;
