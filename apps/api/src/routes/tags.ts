import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { slugify } from '@shacky/shared';

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
});

const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { search } = req.query as { search?: string };
    const tags = await prisma.tag.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    });
    return reply.send(tags.map((t) => ({ ...t, postCount: t._count.posts })));
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = schema.parse(req.body);
    const slug = body.slug || slugify(body.name);
    const existing = await prisma.tag.findUnique({ where: { slug } });
    if (existing) return reply.send(existing);
    const tag = await prisma.tag.create({ data: { name: body.name, slug, description: body.description } });
    return reply.status(201).send(tag);
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = schema.partial().parse(req.body);
    const tag = await prisma.tag.update({ where: { id }, data: body });
    return reply.send(tag);
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.tag.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default tagsRoutes;
