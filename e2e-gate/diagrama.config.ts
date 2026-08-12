import { defineConfig, devices } from '@playwright/test';

const puerto = Number(process.env.E2E_DIAGRAMA_PORT ?? 3103);
const baseURL = `http://127.0.0.1:${puerto}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'diagrama.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/e2e/diagrama/reporte-html', open: 'never' }],
    ['json', { outputFile: '../output/e2e/diagrama/resultado.json' }],
  ],
  outputDir: '../output/e2e/diagrama/resultados',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium-diagrama',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Webpack aísla también la caché de Tailwind. Dos Turbopack `dev`
    // simultáneos pueden compartirla aunque tengan distDir distintos.
    command: `npm run dev -- --webpack --hostname 127.0.0.1 --port ${puerto}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
