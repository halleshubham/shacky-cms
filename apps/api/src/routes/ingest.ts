import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { previewIngestion, ingestIssue } from '../services/docxIngestion.js';
import { prisma } from '../plugins/prisma.js';
import { getAIConfig } from '../services/ai.js';
import { audit } from '../utils/audit.js';
import { ingestQueue } from '../jobs/ingestQueue.js';

function parseAiOptions(raw: string) {
  try {
    const v = JSON.parse(raw);
    return {
      generateImage: !!v.generateImage,
      mapCategories: !!v.mapCategories,
      generateTags: !!v.generateTags,
      searchStockImage: !!v.searchStockImage,
    };
  } catch {
    return undefined;
  }
}

function hasAnyEnhancement(opts: ReturnType<typeof parseAiOptions>): boolean {
  if (!opts) return false;
  return !!(opts.generateImage || opts.mapCategories || opts.generateTags || opts.searchStockImage);
}

const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /ingest/ai-status — whether AI is configured and image-capable
  fastify.get('/ai-status', { preHandler: [authenticate] }, async (_req, reply) => {
    const config = await getAIConfig();
    const supportsImages = config?.provider === 'openai' || config?.provider === 'gemini';
    return reply.send({ configured: !!config, supportsImages });
  });

  // POST /ingest/preview — upload ZIP and get article list preview
  fastify.post('/preview', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const data = await req.file({ limits: { fileSize: 500 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file' });
    if (!data.filename.endsWith('.zip')) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Must be a ZIP file' });
    }

    const buffer = await data.toBuffer();
    const preview = await previewIngestion(buffer);
    return reply.send(preview);
  });

  // POST /ingest — perform actual ingestion into an existing issue
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const parts = req.parts();
    let zipBuffer: Buffer | null = null;
    let issueId = '';
    let publishHour = 1;
    let aiOptions: ReturnType<typeof parseAiOptions>;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        zipBuffer = Buffer.from(await part.toBuffer());
      } else if (part.type === 'field') {
        const v = part.value as string;
        if (part.fieldname === 'issueId') issueId = v;
        if (part.fieldname === 'publishHour') publishHour = parseInt(v) || 1;
        if (part.fieldname === 'aiOptions') aiOptions = parseAiOptions(v);
      }
    }

    if (!zipBuffer) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No ZIP file' });
    if (!issueId) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'issueId required' });

    const { created, warnings, postsForAI } = await ingestIssue(zipBuffer, {
      issueId,
      categoryIds: [],
      publishHour,
      uploadedById: req.user!.id,
      aiOptions: undefined, // Phase 1 only; enhancements go to queue below
    });

    let jobId: string | undefined;
    if (hasAnyEnhancement(aiOptions) && postsForAI.length > 0) {
      const job = await ingestQueue.add('enhance', {
        issueId,
        posts: postsForAI,
        aiOptions: aiOptions!,
        uploadedById: req.user!.id,
      });
      jobId = job.id;
    }

    await audit(req, 'ingest.completed', {
      entity: 'issue',
      entityId: issueId,
      meta: { created, warnings: warnings.length, jobId },
    });

    return reply.send({ created, warnings, jobId });
  });

  // POST /ingest/issue — create issue + ingest ZIP in one step
  fastify.post('/issue', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const parts = req.parts({ limits: { fileSize: 500 * 1024 * 1024 } });
    let zipBuffer: Buffer | null = null;
    let volumeNumber = 0;
    let issueNumber = 0;
    let title = '';
    let publishDate = '';
    let type: 'print' | 'blog' | 'combined' = 'combined';
    let publishHour = 1;
    let aiOptions: ReturnType<typeof parseAiOptions>;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        zipBuffer = Buffer.from(await part.toBuffer());
      } else if (part.type === 'field') {
        const v = part.value as string;
        if (part.fieldname === 'volumeNumber') volumeNumber = parseInt(v) || 0;
        if (part.fieldname === 'issueNumber') issueNumber = parseInt(v) || 0;
        if (part.fieldname === 'title') title = v;
        if (part.fieldname === 'publishDate') publishDate = v;
        if (part.fieldname === 'type') type = (v as any) || 'combined';
        if (part.fieldname === 'publishHour') publishHour = parseInt(v) || 1;
        if (part.fieldname === 'aiOptions') aiOptions = parseAiOptions(v);
      }
    }

    if (!zipBuffer) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No ZIP file' });
    if (!volumeNumber || !issueNumber) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'volumeNumber and issueNumber required' });
    if (!publishDate) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'publishDate required' });

    const parsedSchema = z.object({
      volumeNumber: z.number().int().positive(),
      issueNumber: z.number().int().positive(),
      type: z.enum(['print', 'blog', 'combined']),
    }).parse({ volumeNumber, issueNumber, type });

    const existing = await prisma.issue.findFirst({
      where: { volumeNumber: parsedSchema.volumeNumber, issueNumber: parsedSchema.issueNumber },
    });
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: `Vol. ${parsedSchema.volumeNumber}, No. ${parsedSchema.issueNumber} already exists (issue ID: ${existing.id}). Update the issue number or ingest into the existing issue from its detail page.`,
      });
    }

    const issue = await prisma.issue.create({
      data: {
        volumeNumber: parsedSchema.volumeNumber,
        issueNumber: parsedSchema.issueNumber,
        title: title || `Vol. ${volumeNumber}, No. ${issueNumber}`,
        publishDate: new Date(publishDate),
        type: parsedSchema.type,
      },
    });

    // Phase 1: create articles from ZIP (synchronous — must finish before we respond)
    const { created, warnings, postsForAI } = await ingestIssue(zipBuffer, {
      issueId: issue.id,
      categoryIds: [],
      publishHour,
      uploadedById: req.user!.id,
      aiOptions: undefined, // Phase 1 only
    });

    // Phase 2: enqueue AI/stock enhancements as a background job
    let jobId: string | undefined;
    if (hasAnyEnhancement(aiOptions) && postsForAI.length > 0) {
      const job = await ingestQueue.add('enhance', {
        issueId: issue.id,
        posts: postsForAI,
        aiOptions: aiOptions!,
        uploadedById: req.user!.id,
      });
      jobId = job.id;
    }

    await audit(req, 'ingest.completed', {
      entity: 'issue',
      entityId: issue.id,
      meta: { created, warnings: warnings.length, jobId },
    });

    return reply.status(201).send({
      issueId: issue.id,
      title: issue.title,
      created,
      warnings,
      jobId,
    });
  });

  // GET /ingest/job/:jobId — check enhancement job status
  fastify.get('/job/:jobId', { preHandler: [authenticate] }, async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const job = await ingestQueue.getJob(jobId);
    if (!job) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Job not found' });

    const state = await job.getState();
    const result = job.returnvalue as { warnings: string[] } | undefined;

    return reply.send({
      jobId: job.id,
      state,
      warnings: result?.warnings ?? [],
      failReason: job.failedReason ?? undefined,
    });
  });
};

export default ingestRoutes;
