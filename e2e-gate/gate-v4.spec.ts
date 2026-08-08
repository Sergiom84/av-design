import { test, expect, type Page } from '@playwright/test';
import { instalarCapturaRed } from './captura-red';

instalarCapturaRed('gate-v4');

const PREFIJO = 'E2E-20260808-1300-PLAYWRIGHT';

const VIEWPORTS = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '1280x800', width: 1280, height: 800 },
  { nombre: '1024x768', width: 1024, height: 768 },
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

test.describe('VISUAL — reflow equivalente a zoom 200%', () => {
  // El parámetro `scale` de CDP Emulation.setDeviceMetricsOverride escala la
  // IMAGEN capturada, no el layout (https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setDeviceMetricsOverride) —
  // no reproduce el zoom de página. El zoom de navegador (Ctrl++) sí reduce el
  // viewport CSS efectivo a la mitad a 200%: un desktop de 1280×800 pasa a
  // reflowar como si el viewport fuera 640×400. Se emula así, verificando
  // primero que el viewport efectivo cambió de verdad, y solo entonces se
  // afirma la ausencia de overflow — igual que a 320/390.
  for (const ruta of RUTAS_VISUAL) {
    test(`${ruta} — reflow equivalente a 200% (viewport CSS a la mitad)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(ruta, { waitUntil: 'networkidle' });
      const clientWidthAntes = await page.evaluate(() => document.documentElement.clientWidth);

      await page.setViewportSize({ width: 640, height: 400 });
      const clientWidthDespues = await page.evaluate(() => document.documentElement.clientWidth);
      expect(
        clientWidthDespues,
        'el viewport efectivo debe reducirse a la mitad — si no cambia, el zoom no se aplicó',
      ).toBeLessThan(clientWidthAntes);

      const { scrollWidth, clientWidth } = await overflowDeDocumento(page);
      await page.screenshot({
        path: `../output/e2e/20260808-1300/capturas/zoom200_${ruta.replace(/\//g, '_')}.png`,
        fullPage: true,
      });
      expect(
        scrollWidth,
        `overflow con reflow equivalente a 200% en ${ruta}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`,
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});

test.describe('A11Y — motion', () => {
  // `.boton` declara `transition: ... 0.15s ease` en globals.css — un elemento
  // sin transición propia (como <body>) tiene duration inicial "0s" en ambos
  // modos y no distingue nada. Se mide sobre un botón real de la página.
  test('reduced-motion colapsa la transición de .boton en /proyectos', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/proyectos', { waitUntil: 'networkidle' });
    const boton = page.locator('.boton').first();
    await expect(boton).toBeVisible();
    // getComputedStyle normaliza a segundos con notación científica
    // (parseFloat lo entiende igual: "1e-05s" -> 0.00001).
    const transicion = await boton.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    expect(transicion, 'globals.css debe forzar transition-duration a ~0 con reduced-motion').toBeLessThan(0.001);
    await page.screenshot({ path: '../output/e2e/20260808-1300/capturas/motion_reduce_proyectos.png' });
  });
  test('motion normal /proyectos conserva la transición declarada de .boton', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/proyectos', { waitUntil: 'networkidle' });
    const boton = page.locator('.boton').first();
    await expect(boton).toBeVisible();
    const transicion = await boton.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    expect(transicion, 'sin reduced-motion la transición de .boton debe seguir en 0.15s').toBeCloseTo(0.15, 2);
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
