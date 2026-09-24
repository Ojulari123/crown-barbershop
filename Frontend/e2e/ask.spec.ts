import { expect, test } from '@playwright/test';
import { adminState, OWNER_STATE, stamp } from './fixtures';

test('a question from the Visit page lands in the admin inbox', async ({ browser, page }) => {
  const tag = stamp();
  const question = `E2E question ${tag}: is there parking?`;

  await page.goto('/visit');
  await page.locator('#ask-name').fill(`E2E Asker ${tag}`);
  await page.locator('#ask-phone').fill('519-555-0158');
  await page.locator('#ask-body').fill(question);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Thanks, E2E.' })).toBeVisible();

  const admin = await browser.newContext({ storageState: OWNER_STATE });
  const inbox = await admin.newPage();
  await inbox.goto('/admin/messages');
  await expect(inbox.getByText(question).first()).toBeVisible();
  expect((await adminState(admin.request)).messages.some((m) => m.body === question)).toBe(true);
  await admin.close();
});
