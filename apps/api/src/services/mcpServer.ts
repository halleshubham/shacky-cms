import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { env } from '../utils/env.js';
import { searchAllStock, downloadAndStoreStockImage } from './stockSearch.js';
import type { StockPhoto } from './stockSearch.js';
import { generateNewsletterHtml } from './newsletter.js';
import { sendMail } from './email.js';

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

    server.tool(
      'search_stock_images',
      'Search copyright-free stock photos from Unsplash, Pexels, Pixabay, and Wikimedia Commons. Returns image options you can then set as a post\'s featured image.',
      {
        query: z.string().min(1).describe('Search query, e.g. "budget finance economy"'),
        limit: z.number().int().min(1).max(20).optional().describe('Max results to return (default 5)'),
      },
      async ({ query, limit = 5 }) => {
        const results = await searchAllStock(query);
        const photos = results.slice(0, limit).map((p) => ({
          imageUrl: p.fullUrl,
          downloadUrl: p.downloadUrl,
          thumbnailUrl: p.thumbnailUrl,
          alt: p.alt,
          credit: p.credit,
          creditUrl: p.creditUrl,
          source: p.source,
        }));
        if (photos.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No stock images found for that query. Try different keywords.' }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(photos, null, 2) }] };
      },
    );

    server.tool(
      'set_post_featured_image_from_stock',
      'Download a stock photo and set it as the featured image of a post. Use search_stock_images first to find a photo, then pass the imageUrl, downloadUrl, alt, credit, creditUrl, and source fields from that result along with the postId.',
      {
        postId: z.string().describe('ID of the post to update'),
        imageUrl: z.string().url().describe('Full-size image URL from search_stock_images result'),
        downloadUrl: z.string().url().describe('Download URL from search_stock_images result (same as imageUrl for most sources)'),
        alt: z.string().describe('Alt text / description of the image'),
        credit: z.string().describe('Attribution credit string, e.g. "Photo by Jane on Unsplash"'),
        creditUrl: z.string().url().optional().describe('URL to the photographer or source page'),
        source: z.enum(['unsplash', 'pexels', 'pixabay', 'wikimedia']).describe('Stock photo source'),
      },
      async ({ postId, imageUrl, downloadUrl, alt, credit, creditUrl, source }) => {
        const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, slug: true } });
        if (!post) return { content: [{ type: 'text' as const, text: 'Post not found.' }], isError: true };

        const photo: StockPhoto = {
          id: `${source}-mcp`,
          thumbnailUrl: imageUrl,
          fullUrl: imageUrl,
          downloadUrl,
          alt,
          credit,
          creditUrl,
          source,
        };

        const result = await downloadAndStoreStockImage(photo, userId, source);
        if (!result) {
          return { content: [{ type: 'text' as const, text: 'Failed to download or store the image. The URL may be invalid or the source rate-limited.' }], isError: true };
        }

        await prisma.post.update({
          where: { id: postId },
          data: { featuredMediaId: result.mediaId },
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              mediaId: result.mediaId,
              imageUrl: result.url,
              postUrl: `${env.APP_URL}/articles/${post.slug}`,
            }, null, 2),
          }],
        };
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

    server.tool(
      'list_subscriber_lists',
      'List all subscriber lists with their member counts.',
      {},
      async () => {
        const lists = await prisma.subscriberList.findMany({
          include: { _count: { select: { members: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(lists.map((l) => ({ id: l.id, name: l.name, description: l.description, memberCount: l._count.members, createdAt: l.createdAt })), null, 2),
          }],
        };
      },
    );
  }

  // ── Stats (posts:read) ────────────────────────────────────────────────────
  if (can('posts:read')) {
    server.tool(
      'get_stats',
      'Get dashboard statistics: post counts by status, total issues, subscribers, campaigns, and top/recent content.',
      {},
      async () => {
        const [postCounts, totalIssues, activeSubscribers, totalCampaigns, sentCampaigns, topPosts, recentIssues] = await Promise.all([
          prisma.post.groupBy({ by: ['status'], _count: true }),
          prisma.issue.count(),
          prisma.subscriber.count({ where: { status: 'active' } }),
          prisma.campaign.count(),
          prisma.campaign.count({ where: { status: 'sent' } }),
          prisma.post.findMany({ take: 5, where: { status: 'published' }, orderBy: { viewCount: 'desc' }, select: { id: true, title: true, slug: true, viewCount: true } }),
          prisma.issue.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, volumeNumber: true, issueNumber: true, publishDate: true } }),
        ]);
        const counts: Record<string, number> = {};
        for (const r of postCounts) counts[r.status] = r._count;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ posts: { published: counts.published || 0, draft: counts.draft || 0, scheduled: counts.scheduled || 0 }, issues: { total: totalIssues }, subscribers: { active: activeSubscribers }, campaigns: { total: totalCampaigns, sent: sentCampaigns }, topPosts, recentIssues }, null, 2),
          }],
        };
      },
    );

    server.tool(
      'list_authors',
      'List all authors in the CMS. Use their IDs when creating or updating posts.',
      { limit: z.number().int().min(1).max(100).optional().describe('Max results (default 50)') },
      async ({ limit = 50 }) => {
        const authors = await prisma.author.findMany({
          orderBy: { displayName: 'asc' },
          take: limit,
          select: { id: true, slug: true, displayName: true, bio: true, email: true },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(authors, null, 2) }] };
      },
    );

    server.tool(
      'list_issues',
      'List magazine/newsletter issues with their post counts.',
      {
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)'),
        type: z.enum(['print', 'blog', 'combined']).optional().describe('Filter by issue type'),
      },
      async ({ limit = 20, type }) => {
        const issues = await prisma.issue.findMany({
          where: type ? { type: type as any } : undefined,
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: { _count: { select: { posts: true } } },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(issues.map((i) => ({ id: i.id, title: i.title, volumeNumber: i.volumeNumber, issueNumber: i.issueNumber, type: i.type, publishDate: i.publishDate, postCount: i._count.posts })), null, 2),
          }],
        };
      },
    );

    server.tool(
      'get_issue',
      'Get a single issue with all its posts listed.',
      { id: z.string().describe('Issue ID') },
      async ({ id }) => {
        const issue = await prisma.issue.findUnique({
          where: { id },
          include: {
            posts: {
              orderBy: { issueOrder: 'asc' },
              select: { id: true, title: true, slug: true, status: true, issueOrder: true, authors: { select: { author: { select: { displayName: true } } } } },
            },
          },
        });
        if (!issue) return { content: [{ type: 'text' as const, text: 'Issue not found.' }], isError: true };
        return { content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }] };
      },
    );

    server.tool(
      'list_pages',
      'List CMS pages.',
      { limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)') },
      async ({ limit = 20 }) => {
        const pages = await prisma.page.findMany({
          orderBy: { updatedAt: 'desc' },
          take: limit,
          select: { id: true, title: true, slug: true, status: true, updatedAt: true },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(pages, null, 2) }] };
      },
    );
  }

  // ── Issues & Pages write (posts:write) ────────────────────────────────────
  if (can('posts:write')) {
    server.tool(
      'create_issue',
      'Create a new magazine/newsletter issue.',
      {
        title: z.string().min(1).describe('Issue title'),
        volumeNumber: z.number().int().min(1).describe('Volume number'),
        issueNumber: z.number().int().min(1).describe('Issue number'),
        type: z.enum(['print', 'blog', 'combined']).optional().describe('Issue type (default: blog)'),
        publishDate: z.string().describe('ISO 8601 publish date (required)'),
      },
      async ({ title, volumeNumber, issueNumber, type = 'blog', publishDate }) => {
        const issue = await prisma.issue.create({
          data: { title, volumeNumber, issueNumber, type: type as any, publishDate: new Date(publishDate) },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(issue, null, 2) }] };
      },
    );

    server.tool(
      'assign_posts_to_issue',
      'Attach one or more posts to an issue by their IDs.',
      {
        issueId: z.string().describe('Issue ID to attach posts to'),
        postIds: z.array(z.string()).min(1).describe('Array of post IDs to attach'),
      },
      async ({ issueId, postIds }) => {
        const issue = await prisma.issue.findUnique({ where: { id: issueId } });
        if (!issue) return { content: [{ type: 'text' as const, text: 'Issue not found.' }], isError: true };
        const maxAgg = await prisma.post.aggregate({ where: { issueId }, _max: { issueOrder: true } });
        let nextOrder = (maxAgg._max.issueOrder ?? 0) + 1;
        await Promise.all(postIds.map((id) => prisma.post.update({ where: { id }, data: { issueId, issueOrder: nextOrder++ } })));
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, issueId, attached: postIds.length }, null, 2) }] };
      },
    );

    server.tool(
      'publish_issue',
      'Bulk-publish all draft/scheduled posts in an issue and set their publishedAt to now.',
      { issueId: z.string().describe('Issue ID') },
      async ({ issueId }) => {
        const issue = await prisma.issue.findUnique({ where: { id: issueId } });
        if (!issue) return { content: [{ type: 'text' as const, text: 'Issue not found.' }], isError: true };
        const result = await prisma.post.updateMany({
          where: { issueId, status: { in: ['draft', 'scheduled'] } },
          data: { status: 'published', publishedAt: new Date() },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, published: result.count, issueId }, null, 2) }] };
      },
    );

    server.tool(
      'create_category',
      'Create a new post category.',
      {
        name: z.string().min(1).describe('Category name'),
        slug: z.string().optional().describe('URL slug (auto-generated if omitted)'),
        description: z.string().optional().describe('Category description'),
      },
      async ({ name, slug, description }) => {
        const s = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const cat = await prisma.category.create({ data: { name, slug: s, description } });
        return { content: [{ type: 'text' as const, text: JSON.stringify(cat, null, 2) }] };
      },
    );

    server.tool(
      'create_tag',
      'Create a new post tag.',
      {
        name: z.string().min(1).describe('Tag name'),
        slug: z.string().optional().describe('URL slug (auto-generated if omitted)'),
      },
      async ({ name, slug }) => {
        const s = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const tag = await prisma.tag.create({ data: { name, slug: s } });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag, null, 2) }] };
      },
    );

    server.tool(
      'create_page',
      'Create a new CMS page.',
      {
        title: z.string().min(1).describe('Page title'),
        slug: z.string().min(1).describe('URL slug'),
        content: z.string().optional().describe('HTML content'),
        status: z.enum(['draft', 'published']).optional().describe('Page status (default: draft)'),
      },
      async ({ title, slug, content = '', status = 'draft' }) => {
        const page = await prisma.page.create({ data: { title, slug, content, status } });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...page, url: `${env.APP_URL}/${page.slug}` }, null, 2) }] };
      },
    );

    server.tool(
      'update_page',
      'Update an existing page title, content, or status.',
      {
        id: z.string().describe('Page ID'),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(['draft', 'published']).optional(),
      },
      async ({ id, ...fields }) => {
        const data: Record<string, unknown> = {};
        if (fields.title !== undefined) data.title = fields.title;
        if (fields.content !== undefined) data.content = fields.content;
        if (fields.status !== undefined) data.status = fields.status;
        const page = await prisma.page.update({ where: { id }, data, select: { id: true, title: true, slug: true, status: true, updatedAt: true } });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...page, url: `${env.APP_URL}/${page.slug}` }, null, 2) }] };
      },
    );
  }

  // ── Campaigns (campaigns:read / campaigns:write) ───────────────────────────
  if (can('campaigns:read')) {
    server.tool(
      'list_campaigns',
      'List email/newsletter campaigns with their status and send counts.',
      { limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)') },
      async ({ limit = 20 }) => {
        const campaigns = await prisma.campaign.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: {
            issue: { select: { title: true, volumeNumber: true, issueNumber: true } },
            subscriberList: { select: { name: true, _count: { select: { members: true } } } },
          },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              issue: c.issue,
              subscriberList: { name: c.subscriberList?.name, memberCount: c.subscriberList?._count.members },
              sentCount: c.sentCount,
              sentAt: c.sentAt,
              scheduledAt: c.scheduledAt,
            })), null, 2),
          }],
        };
      },
    );
  }

  if (can('campaigns:write')) {
    server.tool(
      'create_campaign',
      'Create a new campaign linking an issue to a subscriber list.',
      {
        name: z.string().min(1).describe('Campaign name'),
        issueId: z.string().describe('Issue ID to send'),
        subscriberListId: z.string().describe('Subscriber list ID to send to'),
        scheduledAt: z.string().optional().describe('ISO 8601 datetime to schedule (optional)'),
      },
      async ({ name, issueId, subscriberListId, scheduledAt }) => {
        const campaign = await prisma.campaign.create({
          data: { name, issueId, subscriberListId, scheduledAt: scheduledAt ? new Date(scheduledAt) : null },
          include: { issue: { select: { title: true } }, subscriberList: { select: { name: true } } },
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(campaign, null, 2) }] };
      },
    );

    server.tool(
      'send_campaign_test',
      'Send a test email for a campaign to a specific address before sending to the full list.',
      {
        campaignId: z.string().describe('Campaign ID'),
        email: z.string().email().describe('Email address to send the test to'),
      },
      async ({ campaignId, email }) => {
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { issue: { include: { posts: { include: { authors: { include: { author: true } }, categories: { include: { category: true } }, tags: { include: { tag: true } }, featuredMedia: true } } } } } });
        if (!campaign) return { content: [{ type: 'text' as const, text: 'Campaign not found.' }], isError: true };
        const html = await generateNewsletterHtml(campaign.issue as any, { subscriberToken: 'preview' });
        await sendMail({ to: email, subject: `[TEST] ${campaign.issue.title}`, html });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, sentTo: email, subject: `[TEST] ${campaign.issue.title}` }, null, 2) }] };
      },
    );

    server.tool(
      'send_campaign',
      'Send a campaign to all subscribers on the list. This delivers real emails — confirm with the user before calling this.',
      { campaignId: z.string().describe('Campaign ID to send') },
      async ({ campaignId }) => {
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { issue: { include: { posts: { include: { authors: { include: { author: true } }, categories: { include: { category: true } }, tags: { include: { tag: true } }, featuredMedia: true } } } } } });
        if (!campaign) return { content: [{ type: 'text' as const, text: 'Campaign not found.' }], isError: true };
        if (campaign.status === 'sent') return { content: [{ type: 'text' as const, text: 'Campaign already sent.' }], isError: true };

        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'sending' } });

        const subscribers = await prisma.subscriber.findMany({
          where: { status: 'active', channels: { in: ['email', 'both'] }, lists: { some: { listId: campaign.subscriberListId } }, email: { not: null } },
        });

        let sent = 0;
        for (const sub of subscribers) {
          try {
            const html = await generateNewsletterHtml(campaign.issue as any, { subscriberToken: sub.unsubscribeToken });
            await sendMail({ to: sub.email!, subject: campaign.issue.title, html });
            sent++;
          } catch { /* continue on per-subscriber failure */ }
        }

        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'sent', sentAt: new Date(), sentCount: sent } });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, sent, total: subscribers.length }, null, 2) }] };
      },
    );
  }

  return server;
}
