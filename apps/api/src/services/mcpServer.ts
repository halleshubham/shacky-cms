import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { env } from '../utils/env.js';

export function createMcpServer(prisma: PrismaClient, userId: string, scopes: string[]): McpServer {
  const server = new McpServer({
    name: 'shacky-cms',
    version: '1.0.0',
  });

  const can = (scope: string) => scopes.includes(scope);

  // ── Site info (always available) ──────────────────────────────────────────
  server.tool(
    'get_site_info',
    'Get the CMS site name, description, and basic statistics.',
    {},
    async () => {
      const [settings, postCount, subscriberCount] = await Promise.all([
        prisma.setting.findMany({ where: { key: { in: ['site_title', 'site_description'] } } }),
        prisma.post.count({ where: { status: 'published' } }),
        prisma.subscriber.count({ where: { status: 'active' } }),
      ]);
      const info: Record<string, unknown> = {
        publishedPosts: postCount,
        activeSubscribers: subscriberCount,
      };
      for (const s of settings) info[s.key] = s.value;
      return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
    },
  );

  // ── Posts (posts:read) ────────────────────────────────────────────────────
  if (can('posts:read')) {
    server.tool(
      'list_posts',
      'List posts from the CMS with optional filters.',
      {
        status: z.enum(['draft', 'published', 'scheduled']).optional().describe('Filter by post status'),
        search: z.string().optional().describe('Search in title or excerpt'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)'),
      },
      async ({ status, search, limit = 20 }) => {
        const posts = await prisma.post.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(search
              ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { excerpt: { contains: search, mode: 'insensitive' } }] }
              : {}),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
            excerpt: true,
            authors: { select: { author: { select: { displayName: true } } } },
            categories: { select: { category: { select: { name: true } } } },
            tags: { select: { tag: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        const rows = posts.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          url: `${env.APP_URL}/articles/${p.slug}`,
          status: p.status,
          publishedAt: p.publishedAt,
          excerpt: p.excerpt,
          authors: p.authors.map((a) => a.author.displayName),
          categories: p.categories.map((c) => c.category.name),
          tags: p.tags.map((t) => t.tag.name),
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
      },
    );

    server.tool(
      'get_post',
      'Get a single post by its ID or slug, including full content.',
      {
        id: z.string().optional().describe('Post ID'),
        slug: z.string().optional().describe('Post slug'),
      },
      async ({ id, slug }) => {
        if (!id && !slug) {
          return { content: [{ type: 'text' as const, text: 'Provide either id or slug.' }], isError: true };
        }
        const post = await prisma.post.findFirst({
          where: id ? { id } : { slug: slug! },
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
            tags: { include: { tag: true } },
            featuredMedia: true,
          },
        });
        if (!post) return { content: [{ type: 'text' as const, text: 'Post not found.' }], isError: true };
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...post, url: `${env.APP_URL}/articles/${post.slug}` }, null, 2) }] };
      },
    );

    server.tool(
      'list_categories',
      'List all categories in the CMS.',
      {},
      async () => {
        const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        return { content: [{ type: 'text' as const, text: JSON.stringify(cats, null, 2) }] };
      },
    );

    server.tool(
      'list_tags',
      'List all tags in the CMS.',
      {},
      async () => {
        const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tags, null, 2) }] };
      },
    );
  }

  // ── Posts write (posts:write) ─────────────────────────────────────────────
  if (can('posts:write')) {
    server.tool(
      'create_post',
      'Create a new draft post in the CMS.',
      {
        title: z.string().min(1).describe('Post title'),
        content: z.string().optional().describe('HTML or markdown content'),
        excerpt: z.string().optional().describe('Short excerpt'),
        slug: z.string().optional().describe('URL slug (auto-generated if omitted)'),
        categoryIds: z.array(z.string()).optional().describe('Category IDs to assign'),
        tagIds: z.array(z.string()).optional().describe('Tag IDs to assign'),
      },
      async ({ title, content, excerpt, slug, categoryIds = [], tagIds = [] }) => {
        const generatedSlug =
          slug ||
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const post = await prisma.post.create({
          data: {
            title,
            slug: generatedSlug,
            content: content ?? '',
            excerpt,
            status: 'draft',
            categories: { create: categoryIds.map((categoryId) => ({ category: { connect: { id: categoryId } } })) },
            tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
          },
          select: { id: true, title: true, slug: true, status: true },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...post, url: `${env.APP_URL}/articles/${post.slug}` }, null, 2) }] };
      },
    );

    server.tool(
      'update_post',
      'Update an existing post title, content, excerpt, or status.',
      {
        id: z.string().describe('Post ID'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New HTML content'),
        excerpt: z.string().optional().describe('New excerpt'),
        status: z.enum(['draft', 'published', 'scheduled']).optional().describe('New status'),
      },
      async ({ id, ...fields }) => {
        const data: Record<string, unknown> = {};
        if (fields.title !== undefined) data.title = fields.title;
        if (fields.content !== undefined) data.content = fields.content;
        if (fields.excerpt !== undefined) data.excerpt = fields.excerpt;
        if (fields.status !== undefined) {
          data.status = fields.status;
          if (fields.status === 'published') data.publishedAt = new Date();
        }
        const post = await prisma.post.update({
          where: { id },
          data,
          select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...post, url: `${env.APP_URL}/articles/${post.slug}` }, null, 2) }] };
      },
    );
  }

  // ── Media (media:read) ────────────────────────────────────────────────────
  if (can('media:read')) {
    server.tool(
      'list_media',
      'List media files in the CMS library.',
      {
        search: z.string().optional().describe('Search by filename or alt text'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)'),
      },
      async ({ search, limit = 20 }) => {
        const media = await prisma.media.findMany({
          where: search
            ? { OR: [{ filename: { contains: search, mode: 'insensitive' } }, { altText: { contains: search, mode: 'insensitive' } }] }
            : {},
          select: { id: true, filename: true, url: true, mimeType: true, size: true, altText: true, width: true, height: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(media, null, 2) }] };
      },
    );
  }

  // ── Subscribers (subscribers:read) ────────────────────────────────────────
  if (can('subscribers:read')) {
    server.tool(
      'list_subscribers',
      'List active subscribers with optional channel filter.',
      {
        channel: z.enum(['email', 'whatsapp', 'both']).optional().describe('Filter by channel'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default 50)'),
      },
      async ({ channel, limit = 50 }) => {
        const subs = await prisma.subscriber.findMany({
          where: { status: 'active', ...(channel ? { channels: channel as any } : {}) },
          select: { id: true, email: true, phone: true, name: true, channels: true, subscribedAt: true },
          orderBy: { subscribedAt: 'desc' },
          take: limit,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(subs, null, 2) }] };
      },
    );
  }

  return server;
}
