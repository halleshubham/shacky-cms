import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { slugify } from '@shacky/shared';
import { fireWebhook } from '../utils/webhooks.js';
import { createId } from '@paralleldrive/cuid2';

const postBodySchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().default(''),
  excerpt: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
  featuredMediaId: z.string().optional().nullable(),
  authorIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).max(3).optional(),
  tagIds: z.array(z.string()).optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  codeInjectionHead: z.string().optional().nullable(),
  codeInjectionFoot: z.string().optional().nullable(),
  issueId: z.string().optional().nullable(),
  issueOrder: z.number().int().optional().nullable(),
});

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 238));
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(20),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  isFeatured: z.coerce.boolean().optional(),
  authorId: z.string().optional(),
  categoryId: z.string().optional(),
  issueId: z.string().optional(),
  unassigned: z.coerce.boolean().optional(), // true → posts with no issueId
  search: z.string().optional(),
});

const include = {
  featuredMedia: true,
  authors: { include: { author: true } },
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  issue: { select: { id: true, title: true, volumeNumber: true, issueNumber: true } },
};

function formatPost(p: any) {
  return {
    ...p,
    authors: p.authors.map((a: any) => a.author),
    categories: p.categories.map((c: any) => c.category),
    tags: p.tags.map((t: any) => t.tag),
    readingTime: readingTime(p.content || ''),
  };
}

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /posts/analytics — top posts by views + per-status counts
  fastify.get('/analytics', { preHandler: [authenticate] }, async (req, reply) => {
    const { limit = 10 } = z.object({ limit: z.coerce.number().int().positive().max(100).default(10) }).parse(req.query);

    const [statusCounts, topPosts, viewsTotal] = await Promise.all([
      prisma.post.groupBy({ by: ['status'], _count: true, _sum: { viewCount: true } }),
      prisma.post.findMany({
        take: limit,
        where: { status: 'published' },
        orderBy: { viewCount: 'desc' },
        select: {
          id: true, title: true, slug: true, viewCount: true, publishedAt: true,
          categories: { include: { category: { select: { name: true, slug: true } } } },
          authors: { include: { author: { select: { displayName: true } } } },
        },
      }),
      prisma.post.aggregate({ _sum: { viewCount: true } }),
    ]);

    const byStatus: Record<string, { count: number; views: number }> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = { count: row._count, views: row._sum.viewCount ?? 0 };
    }

    return reply.send({
      totalViews: viewsTotal._sum.viewCount ?? 0,
      byStatus,
      topPosts: topPosts.map((p) => ({
        ...p,
        authors: p.authors.map((a) => a.author),
        categories: p.categories.map((c) => c.category),
      })),
    });
  });

  // GET /posts
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const q = listQuerySchema.parse(req.query);
    const skip = (q.page - 1) * q.pageSize;

    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.isFeatured !== undefined) where.isFeatured = q.isFeatured;
    if (q.issueId) where.issueId = q.issueId;
    if (q.unassigned) where.issueId = null;
    if (q.categoryId) where.categories = { some: { categoryId: q.categoryId } };
    if (q.authorId) where.authors = { some: { authorId: q.authorId } };
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };

    // Authors only see their own posts
    if (req.user?.role === 'author') {
      where.authors = { some: { userId: req.user.id } };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, include, skip, take: q.pageSize, orderBy: { createdAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return reply.send({
      data: posts.map(formatPost),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  });

  // GET /posts/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({ where: { id }, include });
    if (!post) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Post not found' });
    return reply.send(formatPost(post));
  });

  // POST /posts
  fastify.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const body = postBodySchema.parse(req.body);
    const slug = body.slug || slugify(body.title);

    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Slug already in use' });
    }

    const post = await prisma.post.create({
      data: {
        title: body.title,
        slug,
        content: body.content,
        excerpt: body.excerpt,
        status: (body.status || 'draft') as any,
        isFeatured: body.isFeatured ?? false,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
        featuredMediaId: body.featuredMediaId,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        codeInjectionHead: body.codeInjectionHead,
        codeInjectionFoot: body.codeInjectionFoot,
        issueId: body.issueId,
        issueOrder: body.issueOrder,
        authors: body.authorIds ? {
          create: body.authorIds.map((authorId, i) => ({ authorId, order: i })),
        } : undefined,
        categories: body.categoryIds ? {
          create: body.categoryIds.map((categoryId) => ({ categoryId })),
        } : undefined,
        tags: body.tagIds ? {
          create: body.tagIds.map((tagId) => ({ tagId })),
        } : undefined,
      },
      include,
    });

    await audit(req, 'post.created', { entity: 'post', entityId: post.id });
    return reply.status(201).send(formatPost(post));
  });

  // PATCH /posts/:id
  fastify.patch('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = postBodySchema.partial().parse(req.body);

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Post not found' });

    // Authors can only edit their own posts
    if (req.user?.role === 'author') {
      const isAuthor = await prisma.postAuthor.findFirst({
        where: { postId: id, userId: req.user.id },
      });
      if (!isAuthor) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot edit this post' });
    }

    // Save revision before update
    await prisma.revision.create({
      data: {
        postId: id,
        title: existing.title,
        content: existing.content,
        createdById: req.user!.id,
      },
    });

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.slug && { slug: body.slug }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.excerpt !== undefined && { excerpt: body.excerpt }),
        ...(body.status && { status: body.status as any }),
        ...(body.isFeatured !== undefined && { isFeatured: body.isFeatured }),
        ...(body.publishedAt !== undefined && { publishedAt: body.publishedAt ? new Date(body.publishedAt) : null }),
        ...(body.featuredMediaId !== undefined && { featuredMediaId: body.featuredMediaId }),
        ...(body.seoTitle !== undefined && { seoTitle: body.seoTitle }),
        ...(body.seoDescription !== undefined && { seoDescription: body.seoDescription }),
        ...(body.codeInjectionHead !== undefined && { codeInjectionHead: body.codeInjectionHead }),
        ...(body.codeInjectionFoot !== undefined && { codeInjectionFoot: body.codeInjectionFoot }),
        ...(body.issueId !== undefined && { issueId: body.issueId }),
        ...(body.issueOrder !== undefined && { issueOrder: body.issueOrder }),
        ...(body.authorIds && {
          authors: {
            deleteMany: {},
            create: body.authorIds.map((authorId, i) => ({ authorId, order: i })),
          },
        }),
        ...(body.categoryIds && {
          categories: {
            deleteMany: {},
            create: body.categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
        ...(body.tagIds && {
          tags: {
            deleteMany: {},
            create: body.tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include,
    });

    const wasPublished = existing.status !== 'published' && post.status === 'published';
    await audit(req, 'post.updated', { entity: 'post', entityId: post.id });
    if (wasPublished) fireWebhook('post.published', { id: post.id, title: post.title, slug: post.slug });
    return reply.send(formatPost(post));
  });

  // DELETE /posts/:id
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.post.delete({ where: { id } });
    await audit(req, 'post.deleted', { entity: 'post', entityId: id });
    fireWebhook('post.deleted', { id });
    return reply.send({ success: true });
  });

  // POST /posts/:id/duplicate — clone a post
  fastify.post('/:id/duplicate', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const src = await prisma.post.findUnique({ where: { id }, include });
    if (!src) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Post not found' });

    const baseSlug = `${src.slug}-copy`;
    let slug = baseSlug;
    let i = 1;
    while (await prisma.post.findUnique({ where: { slug } })) slug = `${baseSlug}-${i++}`;

    const post = await prisma.post.create({
      data: {
        title: `${src.title} (Copy)`,
        slug,
        content: src.content,
        excerpt: src.excerpt,
        status: 'draft',
        featuredMediaId: src.featuredMediaId,
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
        codeInjectionHead: src.codeInjectionHead,
        codeInjectionFoot: src.codeInjectionFoot,
        issueId: src.issueId,
        authors: { create: src.authors.map((a: any) => ({ authorId: a.authorId, order: a.order })) },
        categories: { create: src.categories.map((c: any) => ({ categoryId: c.categoryId })) },
        tags: { create: src.tags.map((t: any) => ({ tagId: t.tagId })) },
      },
      include,
    });

    await audit(req, 'post.duplicated', { entity: 'post', entityId: post.id, meta: { sourceId: id } });
    return reply.status(201).send(formatPost(post));
  });

  // POST /posts/bulk-action — bulk publish/unpublish/delete/feature
  fastify.post('/bulk-action', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { action, postIds } = z.object({
      action: z.enum(['publish', 'unpublish', 'delete', 'feature', 'unfeature']),
      postIds: z.array(z.string()).min(1).max(100),
    }).parse(req.body);

    if (action === 'delete') {
      await prisma.post.deleteMany({ where: { id: { in: postIds } } });
    } else if (action === 'publish') {
      const now = new Date();
      // Set status for all; only set publishedAt for posts that don't already have one
      // (preserves the original ingest/scheduled timestamp)
      await prisma.post.updateMany({
        where: { id: { in: postIds } },
        data: { status: 'published' },
      });
      await prisma.post.updateMany({
        where: { id: { in: postIds }, publishedAt: null },
        data: { publishedAt: now },
      });
      fireWebhook('post.published', { ids: postIds });
    } else if (action === 'unpublish') {
      await prisma.post.updateMany({ where: { id: { in: postIds } }, data: { status: 'draft' } });
    } else if (action === 'feature') {
      await prisma.post.updateMany({ where: { id: { in: postIds } }, data: { isFeatured: true } });
    } else if (action === 'unfeature') {
      await prisma.post.updateMany({ where: { id: { in: postIds } }, data: { isFeatured: false } });
    }

    await audit(req, `post.bulk_${action}`, { meta: { count: postIds.length } });
    return reply.send({ success: true, count: postIds.length });
  });

  // POST /posts/:id/view — increment view count (public, no auth)
  fastify.post('/:id/view', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.post.updateMany({ where: { id, status: 'published' }, data: { viewCount: { increment: 1 } } });
    return reply.send({ success: true });
  });

  // GET /posts/:id/revisions
  fastify.get('/:id/revisions', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const revisions = await prisma.revision.findMany({
      where: { postId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(revisions);
  });

  // POST /posts/:id/restore/:revisionId
  fastify.post('/:id/restore/:revisionId', { preHandler: [authenticate] }, async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const revision = await prisma.revision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.postId !== id) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Revision not found' });
    }

    const current = await prisma.post.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Post not found' });

    await prisma.revision.create({
      data: { postId: id, title: current.title, content: current.content, createdById: req.user!.id },
    });

    const post = await prisma.post.update({
      where: { id },
      data: { title: revision.title, content: revision.content },
      include,
    });

    await audit(req, 'post.revision_restored', { entity: 'post', entityId: id, meta: { revisionId } });
    return reply.send(formatPost(post));
  });
};

export default postsRoutes;
