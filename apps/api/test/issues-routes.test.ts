import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  issue: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  post: { updateMany: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', role: 'superadmin' }; },
  requireAdmin: async () => {},
}));

import issuesRoutes from '../src/routes/issues';

const app = Fastify();
app.register(issuesRoutes, { prefix: '/api/issues' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

const body = { volumeNumber: 1, issueNumber: 2, title: 'Test Issue', publishDate: new Date().toISOString() };

function prismaUniqueViolation() {
  const e: any = new Error('Unique constraint failed');
  e.code = 'P2002';
  return e;
}

describe('POST /api/issues — duplicate volume+issue', () => {
  it('returns a clean 409 instead of a raw 500 on a duplicate volume/issue number', async () => {
    prisma.issue.create.mockRejectedValue(prismaUniqueViolation());
    const res = await app.inject({ method: 'POST', url: '/api/issues', payload: body });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'Conflict' });
  });

  it('creates normally when the volume/issue number is free', async () => {
    prisma.issue.create.mockResolvedValue({ id: 'i1', ...body });
    const res = await app.inject({ method: 'POST', url: '/api/issues', payload: body });
    expect(res.statusCode).toBe(201);
  });

  it('rethrows unrelated database errors instead of swallowing them', async () => {
    prisma.issue.create.mockRejectedValue(new Error('connection lost'));
    const res = await app.inject({ method: 'POST', url: '/api/issues', payload: body });
    expect(res.statusCode).toBe(500);
  });
});

// Regression coverage: bulk-publish used a per-post sequential loop
// (prisma.post.update inside a for...of) instead of batched updateMany
// calls — an issue with 50 articles meant 50 sequential round-trips.
describe('POST /api/issues/:id/bulk-publish — batched instead of per-row', () => {
  it('publishing uses two updateMany calls split on publishedAt, not one update per post', async () => {
    prisma.post.updateMany.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 2 });
    const res = await app.inject({ method: 'POST', url: '/api/issues/i1/bulk-publish', payload: { status: 'published' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, count: 5 });
    expect(prisma.post.updateMany).toHaveBeenCalledTimes(2);

    const calls = prisma.post.updateMany.mock.calls;
    const freshDateCall = calls.find((c: any) => c[0].where.publishedAt === null);
    expect(freshDateCall[0].data.publishedAt).toBeInstanceOf(Date);
    const preserveDateCall = calls.find((c: any) => c[0].where.publishedAt?.not === null);
    expect(preserveDateCall[0].data).not.toHaveProperty('publishedAt');
  });

  it('setting back to draft is a single updateMany clearing publishedAt', async () => {
    prisma.post.updateMany.mockResolvedValueOnce({ count: 4 });
    const res = await app.inject({ method: 'POST', url: '/api/issues/i1/bulk-publish', payload: { status: 'draft' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, count: 4 });
    expect(prisma.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'draft', publishedAt: null });
  });
});
