import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

test.describe.configure({ mode: 'serial' });

const NOMBRE_SALA = `E2E Diagrama ${Date.now()}`;
const NOMBRE_EQUIPO = 'Equipo de prueba E2E Diagrama';
let salaId = '';
let equipoId = '';
let db: ReturnType<typeof postgres>;

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('El gate exige DATABASE_URL efímera.');
  db = postgres(process.env.DATABASE_URL, { max: 1 });
  const [articulo] = await db<{ id: string }[]>`
    select id from articulos where tipo = 'equipo' and activo order by id limit 1`;
  if (!articulo) throw new Error('La siembra no contiene un equipo activo.');

  const [sala] = await db<{ id: string }[]>`
    insert into salas (
      nombre, largo_m, ancho_m, alto_m, aforo, sillas_modo,
      diagrama_iniciado_en, diagrama_origen
    ) values (
      ${NOMBRE_SALA}, 8, 6, 3, 0, 'manuales', now(), 'desde_cero'
    ) returning id`;
  salaId = sala.id;
  const [equipo] = await db<{ id: string }[]>`
    insert into sala_equipos (
      sala_id, articulo_id, nombre, cantidad, extremo,
      x_m, y_m, z_m, posicion_confirmada, rotacion_grados
    ) values (
      ${salaId}, ${articulo.id}, ${NOMBRE_EQUIPO}, 1, 'pared',
      2, 2, 1.2, true, 0
    ) returning id`;
  equipoId = equipo.id;
});

test.afterAll(async () => {
  if (db && salaId) await db`delete from salas where id = ${salaId}`;
  if (db) await db.end();
});

const ruta = () => `/salas/${salaId}/diagrama`;

async function seleccionarEquipo(page: Page) {
  const boton = page.locator('button:visible').filter({ hasText: NOMBRE_EQUIPO }).first();
  await expect(boton).toBeVisible();
  await boton.click();
}

async function campoX(page: Page) {
  return page.locator('label:visible').filter({ hasText: /^X \(m\)/ }).locator('input').first();
}

async function guardar(page: Page) {
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
}

