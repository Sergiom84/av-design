import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
const salida = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04');
export default defineConfig({ testDir: '.', testMatch: 'rea04.spec.mts', fullyParallel: false, workers: 1, retries: 0, timeout: 120000, expect: { timeout: 20000 }, reporter: [['list'], ['json', { outputFile: resolve(salida, 'e2e.json') }]], outputDir: resolve(salida, 'trazas'), use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3114', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20000 } });
