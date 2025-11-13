import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.api-tests/tests',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  // Per-test timeout (you already had 60s)
  timeout: 60 * 1000,

  // NOTE: intentionally do NOT set a global baseURL or a global Content-Type header.
  // The base URL should be supplied per-run (via env var or repo config) or
  // discovered at runtime by the tests/helpers.
  use: {
    // Do not set `extraHTTPHeaders: { 'Content-Type': 'application/json' }` here
    // — choose headers per-request in your helpers.

    // Helpful debug helpers (safe to keep in CI):
    actionTimeout: 0,                // disable action timeout (only rely on test timeout)
    screenshot: 'only-on-failure',   // capture screenshots only on failure
    video: 'retain-on-failure',      // keep video for failed tests
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '.api-tests/reports' }],
    ['json', { outputFile: '.api-tests/reports/index.json' }]
  ],

  outputDir: '.api-tests/reports',
  retries: 2,
  workers: 4,
};

export default config;
