import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

// Public site settings keys (returned without auth)
const PUBLIC_KEYS = [
  'site_title', 'site_description', 'site_logo', 'site_icon',
  'site_cover', 'site_lang', 'nav_primary', 'nav_secondary',
  'code_injection_head', 'code_injection_foot',
  'translation_enabled', 'translation_languages',
  'tts_enabled', 'tts_language',
];

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /settings/public — no auth required (used by public frontend)
  fastify.get('/public', async (_req, reply) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    // Parse nav JSON
    if (out.nav_primary) { try { out.nav_primary = JSON.parse(out.nav_primary); } catch { /* keep raw */ } }
    if (out.nav_secondary) { try { out.nav_secondary = JSON.parse(out.nav_secondary); } catch { /* keep raw */ } }
    return reply.send(out);
  });

  // GET /settings — all settings, admin only
  fastify.get('/', { preHandler: [authenticate, requireAdmin] }, async (_req, reply) => {
    const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return reply.send(out);
  });

  // PATCH /settings — upsert multiple settings
  fastify.patch('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = z.record(z.string()).parse(req.body);
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
    );
    return reply.send({ success: true });
  });

  // DELETE /settings/:key — remove a setting
  fastify.delete('/:key', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { key } = req.params as { key: string };
    await prisma.setting.deleteMany({ where: { key } });
    return reply.send({ success: true });
  });

  // GET /settings/counts — row counts for every purgeable entity
  fastify.get('/counts', { preHandler: [authenticate, requireAdmin] }, async (_req, reply) => {
    const [posts, issues, categories, tags, authors, media, subscribers] = await Promise.all([
      prisma.post.count(),
      prisma.issue.count(),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.author.count(),
      prisma.media.count(),
      prisma.subscriber.count(),
    ]);
    return reply.send({ posts, issues, categories, tags, authors, media, subscribers });
  });

  // POST /settings/purge — bulk delete all records of a given entity type
  fastify.post('/purge', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { entity } = z.object({
      entity: z.enum(['posts', 'issues', 'categories', 'tags', 'authors', 'media', 'subscribers']),
    }).parse(req.body);

    let count = 0;

    switch (entity) {
      case 'posts': {
        // PostAuthor / PostCategory / PostTag / Revision cascade from Post
        const r = await prisma.post.deleteMany();
        count = r.count;
        break;
      }
      case 'issues': {
        await prisma.post.updateMany({ data: { issueId: null } });
        const r = await prisma.issue.deleteMany();
        count = r.count;
        break;
      }
      case 'categories': {
        await prisma.postCategory.deleteMany();
        const r = await prisma.category.deleteMany();
        count = r.count;
        break;
      }
      case 'tags': {
        await prisma.postTag.deleteMany();
        const r = await prisma.tag.deleteMany();
        count = r.count;
        break;
      }
      case 'authors': {
        await prisma.postAuthor.deleteMany();
        const r = await prisma.author.deleteMany();
        count = r.count;
        break;
      }
      case 'media': {
        await prisma.post.updateMany({ data: { featuredMediaId: null } });
        await prisma.page.updateMany({ data: { featuredMediaId: null } });
        const r = await prisma.media.deleteMany();
        count = r.count;
        break;
      }
      case 'subscribers': {
        await prisma.subscriberListMember.deleteMany();
        const r = await prisma.subscriber.deleteMany();
        count = r.count;
        break;
      }
    }

    return reply.send({ deleted: count });
  });
};

export default settingsRoutes;
