import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
const salida = resolve(process.env.REA07_OUTPUT_DIR ?? 'output/rea-integracion/rea07/seguimiento-runtime');
export default defineConfig({ testDir: '.', testMatch: 'rea07.spec.mts', workers: 1, fullyParallel: false, retries: 0, timeout: 120000, expect: { timeout: 30000 }, forbidOnly: true, reporter: [['list'], ['json', { outputFile: resolve(salida, 'e2e.json') }]], outputDir: resolve(salida, 'trazas'), use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3118', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20000 } });
