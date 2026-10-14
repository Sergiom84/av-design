import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';
import {
  leerArchivoImportacion, coincidenciasExactas, revisarFilas, numeroImportado, fechaIsoValida,
  normalizarNamespaceHoja, MAXIMO_BYTES_IMPORTACION, comprobarXlsx,
  previsualizarImportacion, validarEntrada, type ArticuloParaImportacion, type SqlImportacion,
  elegirCosteVigente, fechaLimiteVigencia,
} from './importacion';

const csv = (texto: string) => ({ nombre: 'PRUEBA-IMPORT-01.csv', bytes: new TextEncoder().encode(texto) });
const articulo = (id: string, modelo: string, categoria = 'PANTALLA'): ArticuloParaImportacion => ({
  id, referencia: id, referencia_fabricante: null, marca: 'SINTÉTICA', modelo, categoria,
  tipo: 'equipo', unidad: 'ud', activo: true, revision: 3, coste: null, coste_orientativo: false,
});
const articulos = [articulo('a', 'QB65R'), articulo('b', 'QB65R-B'), articulo('c', 'K400'), articulo('d', 'K400+')];
const fila = (datos: Record<string, string>, numero = 2) => ({ fila: numero, datos, errores: [] });
const oferta = (extra: Record<string, string> = {}) => ({ referencia: 'a', unidad: 'ud', presupuesto: 'PRUEBA-IMPORT-01',
  proveedor: 'Proveedor sintético', fecha: '2026-10-13', moneda: 'EUR', unidad_compra: 'ud',
  unidades_por_compra: '1', precio_compra: '12,50', origen: 'final', ...extra });

async function xlsx(filas: unknown[][], segundaHoja = false): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook(); const hoja = libro.addWorksheet('Datos');
  for (const valores of filas) hoja.addRow(valores);
  if (segundaHoja) libro.addWorksheet('Otra');
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

