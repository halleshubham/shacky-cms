import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const issueBodySchema = z.object({
  volumeNumber: z.number().int().positive(),
  issueNumber: z.number().int().positive(),
  title: z.string().min(1),
  publishDate: z.string().datetime(),
  type: z.enum(['print', 'blog', 'combined']).default('combined'),
});

const issuesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /issues
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { page = 1, pageSize = 20 } = req.query as any;
    const skip = (page - 1) * pageSize;
    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        skip,
        take: Number(pageSize),
        orderBy: [{ volumeNumber: 'desc' }, { issueNumber: 'desc' }],
        include: {
          _count: { select: { posts: true } },
        },
      }),
      prisma.issue.count(),
    ]);
    return reply.send({ data: issues, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  // GET /issues/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        posts: {
          orderBy: { issueOrder: 'asc' },
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
            featuredMedia: true,
          },
        },
      },
    });
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });
    return reply.send(issue);
  });

  // POST /issues
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = issueBodySchema.parse(req.body);
    const issue = await prisma.issue.create({
      data: {
        volumeNumber: body.volumeNumber,
        issueNumber: body.issueNumber,
        title: body.title,
        publishDate: new Date(body.publishDate),
        type: body.type as any,
      },
    });
    await audit(req, 'issue.created', { entity: 'issue', entityId: issue.id });
    return reply.status(201).send(issue);
  });

  // PATCH /issues/:id
  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = issueBodySchema.partial().parse(req.body);
    const issue = await prisma.issue.update({
      where: { id },
      data: {
        ...body,
        ...(body.publishDate && { publishDate: new Date(body.publishDate) }),
      },
    });
    await audit(req, 'issue.updated', { entity: 'issue', entityId: id });
    return reply.send(issue);
  });

  // DELETE /issues/:id
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.issue.delete({ where: { id } });
    await audit(req, 'issue.deleted', { entity: 'issue', entityId: id });
    return reply.send({ success: true });
  });

  // POST /issues/:id/bulk-publish
  fastify.post('/:id/bulk-publish', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status = 'published' } = req.body as { status?: string };

    const posts = await prisma.post.findMany({
      where: { issueId: id },
      orderBy: { issueOrder: 'asc' },
    });

    for (const post of posts) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: status as any,
          ...(status === 'published' && !post.publishedAt && { publishedAt: new Date() }),
          ...(status === 'draft' && { publishedAt: null }),
        },
      });
    }

    await audit(req, `issue.bulk_${status}`, { entity: 'issue', entityId: id, meta: { count: posts.length } });
    return reply.send({ success: true, count: posts.length });
  });

  // PUT /issues/:id/article-order
  fastify.put('/:id/article-order', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { order } = req.body as { order: Array<{ postId: string; order: number }> };

    await Promise.all(
      order.map((item) =>
        prisma.post.update({
          where: { id: item.postId, issueId: id },
          data: { issueOrder: item.order },
        }),
      ),
    );

    await audit(req, 'issue.order_updated', { entity: 'issue', entityId: id });
    return reply.send({ success: true });
  });
};

export default issuesRoutes;
