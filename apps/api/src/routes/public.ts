import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';

const postInclude = {
  featuredMedia: true,
  authors: { include: { author: true }, orderBy: { order: 'asc' as const } },
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  issue: { select: { id: true, title: true, volumeNumber: true, issueNumber: true, publishDate: true } },
};

function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 238));
}

function fmt(p: any) {
  return {
    ...p,
    authors: p.authors.map((a: any) => a.author),
    categories: p.categories.map((c: any) => c.category),
    tags: p.tags.map((t: any) => t.tag),
    readingTime: readingTime(p.content || ''),
  };
}

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /public/posts — published posts with search, category, tag, author filters
  fastify.get('/posts', async (req, reply) => {
    const q = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().default(12),
      search: z.string().optional(),
      categorySlug: z.string().optional(),
      tagSlug: z.string().optional(),
      authorSlug: z.string().optional(),
      issueId: z.string().optional(),
    }).parse(req.query);

    const skip = (q.page - 1) * q.pageSize;

    const where: any = { status: 'published' };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { excerpt: { contains: q.search, mode: 'insensitive' } },
        { content: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.categorySlug) where.categories = { some: { category: { slug: q.categorySlug } } };
    if (q.tagSlug) where.tags = { some: { tag: { slug: q.tagSlug } } };
    if (q.authorSlug) where.authors = { some: { author: { slug: q.authorSlug } } };
    if (q.issueId) where.issueId = q.issueId;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: postInclude,
        skip,
        take: q.pageSize,
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    return reply.send({
      data: posts.map(fmt),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  });

  // GET /public/posts/:slug — single published post
  fastify.get('/posts/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const post = await prisma.post.findFirst({
      where: { slug, status: 'published' },
      include: postInclude,
    });
    if (!post) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Article not found' });

    // Fetch related posts (same category, not same post)
    const categoryIds = post.categories.map((c: any) => c.categoryId);
    const related = categoryIds.length
      ? await prisma.post.findMany({
          where: {
            status: 'published',
            id: { not: post.id },
            categories: { some: { categoryId: { in: categoryIds } } },
          },
          include: postInclude,
          orderBy: { publishedAt: 'desc' },
          take: 4,
        })
      : [];

    return reply.send({
      ...fmt(post),
      related: related.map(fmt),
    });
  });

  // GET /public/issues — paginated issue list
  fastify.get('/issues', async (req, reply) => {
    const { page = 1, pageSize = 12 } = req.query as any;
    const skip = (Number(page) - 1) * Number(pageSize);
    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        skip,
        take: Number(pageSize),
        orderBy: [{ volumeNumber: 'desc' }, { issueNumber: 'desc' }],
        include: {
          _count: { select: { posts: { where: { status: 'published' } } } },
          posts: {
            where: { status: 'published' },
            orderBy: { issueOrder: 'asc' },
            take: 1,
            include: { featuredMedia: true },
          },
        },
      }),
      prisma.issue.count(),
    ]);
    return reply.send({
      data: issues.map((i) => ({ ...i, postCount: i._count.posts, coverPost: i.posts[0] || null, posts: undefined, _count: undefined })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    });
  });

  // GET /public/issues/latest — most recent issue with all its posts
  fastify.get('/issues/latest', async (_req, reply) => {
    const issue = await prisma.issue.findFirst({
      orderBy: [{ volumeNumber: 'desc' }, { issueNumber: 'desc' }],
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: postInclude,
        },
      },
    });
    if (!issue) return reply.send(null);
    return reply.send({ ...issue, posts: issue.posts.map(fmt) });
  });

  // GET /public/issues/:id — single issue with all published posts
  fastify.get('/issues/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { issueOrder: 'asc' },
          include: postInclude,
        },
      },
    });
    if (!issue) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Issue not found' });
    return reply.send({ ...issue, posts: issue.posts.map(fmt) });
  });

  // GET /public/categories — all categories with published post count
  fastify.get('/categories', async (_req, reply) => {
    const cats = await prisma.category.findMany({
      include: {
        _count: { select: { posts: { where: { post: { status: 'published' } } } } },
        children: { include: { _count: { select: { posts: { where: { post: { status: 'published' } } } } } } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
    return reply.send(cats.map((c) => ({
      ...c,
      postCount: c._count.posts,
      children: c.children.map((ch) => ({ ...ch, postCount: ch._count.posts, _count: undefined })),
      _count: undefined,
    })));
  });

  // GET /public/authors — all authors with published post count
  fastify.get('/authors', async (_req, reply) => {
    const authors = await prisma.author.findMany({
      include: { _count: { select: { posts: { where: { post: { status: 'published' } } } } } },
      orderBy: { displayName: 'asc' },
    });
    return reply.send(authors.map((a) => ({ ...a, postCount: a._count.posts, _count: undefined })));
  });

  // GET /public/authors/:slug — author profile + their published posts
  fastify.get('/authors/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { page = 1, pageSize = 12 } = req.query as any;
    const skip = (Number(page) - 1) * Number(pageSize);

    const author = await prisma.author.findUnique({ where: { slug } });
    if (!author) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Author not found' });

    const where = { status: 'published' as const, authors: { some: { authorId: author.id } } };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip, take: Number(pageSize), orderBy: { publishedAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return reply.send({
      author,
      posts: { data: posts.map(fmt), total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  });

  // GET /public/search?q=... — full-text search across posts
  fastify.get('/search', async (req, reply) => {
    const { q, page = 1, pageSize = 12 } = req.query as any;
    if (!q || String(q).trim().length < 2) {
      return reply.send({ data: [], total: 0, page: 1, pageSize: Number(pageSize), totalPages: 0, query: q });
    }

    const term = String(q).trim();
    const skip = (Number(page) - 1) * Number(pageSize);

    const where = {
      status: 'published' as const,
      OR: [
        { title: { contains: term, mode: 'insensitive' as const } },
        { excerpt: { contains: term, mode: 'insensitive' as const } },
        { content: { contains: term, mode: 'insensitive' as const } },
        { authors: { some: { author: { displayName: { contains: term, mode: 'insensitive' as const } } } } },
        { categories: { some: { category: { name: { contains: term, mode: 'insensitive' as const } } } } },
        { tags: { some: { tag: { name: { contains: term, mode: 'insensitive' as const } } } } },
      ],
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip, take: Number(pageSize), orderBy: { publishedAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return reply.send({
      data: posts.map(fmt),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
      query: term,
    });
  });

  // GET /public/tags — all tags with published post count
  fastify.get('/tags', async (_req, reply) => {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { posts: { where: { post: { status: 'published' } } } } } },
      orderBy: { name: 'asc' },
    });
    return reply.send(tags.map((t) => ({ ...t, postCount: t._count.posts, _count: undefined })));
  });

  // GET /public/tags/:slug — tag profile + published posts
  fastify.get('/tags/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { page = 1, pageSize = 12 } = req.query as any;
    const skip = (Number(page) - 1) * Number(pageSize);

    const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Tag not found' });

    const where = { status: 'published' as const, tags: { some: { tagId: tag.id } } };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({ where, include: postInclude, skip, take: Number(pageSize), orderBy: { publishedAt: 'desc' } }),
      prisma.post.count({ where }),
    ]);

    return reply.send({
      tag,
      posts: { data: posts.map(fmt), total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  });

  // GET /public/featured — featured posts
  fastify.get('/featured', async (req, reply) => {
    const { limit = 6 } = req.query as any;
    const posts = await prisma.post.findMany({
      where: { status: 'published', isFeatured: true },
      include: postInclude,
      orderBy: { publishedAt: 'desc' },
      take: Number(limit),
    });
    return reply.send(posts.map(fmt));
  });

  // GET /public/pages — list published pages (for nav picker + public display)
  fastify.get('/pages', async (_req, reply) => {
    const pages = await prisma.page.findMany({
      where: { status: 'published' },
      select: { id: true, title: true, slug: true, excerpt: true },
      orderBy: { title: 'asc' },
    });
    return reply.send(pages);
  });

  // GET /public/pages/:slug — single published page
  fastify.get('/pages/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const page = await prisma.page.findFirst({
      where: { slug, status: 'published' },
      include: { featuredMedia: true },
    });
    if (!page) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Page not found' });
    return reply.send(page);
  });

  // GET /public/settings — site settings for frontend
  fastify.get('/settings', async (_req, reply) => {
    const keys = ['site_title', 'site_description', 'site_logo', 'site_icon', 'nav_primary', 'nav_secondary'];
    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
    const out: Record<string, any> = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    }
    return reply.send(out);
  });
};

export default publicRoutes;
