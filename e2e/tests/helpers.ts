import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@shacky.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123!';

export async function loginViaUi(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL('**/admin**');
}

/** Logs the request context in so later `request.*` calls carry the auth cookie. */
export async function loginViaApi(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function createPost(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<{ id: string; slug: string; title: string }> {
  const res = await request.post('/api/posts', { data: { content: '<p>Body text</p>', ...data } });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

export async function deletePost(request: APIRequestContext, id: string) {
  await request.delete(`/api/posts/${id}`);
}
