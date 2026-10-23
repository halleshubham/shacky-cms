import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  post: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  revision: { create: vi.fn() },
  postAuthor: { findFirst: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/utils/webhooks.js', () => ({ fireWebhook: vi.fn() }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => {
    req.user = { id: 'u1', email: 'a@b.test', role: 'superadmin', name: 'Admin' };
  },
  requireAdmin: async () => {},
  requireSuperAdmin: async () => {},
  requireRoles: () => async () => {},
}));

import postsRoutes from '../src/routes/posts';

const app = Fastify();
app.register(postsRoutes, { prefix: '/api/posts' });
afterAll(() => app.close());

const existing = { id: 'p1', slug: 'old-slug', title: 'T', content: '', status: 'draft' };
const updated = { ...existing, authors: [], categories: [], tags: [] };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.post.update.mockResolvedValue(updated);
});

const patch = (payload: unknown) => app.inject({ method: 'PATCH', url: '/api/posts/p1', payload: payload as any });

describe('PATCH /api/posts/:id slug handling', () => {
  it('returns 409 when another post already uses the slug', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: 'p2' });
    const res = await patch({ slug: 'taken' });
    expect(res.statusCode).toBe(409);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('normalises the slug before saving', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    const res = await patch({ slug: 'लिंगायत जागर' });
    expect(res.statusCode).toBe(200);
    expect(prisma.post.update.mock.calls[0][0].data.slug).toBe('lingayat-jagar');
  });

  it('skips the uniqueness check when the slug is unchanged', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing);
    const res = await patch({ slug: 'old-slug' });
    expect(res.statusCode).toBe(200);
    expect(prisma.post.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for an unknown post', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(null);
    expect((await patch({ title: 'x' })).statusCode).toBe(404);
  });
});

describe('featuredImagePosition', () => {
  beforeEach(() => prisma.post.findUnique.mockResolvedValue(existing));

  it('is saved when valid', async () => {
    await patch({ featuredImagePosition: '40% 15%' });
    expect(prisma.post.update.mock.calls[0][0].data.featuredImagePosition).toBe('40% 15%');
  });

  it('can be cleared with null', async () => {
    await patch({ featuredImagePosition: null });
    expect(prisma.post.update.mock.calls[0][0].data.featuredImagePosition).toBeNull();
  });

  it('is left alone when not sent', async () => {
    await patch({ title: 'New' });
    expect(prisma.post.update.mock.calls[0][0].data).not.toHaveProperty('featuredImagePosition');
  });

  it.each(['top', 'url(javascript:alert(1))', '50% 20% 3', '50 20', '50%;color:red'])(
    'rejects invalid value %s',
    async (value) => {
      const res = await patch({ featuredImagePosition: value });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(prisma.post.update).not.toHaveBeenCalled();
    },
  );
});
