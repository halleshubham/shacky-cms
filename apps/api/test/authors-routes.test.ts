import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  author: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  postAuthor: { count: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', role: 'superadmin' }; },
  requireAdmin: async () => {},
}));

import authorsRoutes from '../src/routes/authors';

const app = Fastify();
app.register(authorsRoutes, { prefix: '/api/authors' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

describe('PATCH /api/authors/:id — slug collision (new)', () => {
  it('rejects a slug already used by a different author', async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 'other' });
    const res = await app.inject({ method: 'PATCH', url: '/api/authors/a1', payload: { slug: 'taken' } });
    expect(res.statusCode).toBe(409);
    expect(prisma.author.update).not.toHaveBeenCalled();
  });

  it('allows keeping your own current slug', async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.author.update.mockResolvedValue({ id: 'a1' });
    const res = await app.inject({ method: 'PATCH', url: '/api/authors/a1', payload: { slug: 'me' } });
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/authors/:id — usage guard', () => {
  it('blocks deleting an author still credited on posts, no force flag', async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.postAuthor.count.mockResolvedValue(4);
    const res = await app.inject({ method: 'DELETE', url: '/api/authors/a1' });
    expect(res.statusCode).toBe(409);
    expect(prisma.author.delete).not.toHaveBeenCalled();
  });

  it('allows deleting with force=true, detaching posts first', async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.postAuthor.count.mockResolvedValue(4);
    const res = await app.inject({ method: 'DELETE', url: '/api/authors/a1?force=true' });
    expect(res.statusCode).toBe(200);
    expect(prisma.postAuthor.deleteMany).toHaveBeenCalledWith({ where: { authorId: 'a1' } });
  });

  it('404s for an unknown author', async () => {
    prisma.author.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'DELETE', url: '/api/authors/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
