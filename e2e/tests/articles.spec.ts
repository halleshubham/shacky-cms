import { test, expect } from '@playwright/test';
import { createPost, deletePost, loginViaApi, loginViaUi, uniq } from './helpers';

test.describe('articles', () => {
  const created: string[] = [];

  test.beforeEach(async ({ request }) => {
    await loginViaApi(request);
  });

  test.afterEach(async ({ request }) => {
    await loginViaApi(request);
    for (const id of created.splice(0)) await deletePost(request, id);
  });

  test('a published article is readable at /articles/<slug>', async ({ page, request }) => {
    const title = uniq('E2E Published');
    const post = await createPost(request, { title, status: 'published', publishedAt: new Date().toISOString() });
    created.push(post.id);

    await page.goto(`/articles/${post.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Body text')).toBeVisible();
  });

  test('a draft is not publicly reachable', async ({ request }) => {
    const post = await createPost(request, { title: uniq('E2E Draft'), status: 'draft' });
    created.push(post.id);

    const res = await request.get(`/articles/${post.slug}`);
    expect(res.status()).toBe(404);
  });

  test('a Devanagari title gets a short ASCII slug and the article loads (regression)', async ({ page, request }) => {
    const post = await createPost(request, {
      title: 'लिंगायत जागर ' + uniq('t'),
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
    created.push(post.id);

    expect(post.slug).toMatch(/^lingayat-jagar-/);
    expect(post.slug).toMatch(/^[a-z0-9-]+$/);

    const res = await page.goto(`/articles/${post.slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('लिंगायत जागर');
  });

  test('slug can be changed from the editor and the new URL works', async ({ page, request }) => {
    const post = await createPost(request, {
      title: uniq('E2E Slug Edit'),
      status: 'published',
      publishedAt: new Date().toISOString(),
    });
    created.push(post.id);
    const newSlug = uniq('renamed');

    await loginViaUi(page);
    await page.goto(`/admin/posts/${post.id}`);
    const slugInput = page.getByPlaceholder('article-url-slug');
    await expect(slugInput).toHaveValue(post.slug);
    await slugInput.fill(newSlug);
    await page.getByRole('button', { name: /^save/i }).first().click();
    await expect(page.getByText('Post saved')).toBeVisible();

    const res = await page.goto(`/articles/${newSlug}`);
    expect(res?.status()).toBe(200);
  });

  test('"From title" fills the slug field from the transliterated title', async ({ page, request }) => {
    const post = await createPost(request, { title: 'बसव स्तोत्र', slug: uniq('placeholder'), status: 'draft' });
    created.push(post.id);

    await loginViaUi(page);
    await page.goto(`/admin/posts/${post.id}`);
    await page.getByRole('button', { name: 'From title' }).click();
    await expect(page.getByPlaceholder('article-url-slug')).toHaveValue('basav-stotr');
  });

  test('API refuses a slug that another article already uses', async ({ request }) => {
    const a = await createPost(request, { title: uniq('E2E A'), status: 'draft' });
    const b = await createPost(request, { title: uniq('E2E B'), status: 'draft' });
    created.push(a.id, b.id);

    const res = await request.patch(`/api/posts/${b.id}`, { data: { slug: a.slug } });
    expect(res.status()).toBe(409);
  });

  test('crop focus is persisted and validated by the API', async ({ request }) => {
    const post = await createPost(request, { title: uniq('E2E Crop'), status: 'draft' });
    created.push(post.id);

    const ok = await request.patch(`/api/posts/${post.id}`, { data: { featuredImagePosition: '50% 20%' } });
    expect(ok.ok()).toBeTruthy();
    expect((await ok.json()).featuredImagePosition).toBe('50% 20%');

    const bad = await request.patch(`/api/posts/${post.id}`, { data: { featuredImagePosition: 'top;color:red' } });
    expect(bad.ok()).toBeFalsy();

    const cleared = await request.patch(`/api/posts/${post.id}`, { data: { featuredImagePosition: null } });
    expect((await cleared.json()).featuredImagePosition).toBeNull();
  });
});
