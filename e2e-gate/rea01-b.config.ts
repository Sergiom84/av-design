import { defineConfig, devices } from '@playwright/test';
const salida = process.env.REA01_B_SALIDA ?? `../output/rea-integracion/rea01/b${process.env.REA01_B_CORRECCION === '1' ? '/correccion-revision' : ''}`;
export default defineConfig({
  testDir: '.', testMatch: 'rea01-b.spec.mts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 20_000 }, forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: `${salida}/e2e.json` }]],
  outputDir: `${salida}/trazas`,
  use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3111',
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
});
