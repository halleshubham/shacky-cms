import type { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { generateTheme, deleteTheme, listThemes } from '../services/themeGenerator.js';

export default async function themesRoutes(fastify: FastifyInstance) {
  // GET /api/themes — list all themes (public so admin UI can load without auth)
  fastify.get('/api/themes', async (_req, reply) => {
    try {
      const themes = await listThemes();
      return reply.send(themes);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/themes/generate — generate a new theme via AI (admin only)
  fastify.post('/api/themes/generate', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    preHandler: [authenticate, requireAdmin],
  }, async (req, reply) => {
    const { label, prompt } = req.body as { label?: string; prompt?: string };
    if (!label?.trim()) return reply.status(400).send({ error: 'label is required' });
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt is required' });
    try {
      const meta = await generateTheme(label.trim(), prompt.trim());
      return reply.status(201).send(meta);
    } catch (err: any) {
      const status = err.message?.includes('already exists') ? 409
        : err.message?.includes('not configured') ? 422
        : 500;
      return reply.status(status).send({ error: err.message });
    }
  });

  // DELETE /api/themes/:id — remove an AI-generated theme (admin only)
  fastify.delete('/api/themes/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await deleteTheme(id);
      return reply.status(200).send({ deleted: id });
    } catch (err: any) {
      const status = err.message?.includes('built-in') ? 403 : 500;
      return reply.status(status).send({ error: err.message });
    }
  });
}
