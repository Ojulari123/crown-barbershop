import { existsSync, readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { adminState, OWNER_STATE, stamp } from './fixtures';

// The API writes dry-run texts to its log as `SMS DRY RUN kind=<kind> to=+1519***<last 4> body="..."`.
// There is no API that exposes the outbox, so the SMS step reads that log. Point E2E_API_LOG at
// the uvicorn log file; without it the SMS assertions are skipped and the test says so.
const API_LOG = process.env.E2E_API_LOG;

function logSince(offset: number) {
  return API_LOG && existsSync(API_LOG) ? readFileSync(API_LOG, 'utf8').slice(offset) : '';
}

test('site booking shows up in the admin, confirm sends the dry-run text', async ({ browser, page }) => {
  test.setTimeout(90_000);
  const tag = stamp();
  const client = `E2E Client ${tag}`;
  const last4 = String(1000 + Math.floor(Math.random() * 9000));
  const phone = `519555${last4}`;
  const logStart = API_LOG && existsSync(API_LOG) ? statSync(API_LOG).size : 0;

  // 1. book on the site: Skin fade, Tania, first open day, first time
  await page.goto('/book');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'What are we doing today?' })).toBeVisible();
  await main.getByRole('button', { name: /Skin fade/ }).first().click();
  await main.getByRole('button', { name: /Tania/ }).first().click();
  await expect(main.getByRole('heading', { name: 'Which day suits you?' })).toBeVisible();
  await main.locator('button[data-ymd][aria-label*="times available"]').first().click();
  await expect(main.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
  await main.getByRole('radiogroup', { name: 'Time' }).getByRole('radio').first().click();
  await main.getByLabel('Your name').fill(client);
  await main.getByLabel('Phone number').fill(phone);
  await main.getByRole('button', { name: 'Request this time' }).click();
  await expect(main.getByRole('button', { name: 'Request this time' })).toBeHidden();

  // 2. it appears in the admin, waiting to be confirmed
  const admin = await browser.newContext({ storageState: OWNER_STATE });
  const portal = await admin.newPage();
  await portal.goto('/admin/bookings');
  await portal.getByRole('tablist', { name: 'Booking lists' }).getByRole('tab', { name: /^To confirm/ }).click();
  const row = portal.locator('table tbody tr').filter({ hasText: client }).first();
  await expect(row).toBeVisible();
  const mine = () => adminState(admin.request).then((s) => s.bookings.find((b) => b.name === client));
  expect((await mine())?.status).toBe('requested');

  // 3. confirm it
  await row.getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(async () => (await mine())?.status).toBe('confirmed');

  // 4. the customer's confirmation text is logged (dry run)
  if (!API_LOG) {
    test.info().annotations.push({ type: 'skipped-check', description: 'SMS log not checked: set E2E_API_LOG to the API log file' });
  } else {
    // confirm texts wait out the 10 s undo grace, then the 5 s outbox tick
    await expect
      .poll(() => logSince(logStart), { timeout: 40_000, intervals: [1000] })
      .toMatch(new RegExp(`SMS DRY RUN kind=confirmed to=\\+1519\\*\\*\\*${last4} body="Crown Barber Shop: your chair is confirmed`));
  }
  await admin.close();
});