describe('importación determinista CSV/XLSX', () => {
  it('CSV UTF-8 conserva acentos, coma decimal, comillas y varias líneas de texto', async () => {
    const archivo = csv('\uFEFFreferencia;unidad;cantidad;nota\r\na;m;12,50;"Ángulo; medido ""aquí""\nsegunda línea"\r\n');
    const r = await leerArchivoImportacion(archivo);
    assert.equal(r.filas.length, 1);
    assert.deepEqual(r.filas[0].datos, { referencia: 'a', unidad: 'm', cantidad: '12,50', nota: 'Ángulo; medido "aquí"\nsegunda línea' });
    assert.equal(r.sha256, createHash('sha256').update(archivo.bytes).digest('hex'));
  });
  it('admite CSV con coma y decimal encerrado en comillas', async () => {
    const r = await leerArchivoImportacion(csv('referencia,unidad,cantidad\na,m,"1,25"'));
    assert.equal(r.filas[0].datos.cantidad, '1,25');
  });
  it('rechaza UTF-8 inválido, cabeceras duplicadas, desconocidas y comillas sin cerrar', async () => {
    await assert.rejects(leerArchivoImportacion({ nombre: 'x.csv', bytes: new Uint8Array([0xff]) }), /UTF-8/u);
    for (const texto of ['referencia;referencia\na;a', 'referencia;columna_opaca\na;a', 'referencia;unidad\n"a;ud']) {
      await assert.rejects(leerArchivoImportacion(csv(texto)), /Cabeceras|comillas/u);
    }
  });
  it('no confunde cantidad negativa con fórmula y detecta celdas peligrosas', async () => {
    const r = await leerArchivoImportacion(csv('referencia;unidad;cantidad;nota\na;ud;-1;normal\nb;ud;1;=SUM(A1)\nc;ud;1;@SUM(A1)\nd;ud;1; +CMD'));
    assert.deepEqual(r.filas[0].errores, []);
    for (const f of r.filas.slice(1)) assert.match(f.errores.join(' '), /peligrosa|fórmula/u);
  });
  it('500 filas es el máximo exacto y rechaza tamaño, nombre, extensión y archivo vacío', async () => {
    const texto = 'referencia;unidad;cantidad\n' + Array.from({ length: 500 }, (_, i) => `${i};ud;1`).join('\n');
    assert.equal((await leerArchivoImportacion(csv(texto))).filas.length, 500);
    await assert.rejects(leerArchivoImportacion(csv(`${texto}\n501;ud;1`)), /500/u);
    await assert.rejects(leerArchivoImportacion({ nombre: 'x.csv', bytes: new Uint8Array(MAXIMO_BYTES_IMPORTACION + 1) }), /5 MiB/u);
    for (const nombre of ['../x.csv', 'x.xls', 'x.pdf']) await assert.rejects(leerArchivoImportacion({ ...csv(texto), nombre }), /Nombre|CSV/u);
    await assert.rejects(leerArchivoImportacion(csv('')), /vacío/u);
  });
  it('XLSX conserva números y fechas tipadas y rechaza fórmulas sin ejecutarlas', async () => {
    const bytes = await xlsx([['referencia', 'unidad', 'cantidad', 'fecha'], ['a', 'ud', 2, new Date('2026-10-13T00:00:00Z')],
      ['b', 'ud', { formula: '1+1', result: 2 }, null]]);
    const r = await leerArchivoImportacion({ nombre: 'x.xlsx', bytes });
    assert.equal(r.filas[0].datos.fecha, '2026-10-13');
    assert.equal(r.filas[0].datos.cantidad, '2');
    assert.match(r.filas[1].errores.join(' '), /fórmula/u);
  });
  it('XLSX estándar con namespace prefijado produce mismas filas y conserva hash original', async () => {
    const normal = await xlsx([['referencia', 'unidad', 'cantidad'], ['a', 'ud', 2]]);
    const partes = unzipSync(normal);
    for (const [nombre, contenido] of Object.entries(partes)) {
      if (!nombre.startsWith('xl/') || !nombre.endsWith('.xml')) continue;
      let xml = new TextDecoder().decode(contenido);
      if (!xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) continue;
      xml = xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
        .replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/gu, '<$1x:$2');
      partes[nombre] = new TextEncoder().encode(xml);
    }
    const bytes = zipSync(partes);
    const r = await leerArchivoImportacion({ nombre: 'prefijado.xlsx', bytes });
    assert.deepEqual(r.filas, (await leerArchivoImportacion({ nombre: 'normal.xlsx', bytes: normal })).filas);
    assert.equal(r.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.notEqual(r.sha256, createHash('sha256').update(normal).digest('hex'));
  });
  it('normalización de namespace no altera textos o relaciones y rechaza rebinding', () => {
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const r = normalizarNamespaceHoja(`<x:workbook xmlns:x="${ns}"><x:sheet r:id="r1"><x:v>&lt;x:texto&gt;</x:v></x:sheet></x:workbook>`);
    assert.match(r, /r:id="r1"/u); assert.match(r, /&lt;x:texto&gt;/u); assert.ok(!r.includes('<x:'));
    assert.throws(() => normalizarNamespaceHoja(`<x:workbook xmlns:x="${ns}"><x:sheet xmlns:x="otro" /></x:workbook>`), /namespace/u);
  });
  it('fecha OOXML t=d conserva fecha ISO en vez de tratar el año como serial Excel', () => {
    const r = normalizarNamespaceHoja('<worksheet><c r="G2" t="d"><v>2026-10-13T00:00:00.000Z</v></c><c r="G3" t="d"><v>2026-02-30</v></c></worksheet>');
    assert.match(r, /t="str"><v>2026-10-13<\/v>/u);
    assert.match(r, /t="str"><v>2026-02-30<\/v>/u);
  });
  it('rechaza varias hojas, firma falsa, enlaces externos, DTD y objetos activos', async () => {
    await assert.rejects(leerArchivoImportacion({ nombre: 'x.xlsx', bytes: await xlsx([['referencia'], ['a']], true) }), /sola hoja/u);
    assert.throws(() => comprobarXlsx(new TextEncoder().encode('PKxx')), /firma/u);
    const partes = unzipSync(await xlsx([['referencia'], ['a']]));
    for (const [nombre, valor] of [
      ['xl/externalLinks/link.xml', '<x />'],
      ['xl/worksheets/_rels/sheet1.xml.rels', '<Relationship TargetMode="External" Target="https://example.invalid" />'],
      ['xl/worksheets/sheet1.xml', '<!DOCTYPE x [<!ENTITY y "x">]><x />'],
    ]) {
      const copia = { ...partes, [nombre]: new TextEncoder().encode(valor) };
      assert.throws(() => comprobarXlsx(zipSync(copia)), /extern|activ|XML/u);
    }
  });
  it('rechaza contenido ZIP que exceda límite aunque el archivo comprimido sea pequeño', async () => {
    const partes = unzipSync(await xlsx([['referencia'], ['a']]));
    partes['xl/grande.xml'] = new Uint8Array(11 * 1024 * 1024);
    const comprimido = zipSync(partes);
    assert.ok(comprimido.byteLength < MAXIMO_BYTES_IMPORTACION);
    assert.throws(() => comprobarXlsx(comprimido), /descomprimido/u);
  });
});

