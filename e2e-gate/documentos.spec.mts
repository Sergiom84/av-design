import { test, expect, type BrowserContext, type APIResponse, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { conectarPrueba, fotografiarBase, FIXTURE_DOCUMENTOS as f, type FotoBase, type SqlPrueba } from '../scripts/documentos-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
import type { ManifiestoExportacion } from '../src/lib/documentos/modelo';

const salida = resolve('output/e1-documentos');
const secreto = 'e1-local-prueba-documentos-secreto-2026';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
let sql: SqlPrueba;
let antes: FotoBase;
const seleccion = {
  salaIds: [f.sala],
  documentos: ['plano', 'elevaciones', 'esquema', 'bom-xlsx', 'bom-csv', 'cables-xlsx', 'cables-csv'],
  opciones: { papel: 'A4', orientacion: 'horizontal', escala: 50 },
};

async function entrar(context: BrowserContext, usuarioId = f.admin): Promise<void> {
  await context.addCookies([{
    name: COOKIE_SESION,
    value: await firmarSesion(secreto, Date.now() + 3600_000, usuarioId),
    domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax',
  }]);
}

async function manifiestoDe(respuesta: APIResponse): Promise<ManifiestoExportacion> {
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()['content-type']).toContain('application/x-ndjson');
  const eventos = (await respuesta.text()).trim().split('\n').map((l) => JSON.parse(l));
  expect(eventos[0].tipo).toBe('inicio');
  expect(eventos.at(-1).tipo).toBe('fin');
  for (const [n, evento] of eventos.filter((e) => e.tipo === 'documento').entries()) expect(evento.completados).toBe(n + 1);
  return eventos.at(-1).manifiesto;
}

async function eventosDelNavegador(page: Page, n: number): Promise<Array<{tipo:string;manifiesto?:ManifiestoExportacion;completados?:number}>> {
  await page.waitForFunction((cantidad) => ((window as unknown as { __avDocumentos?: string[] }).__avDocumentos?.length ?? 0) >= cantidad, n);
  const texto = await page.evaluate((indice) => (window as unknown as { __avDocumentos: string[] }).__avDocumentos[indice - 1], n);
  return texto.trim().split('\n').map((l) => JSON.parse(l));
}

