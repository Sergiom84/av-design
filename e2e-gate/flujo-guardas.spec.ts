import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { instalarCapturaRed } from './captura-red';

instalarCapturaRed('flujo-guardas');

const sql = postgres('postgres://av_design:av_design_local@localhost:5433/av_design_e2e_a', { max: 1 });

const PREFIJO = 'E2E-20260808-1300-PLAYWRIGHT';
const NOMBRE_PROYECTO = `${PREFIJO} Proyecto guardas`;
const NOMBRE_SALA = `${PREFIJO} Sala guardas`;
const ETIQUETA_PLANTILLA_VIP24 = 'VIP · aforo 24'; // plantilla con más puertos disponibles

test.describe.configure({ mode: 'serial' });

let proyectoId = '';
let salaId = '';

async function shot(page: Page, nombre: string) {
  await page.screenshot({
    path: `../output/e2e/20260808-1300/capturas/flujo_${nombre}.png`,
    fullPage: true,
  });
}

test('crea proyecto y registra inicio', async ({ page }) => {
  await page.goto('/proyectos?nueva=1', { waitUntil: 'networkidle' });
  await page.getByLabel('Nombre').fill(NOMBRE_PROYECTO);
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await page.waitForURL(/\/proyectos\/[0-9a-f-]+$/);
  proyectoId = page.url().split('/proyectos/')[1];
  expect(proyectoId).toBeTruthy();

  // Registrar inicio si el formulario existe (requiere técnicos con rol inicio).
  const formInicio = page.locator('form', { hasText: 'Registrar inicio' });
  if (await formInicio.count()) {
    await formInicio.locator('select[name="tecnico_id"]').selectOption({ index: 1 });
    await formInicio.getByRole('button', { name: 'Registrar inicio' }).click();
    await page.waitForLoadState('networkidle');
  }
  await shot(page, '01_proyecto_creado');
});

test('crea sala desde plantilla con puertos', async ({ page }) => {
  await page.goto(`/salas/nueva?proyecto=${proyectoId}`, { waitUntil: 'networkidle' });
  const selectorPlantilla = page.locator('select[name="plantilla_id"]');
  const opcionPlantilla = await selectorPlantilla
    .locator('option')
    .filter({ hasText: ETIQUETA_PLANTILLA_VIP24 })
    .first()
    .getAttribute('value');
  expect(opcionPlantilla, `plantilla "${ETIQUETA_PLANTILLA_VIP24}" no encontrada`).toBeTruthy();
  await selectorPlantilla.selectOption(opcionPlantilla!);
  await page.getByLabel('Nombre', { exact: true }).fill(NOMBRE_SALA);
  await shot(page, '02_alta_sala');
  await page.getByRole('button', { name: 'Crear sala' }).first().click();
  await page.waitForURL(/\/salas\/[0-9a-f-]+$/);
  salaId = page.url().split('/salas/')[1];
  expect(salaId).toBeTruthy();
  await shot(page, '03_sala_creada_resumen');
});

test('añade una toma de red desde equipamiento', async ({ page }) => {
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  const formAnadir = page.locator('form', { has: page.getByRole('button', { name: 'Añadir toma' }) });
  await formAnadir.getByLabel('Código').fill(`${PREFIJO}-T1`);
  await formAnadir.getByRole('button', { name: 'Añadir toma' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`input[value="${PREFIJO}-T1"]`)).toBeVisible();
  await shot(page, '04_toma_anadida');
});

test('añade una conexión desde cableado', async ({ page }) => {
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  const formConexion = page.locator('form', { has: page.getByRole('button', { name: 'Añadir conexión' }) });
  const origenTx = await formConexion
    .locator('select[name="origen_id"] option')
    .filter({ hasText: 'EXTRON DTP HDMI 4K 230 TX' })
    .first()
    .getAttribute('value');
  const destinoRx = await formConexion
    .locator('select[name="destino_id"] option')
    .filter({ hasText: 'EXTRON DTP HDMI 4K 230 RX' })
    .first()
    .getAttribute('value');
  await formConexion.locator('select[name="origen_id"]').selectOption(origenTx!);
  await formConexion.locator('select[name="destino_id"]').selectOption(destinoRx!);
  await shot(page, '05_alta_conexion');
  await formConexion.getByRole('button', { name: 'Añadir conexión' }).click();
  await page.waitForLoadState('networkidle');
  await shot(page, '06_conexion_anadida');
});

