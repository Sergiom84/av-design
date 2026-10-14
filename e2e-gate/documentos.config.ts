import { defineConfig, devices } from '@playwright/test';

/** El servidor lo inicia el operador con la URL de fixture; este gate no arranca ni resetea nada. */
export default defineConfig({
  testDir: '.',
  testMatch: 'documentos.spec.mts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: '../output/e1-documentos/e2e-resultados.json' }],
    ['html', { outputFolder: '../output/e1-documentos/e2e-reporte', open: 'never' }],
  ],
  outputDir: '../output/e1-documentos/e2e-trazas',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: process.env.DOCUMENTOS_BASE_URL ?? 'http://localhost:3101',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
});
