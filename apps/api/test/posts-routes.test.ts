import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  post: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  revision: { create: vi.fn(), findMany: vi.fn() },
  postAuthor: { findFirst: vi.fn() },
}));
// Mutable per-test "logged in as" — real role-checking logic (not a no-op), so
// requireContentRole's role gate in posts.ts is actually exercised by these tests.
const mockUser = vi.hoisted(() => ({ current: { id: 'u1', email: 'a@b.test', role: 'superadmin', name: 'Admin' } }));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
const fireWebhook = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/webhooks.js', () => ({ fireWebhook }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => {
    req.user = mockUser.current;
  },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
    }
  },
  requireSuperAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin') reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
  requireRoles: (...roles: string[]) => async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role)) reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import postsRoutes from '../src/routes/posts';

const app = Fastify();
app.register(postsRoutes, { prefix: '/api/posts' });
afterAll(() => app.close());

const existing = { id: 'p1', slug: 'old-slug', title: 'T', content: '', status: 'draft' };
const updated = { ...existing, authors: [], categories: [], tags: [] };

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'u1', email: 'a@b.test', role: 'superadmin', name: 'Admin' };
  prisma.post.update.mockResolvedValue(updated);
  prisma.revision.findMany.mockResolvedValue([]);
});

const asRole = (role: string) => { mockUser.current = { ...mockUser.current, role }; };
const patch = (payload: unknown) => app.inject({ method: 'PATCH', url: '/api/posts/p1', payload: payload as any });
const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/posts', payload: payload as any });

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

describe('webhook events', () => {
  it('fires post.created on create', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(null);
    prisma.post.create.mockResolvedValueOnce({ id: 'p9', title: 'New', slug: 'new', authors: [], categories: [], tags: [] });
    await post({ title: 'New' });
    expect(fireWebhook).toHaveBeenCalledWith('post.created', expect.objectContaining({ id: 'p9' }));
  });

  it('fires post.updated and post.published when a draft transitions to published', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing);
    prisma.post.update.mockResolvedValueOnce({ ...updated, status: 'published' });
    await patch({ status: 'published' });
    expect(fireWebhook).toHaveBeenCalledWith('post.updated', expect.objectContaining({ id: 'p1' }));
    expect(fireWebhook).toHaveBeenCalledWith('post.published', expect.objectContaining({ id: 'p1' }));
    expect(fireWebhook).not.toHaveBeenCalledWith('post.unpublished', expect.anything());
  });

  it('fires post.updated and post.unpublished when a published post reverts to draft', async () => {
    prisma.post.findUnique.mockResolvedValueOnce({ ...existing, status: 'published' });
    prisma.post.update.mockResolvedValueOnce({ ...updated, status: 'draft' });
    await patch({ status: 'draft' });
    expect(fireWebhook).toHaveBeenCalledWith('post.updated', expect.objectContaining({ id: 'p1' }));
    expect(fireWebhook).toHaveBeenCalledWith('post.unpublished', expect.objectContaining({ id: 'p1' }));
    expect(fireWebhook).not.toHaveBeenCalledWith('post.published', expect.anything());
  });

  it('fires only post.updated when status does not change', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing);
    await patch({ title: 'New title' });
    expect(fireWebhook).toHaveBeenCalledWith('post.updated', expect.objectContaining({ id: 'p1' }));
    expect(fireWebhook).not.toHaveBeenCalledWith('post.published', expect.anything());
    expect(fireWebhook).not.toHaveBeenCalledWith('post.unpublished', expect.anything());
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

