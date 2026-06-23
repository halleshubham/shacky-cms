import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { previewIngestion, ingestIssue } from '../services/docxIngestion.js';
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
};

export default ingestRoutes;
