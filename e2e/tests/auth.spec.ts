import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, loginViaUi } from './helpers';

test.describe('authentication', () => {
  test('admin area redirects anonymous visitors to login', async ({ page }) => {
    await page.goto('/admin/posts');
    await page.waitForURL('**/login**');
  });

  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.locator('#password').fill('definitely-wrong');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in with the seeded admin and reaches the dashboard', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/admin/);
  });
});
