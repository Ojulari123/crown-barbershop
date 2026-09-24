import { expect, test } from '@playwright/test';

test('signed-out /admin/today redirects to /admin/login', async ({ page }) => {
  await page.goto('/admin/today');
  // proxy.ts keeps the page asked for, so login can send the owner back to it
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Ftoday$/);
  await expect(page.getByRole('heading', { name: 'Sign in to the admin' })).toBeVisible();
});
