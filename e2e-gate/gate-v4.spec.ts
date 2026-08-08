import { test, expect, type Page } from '@playwright/test';

const PREFIJO = 'E2E-20260808-1300-PLAYWRIGHT';

const VIEWPORTS = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '1280x800', width: 1280, height: 800 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '320x568', width: 320, height: 568 },
];

const RUTAS_VISUAL = [
  '/proyectos',
  '/salas',
  '/catalogo',
  '/plantillas',
  '/almacen',
  '/compras',
  '/parametros',
  '/checkin',
];

async function overflowDeDocumento(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

const consolaGlobal: string[] = [];
const redFallidaGlobal: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consolaGlobal.push(`[${page.url()}] ${msg.text()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 500) redFallidaGlobal.push(`[${res.status()}] ${res.url()}`);
  });
  page.on('pageerror', (err) => consolaGlobal.push(`[pageerror ${page.url()}] ${err.message}`));
});

test.afterAll(async () => {
  const fs = await import('node:fs');
  fs.writeFileSync(
    '../output/e2e/20260808-1300/consola.txt',
    consolaGlobal.join('\n') || '(sin errores de consola)',
  );
  fs.writeFileSync(
    '../output/e2e/20260808-1300/red-fallida.txt',
    redFallidaGlobal.join('\n') || '(sin respuestas 5xx)',
  );
});

test.describe('VISUAL — overflow por viewport', () => {
  for (const ruta of RUTAS_VISUAL) {
    for (const vp of VIEWPORTS) {
      test(`${ruta} @ ${vp.nombre} sin scroll horizontal`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(ruta, { waitUntil: 'networkidle' });
        const { scrollWidth, clientWidth } = await overflowDeDocumento(page);
        await page.screenshot({
          path: `../output/e2e/20260808-1300/capturas/visual_${ruta.replace(/\//g, '_')}_${vp.nombre}.png`,
          fullPage: true,
        });
        expect(scrollWidth, `overflow en ${ruta} @ ${vp.nombre}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
          clientWidth + 1,
        );
      });
    }
  }
});

test.describe('VISUAL — zoom 200% real (CDP)', () => {
  for (const ruta of ['/proyectos', '/catalogo']) {
    test(`${ruta} a zoom 200%`, async ({ page, context, browserName }) => {
      test.skip(browserName !== 'chromium', 'zoom real via CDP solo en chromium');
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(ruta, { waitUntil: 'networkidle' });
      const cdp = await context.newCDPSession(page);
      // Zoom real de navegador: scale 2 sobre un viewport lógico igual al real,
      // equivalente a Ctrl++ al 200%, no un transform CSS.
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
        scale: 2,
      });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `../output/e2e/20260808-1300/capturas/zoom200_${ruta.replace(/\//g, '_')}.png`,
      });
      await cdp.send('Emulation.clearDeviceMetricsOverride');
    });
  }
});

test.describe('A11Y — motion', () => {
  test('reduced-motion no rompe /proyectos', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/proyectos', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: '../output/e2e/20260808-1300/capturas/motion_reduce_proyectos.png' });
  });
  test('motion normal /proyectos', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/proyectos', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: '../output/e2e/20260808-1300/capturas/motion_normal_proyectos.png' });
  });
});

test.describe('A11Y — teclado y foco', () => {
  test('Tab recorre la navegación y :focus-visible se ve', async ({ page }) => {
    await page.goto('/proyectos', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const primero = await page.evaluate(() => document.activeElement?.tagName);
    expect(primero).toBeTruthy();
    let outlineVisible = false;
    for (let i = 0; i < 8; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
      });
      if (info && (info.outline !== 'none' || info.boxShadow !== 'none')) outlineVisible = true;
      await page.keyboard.press('Tab');
    }
    expect(outlineVisible).toBeTruthy();
  });

  // El atrás/adelante entre pestañas de sala con datos reales se cubre en
  // flujo-guardas.spec.ts, sobre la sala que ese archivo crea a propósito.
});
