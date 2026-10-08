import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', workers: 1, retries: 0,
  timeout: 30_000, outputDir: 'output/playwright',
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4183', acceptDownloads: true, trace: 'retain-on-failure' },
  webServer: { command: 'node --import tsx tests/start-browser-server.ts', url: 'http://127.0.0.1:4183', reuseExistingServer: false, timeout: 60_000 },
});