describe('role enforcement (privilege-escalation fix)', () => {
  beforeEach(() => prisma.post.findUnique.mockResolvedValue(existing));

  it.each(['subscriber_manager', 'nonsense-role'])('blocks %s from creating a post', async (role) => {
    asRole(role);
    const res = await post({ title: 'Hijack' });
    expect(res.statusCode).toBe(403);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it.each(['subscriber_manager', 'nonsense-role'])('blocks %s from editing a post', async (role) => {
    asRole(role);
    const res = await patch({ title: 'Hijack' });
    expect(res.statusCode).toBe(403);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it.each(['superadmin', 'editor', 'author'])('allows %s to create a post', async (role) => {
    asRole(role);
    prisma.post.findUnique.mockResolvedValueOnce(null); // slug not taken
    prisma.post.create.mockResolvedValueOnce({ ...existing, authors: [], categories: [], tags: [] });
    const res = await post({ title: 'OK' });
    expect(res.statusCode).toBe(201);
  });

  it('still blocks an author from editing a post they are not credited on', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce(null);
    const res = await patch({ title: 'Hijack' });
    expect(res.statusCode).toBe(403);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('blocks a subscriber_manager from restoring a revision', async () => {
    asRole('subscriber_manager');
    const res = await app.inject({ method: 'POST', url: '/api/posts/p1/restore/r1' });
    expect(res.statusCode).toBe(403);
  });

  it.each(['author', 'subscriber_manager'])(
    'strips codeInjectionHead/Foot from a %s create request instead of honoring it',
    async (role) => {
      asRole(role);
      prisma.post.findUnique.mockResolvedValueOnce(null);
      prisma.post.create.mockResolvedValueOnce({ ...existing, authors: [], categories: [], tags: [] });
      const res = await post({ title: 'OK', codeInjectionHead: '<script>alert(1)</script>' });
      if (role === 'subscriber_manager') {
        expect(res.statusCode).toBe(403);
        return;
      }
      expect(res.statusCode).toBe(201);
      expect(prisma.post.create.mock.calls[0][0].data.codeInjectionHead).toBeNull();
    },
  );

  it('strips codeInjectionHead/Foot from an author edit request instead of honoring it', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce({ id: 'pa1' });
    const res = await patch({ codeInjectionHead: '<script>alert(1)</script>' });
    expect(res.statusCode).toBe(200);
    expect(prisma.post.update.mock.calls[0][0].data).not.toHaveProperty('codeInjectionHead');
  });

  it.each(['superadmin', 'editor'])('lets %s set codeInjectionHead', async (role) => {
    asRole(role);
    const res = await patch({ codeInjectionHead: '<script>trusted()</script>' });
    expect(res.statusCode).toBe(200);
    expect(prisma.post.update.mock.calls[0][0].data.codeInjectionHead).toBe('<script>trusted()</script>');
  });
});

// Regression coverage: post content reached storage (and from there the
// public site, via dangerouslySetInnerHTML) completely unsanitized.
describe('content sanitization on create/update', () => {
  it('strips a <script> tag from create', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(null); // slug not taken
    prisma.post.create.mockResolvedValueOnce({ ...existing, authors: [], categories: [], tags: [] });
    await post({ title: 'T', content: '<p>hi</p><script>alert(1)</script>' });
    expect(prisma.post.create.mock.calls[0][0].data.content).not.toContain('<script');
    expect(prisma.post.create.mock.calls[0][0].data.content).toContain('<p>hi</p>');
  });

  it('strips an onerror handler from update', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(existing);
    await patch({ content: '<img src="x.jpg" onerror="alert(1)">' });
    expect(prisma.post.update.mock.calls[0][0].data.content).not.toContain('onerror');
  });
});

// Regression coverage: GET /:id, GET /:id/revisions, and POST /:id/duplicate
// had no ownership check for the author role at all — the list endpoint
// filters to the author's own posts, but fetching/duplicating by ID bypassed
// that entirely, letting any author read or clone any other author's draft.
describe('author ownership on GET /:id, GET /:id/revisions, POST /:id/duplicate (IDOR fix)', () => {
  beforeEach(() => {
    prisma.post.findUnique.mockResolvedValue(updated); // has authors/categories/tags for formatPost
    prisma.post.create.mockResolvedValue(updated);
  });

  it('blocks an author from reading a post they are not credited on', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/api/posts/p1' });
    expect(res.statusCode).toBe(403);
  });

  it('allows an author to read their own post', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce({ id: 'pa1' });
    const res = await app.inject({ method: 'GET', url: '/api/posts/p1' });
    expect(res.statusCode).toBe(200);
  });

  it.each(['superadmin', 'editor'])('%s can read any post with no ownership check', async (role) => {
    asRole(role);
    const res = await app.inject({ method: 'GET', url: '/api/posts/p1' });
    expect(res.statusCode).toBe(200);
    expect(prisma.postAuthor.findFirst).not.toHaveBeenCalled();
  });

  it('blocks an author from reading revision history of a post they are not credited on', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/api/posts/p1/revisions' });
    expect(res.statusCode).toBe(403);
    expect(prisma.revision.findMany).not.toHaveBeenCalled();
  });

  it('allows an author to read revision history of their own post', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce({ id: 'pa1' });
    const res = await app.inject({ method: 'GET', url: '/api/posts/p1/revisions' });
    expect(res.statusCode).toBe(200);
    expect(prisma.revision.findMany).toHaveBeenCalled();
  });

  it('blocks an author from duplicating a post they are not credited on', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/api/posts/p1/duplicate' });
    expect(res.statusCode).toBe(403);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('allows an author to duplicate their own post', async () => {
    asRole('author');
    prisma.postAuthor.findFirst.mockResolvedValueOnce({ id: 'pa1' });
    prisma.post.findUnique.mockResolvedValueOnce({ ...existing, authors: [], categories: [], tags: [] }).mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/api/posts/p1/duplicate' });
    expect(res.statusCode).toBe(201);
    expect(prisma.post.create).toHaveBeenCalled();
  });
});
