import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/auth.js';

const subscribeSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  channels: z.enum(['email', 'whatsapp', 'both']).default('email'),
  listId: z.string().optional(),
});

const subscribersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /subscribers — admin only
  fastify.get(
    '/',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { page = 1, pageSize = 50, status, listId } = req.query as any;
      const skip = (page - 1) * pageSize;
      const where: any = {};
      if (status) where.status = status;
      if (listId) where.lists = { some: { listId } };

      const [data, total] = await Promise.all([
        prisma.subscriber.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: { subscribedAt: 'desc' },
          include: { lists: { include: { list: { select: { id: true, name: true } } } } },
        }),
        prisma.subscriber.count({ where }),
      ]);

      return reply.send({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    },
  );

  // POST /subscribers/subscribe — public
  fastify.post('/subscribe', async (req, reply) => {
    const body = subscribeSchema.parse(req.body);
    if (!body.email && !body.phone) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Email or phone required' });
    }

    const existing = await prisma.subscriber.findFirst({
      where: { OR: [body.email ? { email: body.email } : {}, body.phone ? { phone: body.phone } : {}] },
    });

    let subscriber = existing;
    if (!subscriber) {
      subscriber = await prisma.subscriber.create({
        data: {
          email: body.email,
          phone: body.phone,
          name: body.name,
          channels: body.channels as any,
          source: 'web_form',
          unsubscribeToken: createId(),
        },
      });
    }

    if (body.listId) {
      await prisma.subscriberListMember.upsert({
        where: { subscriberId_listId: { subscriberId: subscriber.id, listId: body.listId } },
        create: { subscriberId: subscriber.id, listId: body.listId },
        update: {},
      });
    }

    return reply.send({ success: true, id: subscriber.id });
  });

  // GET /subscribers/unsubscribe/:token — one-click unsubscribe
  fastify.get('/unsubscribe/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const subscriber = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
    if (!subscriber) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid unsubscribe link' });
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { status: 'unsubscribed', unsubscribedAt: new Date() },
    });

    return reply.send({ success: true, message: 'You have been unsubscribed.' });
  });

  // DELETE /subscribers/:id — admin
  fastify.delete(
    '/:id',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await prisma.subscriber.delete({ where: { id } });
      return reply.send({ success: true });
    },
  );

  // ── Subscriber Lists ───────────────────────────────────────────────────

  fastify.get(
    '/lists',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const lists = await prisma.subscriberList.findMany({
        include: { _count: { select: { members: true } } },
        orderBy: { name: 'asc' },
      });
      return reply.send(lists.map((l) => ({ ...l, subscriberCount: l._count.members })));
    },
  );

  fastify.post(
    '/lists',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { name, description } = req.body as { name: string; description?: string };
      const list = await prisma.subscriberList.create({ data: { name, description } });
      return reply.status(201).send(list);
    },
  );

  fastify.patch(
    '/lists/:id',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { name, description } = req.body as { name?: string; description?: string };
      const list = await prisma.subscriberList.update({ where: { id }, data: { name, description } });
      return reply.send(list);
    },
  );

  fastify.delete(
    '/lists/:id',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await prisma.subscriberList.delete({ where: { id } });
      return reply.send({ success: true });
    },
  );

  // POST /subscribers/lists/:id/members
  fastify.post(
    '/lists/:id/members',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { subscriberIds } = req.body as { subscriberIds: string[] };

      await prisma.subscriberListMember.createMany({
        data: subscriberIds.map((subscriberId) => ({ subscriberId, listId: id })),
        skipDuplicates: true,
      });
      return reply.send({ success: true });
    },
  );

  // POST /subscribers/import — CSV import
  fastify.post(
    '/import',
    { preHandler: [authenticate, requireRoles('superadmin', 'editor', 'subscriber_manager')] },
    async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file' });

      const csv = (await data.toBuffer()).toString('utf-8');
      const lines = csv.split('\n').slice(1); // skip header
      let imported = 0;
      let skipped = 0;

      for (const line of lines) {
        const [email, phone, name, channels] = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        if (!email && !phone) { skipped++; continue; }
        try {
          await prisma.subscriber.upsert({
            where: email ? { email } : { phone: phone! },
            create: {
              email: email || null,
              phone: phone || null,
              name: name || null,
              channels: (channels as any) || 'email',
              source: 'import',
              unsubscribeToken: createId(),
            },
            update: { name: name || undefined },
          });
          imported++;
        } catch { skipped++; }
      }

      return reply.send({ imported, skipped });
    },
  );
};

export default subscribersRoutes;
