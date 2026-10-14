/**
 * Gate E1 contra Postgres y los archivos reales, sólo en la fixture aislada.
 *
 * DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
 *   node --import tsx scripts/verificar-documentos.mts
 *
 * No escribe en la base. Genera y conserva artefactos en output/e1-documentos.
 * El generador PDF fallido se inyecta únicamente dentro de este proceso de prueba.
 * --solo-concurrencia comprueba MVCC y restaura exactamente el coste sintético;
 * no regenera archivos PDF/XLSX durante una inspección visual en curso.
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { conectarPrueba, fotografiarBase, FIXTURE_DOCUMENTOS as f } from './documentos-fixture.mjs';
import type { OpcionesPdf, TipoDocumento } from '../src/lib/documentos/modelo';

const url = process.env.DOCUMENTOS_DATABASE_URL;
if (!url) throw new Error('Define DOCUMENTOS_DATABASE_URL explícitamente; no se usa .env.local.');
const sql = await conectarPrueba(url);
process.env.DATABASE_URL = url;

type Modulo = { _load: (request: string, ...resto: unknown[]) => unknown };
const modulo = Module as unknown as Modulo;
const original = modulo._load;
modulo._load = (request, ...resto) => request === 'server-only' ? {} : original.call(Module, request, ...resto);

const salida = resolve('output/e1-documentos');
await mkdir(salida, { recursive: true });
const comprobaciones: string[] = [];
function ok(mensaje: string): void { comprobaciones.push(mensaje); console.log(`OK   ${mensaje}`); }
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const opciones: OpcionesPdf = { papel: 'A4', orientacion: 'horizontal', escala: 50 };

try {
  const antes = await fotografiarBase(sql);
  await writeFile(resolve(salida, 'bd-gate-antes.json'), JSON.stringify(antes, null, 2));
  const { conLecturaConsistente, sql: lectura } = await import('../src/lib/db');
  const [originalCoste] = await sql`select coste::text as coste from articulos where id = ${f.pantalla}`;
  assert.equal(originalCoste.coste, '800.0000');
  let primera: string | undefined;
  let segunda: string | undefined;
  let exterior: string | undefined;
  try {
    await conLecturaConsistente(async () => {
      const [uno] = await lectura`select coste::text as coste from articulos where id = ${f.pantalla}`;
      primera = uno.coste;
      // Otra conexión confirma el cambio entre ambas lecturas del snapshot.
      await sql`update articulos set coste = coste + 1 where id = ${f.pantalla}`;
      const [dos] = await lectura`select coste::text as coste from articulos where id = ${f.pantalla}`;
      segunda = dos.coste;
      assert.equal(segunda, primera);
    });
    await assert.rejects(conLecturaConsistente(async () => {
      await lectura`update articulos set coste = 900 where id = ${f.pantalla}`;
    }), /read-only transaction/);
    const [fuera] = await sql`select coste::text as coste from articulos where id = ${f.pantalla}`;
    exterior = fuera.coste;
    assert.equal(exterior, '801.0000');
  } finally {
    // `articulos` no tiene trigger de timestamps: esta restauración recupera
    // el valor byte a byte. No hay ninguna escritura fuera de esta fixture.
    await sql`update articulos set coste = ${originalCoste.coste} where id = ${f.pantalla}`;
  }
  const despuesConcurrencia = await fotografiarBase(sql);
  assert.deepEqual(despuesConcurrencia, antes);
  await writeFile(resolve(salida, 'gate-concurrencia.json'), JSON.stringify({
    primera, segunda, exterior, mismaLectura: primera === segunda, soloLectura: true,
    sha256Antes: antes.sha256, sha256Despues: despuesConcurrencia.sha256,
  }, null, 2));
  ok('repeatable read ve 800 antes/después de commit externo 801, rechaza escritura y restaura exactamente 38 tablas');
  if (!process.argv.includes('--solo-concurrencia')) {
  const { cargarSnapshot } = await import('../src/lib/documentos/datos');
  const { construirBom, generarXlsx, generarCablesCsv } = await import('../src/lib/documentos/tablas');
  const { generarPdfTecnico } = await import('../src/lib/documentos/pdf');
  const { generarPaquete, leerArchivo, leerPaquete } = await import('../src/lib/documentos/paquete');
  const { necesidadDeSala, calcularFaltante } = await import('../src/lib/compras');
  const { agruparMaterialCable } = await import('../src/lib/calculo-cable');
  const { tablaCablesACsv } = await import('../src/lib/cable-schedule');

  const snapshot = await cargarSnapshot([f.sala]);
  assert.equal(snapshot.salas[0].sala.codigo, 'PRUEBA-DOC-01');
  assert.equal(snapshot.salas[0].sala.diagrama_version, 7);
  assert.equal(snapshot.proyecto?.codigo, 'PRUEBA-DOC-OBRA');
  assert.equal(snapshot.salas[0].equipos.find((e) => e.id === f.equipoRack)?.posicion_confirmada, true);
  assert.equal(snapshot.salas[0].equipos.find((e) => e.id === f.equipoMicrofono)?.posicion_confirmada, false);
  ok('snapshot de sala conserva obra, versión, posición medida (0,0,0) y posición estimada');

  const sala = snapshot.salas[0];
  const articulos = new Map(snapshot.articulos.map((a) => [a.id, a]));
  const necesidad = necesidadDeSala(sala.equipos, agruparMaterialCable(sala.resultadosCable, sala.conexiones, articulos), articulos);
  const faltante = calcularFaltante(necesidad,
    new Map(snapshot.disponibilidad.map((d) => [d.articulo_id, d.disponible])),
    new Map(sala.reservas.map((r) => [r.articulo_id, r.cantidad])));
  const bom = construirBom(snapshot, [sala]);
  assert.deepEqual(bom.map((l) => [l.articulo_id, l.cantidad, l.a_comprar]).sort(),
    faltante.map((l) => [l.articulo_id, l.cantidad, l.falta]).sort());
  const porId = new Map(bom.map((l) => [l.articulo_id, l]));
  assert.equal(porId.get(f.pantalla)?.disponible_libre, 0);
  assert.equal(porId.get(f.pantalla)?.reservado_propio, 1);
  assert.equal(porId.get(f.pantalla)?.a_comprar, 0);
  assert.equal(porId.get(f.codec)?.a_comprar, 1);
  assert.equal(porId.get(f.codec)?.estado_precio, 'Orientativo');
  assert.equal(porId.get(f.microfono)?.precio_unitario, null);
  assert.equal(porId.get(f.microfono)?.importe_necesidad, null);
  assert.equal(porId.get(f.microfono)?.cantidad, 2);
  ok('BOM coincide con necesidad/calcularFaltante actuales; reserva propia evita doble compra y sin precio sigue vacío');

  const obra = await cargarSnapshot([f.sala, f.salaDos], f.proyecto);
  const bomObra = new Map(construirBom(obra, obra.salas).map((l) => [l.articulo_id, l]));
  assert.equal(bomObra.get(f.pantalla)?.cantidad, 2);
  assert.equal(bomObra.get(f.pantalla)?.a_comprar, 1);
  assert.equal(bomObra.get(f.codec)?.cantidad, 2);
  assert.equal(bomObra.get(f.codec)?.reservado_propio, 1);
  assert.equal(bomObra.get(f.codec)?.a_comprar, 1);
  assert.equal(bomObra.get(f.hdmi)?.cantidad, 2);
  assert.equal(bomObra.get(f.hdmi)?.a_comprar, 0);
  assert.deepEqual(construirBom(obra, [...obra.salas, obra.salas[0]]), construirBom(obra, obra.salas));
  await assert.rejects(cargarSnapshot([f.sala, f.salaAjena], f.proyecto), /ajena/);
  await assert.rejects(cargarSnapshot([f.sala, f.salaDos]), /obra/);
  ok('multisala consolida antes de contar stock, elimina duplicados y rechaza salas de otra obra');

  const libroBytes = await generarXlsx(snapshot, [sala], 'bom');
  await writeFile(resolve(salida, 'gate-material.xlsx'), libroBytes);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(libroBytes) as unknown as ExcelJS.Buffer);
  const hoja = libro.getWorksheet('Material')!;
  assert.ok(hoja);
  const filas = new Map<string, ExcelJS.Row>();
  for (let n = 10; n < 10 + bom.length; n++) filas.set(String(hoja.getRow(n).getCell(1).value), hoja.getRow(n));
  for (const l of bom) {
    const fila = filas.get(l.articulo_id)!;
    assert.equal(fila.getCell(6).value, l.cantidad);
    assert.equal(typeof fila.getCell(6).value, 'number');
    assert.equal(fila.getCell(12).value, l.a_comprar);
    assert.equal(fila.getCell(14).value, l.precio_unitario);
    assert.equal(fila.getCell(15).value, l.estado_precio);
    assert.equal(fila.getCell(16).value, l.importe_necesidad);
    assert.equal(fila.getCell(17).value, l.importe_compra);
    for (const n of [14, 16, 17]) if (fila.getCell(n).value != null) assert.equal(typeof fila.getCell(n).value, 'number');
  }
  assert.equal(filas.get(f.microfono)!.getCell(14).value, null);
  assert.match(String(filas.get(f.microfono)!.getCell(3).value), /Micrófono/);
  assert.equal(hoja.getCell('B3').value, snapshot.revision);
  const subtotal = Math.round(bom.reduce((total, l) => total + (l.importe_necesidad ?? 0), 0) * 100) / 100;
  assert.equal(hoja.getCell(10 + bom.length, 16).value, subtotal);
  ok('XLSX real reabierto: cantidades/importes numéricos, acentos, revisión, subtotal y celdas sin precio vacías');

  const cablesBytes = await generarXlsx(snapshot, [sala], 'cables');
  await writeFile(resolve(salida, 'gate-cables.xlsx'), cablesBytes);
  const libroCables = new ExcelJS.Workbook();
  await libroCables.xlsx.load(Buffer.from(cablesBytes) as unknown as ExcelJS.Buffer);
  const hojaCables = libroCables.getWorksheet('Cables')!;
  for (const [n, fila] of sala.filasCable.entries()) {
    assert.equal(hojaCables.getCell(10 + n, 2).value, fila.identificador);
    assert.equal(hojaCables.getCell(10 + n, 12).value, fila.metros);
    if (fila.metros != null) assert.equal(typeof hojaCables.getCell(10 + n, 12).value, 'number');
  }
  const csv = generarCablesCsv(snapshot, sala);
  await writeFile(resolve(salida, 'gate-cables.csv'), csv);
  assert.deepEqual(csv, new TextEncoder().encode(`\uFEFF${tablaCablesACsv(sala.filasCable)}`));
  assert.equal(new TextDecoder().decode(csv).split('\r\n')[0].replace(/^\uFEFF/, '').split(';').length, 18);
  ok('XLSX cables conserva IDs/metraje; CSV mantiene bytes, BOM UTF-8 y 18 columnas del exportador existente');

  const incompleta = await cargarSnapshot([f.salaIncompleta]);
  assert.equal(incompleta.salas[0].filasCable[0].metros, null);
  const bytesIncompleta = await generarXlsx(incompleta, incompleta.salas, 'cables');
  const libroIncompleto = new ExcelJS.Workbook();
  await libroIncompleto.xlsx.load(Buffer.from(bytesIncompleta) as unknown as ExcelJS.Buffer);
  assert.equal(libroIncompleto.getWorksheet('Cables')!.getCell('L10').value, null);
  await writeFile(resolve(salida, 'gate-cables-incompletos.xlsx'), bytesIncompleta);
  ok('sala incompleta conserva ausencia de metros en XLSX, sin convertirla en cero');

  const matrizPdf: Array<{ nombre: string; bytes: number; sha256: string; opciones: OpcionesPdf }> = [];
  for (const papel of ['A4', 'A3'] as const) for (const orientacion of ['horizontal', 'vertical'] as const) {
    const opcion = { papel, orientacion, escala: 50 } as const;
    for (const tipo of ['plano', 'elevaciones', 'esquema'] as const) {
      const bytes = await generarPdfTecnico(snapshot, sala, tipo, opcion);
      assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
      const nombre = `gate-${tipo}-${papel}-${orientacion}-50.pdf`;
      await writeFile(resolve(salida, nombre), bytes);
      matrizPdf.push({ nombre, bytes: bytes.length, sha256: digest(bytes), opciones: opcion });
    }
  }
  for (const tipo of ['plano', 'elevaciones', 'esquema'] as const) {
    const bytes = await generarPdfTecnico(incompleta, incompleta.salas[0], tipo, opciones);
    await writeFile(resolve(salida, `gate-${tipo}-incompleto.pdf`), bytes);
  }
  const bytesEscala20 = await generarPdfTecnico(snapshot, sala, 'plano', { ...opciones, escala: 20 });
  await writeFile(resolve(salida, 'gate-plano-A4-horizontal-20.pdf'), bytesEscala20);
  ok('generados PDF reales A4/A3 horizontal/vertical, escala 1:50, plano paginado 1:20 y los tres documentos incompletos; requieren render visual');

  const documentos: TipoDocumento[] = ['plano', 'elevaciones', 'esquema', 'bom-xlsx', 'bom-csv', 'cables-xlsx', 'cables-csv'];
  const eventos: unknown[] = [];
  const manifiesto = await generarPaquete(snapshot, documentos, opciones, f.admin, (evento) => eventos.push(evento));
  assert.equal(manifiesto.archivos.length, 7);
  assert.ok(manifiesto.archivos.every((a) => a.estado === 'correcto'));
  const guardado = await leerPaquete(manifiesto.id, f.admin);
  assert.deepEqual(guardado?.manifiesto, manifiesto);
  assert.equal(await leerPaquete(manifiesto.id, f.lectura), null);
  assert.equal(await leerArchivo(manifiesto.id, '../propietario.json', manifiesto), null);
  const zip = await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto);
  assert.ok(zip);
  const segundaDescarga = await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto);
  assert.equal(digest(zip), digest(segundaDescarga!));
  const entradas = unzipSync(zip);
  assert.equal(Object.keys(entradas).length, 8);
  assert.deepEqual(JSON.parse(strFromU8(entradas['manifiesto.json'])), manifiesto);
  for (const archivo of manifiesto.archivos) {
    assert.equal(digest(entradas[archivo.nombre]), archivo.sha256);
    assert.equal(entradas[archivo.nombre].length, archivo.bytes);
  }
  await writeFile(resolve(salida, 'gate-paquete.zip'), zip);
  await writeFile(resolve(salida, 'gate-manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  await writeFile(resolve(salida, 'gate-progreso.json'), JSON.stringify(eventos, null, 2));
  ok('ZIP real reabierto: siete documentos, manifiesto/revisión/hash/bytes coherentes; segunda descarga idéntica, propietario y path traversal protegidos');

  const eventosFallo: unknown[] = [];
  const parcial = await generarPaquete(snapshot, documentos, opciones, f.admin, (evento) => eventosFallo.push(evento),
    async (...argumentos) => { if (argumentos[2] === 'plano') throw new Error('Fallo PDF simulado E1'); return generarPdfTecnico(...argumentos); });
  const errores = parcial.archivos.filter((a) => a.estado === 'error');
  assert.equal(errores.length, 1);
  assert.equal(errores[0].documento, 'plano');
  assert.match(errores[0].error!, /demás documentos siguen disponibles/);
  const zipParcial = await leerArchivo(parcial.id, 'paquete.zip', parcial);
  assert.ok(zipParcial);
  const entradasParcial = unzipSync(zipParcial);
  assert.equal(Object.keys(entradasParcial).length, 7);
  assert.equal(entradasParcial[errores[0].nombre], undefined);
  assert.equal((await leerPaquete(manifiesto.id, f.admin))?.manifiesto.revision, snapshot.revision);
  assert.equal(digest((await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto))!), digest(zip));
  await writeFile(resolve(salida, 'gate-paquete-parcial.zip'), zipParcial);
  await writeFile(resolve(salida, 'gate-fallo-parcial.json'), JSON.stringify({ manifiesto: parcial, eventos: eventosFallo }, null, 2));
  ok('fallo PDF inyectado conserva seis documentos válidos y su ZIP; último paquete correcto sigue descargándose idéntico');

  const nueva = await cargarSnapshot([f.sala]);
  assert.notEqual(nueva.revision, snapshot.revision);
  assert.deepEqual(nueva.salas, snapshot.salas);
  assert.deepEqual(nueva.articulos, snapshot.articulos);
  const despues = await fotografiarBase(sql);
  assert.deepEqual(despues, antes);
  await writeFile(resolve(salida, 'bd-gate-despues.json'), JSON.stringify(despues, null, 2));
  await writeFile(resolve(salida, 'gate-resultados.json'), JSON.stringify({
    base: antes.base, sinMutacion: despues.sha256 === antes.sha256, sha256Antes: antes.sha256, sha256Despues: despues.sha256,
    comprobaciones, pdf: matrizPdf, revision: snapshot.revision, revisionNueva: nueva.revision,
    paquete: manifiesto.id, paqueteParcial: parcial.id,
  }, null, 2));
  ok('nueva revisión distinguible; 38 tablas sin mutación tras lectura y todas las exportaciones');
  }
} finally {
  await global.__sql?.end();
  await sql.end();
  modulo._load = original;
}
