import { test, type Page } from '@playwright/test';
import { appendFileSync } from 'node:fs';

const RUTA_CONSOLA = '../output/e2e/20260808-1300/consola.txt';
const RUTA_RED = '../output/e2e/20260808-1300/red-fallida.txt';

/**
 * Cada spec llama a esto una vez, a nivel de módulo. Escribe por append, no
 * por overwrite: con tres ficheros de test independientes, cada uno debe
 * sumar su evidencia sin pisar la de los otros dos, sea cual sea el orden de
 * ejecución. El fichero se limpia antes de correr la suite completa, no aquí.
 */
export function instalarCapturaRed(nombreSpec: string) {
  const consola: string[] = [];
  const redFallida: string[] = [];

  test.beforeEach(async ({ page }: { page: Page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') consola.push(`[${nombreSpec}] [${page.url()}] ${msg.text()}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 500) redFallida.push(`[${nombreSpec}] [${res.status()}] ${res.url()}`);
    });
    page.on('pageerror', (err) => {
      consola.push(`[${nombreSpec}] [pageerror ${page.url()}] ${err.message}`);
    });
  });

  test.afterAll(async () => {
    if (consola.length) appendFileSync(RUTA_CONSOLA, consola.join('\n') + '\n');
    if (redFallida.length) appendFileSync(RUTA_RED, redFallida.join('\n') + '\n');
  });
}
