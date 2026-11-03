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

// For listing/search responses (cards only — title, excerpt, image, meta): drops
// the full article HTML body and other detail-only fields that the list UI never
// renders. readingTime is still computed from content before it's stripped.
function fmtList(p: any) {
  const { content, seoTitle, seoDescription, codeInjectionHead, codeInjectionFoot, ...rest } = fmt(p);
  return rest;
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
      data: posts.map(fmtList),
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
      related: related.map(fmtList),
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
    return reply.send({ ...issue, posts: issue.posts.map(fmtList) });
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
    return reply.send({ ...issue, posts: issue.posts.map(fmtList) });
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
      posts: { data: posts.map(fmtList), total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  });

  // GET /public/search?q=... — full-text search across posts
  //
  // Written as a UNION of single-predicate sub-selects rather than one
  // `status = published AND (a OR b OR c OR EXISTS(...) OR ...)` clause.
  // Postgres can give each branch its own cheap index scan (a trgm GIN
  // index for title/excerpt/content, a join starting from the few matching
  // authors/categories/tags for the relation branches) and UNION dedupes
  // the post ids for free. The combined-OR form forced a full sequential
  // scan of every published post for the count() query (no LIMIT to let it
  // stop early via the publishedAt index), decompressing the TOASTed
  // content column for thousands of non-matching rows just to evaluate the
  // filter — multi-second on production despite the trgm indexes existing.
  fastify.get('/search', async (req, reply) => {
    const { q, page = 1, pageSize = 12 } = req.query as any;
    if (!q || String(q).trim().length < 2) {
      return reply.send({ data: [], total: 0, page: 1, pageSize: Number(pageSize), totalPages: 0, query: q });
    }

    const term = String(q).trim();
    const skip = (Number(page) - 1) * Number(pageSize);

    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM posts WHERE status = 'published' AND title ILIKE '%' || ${term} || '%'
      UNION
      SELECT id FROM posts WHERE status = 'published' AND excerpt ILIKE '%' || ${term} || '%'
      UNION
      SELECT id FROM posts WHERE status = 'published' AND content ILIKE '%' || ${term} || '%'
      UNION
      SELECT p.id FROM posts p
        JOIN post_authors pa ON pa."postId" = p.id
        JOIN authors a ON a.id = pa."authorId"
        WHERE p.status = 'published' AND a."displayName" ILIKE '%' || ${term} || '%'
      UNION
      SELECT p.id FROM posts p
        JOIN post_categories pc ON pc."postId" = p.id
        JOIN categories c ON c.id = pc."categoryId"
        WHERE p.status = 'published' AND c.name ILIKE '%' || ${term} || '%'
      UNION
      SELECT p.id FROM posts p
        JOIN post_tags pt ON pt."postId" = p.id
        JOIN tags t ON t.id = pt."tagId"
        WHERE p.status = 'published' AND t.name ILIKE '%' || ${term} || '%'
    `;
    const total = matches.length;
    if (total === 0) {
      return reply.send({ data: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0, query: term });
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: matches.map((m) => m.id) } },
      include: postInclude,
      skip,
      take: Number(pageSize),
      orderBy: { publishedAt: 'desc' },
    });

    return reply.send({
      data: posts.map(fmtList),
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
      posts: { data: posts.map(fmtList), total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
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
    return reply.send(posts.map(fmtList));
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
