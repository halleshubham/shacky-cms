import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  post: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));

import publicRoutes from '../src/routes/public';

const app = Fastify();
app.register(publicRoutes, { prefix: '/api/public' });

const dbPost = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: 'Hello',
  slug: 'hello',
  content: '<p>' + 'word '.repeat(500) + '</p>',
  status: 'published',
  featuredImagePosition: '50% 20%',
  authors: [{ author: { id: 'a1', displayName: 'Asha', slug: 'asha' } }],
  categories: [{ categoryId: 'c1', category: { id: 'c1', name: 'Culture', slug: 'culture' } }],
  tags: [{ tag: { id: 't1', name: 'Poetry', slug: 'poetry' } }],
  ...over,
});

beforeEach(() => vi.resetAllMocks());
afterAll(() => app.close());

describe('GET /api/public/posts/:slug', () => {
  it('returns a published post with flattened relations and reading time', async () => {
    prisma.post.findFirst.mockResolvedValue(dbPost());
    prisma.post.findMany.mockResolvedValue([]);

    const res = await app.inject({ url: '/api/public/posts/hello' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe('hello');
    expect(body.authors).toEqual([{ id: 'a1', displayName: 'Asha', slug: 'asha' }]);
    expect(body.categories[0].slug).toBe('culture');
    expect(body.tags[0].slug).toBe('poetry');
    expect(body.readingTime).toBe(3);
    expect(body.featuredImagePosition).toBe('50% 20%');
    expect(body.related).toEqual([]);
  });

  it('only ever looks up published posts', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    await app.inject({ url: '/api/public/posts/draft-post' });
    expect(prisma.post.findFirst.mock.calls[0][0].where).toEqual({ slug: 'draft-post', status: 'published' });
  });

  it('returns 404 when the post does not exist', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    const res = await app.inject({ url: '/api/public/posts/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('includes related posts from the same categories, excluding itself', async () => {
    prisma.post.findFirst.mockResolvedValue(dbPost());
    prisma.post.findMany.mockResolvedValue([dbPost({ id: 'p2', slug: 'other' })]);

    const body = (await app.inject({ url: '/api/public/posts/hello' })).json();
    expect(body.related).toHaveLength(1);
    expect(body.related[0].slug).toBe('other');
    const where = prisma.post.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 'p1' });
    expect(where.categories.some.categoryId.in).toEqual(['c1']);
  });
});

describe('GET /api/public/posts', () => {
  it('paginates and filters to published posts', async () => {
    prisma.post.findMany.mockResolvedValue([dbPost()]);
    prisma.post.count.mockResolvedValue(25);

    const res = await app.inject({ url: '/api/public/posts?page=2&pageSize=10&search=abc' });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body).toMatchObject({ total: 25, page: 2, pageSize: 10, totalPages: 3 });
    const args = prisma.post.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.where.status).toBe('published');
    expect(args.where.OR[0].title.contains).toBe('abc');
  });
});
