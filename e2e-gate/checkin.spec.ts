import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { instalarCapturaRed } from './captura-red';

instalarCapturaRed('checkin');

const sql = postgres('postgres://av_design:av_design_local@localhost:5433/av_design_e2e_a', { max: 1 });

const PREFIJO = 'E2E-20260808-1300-PLAYWRIGHT';
const NOMBRE_SALA = `${PREFIJO} Sala checkin`;

test.describe.configure({ mode: 'serial' });

let salaId = '';
let visitaId = '';

async function shot(page: Page, nombre: string) {
  await page.screenshot({
    path: `../output/e2e/20260808-1300/capturas/checkin_${nombre}.png`,
    fullPage: true,
  });
}

test('crea una sala en blanco para la visita', async ({ page }) => {
  await page.goto('/salas/nueva', { waitUntil: 'networkidle' });
  await page.getByLabel('Nombre', { exact: true }).fill(NOMBRE_SALA);
  await page.getByRole('button', { name: 'Crear sala' }).first().click();
  await page.waitForURL(/\/salas\/[0-9a-f-]+$/);
  salaId = page.url().split('/salas/')[1];
  expect(salaId).toBeTruthy();
});

test('abre una visita de check-in para la sala', async ({ page }) => {
  await page.goto('/checkin', { waitUntil: 'networkidle' });
  const formAlta = page.locator('form', { has: page.getByRole('button', { name: 'Abrir visita' }) });
  await formAlta.locator('select[name="sala_id"]').selectOption(salaId);
  await formAlta.locator('input[name="quien"]').fill(`${PREFIJO} técnico`);
  await formAlta.getByRole('button', { name: 'Abrir visita' }).click();
  await page.waitForURL(/\/checkin\/[0-9a-f-]+$/);
  visitaId = page.url().split('/checkin/')[1];
  expect(visitaId).toBeTruthy();
  await shot(page, '01_visita_abierta');
});

test('la visita nace con 22 puntos pendientes', async ({ page }) => {
  const [{ n }] = await sql`select count(*)::int as n from revision_puntos where revision_id = ${visitaId}`;
  expect(n, 'la plantilla de check-in tiene 22 puntos').toBe(22);
  await page.goto(`/checkin/${visitaId}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('0 de 22 puntos mirados')).toBeVisible();
});

test('el botón de cerrar está deshabilitado con puntos sin mirar', async ({ page }) => {
  await page.goto(`/checkin/${visitaId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Cerrar visita' })).toBeDisabled();
  await shot(page, '02_cierre_deshabilitado');
});

test('marca los 22 puntos como conforme, uno por uno', async ({ page }) => {
  await page.goto(`/checkin/${visitaId}`, { waitUntil: 'networkidle' });

  // Cada punto conserva sus tres botones (Conforme/Incidencia/No aplica)
  // también tras marcarse — pulsar de nuevo el mismo estado lo deshace. Por
  // eso se recorre por índice fijo, no por "el primer formulario con botón
  // Conforme": ese selector siempre resuelve al primer punto de la lista y
  // acabaría marcando y desmarcando el mismo punto 22 veces.
  const formulariosPunto = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Conforme', exact: true }),
  });
  await expect(formulariosPunto).toHaveCount(22);

  for (let i = 0; i < 22; i++) {
    const formularioPunto = formulariosPunto.nth(i);
    const campoValor = formularioPunto.locator('input[name="valor"]');
    if (await campoValor.count()) {
      await campoValor.fill(`${PREFIJO} valor ${i + 1}`);
    }
    await formularioPunto.getByRole('button', { name: 'Conforme', exact: true }).click();
    await page.waitForLoadState('networkidle');
  }

  await expect(page.getByText('22 de 22 puntos mirados')).toBeVisible();
  const [{ n }] = await sql`
    select count(*)::int as n from revision_puntos
    where revision_id = ${visitaId} and estado = 'conforme'`;
  expect(n, 'verificación en BD: los 22 puntos deben quedar en conforme').toBe(22);
  await shot(page, '03_veintidos_puntos_conforme');
});

test('cierra la visita ya completa', async ({ page }) => {
  await page.goto(`/checkin/${visitaId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Cerrar visita' })).toBeEnabled();
  await page.getByRole('button', { name: 'Cerrar visita' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Visita cerrada')).toBeVisible();
  let cerrada = false;
  for (let intento = 0; intento < 10 && !cerrada; intento++) {
    [{ cerrada }] = await sql`select cerrada from revisiones where id = ${visitaId}`;
    if (!cerrada) await page.waitForTimeout(200);
  }
  expect(cerrada, 'verificación en BD: la visita debe quedar cerrada').toBe(true);
  await shot(page, '04_visita_cerrada');
});

test('una visita cerrada no vuelve a mostrar botones de marcar', async ({ page }) => {
  await page.goto(`/checkin/${visitaId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Conforme', exact: true })).toHaveCount(0);
  await shot(page, '05_visita_cerrada_solo_lectura');
});

test.afterAll(async () => {
  await sql.end();
});
