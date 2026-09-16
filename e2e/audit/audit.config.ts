import { defineConfig } from '@playwright/test';

/**
 * Separate config so the audit never runs as part of the normal suite: it is a
 * report, not a gate, and it writes screenshots.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off' },
});
