import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for @takehomeviz/web.
 *
 * Runs two projects:
 *   - chromium: desktop, runs every test except those tagged @mobile-only.
 *   - mobile-webkit: iPhone 13 profile, runs only tests tagged @mobile.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI
      ? 'pnpm --filter @takehomeviz/web preview --port 5173 --strictPort'
      : 'pnpm --filter @takehomeviz/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      grepInvert: /@mobile-only/,
    },
  ],
});
