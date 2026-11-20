import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAllPublishedPosts } from '@/lib/sitemap';

function mockFetchPages(pagesOfPosts: any[][]) {
  const totalPages = pagesOfPosts.length;
  return vi.fn(async (url: string) => {
    const page = Number(new URL(url).searchParams.get('page'));
    const data = pagesOfPosts[page - 1] ?? [];
    return {
      ok: true,
      json: async () => ({ data, total: pagesOfPosts.flat().length, page, totalPages }),
    } as Response;
  });
}

const makePost = (n: number) => ({ slug: `post-${n}`, updatedAt: '2026-01-01T00:00:00.000Z' });

afterEach(() => vi.restoreAllMocks());

describe('fetchAllPublishedPosts', () => {
  it('fetches every page, not just the first (regression for the old pageSize=500 cap)', async () => {
    // Simulate 3 pages worth (e.g. pageSize 200 → 450 posts spread over 3 pages),
    // something the old hardcoded single-request pageSize=500 would have mishandled
    // as soon as the archive grew past the fixed cap.
    const pages = [
      Array.from({ length: 200 }, (_, i) => makePost(i)),
      Array.from({ length: 200 }, (_, i) => makePost(200 + i)),
      Array.from({ length: 50 }, (_, i) => makePost(400 + i)),
    ];
    global.fetch = mockFetchPages(pages) as any;

    const posts = await fetchAllPublishedPosts('http://api.test');

    expect(posts).toHaveLength(450);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(posts[0].slug).toBe('post-0');
    expect(posts[449].slug).toBe('post-449');
  });

  it('stops after a single page when everything fits in one', async () => {
    const pages = [Array.from({ length: 10 }, (_, i) => makePost(i))];
    global.fetch = mockFetchPages(pages) as any;

    const posts = await fetchAllPublishedPosts('http://api.test');

    expect(posts).toHaveLength(10);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops cleanly if the API call fails rather than looping forever', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response) as any;

    const posts = await fetchAllPublishedPosts('http://api.test');

    expect(posts).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