test('atrás/adelante conserva la pestaña de sala', async ({ page }) => {
  await page.goto(`/salas/${salaId}`, { waitUntil: 'networkidle' });
  const resumenUrl = page.url();
  await page.getByRole('link', { name: 'Equipamiento' }).click();
  await page.waitForURL(/\/equipamiento$/);
  await page.getByRole('link', { name: 'Cableado' }).click();
  await page.waitForURL(/\/cableado$/);
  await page.goBack();
  await page.waitForURL(/\/equipamiento$/);
  await page.goBack();
  await page.waitForURL(resumenUrl);
  await page.goForward();
  await page.waitForURL(/\/equipamiento$/);
  // Recarga directa por URL de una pestaña: debe cargar sin depender de navegación previa.
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Conexiones', exact: true })).toBeVisible();
  await shot(page, '07b_pestanas_atras_adelante');
});

test('activa una pestaña de sala con Tab + Enter', async ({ page }) => {
  await page.goto(`/salas/${salaId}`, { waitUntil: 'networkidle' });
  const enlaceEquipamiento = page.getByRole('link', { name: 'Equipamiento' });
  // Se llega al enlace por teclado de verdad: Tab repetido hasta que el foco
  // cae sobre él, no un .focus() programático que se saltaría la navegación
  // real por tabulación.
  let intentos = 0;
  while (!(await enlaceEquipamiento.evaluate((el) => el === document.activeElement).catch(() => false))) {
    await page.keyboard.press('Tab');
    intentos++;
    if (intentos > 30) throw new Error('Tab no alcanzó el enlace "Equipamiento" en 30 pulsaciones');
  }
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/equipamiento$/);
  await expect(enlaceEquipamiento).toHaveAttribute('aria-current', 'page');
});

test('cierra el proyecto (registrar cierre)', async ({ page }) => {
  await page.goto(`/proyectos/${proyectoId}`, { waitUntil: 'networkidle' });
  const formCierre = page.locator('form', { hasText: 'Registrar cierre' });
  await expect(formCierre).toBeVisible();
  await formCierre.locator('select[name="tecnico_id"]').selectOption({ index: 1 });
  const notaCierre = formCierre.locator('input[name="notas"]');
  if (await notaCierre.count()) {
    await notaCierre.fill(`${PREFIJO} cierre con sala sin entregar, a propósito`);
  }
  await formCierre.getByRole('button', { name: 'Registrar cierre' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Obra cerrada: solo lectura')).toBeVisible();
  await shot(page, '07_proyecto_cerrado');
});

test('con proyecto cerrado: anadirToma no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  const tablaTomas = page.getByRole('group', { name: 'Tomas de red' });
  const antes = await tablaTomas.locator('tbody tr').count();
  const formAnadir = page.locator('form', { has: page.getByRole('button', { name: 'Añadir toma' }) });
  // El formulario sigue visible (la guarda avisa, no bloquea la UI) — se
  // comprueba que la Server Action no escribe, no que el botón desaparezca.
  await formAnadir.getByLabel('Código').fill(`${PREFIJO}-T2-BLOQUEADA`);
  await formAnadir.getByRole('button', { name: 'Añadir toma' }).click();
  await page.waitForLoadState('networkidle');
  const despues = await page.getByRole('group', { name: 'Tomas de red' }).locator('tbody tr').count();
  expect(despues, 'anadirToma no debe crear fila con proyecto cerrado').toBe(antes);
  await expect(page.locator(`input[value="${PREFIJO}-T2-BLOQUEADA"]`)).toHaveCount(0);
  const [{ n }] = await sql`select count(*)::int as n from tomas_red where sala_id = ${salaId} and codigo = ${`${PREFIJO}-T2-BLOQUEADA`}`;
  expect(n, 'verificación en BD: anadirToma no debe persistir con proyecto cerrado').toBe(0);
  await shot(page, '08_toma_bloqueada_no_escribe');
});

test('con proyecto cerrado: guardarToma no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  const fila = page.locator('form[id^="toma-"]').first();
  await expect(fila).toBeVisible();
  const inputCodigo = fila.getByLabel('Código de la roseta');
  const valorAntes = await inputCodigo.inputValue();
  await inputCodigo.fill(`${valorAntes}-EDITADO`);
  await fila.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForLoadState('networkidle');
  await page.reload({ waitUntil: 'networkidle' });
  const filaTrasReload = page.locator('form[id^="toma-"]').first();
  const valorTrasReload = await filaTrasReload.getByLabel('Código de la roseta').inputValue();
  expect(valorTrasReload, 'guardarToma no debe modificar el valor con proyecto cerrado').toBe(valorAntes);
  const [{ n }] = await sql`select count(*)::int as n from tomas_red where sala_id = ${salaId} and codigo = ${`${valorAntes}-EDITADO`}`;
  expect(n, 'verificación en BD: guardarToma no debe persistir el cambio con proyecto cerrado').toBe(0);
  await shot(page, '09_toma_edicion_bloqueada');
});

