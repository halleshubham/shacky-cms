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
    const { search, page: pageStr, pageSize: pageSizeStr } = req.query as { search?: string; page?: string; pageSize?: string };
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const pageSize = Math.max(1, parseInt(pageSizeStr || '100', 10));
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : undefined;
    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        include: { _count: { select: { posts: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tag.count({ where }),
    ]);
    return reply.send({
      data: tags.map((t) => ({ ...t, postCount: t._count.posts })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
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
