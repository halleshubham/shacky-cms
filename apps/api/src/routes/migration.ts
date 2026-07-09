import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  testWPConnection,
  runMigration,
  importAuthorsFromPosts,
  getProgress,
  cancelJob,
} from '../services/wordpress.js';

const wpConfigSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});

const migrationRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /migration/wordpress/test — verify credentials + return content counts
  fastify.post('/wordpress/test', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const cfg = wpConfigSchema.parse(req.body);
    try {
      const result = await testWPConnection(cfg);
      return reply.send(result);
    } catch (e: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Connection Failed', message: e.message });
    }
  });

  // POST /migration/wordpress/start — kick off migration job
  fastify.post('/wordpress/start', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = z.object({
      ...wpConfigSchema.shape,
      options: z.object({
        importCategories: z.boolean().default(true),
        importTags: z.boolean().default(true),
        importAuthors: z.boolean().default(true),
        importPosts: z.boolean().default(true),
        postStatus: z.enum(['all', 'publish', 'draft']).default('all'),
        skipExisting: z.boolean().default(false),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        groupByDate: z.boolean().default(false),
        firstVolumeNumber: z.number().int().positive().optional(),
        firstIssueNumber: z.number().int().positive().optional(),
        issuesPerVolume: z.number().int().positive().default(52),
      }).default({}),
    }).parse(req.body);

    const user = (req as any).user;
    const jobId = createId();

    // Run in background — don't await
    setImmediate(() => {
      runMigration(
        { baseUrl: body.baseUrl, username: body.username, appPassword: body.appPassword },
        body.options,
        jobId,
        user.id,
      ).catch((e) => fastify.log.error({ err: e }, 'Migration job crashed'));
    });

    return reply.status(202).send({ jobId });
  });

  // GET /migration/wordpress/status/:jobId — poll progress
  fastify.get('/wordpress/status/:jobId', { preHandler: [authenticate] }, async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const progress = getProgress(jobId);
    if (!progress) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Job not found' });
    return reply.send(progress);
  });

  // POST /migration/wordpress/authors — import authors via embedded post data
  // Works even when the WP site blocks /wp/v2/users (security plugins, etc.)
  fastify.post('/wordpress/authors', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const cfg = wpConfigSchema.parse(req.body);
    const jobId = createId();
    setImmediate(() => {
      importAuthorsFromPosts(cfg, jobId).catch((e) =>
        fastify.log.error({ err: e }, 'Author import job crashed'),
      );
    });
    return reply.status(202).send({ jobId });
  });

  // DELETE /migration/wordpress/job/:jobId — cancel running job
  fastify.delete('/wordpress/job/:jobId', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    cancelJob(jobId);
    return reply.send({ ok: true });
  });
};

export default migrationRoutes;
