import { expect, test as setup } from '@playwright/test';
import { OWNER, OWNER_STATE } from './fixtures';

// One real sign-in per run; every admin spec adopts the saved cookies.
setup('sign in as the owner', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password', { exact: true }).fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin/today');
  await expect(page.locator('[data-admin-title]').first()).toBeVisible();
  await page.context().storageState({ path: OWNER_STATE });
});
