import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  post: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  setting: { findUnique: vi.fn() },
  issue: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
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

  it('drops the full article body from list results but still computes reading time', async () => {
    prisma.post.findMany.mockResolvedValue([dbPost()]);
    prisma.post.count.mockResolvedValue(1);

    const body = (await app.inject({ url: '/api/public/posts' })).json();
    expect(body.data[0].content).toBeUndefined();
    expect(body.data[0].readingTime).toBe(3);
    expect(body.data[0].slug).toBe('hello');
  });
});

describe('GET /api/public/search', () => {
  it('searches title, excerpt, content, and author/category/tag names via a UNION of matching post ids', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
    prisma.post.findMany.mockResolvedValue([dbPost()]);

    const res = await app.inject({ url: '/api/public/search?q=culture' });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.total).toBe(1);
    expect(body.data[0].content).toBeUndefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.post.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['p1'] } });
  });

  it('skips the query entirely for terms under 2 characters', async () => {
    const res = await app.inject({ url: '/api/public/search?q=a' });
    const body = res.json();
    expect(body).toMatchObject({ data: [], total: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('returns no results without querying findMany when nothing matches', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const res = await app.inject({ url: '/api/public/search?q=nomatch' });
    const body = res.json();
    expect(body).toMatchObject({ data: [], total: 0 });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/public/legacy-redirect/:slug', () => {
  const get = (slug: string) => app.inject({ url: `/api/public/legacy-redirect/${slug}` });

  it('returns the target for a mapped slug', async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: 'legacy_redirects', value: JSON.stringify({ old: 'https://other.example/articles/new' }) });
    const res = await get('old');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ url: 'https://other.example/articles/new' });
  });

  it('404s for an unmapped slug, a missing setting, or malformed JSON', async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: 'legacy_redirects', value: JSON.stringify({ a: 'https://x.example/' }) });
    expect((await get('b')).statusCode).toBe(404);
    prisma.setting.findUnique.mockResolvedValue(null);
    expect((await get('a')).statusCode).toBe(404);
    prisma.setting.findUnique.mockResolvedValue({ key: 'legacy_redirects', value: '{not json' });
    expect((await get('a')).statusCode).toBe(404);
  });

  it('refuses non-http(s) targets (no javascript: or relative redirects)', async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: 'legacy_redirects', value: JSON.stringify({ x: 'javascript:alert(1)', y: '/relative' }) });
    expect((await get('x')).statusCode).toBe(404);
    expect((await get('y')).statusCode).toBe(404);
  });
});

describe('GET /api/public/issues/latest — picks by readiness', () => {
  it('only considers issues with at least one published post, not just the highest volume/issue number', async () => {
    prisma.issue.findFirst.mockResolvedValue(null);
    await app.inject({ url: '/api/public/issues/latest' });
    const call = prisma.issue.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ posts: { some: { status: 'published' } } });
    expect(call.orderBy).toEqual([{ volumeNumber: 'desc' }, { issueNumber: 'desc' }]);
  });

  it('returns null when no issue has a published post yet (e.g. a next-issue stub with only drafts)', async () => {
    prisma.issue.findFirst.mockResolvedValue(null);
    const res = await app.inject({ url: '/api/public/issues/latest' });
    expect(res.json()).toBeNull();
  });

  it('returns the ready issue with its published posts formatted', async () => {
    prisma.issue.findFirst.mockResolvedValue({
      id: 'i1', volumeNumber: 5, issueNumber: 3,
      posts: [dbPost({ id: 'p1' })],
    });
    const res = await app.inject({ url: '/api/public/issues/latest' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 'i1', posts: [{ id: 'p1' }] });
  });
});