describe('revisión literal de referencias y BOM', () => {
  it('preserva variantes QB65R-B y K400+; no elimina sufijos ni guiones', () => {
    for (const a of articulos) assert.deepEqual(coincidenciasExactas({ marca: 'sintética', modelo: a.modelo }, articulos).map(c => c.id), [a.id]);
    assert.deepEqual(coincidenciasExactas({ marca: 'SINTÉTICA', modelo: 'QB65' }, articulos), []);
    assert.deepEqual(coincidenciasExactas({ marca: 'SINTÉTICA', modelo: 'QB65R B' }, articulos), []);
  });
  it('referencia fabricante repetida y modelo en varias categorías quedan ambiguos', () => {
    const a = [{ ...articulo('a', 'Á exacto'), referencia_fabricante: 'FAB-1' }, { ...articulo('b', 'Á exacto', 'OTRA'), referencia_fabricante: 'FAB-1' }];
    assert.equal(coincidenciasExactas({ referencia: 'fab-1' }, a).length, 2);
    assert.equal(coincidenciasExactas({ marca: 'sintética', modelo: 'á exacto' }, a).length, 2);
    assert.deepEqual(coincidenciasExactas({ marca: 'sintética', modelo: 'á exacto', categoria: 'otra' }, a).map(c => c.id), ['b']);
  });
  it('cantidad ausente, negativa, fracción ud, infinito y exceso se rechazan', () => {
    for (const cantidad of ['', '-1', '1.5', 'Infinity', '1000001', '1e2']) {
      assert.equal(revisarFilas('bom', [fila({ referencia: 'a', unidad: 'ud', cantidad })], articulos)[0].estado, 'rechazada');
    }
    assert.equal(revisarFilas('bom', [fila({ referencia: 'a', unidad: 'ud', cantidad: '2' })], articulos)[0].estado, 'coincidencia');
  });
  it('unidad incompatible se rechaza; duplicado avisa para elegir una sola sin invalidar su corrección', () => {
    const a = [{ ...articulo('m', 'Cable'), tipo: 'cable', unidad: 'm' as const }];
    const r = revisarFilas('bom', [fila({ referencia: 'm', unidad: 'ud', cantidad: '2' }), fila({ referencia: 'm', unidad: 'm', cantidad: '12,50' }, 3)], a);
    assert.equal(r[0].estado, 'rechazada'); assert.equal(r[1].estado, 'coincidencia'); assert.match(r[1].avisos.join(' '), /duplicada/u);
  });
  it('nuevo catálogo exige identidad/tipo; no encontrado en BOM no da de alta automáticamente', () => {
    assert.equal(revisarFilas('catalogo', [fila({ modelo: 'Nuevo', unidad: 'ud' })], articulos)[0].estado, 'rechazada');
    assert.equal(revisarFilas('catalogo', [fila({ modelo: 'Nuevo', unidad: 'ud', tipo: 'equipo', categoria: 'OTRA' })], articulos)[0].estado, 'alta');
    assert.equal(revisarFilas('bom', [fila({ referencia: 'desconocida', unidad: 'ud', cantidad: '1' })], articulos)[0].estado, 'no_encontrada');
  });
});

