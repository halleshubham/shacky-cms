import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { slugify } from '@shacky/shared';

const pageBodySchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().default(''),
  excerpt: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  publishedAt: z.string().datetime().optional(),
  featuredMediaId: z.string().optional().nullable(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

const pagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const pages = await prisma.page.findMany({
      orderBy: { createdAt: 'desc' },
      include: { featuredMedia: true },
    });
    return reply.send(pages);
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const page = await prisma.page.findUnique({
      where: { id },
      include: { featuredMedia: true },
    });
    if (!page) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Page not found' });
    return reply.send(page);
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = pageBodySchema.parse(req.body);
    const slug = body.slug || slugify(body.title);
    const page = await prisma.page.create({
      data: {
        title: body.title,
        slug,
        content: body.content,
        excerpt: body.excerpt,
        status: (body.status || 'draft') as any,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
        featuredMediaId: body.featuredMediaId,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
      },
    });
    return reply.status(201).send(page);
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = pageBodySchema.partial().parse(req.body);
    const page = await prisma.page.update({
      where: { id },
      data: {
        ...body,
        ...(body.publishedAt !== undefined && { publishedAt: body.publishedAt ? new Date(body.publishedAt) : null }),
        status: body.status as any,
      },
    });
    return reply.send(page);
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.page.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default pagesRoutes;
