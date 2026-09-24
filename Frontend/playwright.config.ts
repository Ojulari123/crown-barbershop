import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end specs against the real stack: Next (production build) + FastAPI + Postgres.
 *
 * The backend is not started here (Python, its own virtualenv and database). `globalSetup`
 * checks it answers through the Next rewrite and says what to run if it does not.
 *
 * Next: by default Playwright runs `npm run start` on :3000 (build first). To test a server
 * that is already running, set E2E_BASE_URL (for example http://127.0.0.1:3000).
 *
 * The admin session is created once by `auth.setup.ts` and reused through storageState:
 * the API limits logins to 10/minute per IP, and that limit stays on.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // The specs share one database and one booking calendar; run them one at a time.
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: baseURL,
        // Never test whatever else happens to be on :3000.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
