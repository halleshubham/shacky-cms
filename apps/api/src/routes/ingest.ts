import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { previewIngestion, ingestIssue } from '../services/docxIngestion.js';
import { prisma } from '../plugins/prisma.js';
import { audit } from '../utils/audit.js';

const ingestRoutes: FastifyPluginAsync = async (fastify) => {
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

  // POST /ingest — perform actual ingestion
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const parts = req.parts();
    let zipBuffer: Buffer | null = null;
    let issueId = '';
    let categoryIds: string[] = [];
    let publishHour = 1;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        zipBuffer = await part.toBuffer();
      } else if (part.type === 'field') {
        if (part.fieldname === 'issueId') issueId = part.value as string;
        if (part.fieldname === 'categoryIds') {
          try { categoryIds = JSON.parse(part.value as string); } catch {}
        }
        if (part.fieldname === 'publishHour') publishHour = parseInt(part.value as string) || 1;
      }
    }

    if (!zipBuffer) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No ZIP file' });
    if (!issueId) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'issueId required' });

    const result = await ingestIssue(zipBuffer, {
      issueId,
      categoryIds,
      publishHour,
      uploadedById: req.user!.id,
    });

    await audit(req, 'ingest.completed', {
      entity: 'issue',
      entityId: issueId,
      meta: { created: result.created, warnings: result.warnings.length },
    });

    return reply.send(result);
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
    let categoryIds: string[] = [];
    let publishHour = 1;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        zipBuffer = await part.toBuffer();
      } else if (part.type === 'field') {
        const v = part.value as string;
        if (part.fieldname === 'volumeNumber') volumeNumber = parseInt(v) || 0;
        if (part.fieldname === 'issueNumber') issueNumber = parseInt(v) || 0;
        if (part.fieldname === 'title') title = v;
        if (part.fieldname === 'publishDate') publishDate = v;
        if (part.fieldname === 'type') type = (v as any) || 'combined';
        if (part.fieldname === 'categoryIds') { try { categoryIds = JSON.parse(v); } catch {} }
        if (part.fieldname === 'publishHour') publishHour = parseInt(v) || 1;
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

    const issue = await prisma.issue.create({
      data: {
        volumeNumber: parsedSchema.volumeNumber,
        issueNumber: parsedSchema.issueNumber,
        title: title || `Vol. ${volumeNumber}, No. ${issueNumber}`,
        publishDate: new Date(publishDate),
        type: parsedSchema.type,
      },
    });

    const result = await ingestIssue(zipBuffer, {
      issueId: issue.id,
      categoryIds,
      publishHour,
      uploadedById: req.user!.id,
    });

    await audit(req, 'ingest.completed', {
      entity: 'issue',
      entityId: issue.id,
      meta: { created: result.created, warnings: result.warnings.length },
    });

    return reply.status(201).send({ issueId: issue.id, title: issue.title, ...result });
  });
};

export default ingestRoutes;
