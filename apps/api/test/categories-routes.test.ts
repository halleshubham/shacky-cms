import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  postCategory: { count: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', role: 'superadmin' }; },
  requireAdmin: async () => {},
}));

import categoriesRoutes from '../src/routes/categories';

const app = Fastify();
app.register(categoriesRoutes, { prefix: '/api/categories' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

describe('POST /api/categories — slug collision', () => {
  it('returns a clean 409 instead of a raw FK/unique 500', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'existing' });
    const res = await app.inject({ method: 'POST', url: '/api/categories', payload: { name: 'Culture' } });
    expect(res.statusCode).toBe(409);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('creates normally when the slug is free', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'c1', name: 'Culture', slug: 'culture' });
    const res = await app.inject({ method: 'POST', url: '/api/categories', payload: { name: 'Culture' } });
    expect(res.statusCode).toBe(201);
  });
});

describe('PATCH /api/categories/:id — slug collision', () => {
  it('rejects a slug already used by a different category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'other' });
    const res = await app.inject({ method: 'PATCH', url: '/api/categories/c1', payload: { slug: 'taken' } });
    expect(res.statusCode).toBe(409);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('allows keeping your own current slug', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.category.update.mockResolvedValue({ id: 'c1' });
    const res = await app.inject({ method: 'PATCH', url: '/api/categories/c1', payload: { slug: 'culture' } });
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/categories/:id — usage guard', () => {
  it('blocks deleting a category still attached to posts, no force flag', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.postCategory.count.mockResolvedValue(3);
    const res = await app.inject({ method: 'DELETE', url: '/api/categories/c1' });
    expect(res.statusCode).toBe(409);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('allows deleting with force=true, detaching posts first', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.postCategory.count.mockResolvedValue(3);
    const res = await app.inject({ method: 'DELETE', url: '/api/categories/c1?force=true' });
    expect(res.statusCode).toBe(200);
    expect(prisma.postCategory.deleteMany).toHaveBeenCalledWith({ where: { categoryId: 'c1' } });
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('deletes freely when nothing references it', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.postCategory.count.mockResolvedValue(0);
    const res = await app.inject({ method: 'DELETE', url: '/api/categories/c1' });
    expect(res.statusCode).toBe(200);
    expect(prisma.postCategory.deleteMany).not.toHaveBeenCalled();
  });

  it('404s for an unknown category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'DELETE', url: '/api/categories/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