describe('ofertas revisables, ausencias y decisiones de kit', () => {
  it('precio vigente usa final antes de orientativo y el cambio parametrizado', () => {
    const parametros = { hoy: '2026-10-13', vigenciaMeses: 18, usdEur: 0.8 };
    const finales = [{ precio: 120, moneda: 'EUR', origen: 'final', fecha: null },
      { precio: 100, moneda: 'USD', origen: 'final', fecha: '2026-10-13' },
      { precio: 1, moneda: 'EUR', origen: 'orientativo', fecha: null }];
    assert.deepEqual(elegirCosteVigente(finales, parametros), { coste: 80, orientativo: false });
    assert.deepEqual(elegirCosteVigente([{ precio: 10, moneda: 'USD', origen: 'orientativo', fecha: null }], parametros), { coste: 8, orientativo: true });
    assert.equal(elegirCosteVigente([{ precio: 1, moneda: 'EUR', origen: 'final', fecha: '2024-03-04' }], parametros), null);
  });
  it('vigencia resta meses de calendario y limita el día al último del mes', () => {
    assert.equal(fechaLimiteVigencia('2026-10-31', 1), '2026-09-30');
    assert.equal(fechaLimiteVigencia('2024-03-31', 1), '2024-02-29');
    const parametros = { hoy: '2026-10-13', vigenciaMeses: 18, usdEur: 1 };
    assert.deepEqual(elegirCosteVigente([{ precio: 12, moneda: 'EUR', origen: 'final', fecha: '2025-04-13' }], parametros), { coste: 12, orientativo: false });
    assert.equal(elegirCosteVigente([{ precio: 12, moneda: 'EUR', origen: 'final', fecha: '2025-04-12' }], parametros), null);
  });
  it('acepta final EUR y orientativo USD; conserva precio por paquete explícito', () => {
    const r = revisarFilas('precios', [fila(oferta()), fila(oferta({ presupuesto: 'OTRO', moneda: 'USD', origen: 'orientativo', vinculante: 'no', unidad_compra: 'caja', unidades_por_compra: '5', precio_compra: '100' }), 3)], articulos);
    assert.deepEqual(r.map(f => f.estado), ['coincidencia', 'coincidencia']);
    assert.match(r[1].avisos.join(' '), /20\.0000 USD/u);
  });
  it('precio ausente y cero permanecen distintos; kits y no vinculante final quedan pendientes', () => {
    for (const [extra, patron] of [
      [{ precio_compra: '' }, /ausente/u], [{ precio_compra: '0' }, /cero de kit/u],
      [{ kit: 'sí' }, /composición de kits/u], [{ vinculante: 'no' }, /no vinculante/u], [{ origen: '' }, /clasifica/u],
    ] as Array<[Record<string, string>, RegExp]>) {
      const r = revisarFilas('precios', [fila(oferta(extra))], articulos)[0];
      assert.equal(r.estado, 'rechazada'); assert.match(r.errores.join(' '), patron);
    }
  });
  it('valida fechas reales, moneda, proveedor, unidades de compra y paquetes', () => {
    const invalidas: Array<Record<string, string>> = [{ fecha: '2026-02-30' }, { fecha: '13/10/2026' }, { moneda: 'GBP' }, { proveedor: '' },
      { unidades_por_compra: '0' }, { unidad_compra: 'm' }, { unidades_por_compra: '1.5', unidad_compra: 'caja' },
      { unidad_compra: 'bobina' }, { precio_compra: '0.00001' }];
    for (const extra of invalidas) {
      assert.equal(revisarFilas('precios', [fila(oferta(extra))], articulos)[0].estado, 'rechazada', JSON.stringify(extra));
    }
    assert.ok(fechaIsoValida('2024-02-29')); assert.ok(!fechaIsoValida('2025-02-29'));
    assert.equal(numeroImportado(''), null); assert.ok(Number.isNaN(numeroImportado('1.234,56'))); assert.equal(numeroImportado('1,25'), 1.25);
  });
  it('preview sólo lee; hash cambia cuando el catálogo se modifica tras la revisión', async () => {
    const consultas: string[] = []; let revision = 3;
    const falsoSql = ((partes: TemplateStringsArray | unknown[]) => {
      if (!('raw' in partes)) return partes;
      const consulta = partes.join('?'); consultas.push(consulta);
      assert.match(consulta.trim(), /^select/u);
      return Promise.resolve(consulta.includes('from articulos') ? [{ ...articulos[0], revision }] : []);
    }) as unknown as SqlImportacion;
    const entrada = { destino: 'catalogo' as const, origen: 'Archivo sintético', archivo: csv('referencia;unidad;descripcion\na;ud;Revisada') };
    const antes = await previsualizarImportacion(falsoSql, entrada);
    revision++;
    const despues = await previsualizarImportacion(falsoSql, entrada);
    assert.notEqual(antes.previewHash, despues.previewHash); assert.equal(consultas.length, 2);
  });
  it('destino y sala explícitos previenen escribir BOM sin sala o catálogo con sala', () => {
    assert.throws(() => validarEntrada('inventario', 'x', undefined), /Destino/u);
    assert.throws(() => validarEntrada('catalogo', '', undefined), /procedencia/u);
    assert.throws(() => validarEntrada('bom', 'x', undefined), /sala/u);
    assert.throws(() => validarEntrada('catalogo', 'x', 'e2000000-0000-4000-8000-000000000010'), /Sólo la BOM/u);
  });
});
