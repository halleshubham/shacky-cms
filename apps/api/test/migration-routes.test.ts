import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  migrationJob: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));

const mockUser = vi.hoisted(() => ({ current: { id: 'u1', role: 'author' } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import migrationRoutes from '../src/routes/migration';

const app = Fastify();
app.register(migrationRoutes, { prefix: '/api/migration' });
afterAll(() => app.close());

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'u1', role: 'author' };
});

describe('GET /api/migration/wordpress/status/:jobId — requires admin', () => {
  it('blocks a non-admin user (was previously any authenticated user)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/migration/wordpress/status/j1' });
    expect(res.statusCode).toBe(403);
  });

  it('404s for an unknown job even for an admin', async () => {
    mockUser.current = { id: 'admin1', role: 'superadmin' };
    prisma.migrationJob.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/api/migration/wordpress/status/ghost' });
    expect(res.statusCode).toBe(404);
  });

  it('an admin can read progress persisted in the DB (survives a restart — nothing in the in-memory map)', async () => {
    mockUser.current = { id: 'admin1', role: 'superadmin' };
    prisma.migrationJob.findUnique.mockResolvedValue({
      id: 'j2',
      status: 'running',
      phase: 'Importing posts…',
      total: 100,
      done: 40,
      skipped: 2,
      errors: 1,
      errorLog: ['Post "x": failed'],
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/migration/wordpress/status/j2' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ jobId: 'j2', status: 'running', done: 40, total: 100 });
  });
});
