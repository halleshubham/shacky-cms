import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';

const prisma = vi.hoisted(() => ({ issue: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() } }));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/services/ai.js', () => ({ getAIConfig: vi.fn().mockResolvedValue(null) }));

const previewIngestion = vi.hoisted(() => vi.fn());
const ingestIssue = vi.hoisted(() => vi.fn());
vi.mock('../src/services/docxIngestion.js', () => ({ previewIngestion, ingestIssue }));

const ingestQueue = vi.hoisted(() => ({ add: vi.fn(), getJob: vi.fn() }));
vi.mock('../src/jobs/ingestQueue.js', () => ({ ingestQueue }));

const mockUser = vi.hoisted(() => ({ current: { id: 'u1', role: 'author' } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import ingestRoutes from '../src/routes/ingest';

const app = Fastify();
app.register(multipart);
app.register(ingestRoutes, { prefix: '/api/ingest' });
afterAll(() => app.close());

function zipForm(fields: Record<string, string> = {}) {
  const b = 'XBOUNDARYX';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="issue.zip"\r\nContent-Type: application/zip\r\n\r\n`));
  parts.push(Buffer.from('fake-zip-bytes'), Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'u1', role: 'superadmin' };
});

describe('POST /api/ingest/preview — clean error on bad ZIP', () => {
  it('returns a clean 400 instead of a raw 500 when the ZIP cannot be parsed', async () => {
    previewIngestion.mockRejectedValue(new Error('Invalid or corrupted zip file'));
    const { payload, headers } = zipForm();
    const res = await app.inject({ method: 'POST', url: '/api/ingest/preview', payload, headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Invalid or corrupted zip file');
  });

  it('passes through a successful preview unchanged', async () => {
    previewIngestion.mockResolvedValue({ articles: [{ number: 1, title: 'T', authorName: 'A', excerpt: 'E', wordCount: 42 }], totalArticles: 1, warnings: [] });
    const { payload, headers } = zipForm();
    const res = await app.inject({ method: 'POST', url: '/api/ingest/preview', payload, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().articles[0].wordCount).toBe(42);
  });
});

describe('POST /api/ingest — clean error on bad ZIP', () => {
  it('returns a clean 400 instead of a raw 500 when ingestIssue throws', async () => {
    ingestIssue.mockRejectedValue(new Error('Summary.docx not found'));
    const { payload, headers } = zipForm({ issueId: 'i1' });
    const res = await app.inject({ method: 'POST', url: '/api/ingest', payload, headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Summary.docx not found');
  });
});

describe('GET /api/ingest/job/:jobId — ownership check', () => {
  const fakeJob = {
    id: 'j1',
    data: { uploadedById: 'owner1' },
    getState: vi.fn().mockResolvedValue('completed'),
    returnvalue: { warnings: [] },
    failedReason: undefined,
  };

  it('404s when the job does not exist', async () => {
    ingestQueue.getJob.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/api/ingest/job/ghost' });
    expect(res.statusCode).toBe(404);
  });

  it('lets the uploader view their own job', async () => {
    mockUser.current = { id: 'owner1', role: 'author' };
    ingestQueue.getJob.mockResolvedValue(fakeJob);
    const res = await app.inject({ method: 'GET', url: '/api/ingest/job/j1' });
    expect(res.statusCode).toBe(200);
  });

  it('blocks a different non-admin user from viewing someone else\'s job', async () => {
    mockUser.current = { id: 'someone-else', role: 'author' };
    ingestQueue.getJob.mockResolvedValue(fakeJob);
    const res = await app.inject({ method: 'GET', url: '/api/ingest/job/j1' });
    expect(res.statusCode).toBe(403);
  });

  it('lets an editor/superadmin view any job', async () => {
    mockUser.current = { id: 'someone-else', role: 'superadmin' };
    ingestQueue.getJob.mockResolvedValue(fakeJob);
    const res = await app.inject({ method: 'GET', url: '/api/ingest/job/j1' });
    expect(res.statusCode).toBe(200);
  });
});
