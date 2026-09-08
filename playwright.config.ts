import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
