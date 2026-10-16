import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'rea01-a.spec.mts', fullyParallel: false, workers: 1,
  retries: 0, timeout: 150_000, expect: { timeout: 25_000 }, forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: '../output/rea-integracion/rea01/a/e2e-resultados.json' }]],
  outputDir: '../output/rea-integracion/rea01/a/e2e-trazas',
  use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3111',
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
});
