import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *
 * These run against a **deployed** environment rather than a local dev server,
 * because the things worth testing here — RLS, cache invalidation, the paywall,
 * signed uploads — only behave correctly against a real database and a real
 * CDN. A mocked run would pass while production was broken, which is worse than
 * no test at all.
 *
 * Set E2E_SITE_URL and E2E_ADMIN_URL to point at a preview or production
 * deployment. Tests that need a signed-in newsroom user are skipped unless
 * E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are also set, so the public suite
 * still runs in CI without secrets.
 */
const SITE = process.env.E2E_SITE_URL ?? 'https://bcm10news.vercel.app';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: SITE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Most BCM10 readers are on a phone; test the layout they actually get.
    ...devices['Desktop Chrome'],
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
