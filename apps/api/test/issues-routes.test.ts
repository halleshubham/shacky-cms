import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  issue: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
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