test('con proyecto cerrado: borrarToma no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  const antes = await page.locator('form[id^="toma-"]').count();
  const filaT1 = page.locator('tr').filter({ has: page.locator(`input[value="${PREFIJO}-T1"]`) });
  await filaT1.getByRole('button', { name: 'Quitar' }).click();
  await page.waitForLoadState('networkidle');
  const despues = await page.locator('form[id^="toma-"]').count();
  expect(despues, 'borrarToma no debe eliminar la toma con proyecto cerrado').toBe(antes);
  await expect(page.locator(`input[value="${PREFIJO}-T1"]`)).toBeVisible();
  const [{ n }] = await sql`select count(*)::int as n from tomas_red where sala_id = ${salaId} and codigo = ${`${PREFIJO}-T1`}`;
  expect(n, 'verificación en BD: borrarToma no debe eliminar con proyecto cerrado').toBe(1);
  await shot(page, '10_toma_borrado_bloqueado');
});

test('con proyecto cerrado: anadirConexion no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  const [{ n: antesBd }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId}`;
  const antes = await page.getByRole('group', { name: 'Conexiones' }).locator("tbody tr").count();
  const formConexion = page.locator('form', { has: page.getByRole('button', { name: 'Añadir conexión' }) });
  await expect(formConexion).toBeVisible();
  const origenNav = await formConexion
    .locator('select[name="origen_id"] option')
    .filter({ hasText: 'CISCO ROOM NAVIGATOR' })
    .first()
    .getAttribute('value');
  const destinoRx2 = await formConexion
    .locator('select[name="destino_id"] option')
    .filter({ hasText: 'EXTRON DTP HDMI 4K 230 RX' })
    .first()
    .getAttribute('value');
  await formConexion.locator('select[name="origen_id"]').selectOption(origenNav!);
  await formConexion.locator('select[name="destino_id"]').selectOption(destinoRx2!);
  await formConexion.getByRole('button', { name: 'Añadir conexión' }).click();
  await page.waitForLoadState('networkidle');
  const despues = await page.getByRole('group', { name: 'Conexiones' }).locator("tbody tr").count();
  expect(despues, 'anadirConexion no debe crear tirada con proyecto cerrado').toBe(antes);
  const [{ n: despuesBd }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId}`;
  expect(despuesBd, 'verificación en BD: anadirConexion no debe persistir con proyecto cerrado').toBe(antesBd);
  await shot(page, '11_conexion_bloqueada_no_escribe');
});

test('con proyecto cerrado: guardarConexion no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  const [{ senal: senalAntes }] = await sql`select senal::text from conexiones where sala_id = ${salaId} limit 1`;
  const nuevaSenal = senalAntes === 'hdmi' ? 'red' : 'hdmi';
  // Los controles de cada fila referencian su <form id="conexion-{id}"> por el
  // atributo HTML `form=`, no por anidamiento en el DOM — el select y los
  // botones viven en la <tr>, el <form> es un elemento hermano y vacío. Por
  // eso se localiza la fila (tr), no el form.
  const filaConexion = page.getByRole('group', { name: 'Conexiones' }).locator('tbody tr').first();
  await expect(filaConexion, 'debe existir la conexión creada en el paso previo').toBeVisible();
  await filaConexion.locator('select[name="senal"]').selectOption(nuevaSenal);
  await filaConexion.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForLoadState('networkidle');
  const [{ n }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId} and senal::text = ${nuevaSenal}`;
  expect(n, 'verificación en BD: guardarConexion no debe cambiar la señal con proyecto cerrado').toBe(0);
  await shot(page, '11b_conexion_edicion_bloqueada');
});

