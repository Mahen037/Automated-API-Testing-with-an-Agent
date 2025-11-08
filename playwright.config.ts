import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.api-tests/tests',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  timeout: 60 * 1000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8000',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  reporter: [
    ['list'], 
    ['html', { open: 'never',  outputFolder: ".api-tests/reports" }], 
    ['json', { outputFile: ".api-tests/reports/index.json" }]
  ],
  outputDir: '.api-tests/reports',
  retries: 2,
  workers: 4,
};

export default config;