test.describe.serial('E1 documentación, escritorio antes de móvil', () => {
  test.beforeAll(async () => {
    const url = process.env.DOCUMENTOS_DATABASE_URL;
    if (!url) throw new Error('Define DOCUMENTOS_DATABASE_URL para comprobar la BD aislada antes del E2E.');
    sql = await conectarPrueba(url);
    await mkdir(salida, { recursive: true });
    antes = await fotografiarBase(sql);
    await writeFile(resolve(salida, 'bd-e2e-antes.json'), JSON.stringify(antes, null, 2));
  });
  test.afterAll(async () => {
    if (!sql) return;
    try {
      const despues = await fotografiarBase(sql);
      await writeFile(resolve(salida, 'bd-e2e-despues.json'), JSON.stringify(despues, null, 2));
      expect(despues).toEqual(antes);
    } finally { await sql.end(); }
  });

  test('escritorio: sala, descarga real, revisión, fallo parcial y selección de obra', async ({ page, context }) => {
    await entrar(context);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    // Captura el stream real en la propia página. Chrome puede descartar el
    // body CDP de un fetch interceptado tras descargas; Response.clone no cambia
    // el stream que consume la aplicación ni espera a tener el paquete entero.
    await page.addInitScript(() => {
      const ventana = window as unknown as { __avDocumentos: string[] };
      ventana.__avDocumentos = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const respuesta = await originalFetch(...args);
        const destino = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
        if (new URL(destino, window.location.href).pathname === '/api/documentos' && respuesta.ok) {
          void respuesta.clone().text().then((texto) => ventana.__avDocumentos.push(texto));
        }
        return respuesta;
      };
    });
    await page.goto(`/salas/${f.sala}/documentos`);
    await expect(page.getByRole('heading', { name: 'Paquete de obra', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Material XLSX', exact: true })).toBeChecked();
    await page.getByRole('combobox', { name: /^Papel/ }).selectOption('A3');
    await page.getByRole('combobox', { name: /^Orientación/ }).selectOption('vertical');
    await page.getByRole('combobox', { name: /^Papel/ }).selectOption('A4');
    await page.getByRole('combobox', { name: /^Orientación/ }).selectOption('horizontal');
    const progreso = page.waitForResponse((r) => r.url().endsWith('/api/documentos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generar paquete', exact: true }).click();
    const respuesta = await progreso;
    expect(respuesta.status()).toBe(200);
    const eventos = await eventosDelNavegador(page, 1);
    await writeFile(resolve(salida, 'e2e-progreso-sala.json'), JSON.stringify(eventos, null, 2));
    const completo = eventos.at(-1)!.manifiesto as ManifiestoExportacion;
    expect(completo.archivos).toHaveLength(7);
    expect(completo.archivos.every((a) => a.estado === 'correcto')).toBe(true);
    expect(eventos.filter((e) => e.tipo === 'documento').map((e) => e.completados)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await expect(page.getByRole('heading', { name: 'Paquete disponible', exact: true })).toBeVisible();
    await expect(page.getByText(completo.revision, { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'e2e-escritorio-sala.png'), fullPage: true });

    const descarga = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar ZIP', exact: true }).click();
    const archivo = await descarga;
    expect(await archivo.failure()).toBeNull();
    const rutaZip = resolve(salida, 'e2e-sala-descarga.zip');
    await archivo.saveAs(rutaZip);
    const bytesZip = new Uint8Array(await readFile(rutaZip));
    const entradas = unzipSync(bytesZip);
    expect(JSON.parse(strFromU8(entradas['manifiesto.json']))).toEqual(completo);
    for (const a of completo.archivos) {
      expect(digest(entradas[a.nombre])).toBe(a.sha256);
      await writeFile(resolve(salida, `e2e-${a.nombre}`), entradas[a.nombre]);
    }
    const libro = new ExcelJS.Workbook();
    const bom = completo.archivos.find((a) => a.documento === 'bom-xlsx')!;
    await libro.xlsx.load(Buffer.from(entradas[bom.nombre]) as unknown as ExcelJS.Buffer);
    const hoja = libro.getWorksheet('Material')!;
    expect(hoja.getCell('B3').value).toBe(completo.revision);
    let mic: ExcelJS.Row | undefined;
    hoja.eachRow((fila) => { if (fila.getCell(1).value === f.microfono) mic = fila; });
    assert.ok(mic);
    expect(mic.getCell(6).value).toBe(2);
    expect(typeof mic.getCell(6).value).toBe('number');
    expect(mic.getCell(14).value).toBeNull();
    expect(mic.getCell(15).value).toBe('Sin precio');
    await page.reload();
    await expect(page.getByText(completo.revision, { exact: true })).toBeVisible();
    const dos = await page.request.get(`/api/documentos/${completo.id}/descarga?archivo=paquete.zip`);
    expect(dos.headers()['x-av-revision']).toBe(completo.revision);
    expect(digest(await dos.body())).toBe(digest(bytesZip));

    await page.route('**/api/documentos', async (route) => {
      await route.continue({ headers: { ...route.request().headers(), 'x-av-prueba-fallo-pdf': 'plano' } });
    });
    const fallo = page.waitForResponse((r) => r.url().endsWith('/api/documentos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generar paquete', exact: true }).click();
    expect((await fallo).status()).toBe(200);
    const eventosFallo = await eventosDelNavegador(page, 1);
    const parcial = eventosFallo.at(-1)!.manifiesto as ManifiestoExportacion;
    await writeFile(resolve(salida, 'e2e-progreso-fallo.json'), JSON.stringify(eventosFallo, null, 2));
    expect(parcial.revision).not.toBe(completo.revision);
    expect(parcial.archivos.filter((a) => a.estado === 'error').map((a) => a.documento)).toEqual(['plano']);
    await expect(page.getByRole('heading', { name: 'Paquete parcial', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Último paquete completo', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: '6 documentos válidos' })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'e2e-escritorio-fallo-parcial.png'), fullPage: true });
    const descargarParcial = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar ZIP parcial', exact: true }).click();
    const archivoParcial = await descargarParcial;
    expect(await archivoParcial.failure()).toBeNull();
    await archivoParcial.saveAs(resolve(salida, 'e2e-fallo-parcial.zip'));
    const ZIPparcial = unzipSync(new Uint8Array(await readFile(resolve(salida, 'e2e-fallo-parcial.zip'))));
    expect(Object.keys(ZIPparcial)).toHaveLength(7);
    expect(JSON.parse(strFromU8(ZIPparcial['manifiesto.json'])).revision).toBe(parcial.revision);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Paquete parcial', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Último paquete completo', exact: true })).toBeVisible();
    await expect(page.getByText(completo.revision, { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'e2e-recarga-paquete-parcial.png'), fullPage: true });
    const descargarAnterior = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar paquete anterior', exact: true }).click();
    const anterior = await descargarAnterior;
    await anterior.saveAs(resolve(salida, 'e2e-paquete-anterior.zip'));
    expect(digest(await readFile(resolve(salida, 'e2e-paquete-anterior.zip')))).toBe(digest(bytesZip));
    await page.unroute('**/api/documentos');

    await page.goto(`/proyectos/${f.proyecto}/documentos`);
    await expect(page.getByRole('group', { name: 'Salas de la obra' })).toBeVisible();
    await page.getByRole('checkbox', { name: /PRUEBA-DOC-INCOMPLETA/ }).uncheck();
    expect(await page.getByRole('group', { name: 'Salas de la obra' }).getByRole('checkbox').count()).toBe(3);
    const progresoObra = page.waitForResponse((r) => r.url().endsWith('/api/documentos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generar paquete', exact: true }).click();
    expect((await progresoObra).status()).toBe(200);
    const eventosObra = await eventosDelNavegador(page, 1);
    const manifiestoObra = eventosObra.at(-1)!.manifiesto as ManifiestoExportacion;
    expect(manifiestoObra.salas.map((s) => s.id).sort()).toEqual([f.sala, f.salaDos].sort());
    expect(manifiestoObra.archivos).toHaveLength(12);
    await expect(page.getByRole('heading', { name: 'Paquete disponible', exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(salida, 'e2e-escritorio-obra.png'), fullPage: true });
    const descargarObra = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar ZIP', exact: true }).click();
    const ZIPobra = await descargarObra;
    expect(await ZIPobra.failure()).toBeNull();
    await ZIPobra.saveAs(resolve(salida, 'e2e-obra.zip'));
    await writeFile(resolve(salida, 'e2e-progreso-obra.json'), JSON.stringify(eventosObra, null, 2));
    expect(errores).toEqual([]);
    await writeFile(resolve(salida, 'e2e-consola.json'), JSON.stringify({ erroresPagina: errores }, null, 2));
  });

  test('servidor: permisos reales, propietario, selección ajena y ausencia de mutaciones', async ({ context, request }) => {
    await entrar(context);
    const valida = await context.request.post('/api/documentos', { data: seleccion });
    const paquete = await manifiestoDe(valida);
    const ajena = await context.request.post('/api/documentos', {
      data: { ...seleccion, salaIds: [f.sala, f.salaAjena], proyectoId: f.proyecto },
    });
    expect(ajena.status()).toBe(400);
    expect((await ajena.json()).error).toMatch(/ajena/);
    const duplicadas = await context.request.post('/api/documentos', { data: { ...seleccion, salaIds: [f.sala, f.sala] } });
    expect(duplicadas.status()).toBe(400);
    const sinSesion = await request.post('/api/documentos', { data: seleccion, maxRedirects: 0 });
    expect([307, 401]).toContain(sinSesion.status());
    await context.clearCookies();
    await entrar(context, f.oculto);
    const oculto = await context.request.post('/api/documentos', { data: { ...seleccion, documentos: ['plano'] } });
    expect(oculto.status()).toBe(403);
    await context.clearCookies();
    await entrar(context, f.sinCompras);
    const compras = await context.request.post('/api/documentos', { data: { ...seleccion, documentos: ['bom-xlsx'] } });
    expect(compras.status()).toBe(403);
    const plano = await context.request.post('/api/documentos', { data: { ...seleccion, documentos: ['plano'] } });
    await manifiestoDe(plano);
    await context.clearCookies();
    await entrar(context, f.lectura);
    const ajeno = await context.request.get(`/api/documentos/${paquete.id}`);
    expect(ajeno.status()).toBe(404);
    const descargaAjena = await context.request.get(`/api/documentos/${paquete.id}/descarga?archivo=paquete.zip`);
    expect(descargaAjena.status()).toBe(404);
    const propioLectura = await manifiestoDe(await context.request.post('/api/documentos', {
      data: { ...seleccion, documentos: ['plano'] },
    }));
    let revocacionMetadata = 0;
    let revocacionDescarga = 0;
    try {
      // Escritura temporal sólo en la fixture cuyo destino se ha comprobado.
      // No se renueva la cookie: la siguiente petición debe leer el permiso nuevo.
      await sql`insert into usuario_permisos (usuario_id, seccion, acceso) values (${f.lectura}, 'salas', 'oculto')`;
      revocacionMetadata = (await context.request.get(`/api/documentos/${propioLectura.id}`)).status();
      revocacionDescarga = (await context.request.get(`/api/documentos/${propioLectura.id}/descarga?archivo=paquete.zip`)).status();
      expect(revocacionMetadata).toBe(403);
      expect(revocacionDescarga).toBe(403);
    } finally {
      await sql`delete from usuario_permisos where usuario_id = ${f.lectura} and seccion = 'salas'`;
    }
    expect((await context.request.get(`/api/documentos/${propioLectura.id}`)).status()).toBe(200);
    await writeFile(resolve(salida, 'e2e-permisos.json'), JSON.stringify({
      seleccionAjena: ajena.status(), duplicadas: duplicadas.status(), sinSesion: sinSesion.status(),
      salasOcultas: oculto.status(), bomSinCompras: compras.status(), planoSinCompras: plano.status(),
      metadataOtroUsuario: ajeno.status(), descargaOtroUsuario: descargaAjena.status(),
      metadataTrasRevocar: revocacionMetadata, descargaTrasRevocar: revocacionDescarga,
    }, null, 2));
  });

  test('móvil al cierre: documentos accesibles, selección y descarga real', async ({ page, context }) => {
    await entrar(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/salas/${f.sala}/documentos`);
    await expect(page.getByRole('button', { name: 'Generar paquete', exact: true })).toBeVisible();
    for (const nombre of ['Plano PDF', 'Elevaciones PDF', 'Esquema PDF', 'Material CSV', 'Cables XLSX', 'Cables CSV']) {
      await page.getByRole('checkbox', { name: nombre, exact: true }).uncheck();
    }
    await page.getByRole('button', { name: 'Generar paquete', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Paquete disponible', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /seleccion-bom-xlsx\.xlsx/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(salida, 'e2e-movil-documentos.png'), fullPage: true });
    const descargar = page.waitForEvent('download');
    await page.getByRole('link', { name: /seleccion-bom-xlsx\.xlsx/ }).click();
    const xlsx = await descargar;
    expect(await xlsx.failure()).toBeNull();
    await xlsx.saveAs(resolve(salida, 'e2e-movil-material.xlsx'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
