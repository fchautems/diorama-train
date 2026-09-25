import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  expect: {
    timeout: 45000
  },
  use: {
    baseURL: 'http://127.0.0.1:8000',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    headless: true
  },
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://127.0.0.1:8000/le-muids-3d.html',
    reuseExistingServer: true,
    timeout: 120000
  }
});
