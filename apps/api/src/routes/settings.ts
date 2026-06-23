import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

// Public site settings keys (returned without auth)
const PUBLIC_KEYS = [
  'site_title', 'site_description', 'site_logo', 'site_icon',
  'site_cover', 'site_lang', 'nav_primary', 'nav_secondary',
  'code_injection_head', 'code_injection_foot',
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
};

export default settingsRoutes;
