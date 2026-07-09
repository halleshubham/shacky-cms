import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const EVENTS = [
  'post.published', 'post.unpublished', 'post.created', 'post.updated', 'post.deleted',
  'member.created', 'member.updated', 'member.deleted',
  'campaign.sent',
];

const schema = z.object({
  name: z.string().min(1),
  event: z.enum(EVENTS as [string, ...string[]]),
  targetUrl: z.string().url(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { page: pageStr, pageSize: pageSizeStr } = req.query as { page?: string; pageSize?: string };
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const pageSize = Math.max(1, parseInt(pageSizeStr || '50', 10));
    const [hooks, total] = await Promise.all([
      prisma.webhook.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.webhook.count(),
    ]);
    return reply.send({
      data: hooks.map((h) => ({ ...h, secret: h.secret ? '***' : null })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  fastify.get('/events', { preHandler: [authenticate] }, async (_req, reply) => {
    return reply.send(EVENTS);
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = schema.parse(req.body);
    const hook = await prisma.webhook.create({ data: body });
    return reply.status(201).send({ ...hook, secret: hook.secret ? '***' : null });
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = schema.partial().parse(req.body);
    const hook = await prisma.webhook.update({ where: { id }, data: body });
    return reply.send({ ...hook, secret: hook.secret ? '***' : null });
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.webhook.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default webhooksRoutes;
