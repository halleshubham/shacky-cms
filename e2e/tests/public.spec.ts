import { test, expect } from '@playwright/test';

test.describe('public site', () => {
  test('home page renders', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  test('public posts API responds with a paginated list', async ({ request }) => {
    const res = await request.get('/api/public/posts?pageSize=5');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('totalPages');
  });

  test('an unknown article returns 404', async ({ request }) => {
    const res = await request.get('/articles/this-article-does-not-exist-e2e');
    expect(res.status()).toBe(404);
  });
});