test('con proyecto cerrado: borrarConexion no escribe desde la UI', async ({ page }) => {
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  const [{ n: antesBd }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId}`;
  const antes = await page.getByRole('group', { name: 'Conexiones' }).locator('tbody tr').count();
  await page
    .getByRole('group', { name: 'Conexiones' })
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: 'Quitar' })
    .click();
  await page.waitForLoadState('networkidle');
  const despues = await page.getByRole('group', { name: 'Conexiones' }).locator('tbody tr').count();
  expect(despues, 'borrarConexion no debe eliminar la fila con proyecto cerrado').toBe(antes);
  const [{ n: despuesBd }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId}`;
  expect(despuesBd, 'verificación en BD: borrarConexion no debe eliminar con proyecto cerrado').toBe(antesBd);
  await shot(page, '11c_conexion_borrado_bloqueado');
});

test('reabre el proyecto borrando el cierre', async ({ page }) => {
  await page.goto(`/proyectos/${proyectoId}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Borrar cierre' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Borrar cierre definitivamente' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Obra cerrada: solo lectura')).toHaveCount(0);
  await shot(page, '12_proyecto_reabierto');
});

test('con proyecto reabierto: anadirToma vuelve a escribir', async ({ page }) => {
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  const antes = await page.getByRole('group', { name: 'Tomas de red' }).locator('tbody tr').count();
  const formAnadir = page.locator('form', { has: page.getByRole('button', { name: 'Añadir toma' }) });
  await formAnadir.getByLabel('Código').fill(`${PREFIJO}-T3-REABIERTA`);
  await formAnadir.getByRole('button', { name: 'Añadir toma' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`input[value="${PREFIJO}-T3-REABIERTA"]`)).toBeVisible();
  const despues = await page.getByRole('group', { name: 'Tomas de red' }).locator('tbody tr').count();
  expect(despues, 'anadirToma sí debe escribir con proyecto reabierto (control positivo)').toBe(antes + 1);
  await shot(page, '13_toma_reabierta_si_escribe');
});

test('con proyecto reabierto: guardarConexion vuelve a escribir (control positivo)', async ({ page }) => {
  await page.goto(`/salas/${salaId}/cableado`, { waitUntil: 'networkidle' });
  const [{ senal: senalAntes }] = await sql`select senal::text from conexiones where sala_id = ${salaId} limit 1`;
  const nuevaSenal = senalAntes === 'hdmi' ? 'red' : 'hdmi';
  const filaConexion = page.getByRole('group', { name: 'Conexiones' }).locator('tbody tr').first();
  await filaConexion.locator('select[name="senal"]').selectOption(nuevaSenal);
  await filaConexion.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForLoadState('networkidle');
  let n = 0;
  for (let intento = 0; intento < 10 && n === 0; intento++) {
    [{ n }] = await sql`select count(*)::int as n from conexiones where sala_id = ${salaId} and senal::text = ${nuevaSenal}`;
    if (n === 0) await page.waitForTimeout(200);
  }
  expect(n, 'verificación en BD: guardarConexion sí debe cambiar la señal con proyecto reabierto').toBe(1);
  await shot(page, '14_conexion_reabierta_si_escribe');
});

// Se coloca al final a propósito: usa expect.soft para no abortar en modo
// serial el resto de la evidencia (guardas, control positivo) si falla, y
// porque en la práctica SÍ falla — ver hallazgo E2E-VIS-004 en el consolidado.
test('pestaña activa a 320px con motion normal y reducido', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/salas/${salaId}/equipamiento`, { waitUntil: 'networkidle' });
  let overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect.soft(
    overflow.scrollWidth,
    `overflow a 320px, motion normal: ${JSON.stringify(overflow)} — ver E2E-VIS-004`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await shot(page, '07c_pestana_320_motion_normal');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect.soft(
    overflow.scrollWidth,
    `overflow a 320px, motion reducido: ${JSON.stringify(overflow)} — ver E2E-VIS-004`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await shot(page, '07d_pestana_320_motion_reducido');

  await page.setViewportSize({ width: 1280, height: 800 });
});

test.afterAll(async () => {
  await sql.end();
});
