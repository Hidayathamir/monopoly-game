import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 5000 },
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npx vite --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
