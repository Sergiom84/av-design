import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { conectarRevisiones, fotografiarRevisiones, FIXTURE_REVISIONES as f, type SqlRevisionesPrueba } from '../scripts/revisiones-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';

const salida = resolve(process.env.E3_SALIDA_E2E ?? 'output/e3-revisiones/navegador');
const origen = 'http://localhost:3105';
const secreto = 'e3-local-prueba-revisiones-secreto-2026';
const tanda = Date.now().toString(36);
let sql: SqlRevisionesPrueba;
let revisionAntes: string;
let revisionDespues: string;
let copia: string;
const errores: string[] = [];
async function entrar(context: BrowserContext, id = f.admin) {
  await context.clearCookies();
  await context.addCookies([{ name: COOKIE_SESION, value: await firmarSesion(secreto, Date.now() + 3600_000, id), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
async function historial(context: BrowserContext, sala = f.sala) {
  const r = await context.request.get(`/api/salas/${sala}/revisiones`); expect(r.status()).toBe(200); return r.json();
}
async function operacion() {
  const resultado: Record<string, unknown> = {};
  for (const tabla of ['movimientos', 'reservas', 'pedidos', 'pedido_lineas', 'cargas', 'carga_lineas', 'hitos_sala', 'hitos_proyecto', 'revisiones', 'revision_puntos', 'importacion_lotes', 'importacion_cambios']) {
    resultado[tabla] = await sql.unsafe(`select to_jsonb(t) as fila from ${tabla} t order by to_jsonb(t)::text`);
  }
  return resultado;
}
async function guardarRevision(page: Page, context: BrowserContext, nombre: string) {
  await page.getByLabel('Nombre de revisión', { exact: true }).fill(nombre);
  const respuesta = page.waitForResponse(r => r.url().endsWith(`/api/salas/${f.sala}/revisiones`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar revisión', exact: true }).click();
  expect((await respuesta).status()).toBe(201);
  await expect(page.getByText(nombre, { exact: false }).first()).toBeVisible();
  const h = await historial(context); return h.revisiones.find((r: { nombre: string }) => r.nombre === nombre).id as string;
}
async function guardarEditor(page: Page) {
  const guardado = page.waitForResponse(r => r.url().includes('/diagrama') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  expect((await guardado).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Guardar borrador', exact: true })).toBeDisabled();
}

test.describe.serial('E3 escritorio completo y móvil al cierre', () => {
  test.beforeAll(async () => {
    if (!process.env.REVISIONES_DATABASE_URL) throw new Error('URL E3 explícita obligatoria.');
    sql = await conectarRevisiones(process.env.REVISIONES_DATABASE_URL);
    await mkdir(salida, { recursive: true });
    await writeFile(resolve(salida, 'bd-antes.json'), JSON.stringify(await fotografiarRevisiones(sql), null, 2));
    await writeFile(resolve(salida, 'operacion-antes.json'), JSON.stringify(await operacion(), null, 2));
  });
  test.afterAll(async () => {
    if (!sql) return;
    await writeFile(resolve(salida, 'bd-despues.json'), JSON.stringify(await fotografiarRevisiones(sql), null, 2));
    await writeFile(resolve(salida, 'operacion-despues.json'), JSON.stringify(await operacion(), null, 2));
    const antes = JSON.parse(await readFile(resolve(salida, 'operacion-antes.json'), 'utf8'));
    expect(await operacion()).toEqual(antes);
    await writeFile(resolve(salida, 'consola.json'), JSON.stringify({ erroresPagina: errores }, null, 2));
    expect(errores).toEqual([]);
    await sql.end();
  });

  test('escritorio: revisión, notas, preview/deshacer, diff, restauración, alternativa y PDF real', async ({ page, context }) => {
    page.on('pageerror', e => errores.push(e.message)); await entrar(context);
    const notasPrevias = await sql`select id from anotaciones_sala where sala_id=${f.sala} and texto like 'E3 navegador%'`;
    await page.goto(`/salas/${f.sala}/documentos`);
    await expect(page.getByRole('heading', { name: 'Revisiones y alternativas', exact: true })).toBeVisible();
    revisionAntes = await guardarRevision(page, context, 'E3 navegador · anterior');
    await page.goto(`/salas/${f.sala}/diagrama`);
    await page.getByLabel('Texto de anotación', { exact: true }).fill('E3 navegador · Nota de instalación de sala');
    await page.getByRole('button', { name: 'Añadir anotación', exact: true }).click();
    await page.getByLabel('Ancla de anotación', { exact: true }).selectOption(`equipo:${f.equipoPantalla}`);
    await page.getByLabel('Texto de anotación', { exact: true }).fill('E3 navegador · Fijar pantalla según altura medida');
    await page.getByRole('button', { name: 'Añadir anotación', exact: true }).click();
    await page.getByLabel('Ancla de anotación', { exact: true }).selectOption(`conexion:${f.conexionHdmi}`);
    await page.getByLabel('Texto de anotación', { exact: true }).fill('E3 navegador · Conservar etiqueta de brida HD-1000');
    await page.getByRole('button', { name: 'Añadir anotación', exact: true }).click();
    await page.getByLabel('Ancla de anotación', { exact: true }).selectOption('visual');
    await page.getByLabel('Texto de anotación', { exact: true }).fill('E3 navegador · Callout visual sin medida física');
    await page.getByLabel('X visual de anotación').fill('50'); await page.getByLabel('Y visual de anotación').fill('50');
    await page.getByRole('button', { name: 'Añadir anotación', exact: true }).click();
    await page.getByRole('button', { name: 'Seleccionar todos', exact: true }).click();
    await page.getByRole('button', { name: 'Distribuir vertical', exact: true }).click();
    await expect(page.getByText('Vista previa de posiciones visuales.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar vista previa', exact: true }).click();
    await page.getByRole('button', { name: 'Ordenar por flujo', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar posiciones', exact: true }).click();
    await page.getByRole('button', { name: /^Mover / }).first().press('ArrowRight');
    await page.getByRole('button', { name: 'Deshacer posición', exact: true }).click();
    await page.getByRole('button', { name: 'Rehacer posición', exact: true }).click();
    await page.screenshot({ path: resolve(salida, 'escritorio-editor-notas.png'), fullPage: true });
    await guardarEditor(page);
    await page.reload();
    expect(await sql`select id from anotaciones_sala where sala_id=${f.sala} and texto like 'E3 navegador%'`).toHaveLength(notasPrevias.length + 4);
    const antesBajas = await fotografiarRevisiones(sql);
    await page.goto(`/salas/${f.sala}/equipamiento`);
    await page.locator('form').filter({ has: page.locator(`input[name="id"][value="${f.equipoPantalla}"]`) }).filter({ has: page.getByRole('button', { name: 'Quitar', exact: true }) }).getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(page).toHaveURL(/anotaciones=resolver/);
    await expect(page.getByText('El equipo o cable conserva anotaciones.', { exact: false })).toBeVisible();
    expect(await fotografiarRevisiones(sql)).toEqual(antesBajas);
    await page.getByLabel('Seleccionar conexión', { exact: true }).selectOption(f.conexionHdmi);
    await page.getByRole('button', { name: 'Quitar conexión', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Anotaciones del ancla retirada', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar borrador', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar baja', exact: true }).click();
    await expect(page.getByLabel('Seleccionar conexión', { exact: true })).toHaveValue(f.conexionHdmi);
    await page.goto(`/salas/${f.sala}/documentos`);
    revisionDespues = await guardarRevision(page, context, 'E3 navegador · con anotaciones');
    const h = await historial(context); const a = h.revisiones.find((r: { id: string }) => r.id === revisionAntes); const b = h.revisiones.find((r: { id: string }) => r.id === revisionDespues);
    await page.getByRole('checkbox', { name: `Comparar revisión ${a.numero}`, exact: true }).check();
    await page.getByRole('checkbox', { name: `Comparar revisión ${b.numero}`, exact: true }).check();
    await page.getByRole('button', { name: 'Comparar revisiones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Diferencias de diseño', exact: true })).toBeVisible();
    await expect(page.getByText(/Anotaciones · añadido/).first()).toBeVisible();
    const diffPrimero = await page.getByLabel('Diferencias de diseño', { exact: true }).textContent() ?? '';
    await page.getByRole('checkbox', { name: `Comparar revisión ${a.numero}`, exact: true }).uncheck();
    await page.getByRole('checkbox', { name: `Comparar revisión ${b.numero}`, exact: true }).uncheck();
    await page.getByRole('checkbox', { name: `Comparar revisión ${b.numero}`, exact: true }).check();
    await page.getByRole('checkbox', { name: `Comparar revisión ${a.numero}`, exact: true }).check();
    const diffAlReves = page.waitForResponse(r => r.url().includes('/comparar?'));
    await page.getByRole('button', { name: 'Comparar revisiones', exact: true }).click();
    expect((await diffAlReves).status()).toBe(200);
    await expect(page.getByLabel('Diferencias de diseño', { exact: true })).toHaveText(diffPrimero);
    await page.screenshot({ path: resolve(salida, 'escritorio-diff.png'), fullPage: true });
    await page.getByRole('button', { name: `Revisar restauración R${b.numero}`, exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar revisión', exact: true }).click();
    await expect(page.getByText('Diseño restaurado en una revisión nueva.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Previsualizar duplicación', exact: true }).click();
    await expect(page.getByText('Existencias y movimientos de almacén', { exact: true })).toBeVisible();
    await page.getByLabel('Nombre de alternativa', { exact: true }).fill(`E3 navegador · alternativa ${tanda}`);
    await page.getByLabel('Código de alternativa', { exact: true }).fill(`PRUEBA-REV-ALTERNATIVA-${tanda}`);
    const duplicada = page.waitForResponse(r => r.url().endsWith('/duplicar') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear alternativa', exact: true }).click();
    const respuestaCopia = await duplicada; expect(respuestaCopia.status()).toBe(201); copia = (await respuestaCopia.json()).salaId;
    await expect(page.getByRole('link', { name: 'Abrir alternativa creada', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Abrir alternativa creada', exact: true }).click();
    await expect(page.getByText('Medidas heredadas de', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Comparar con origen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Diferencias de diseño', exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'escritorio-alternativa.png'), fullPage: true });
    const seleccion = { salaIds: [copia], documentos: ['plano', 'esquema', 'bom-xlsx', 'cables-csv'], opciones: { papel: 'A4', orientacion: 'horizontal', escala: 50 } };
    const generada = await context.request.post('/api/documentos', { data: seleccion, headers: { origin: origen } }); expect(generada.status()).toBe(200);
    const eventos = (await generada.text()).trim().split('\n').map(l => JSON.parse(l)); const manifest = eventos.at(-1).manifiesto;
    expect(manifest.archivos.every((r: { estado: string }) => r.estado === 'correcto')).toBe(true);
    for (const archivo of manifest.archivos) {
      const r = await context.request.get(`/api/documentos/${manifest.id}/descarga?archivo=${encodeURIComponent(archivo.nombre)}`);
      expect(r.status()).toBe(200); const bytes = await r.body();
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(archivo.sha256);
      await writeFile(resolve(salida, archivo.nombre), bytes);
    }
    await writeFile(resolve(salida, 'exportacion-alternativa.json'), JSON.stringify(manifest, null, 2));
    await writeFile(resolve(salida, 'identidades.json'), JSON.stringify({ revisionAntes, revisionDespues, copia }, null, 2));
  });

  test('escritorio: matriz 15 equipos/24 bocas/100 conexiones, teclado, ratón y invariantes', async ({ page, context }) => {
    page.on('pageerror', e => errores.push(e.message)); await entrar(context);
    const antes = await sql`select id,x_m,y_m,z_m,posicion_confirmada,rotacion_grados,dimensiones_tecnicas from sala_equipos where sala_id=${f.grande} order by id`;
    const cables = await sql`select to_jsonb(c) as fila from conexiones c where sala_id=${f.grande} order by id`;
    await page.goto(`/salas/${f.grande}/diagrama`);
    await expect(page.getByRole('button', { name: /^Seleccionar cable HD-/ })).toHaveCount(100);
    await page.getByRole('button', { name: 'Seleccionar todos', exact: true }).click();
    await page.getByRole('button', { name: 'Ordenar por flujo', exact: true }).click();
    await page.screenshot({ path: resolve(salida, 'escritorio-matriz-preview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Aplicar posiciones', exact: true }).click();
    const bloques = await page.locator('[data-equipo]').evaluateAll(nodos => nodos.map(n => { const e = n as HTMLElement; return { id: e.dataset.equipo, x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height) }; }));
    expect(bloques).toHaveLength(15);
    for (let i = 0; i < bloques.length; i++) for (let j = i + 1; j < bloques.length; j++) {
      const a = bloques[i], b = bloques[j]; expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    const mover = page.getByRole('button', { name: 'Mover Matriz 24 bocas', exact: true });
    await mover.focus(); await mover.press('ArrowRight'); await mover.press('ArrowLeft');
    const caja = await mover.boundingBox(); expect(caja).not.toBeNull();
    await page.mouse.move(caja!.x + 20, caja!.y + 20); await page.mouse.down(); await page.mouse.move(caja!.x + 35, caja!.y + 20); await page.mouse.up();
    await page.getByLabel('Seleccionar conexión', { exact: true }).selectOption(f.conexionGrande(99));
    await expect(page.getByLabel('Longitud del cable', { exact: true })).toContainText('5 m');
    await page.getByRole('button', { name: 'Ampliar zoom', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restablecer zoom' })).toHaveText('125 %');
    await page.screenshot({ path: resolve(salida, 'escritorio-matriz-seleccion.png'), fullPage: true });
    await guardarEditor(page);
    expect(await sql`select id,x_m,y_m,z_m,posicion_confirmada,rotacion_grados,dimensiones_tecnicas from sala_equipos where sala_id=${f.grande} order by id`).toEqual(antes);
    expect(await sql`select to_jsonb(c) as fila from conexiones c where sala_id=${f.grande} order by id`).toEqual(cables);
    await writeFile(resolve(salida, 'matriz-invariantes.json'), JSON.stringify({ bloques, fisicoAntes: antes, fisicoDespues: antes, conexiones: cables.length, longitudManual: 5 }, null, 2));
  });

  test('APIs: permisos actuales, pertenencia, origen y obra cerrada', async ({ context }) => {
    await entrar(context); const h = await historial(context);
    const ajena = await context.request.get(`/api/salas/${f.salaDos}/revisiones/${revisionDespues}`); expect(ajena.status()).toBe(404);
    const origenAjeno = await context.request.post(`/api/salas/${f.sala}/revisiones`, { data: { nombre: 'Origen inválido', base: h.base }, headers: { origin: 'https://ajeno.example' } }); expect(origenAjeno.status()).toBe(403);
    const cerrada = await historial(context, f.cerrada);
    const cierre = await context.request.post(`/api/salas/${f.cerrada}/revisiones`, { data: { nombre: 'Cerrada', base: cerrada.base }, headers: { origin: origen } }); expect(cierre.status()).toBe(409);
    await entrar(context, f.lectura);
    expect((await context.request.get(`/api/salas/${f.sala}/revisiones`)).status()).toBe(200);
    expect((await context.request.post(`/api/salas/${f.sala}/revisiones`, { data: { nombre: 'Sin edición', base: h.base }, headers: { origin: origen } })).status()).toBe(403);
    await sql`insert into usuario_permisos(usuario_id,seccion,acceso) values(${f.lectura},'salas','oculto')`;
    try { expect((await context.request.get(`/api/salas/${f.sala}/revisiones`)).status()).toBe(403); expect((await context.request.get(`/api/salas/${f.sala}/anotaciones`)).status()).toBe(403); }
    finally { await sql`delete from usuario_permisos where usuario_id=${f.lectura} and seccion='salas'`; }
    await entrar(context, f.oculto); expect((await context.request.get(`/api/salas/${f.sala}/revisiones`)).status()).toBe(403);
    await writeFile(resolve(salida, 'permisos.json'), JSON.stringify({ revisionAjena: 404, origenAjeno: 403, obraCerrada: 409, lectura: 200, escrituraLectura: 403, retiradoSiguientePeticion: 403 }, null, 2));
  });

  test('móvil al cierre: historial, alternativa, anotación y controles táctiles', async ({ page, context }) => {
    await entrar(context); page.on('pageerror', e => errores.push(e.message)); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/salas/${f.sala}/documentos`);
    await expect(page.getByRole('heading', { name: 'Revisiones y alternativas', exact: true })).toBeVisible();
    await expect(page.getByLabel('Nombre de revisión', { exact: true })).toBeVisible();
    await expect(page.getByText('Cargando historial…', { exact: true })).toHaveCount(0);
    const tabla = page.getByRole('group', { name: 'Historial de diseño', exact: true });
    const scroll = await tabla.evaluate(e => ({ ancho: e.clientWidth, contenido: e.scrollWidth }));
    expect(scroll.contenido).toBeGreaterThan(scroll.ancho);
    await tabla.evaluate(e => { e.scrollLeft = e.scrollWidth; });
    await expect(page.getByRole('button', { name: /^Revisar restauración R/ }).first()).toBeVisible();
    await tabla.evaluate(e => { e.scrollLeft = 0; });
    await page.getByRole('button', { name: 'Previsualizar duplicación', exact: true }).click();
    await expect(page.getByLabel('Nombre de alternativa', { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'movil-alternativa-preview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Previsualizar duplicación', exact: true }).click();
    await page.screenshot({ path: resolve(salida, 'movil-historial.png'), fullPage: true });
    await page.goto(`/salas/${f.sala}/diagrama`);
    await page.getByRole('button', { name: 'Seleccionar todos', exact: true }).click();
    await page.getByRole('button', { name: 'Distribuir horizontal', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar vista previa', exact: true }).click();
    await expect(page.getByLabel('Texto de anotación', { exact: true })).toBeVisible();
    const ancho = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, pantalla: window.innerWidth })); expect(ancho.contenido).toBeLessThanOrEqual(ancho.pantalla);
    await page.screenshot({ path: resolve(salida, 'movil-editor.png'), fullPage: true });
  });
});
