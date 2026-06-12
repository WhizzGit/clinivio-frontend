import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PATIENT_PORTAL_URL || 'http://localhost:3002';
const API_URL  = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !process.env.CI, // serial in CI to reduce flakiness
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'x-playwright-test': '1',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Spin up the dev server automatically when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: `NEXT_PUBLIC_API_URL=${API_URL} pnpm dev`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
