import { defineConfig, devices } from '@playwright/test';

/** Servidor manual, siempre dirigido a fixture E2 comprobada por el spec. */
export default defineConfig({
  testDir: '.', testMatch: 'importacion.spec.mts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 120_000, expect: {timeout: 20_000}, forbidOnly: true,
  reporter: [['list'],['json',{outputFile:'../output/e2-importacion/gates/e2e-resultados.json'}],
    ['html',{outputFolder:'../output/e2-importacion/gates/e2e-reporte',open:'never'}]],
  outputDir: '../output/e2-importacion/gates/e2e-trazas',
  use: {...devices['Desktop Chrome'],channel:'chrome',baseURL:'http://localhost:3103',
    viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:15_000},
});
