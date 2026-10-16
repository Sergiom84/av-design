import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { conectarRevisiones, FIXTURE_REVISIONES as f, type SqlRevisionesPrueba } from '../scripts/rea01-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
import type { LoteImportacion } from '../src/lib/importacion/modelo';

const origen = 'http://localhost:3111', secreto = 'rea01-local-prueba-integracion-secreto-2026';
const salida = resolve(process.env.REA01_B_SALIDA ?? `output/rea-integracion/rea01/b${process.env.REA01_B_CORRECCION === '1' ? '/correccion-revision' : ''}`);
const id = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const salaId = id(9000); let sql: SqlRevisionesPrueba;
const fuente = 'referencia;unidad;cantidad\nREA01-B-ORIG;ud;3\nREA01-B-DESCONOCIDO;m;12,75';
async function entrar(context: BrowserContext, usuario: string = f.admin) {
  await context.clearCookies(); await context.addCookies([{ name: COOKIE_SESION,
    value: await firmarSesion(secreto, Date.now() + 3600_000, usuario), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
async function archivo(page: Page, texto = fuente) {
  await page.getByLabel(/^Procedencia/).fill('PRUEBA-REA01-B · revisión en navegador');
  await page.getByLabel('Archivo CSV o XLSX', { exact: true }).setInputFiles({ name: 'PRUEBA-REA01-B.csv', mimeType: 'text/csv', buffer: Buffer.from(texto) });
  await page.getByRole('button', { name: 'Revisar archivo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisión antes de guardar', exact: true })).toBeVisible();
}
async function buscar(page: Page, fila: number, texto: string, modelo: string) {
  const campo = page.getByRole('combobox', { name: `Alternativa fila ${fila}`, exact: true });
  await campo.fill(texto);
  await expect(page.getByRole('option', { name: new RegExp(modelo) })).toBeVisible();
  await campo.press('ArrowDown'); await campo.press('Enter');
}
async function confirmar(page: Page, n: number) {
  const respuesta = page.waitForResponse(r => r.url().endsWith('/api/importacion/confirmar') && r.request().method() === 'POST');
  await page.getByRole('button', { name: `Confirmar ${n} filas elegidas`, exact: true }).click();
  const r = await respuesta; expect(r.status()).toBe(200); return await r.json() as LoteImportacion;
}
test.describe.serial('REA01 B · escritorio completo y móvil al cierre', () => {
  test.beforeAll(async () => {
    const url = process.env.REA_DATABASE_URL; if (!url) throw new Error('REA_DATABASE_URL explícita obligatoria.');
    sql = await conectarRevisiones(url); await mkdir(salida, { recursive: true });
    expect((await sql`select id from salas where id=${salaId}`).length).toBe(1);
  });
  test.afterAll(async () => { if (sql) await sql.end(); });
  test('escritorio: masiva, alternativas exacta/desconocida, teclado, revisión, informe, fuente y reversión', async ({ page, context }) => {
    await entrar(context); const errores: string[] = []; page.on('pageerror', e => errores.push(e.message));
    await page.goto(`/salas/${salaId}/equipamiento`);
    await page.getByRole('link', { name: 'Importar material', exact: true }).click();
    await archivo(page);
    await page.getByRole('button', { name: 'Seleccionar coincidencias válidas', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Incluir fila 2', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Incluir fila 3', exact: true })).not.toBeChecked();
    await page.getByRole('row').filter({ hasText: 'REA01-B-ORIG' }).getByRole('button', { name: 'Usar alternativa', exact: true }).click();
    await buscar(page, 2, 'REA01-B-ALTERNATIVO', 'Modelo ALTERNATIVO');
    await page.getByLabel('Motivo fila 2', { exact: true }).fill('Alternativa aprobada por disponibilidad');
    await page.getByRole('row').filter({ hasText: 'REA01-B-DESCONOCIDO' }).getByRole('button', { name: 'Usar alternativa', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo original fila 3', exact: true }).selectOption('cable');
    await buscar(page, 3, 'REA01-B-CABLE', 'Modelo CABLE');
    await page.getByLabel('Motivo fila 3', { exact: true }).fill('Cable de la lista identificado por el técnico');
    await expect(page.getByRole('button', { name: 'Confirmar 2 filas elegidas', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Selección revisada para confirmar', exact: true })).toBeVisible();
    await expect(page.getByText(/12.75 m/).last()).toBeVisible();
    // Una edición libre elimina la elección, aunque no se elija otra opción.
    for (const texto of ['Referencia pendiente de elegir', '']) {
      await page.getByRole('combobox', { name: 'Alternativa fila 2', exact: true }).fill(texto);
      await expect(page.getByRole('button', { name: 'Confirmar 2 filas elegidas', exact: true })).toBeDisabled();
      await expect(page.getByRole('heading', { name: 'Selección revisada para confirmar', exact: true })).toHaveCount(0);
      await buscar(page, 2, 'REA01-B-ALTERNATIVO', 'Modelo ALTERNATIVO');
      await page.getByRole('button', { name: 'Revisar selección', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Confirmar 2 filas elegidas', exact: true })).toBeEnabled();
    }
    await page.getByLabel('Motivo fila 2', { exact: true }).fill('Disponibilidad confirmada del modelo alternativo');
    await expect(page.getByRole('button', { name: 'Confirmar 2 filas elegidas', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar 2 filas elegidas', exact: true })).toBeEnabled();
    await page.screenshot({ path: resolve(salida, 'escritorio-seleccion.png'), fullPage: true });
    const lote = await confirmar(page, 2);
    expect(lote.informe[0].alternativa?.original?.id).toBe(id(1)); expect(lote.informe[1].alternativa?.cantidad).toBe(12.75);
    expect((await sql`select id from sala_material_bom where lote_id=${lote.id}`).length).toBe(2);
    const descargar = page.waitForEvent('download'); await page.getByRole('link', { name: 'Descargar fuente original', exact: true }).click();
    const descarga = await descargar; await descarga.saveAs(resolve(salida, 'fuente-original.csv'));
    expect(createHash('sha256').update(await readFile(resolve(salida, 'fuente-original.csv'))).digest('hex')).toBe(lote.archivoSha256);
    await page.screenshot({ path: resolve(salida, 'escritorio-informe.png'), fullPage: true });
    await page.reload(); await page.getByRole('button', { name: 'Consultar lote', exact: true }).first().click();
    await expect(page.getByText(lote.id, { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Revertir lote', exact: true }).click();
    await expect(page.getByText('Alta retirada sin dependencias ni ediciones posteriores.', { exact: false }).first()).toBeVisible();
    expect((await sql`select id from sala_material_bom where lote_id=${lote.id}`).length).toBe(0);
    await writeFile(resolve(salida, 'e2e-lote.json'), JSON.stringify(lote, null, 2));
    expect(errores).toEqual([]);
  });
  test('escritorio: 409 invalida revisión final; fuente nueva limpia selección y API conserva permisos y origen', async ({ page, context }) => {
    await entrar(context); await page.goto(`/catalogo/importar?sala=${salaId}`); await archivo(page, 'referencia;unidad;cantidad\nREA01-B-ORIG;ud;3');
    await page.getByRole('button', { name: 'Seleccionar coincidencias válidas', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar 1 filas elegidas', exact: true })).toBeEnabled();
    await sql`update articulos set modelo='Cambio ABA navegador B' where id=${id(1)}`; await sql`update articulos set modelo='Modelo ORIG' where id=${id(1)}`;
    await page.getByRole('button', { name: 'Confirmar 1 filas elegidas', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /modificada|revisión/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar 1 filas elegidas', exact: true })).toBeDisabled();
    await page.getByLabel(/^Procedencia/).fill('Fuente corregida');
    await expect(page.getByRole('heading', { name: 'Revisión antes de guardar', exact: true })).toHaveCount(0);
    await archivo(page); await expect(page.getByRole('checkbox', { name: 'Incluir fila 2', exact: true })).not.toBeChecked();
    const multipart = { archivo: { name: 'B.csv', mimeType: 'text/csv', buffer: Buffer.from(fuente) }, destino: 'bom', origen: 'Fuente B', salaId };
    expect((await context.request.post('/api/importacion', { multipart, headers: { origin: 'https://ajeno.invalid' } })).status()).toBe(403);
    await entrar(context, f.lectura); expect((await context.request.post('/api/importacion', { multipart, headers: { origin: origen } })).status()).toBe(403);
    await context.clearCookies();
    const sinSesion = await context.request.post('/api/importacion', { multipart, headers: { origin: origen }, maxRedirects: 0 });
    expect(sinSesion.status()).toBe(401);
    expect(sinSesion.headers()['content-type']).toContain('application/json');
    expect(sinSesion.headers()['cache-control']).toContain('no-store');
    await entrar(context, id(9999)); expect((await context.request.post('/api/importacion', { multipart, headers: { origin: origen }, maxRedirects: 0 })).status()).toBe(401);
    await page.screenshot({ path: resolve(salida, 'escritorio-invalidacion.png'), fullPage: true });
  });
  test('móvil final: seleccionar, revisar, confirmar y revertir sin desbordar la pantalla', async ({ page, context }) => {
    await entrar(context); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/catalogo/importar?sala=${salaId}`); await archivo(page, 'referencia;unidad;cantidad\nREA01-B-ORIG;ud;1');
    await page.getByRole('button', { name: 'Seleccionar coincidencias válidas', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar 1 filas elegidas', exact: true })).toBeEnabled();
    await page.screenshot({ path: resolve(salida, 'movil-revision.png'), fullPage: true });
    const lote = await confirmar(page, 1); expect(lote.informe.filter(f => f.estado === 'alta')).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await page.getByRole('button', { name: 'Revertir lote', exact: true }).click();
    await expect(page.getByText('Alta retirada sin dependencias ni ediciones posteriores.', { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'movil-reversion.png'), fullPage: true });
  });
});
