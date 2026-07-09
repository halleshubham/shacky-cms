import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { slugify } from '@shacky/shared';

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { search, page: pageStr, pageSize: pageSizeStr } = req.query as { search?: string; page?: string; pageSize?: string };
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const pageSize = Math.max(1, parseInt(pageSizeStr || '100', 10));
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : undefined;
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: { _count: { select: { posts: true } }, children: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);
    return reply.send({
      data: categories.map((c) => ({ ...c, postCount: c._count.posts })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const cat = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } }, parent: true, children: true },
    });
    if (!cat) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Category not found' });
    return reply.send({ ...cat, postCount: cat._count.posts });
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = schema.parse(req.body);
    const slug = body.slug || slugify(body.name);
    const cat = await prisma.category.create({
      data: { name: body.name, slug, description: body.description, parentId: body.parentId },
    });
    return reply.status(201).send(cat);
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = schema.partial().parse(req.body);
    const cat = await prisma.category.update({ where: { id }, data: body });
    return reply.send(cat);
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.category.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default categoriesRoutes;
