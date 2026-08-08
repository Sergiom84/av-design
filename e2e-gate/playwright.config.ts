import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../output/e2e/20260808-1300/reporte-html', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'on',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 15_000,
  },
  outputDir: '../output/e2e/20260808-1300/resultados',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
