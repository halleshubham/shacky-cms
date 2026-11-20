import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  tag: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  postTag: { count: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', role: 'superadmin' }; },
  requireAdmin: async () => {},
}));

import tagsRoutes from '../src/routes/tags';

const app = Fastify();
app.register(tagsRoutes, { prefix: '/api/tags' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

describe('POST /api/tags — slug collision (the "silently returns the wrong tag" bug)', () => {
  it('returns a clean 409 instead of silently returning the pre-existing tag under 200', async () => {
    const existingTag = { id: 'existing', name: 'Farmers', slug: 'farmers' };
    prisma.tag.findUnique.mockResolvedValue(existingTag);
    const res = await app.inject({ method: 'POST', url: '/api/tags', payload: { name: 'Farmers  Test' } });
    expect(res.statusCode).toBe(409);
    expect(prisma.tag.create).not.toHaveBeenCalled();
  });

  it('creates normally when the slug is free', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    prisma.tag.create.mockResolvedValue({ id: 't1', name: 'Farmers', slug: 'farmers' });
    const res = await app.inject({ method: 'POST', url: '/api/tags', payload: { name: 'Farmers' } });
    expect(res.statusCode).toBe(201);
  });
});

describe('PATCH /api/tags/:id — slug collision', () => {
  it('rejects a slug already used by a different tag', async () => {
    prisma.tag.findUnique.mockResolvedValue({ id: 'other' });
    const res = await app.inject({ method: 'PATCH', url: '/api/tags/t1', payload: { slug: 'taken' } });
    expect(res.statusCode).toBe(409);
    expect(prisma.tag.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/tags/:id — usage guard', () => {
  it('blocks deleting a tag still attached to posts, no force flag', async () => {
    prisma.tag.findUnique.mockResolvedValue({ id: 't1' });
    prisma.postTag.count.mockResolvedValue(5);
    const res = await app.inject({ method: 'DELETE', url: '/api/tags/t1' });
    expect(res.statusCode).toBe(409);
    expect(prisma.tag.delete).not.toHaveBeenCalled();
  });

  it('allows deleting with force=true, detaching posts first', async () => {
    prisma.tag.findUnique.mockResolvedValue({ id: 't1' });
    prisma.postTag.count.mockResolvedValue(5);
    const res = await app.inject({ method: 'DELETE', url: '/api/tags/t1?force=true' });
    expect(res.statusCode).toBe(200);
    expect(prisma.postTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: 't1' } });
  });

  it('404s for an unknown tag', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'DELETE', url: '/api/tags/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