test('escritorio: arrastre, guardia Escape, persistencia y Resumen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(ruta());
  await expect(page.getByRole('heading', { name: NOMBRE_SALA })).toBeVisible();
  await seleccionarEquipo(page);

  const x = await campoX(page);
  const inicial = Number((await x.inputValue()).replace(',', '.'));
  const agarre = page.locator('svg[aria-label^="Plano en planta"] rect[fill="transparent"]').first();
  const caja = await agarre.boundingBox();
  if (!caja) throw new Error('No se encontró el agarre SVG del equipo.');
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2 + 70, caja.y + caja.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(x).not.toHaveValue(String(inicial));

  await page.getByRole('link', { name: 'Resumen', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Hay cambios sin guardar en el plano' });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/salas/${salaId}/diagrama$`));
  await expect(page.getByText('Cambios sin guardar', { exact: true })).toBeVisible();

  const xGuardada = Number((await x.inputValue()).replace(',', '.'));
  await guardar(page);
  await page.reload();
  await seleccionarEquipo(page);
  await expect(await campoX(page)).toHaveValue(String(xGuardada).replace('.', ','));

  await page.getByRole('link', { name: 'Resumen', exact: true }).click();
  await expect(page.getByRole('img', { name: `Croquis en planta de ${NOMBRE_SALA}` })).toBeVisible();
  const [fila] = await db<{ x_m: string }[]>`select x_m::text from sala_equipos where id = ${equipoId}`;
  expect(Number(fila.x_m)).toBeCloseTo(xGuardada, 2);
  await page.screenshot({ path: testInfo.outputPath('escritorio-resumen.png'), fullPage: true });
});

test('conflicto real: adopta la versión nueva antes de permitir el siguiente guardado', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const primera = await contexto.newPage();
  const segunda = await contexto.newPage();
  await Promise.all([primera.goto(ruta()), segunda.goto(ruta())]);
  await seleccionarEquipo(primera);
  await seleccionarEquipo(segunda);

  const [versionInicial] = await db<{ diagrama_version: number }[]>`
    select diagrama_version from salas where id = ${salaId}`;
  await (await campoX(primera)).fill('3,10');
  await guardar(primera);
  await (await campoX(segunda)).fill('4,20');
  await segunda.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(segunda.getByText('Conflicto', { exact: true })).toBeVisible();
  await expect(segunda.getByText(/cambió en otra pestaña/i)).toBeVisible();

  await segunda.getByRole('button', { name: 'Descartar' }).click();
  await expect(segunda.getByText(/Recargando la versión actual/)).toBeVisible();
  await expect(segunda.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
  await expect(segunda.getByText('Conflicto', { exact: true })).toBeHidden();

  await seleccionarEquipo(segunda);
  await (await campoX(segunda)).fill('4,30');
  await guardar(segunda);
  const [final] = await db<{ diagrama_version: number; x_m: string }[]>`
    select s.diagrama_version, e.x_m::text
    from salas s join sala_equipos e on e.sala_id = s.id
    where s.id = ${salaId} and e.id = ${equipoId}`;
  expect(final.diagrama_version).toBe(versionInicial.diagrama_version + 2);
  expect(Number(final.x_m)).toBeCloseTo(4.3, 2);
  await contexto.close();
});

test('responsive: 768, 390 y 320 sin overflow y con objetivos de 44 px', async ({ page }, testInfo) => {
  for (const ancho of [768, 390, 320]) {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto(ruta());
    const panel = page.locator('details:visible > summary');
    await expect(panel).toBeVisible();
    await panel.click();

    const medida = await page.evaluate(() => {
      const raiz = document.documentElement;
      const selectores = 'a,button,input,select,textarea,summary,[role="button"]';
      const pequenos = [...document.querySelectorAll<HTMLElement>(selectores)]
        .filter((el) => {
          const estilo = getComputedStyle(el);
          const caja = el.getBoundingClientRect();
          return estilo.visibility !== 'hidden' && estilo.display !== 'none' && caja.width > 0 && caja.height > 0;
        })
        .map((el) => {
          const objetivo = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)
            ? el.closest<HTMLElement>('label') ?? el
            : el;
          const caja = objetivo.getBoundingClientRect();
          return { texto: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 50) ?? el.tagName, ancho: caja.width, alto: caja.height };
        })
        .filter((caja) => caja.ancho < 43.5 || caja.alto < 43.5);
      return {
        clientWidth: raiz.clientWidth,
        scrollWidth: raiz.scrollWidth,
        pequenos,
      };
    });
    expect(medida.scrollWidth, `overflow horizontal a ${ancho}px`).toBeLessThanOrEqual(medida.clientWidth + 1);
    expect(medida.pequenos, `objetivos menores de 44px a ${ancho}px`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`diagrama-${ancho}.png`), fullPage: true });
  }
});

test('reduced motion y arrastre táctil emulado', async ({ browser, baseURL }) => {
  const contexto = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await contexto.newPage();
  await page.goto(ruta());
  const duraciones = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('*')]
      .filter((el) => el.getClientRects().length > 0)
      .flatMap((el) => {
        const css = getComputedStyle(el);
        return [css.animationDuration, css.transitionDuration]
          .flatMap((valor) => valor.split(','))
          .map((valor) => Number.parseFloat(valor) || 0);
      }),
  );
  expect(Math.max(...duraciones)).toBeLessThanOrEqual(0.01);

  const agarre = page.locator('svg[aria-label^="Plano en planta"] rect[fill="transparent"]').first();
  const caja = await agarre.boundingBox();
  if (!caja) throw new Error('No se encontró el agarre SVG táctil.');
  const cdp = await contexto.newCDPSession(page);
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let paso = 1; paso <= 6; paso += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + paso * 8, y, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByText('Cambios sin guardar', { exact: true })).toBeVisible();
  await contexto.close();
});
