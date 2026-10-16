import { defineConfig, devices } from '@playwright/test';
const salida = process.env.E3_SALIDA_E2E ?? 'output/e3-revisiones/navegador';
export default defineConfig({
  testDir: '.', testMatch: 'revisiones.spec.mts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 120_000, expect: { timeout: 25_000 }, forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: `../${salida}/resultados.json` }], ['html', { outputFolder: `../${salida}/reporte`, open: 'never' }]],
  outputDir: `../${salida}/trazas`,
  use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3105', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
});
