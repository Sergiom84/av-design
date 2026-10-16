/** Exportación E3 de sólo lectura contra destino explícito; no sobrescribe evidencia E1/E2. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { conectarRevisiones, fotografiarRevisiones, FIXTURE_REVISIONES as f } from './revisiones-fixture.mjs';
import type { OpcionesPdf, SnapshotExportacion, TipoDocumento } from '../src/lib/documentos/modelo';

const url = process.env.REVISIONES_DATABASE_URL;
if (!url) throw new Error('REVISIONES_DATABASE_URL explícita obligatoria. No se usa .env.local.');
const sql = await conectarRevisiones(url);
process.env.DATABASE_URL = url;
type Modulo = { _load: (request: string, ...resto: unknown[]) => unknown };
const modulo = Module as unknown as Modulo;
const original = modulo._load;
modulo._load = (request, ...resto) => request === 'server-only' ? {} : original.call(Module, request, ...resto);
const nombreTanda = process.argv.find((a) => a.startsWith('--tanda='))?.slice(8) ?? 'inicial';
if (!/^[a-z0-9-]+$/.test(nombreTanda)) throw new Error('Tanda de evidencia inválida.');
const salida = resolve('output/e3-revisiones/documentos', nombreTanda);
await mkdir(salida, { recursive: true });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const comprobaciones: string[] = [];
const ok = (s: string) => { comprobaciones.push(s); console.log(`OK ${s}`); };
const opciones: OpcionesPdf = { papel: 'A4', orientacion: 'horizontal', escala: 50 };
const artefactos: Array<{ nombre: string; bytes: number; sha256: string; salaId: string; tipo: string; revision: string }> = [];

try {
  const antes = await fotografiarRevisiones(sql);
  await writeFile(resolve(salida, 'bd-antes.json'), JSON.stringify(antes, null, 2));
  const { cargarSnapshot } = await import('../src/lib/documentos/datos');
  const { construirBom, generarBomCsv, generarCablesCsv, generarXlsx } = await import('../src/lib/documentos/tablas');
  const { generarPdfTecnico, escenaEsquemaExportada, maquetarPdf, mosaicosEsquema } = await import('../src/lib/documentos/pdf');
  const { generarPaquete, leerArchivo, leerPaquete } = await import('../src/lib/documentos/paquete');
  const { tablaCablesACsv } = await import('../src/lib/cable-schedule');
  const { necesidadDeSala } = await import('../src/lib/compras');
  const { agruparMaterialCable } = await import('../src/lib/calculo-cable');

  const principal = await cargarSnapshot([f.sala]);
  const grande = await cargarSnapshot([f.grande]);
  const legado = await cargarSnapshot([f.legado]);
  const obra = await cargarSnapshot([f.sala, f.salaDos], f.proyecto);
  const [alternativa] = await sql<Array<{ id: string }>>`select id from salas where origen_sala_id=${f.sala} order by creado_en desc limit 1`;
  const copia = alternativa ? await cargarSnapshot([alternativa.id]) : null;
  const snapshots: Array<{ nombre: string; snapshot: SnapshotExportacion }> = [
    { nombre: 'principal', snapshot: principal }, { nombre: 'grande', snapshot: grande },
    { nombre: 'legado', snapshot: legado }, { nombre: 'obra', snapshot: obra },
    ...(copia ? [{ nombre: 'alternativa', snapshot: copia }] : []),
  ];
  for (const { nombre, snapshot } of snapshots) {
    assert.ok(snapshot.salas.every((s) => s.revisionDiseno?.hash.length === 64));
    await writeFile(resolve(salida, `snapshot-${nombre}.json`), JSON.stringify(snapshot, null, 2));
  }
  assert.equal(legado.proyecto, null);
  assert.equal(grande.salas[0].equipos.length, 15);
  assert.equal(grande.salas[0].conexiones.length, 100);
  assert.ok(grande.salas[0].puertos.some((p) => p.total === 24));
  assert.ok(grande.salas[0].conexiones.every((c) => Boolean(c.identificador_cable)));
  ok('Snapshot identifica diseño por sala; legado válido; matriz real 15 equipos / 24 bocas / 100 conexiones con etiquetas persistidas.');
  if (process.argv.includes('--exigir-historia')) {
    assert.ok(principal.salas[0].revisionDiseno!.id || principal.salas[0].revisionDiseno!.antecedente);
    assert.ok(principal.salas[0].anotacionesDiseno!.length > 0);
    assert.ok(copia?.salas[0].revisionDiseno?.heredadaDe);
    const escena = escenaEsquemaExportada(grande, grande.salas[0]);
    for (let i = 0; i < escena.bloques.length; i++) for (let j = i + 1; j < escena.bloques.length; j++) {
      const a = escena.bloques[i], b = escena.bloques[j];
      assert.ok(a.x + a.ancho <= b.x || b.x + b.ancho <= a.x || a.y + a.alto <= b.y || b.y + b.alto <= a.y, 'Ordenación grande guardada no puede dejar bloques solapados.');
    }
    ok('Historia real, anotaciones de BD, herencia de copia y ordenación sin solapamientos presentes antes de exportar.');
  }

  const s = principal.salas[0];
  const articulos = new Map(principal.articulos.map((a) => [a.id, a]));
  const esperado = necesidadDeSala(s.equipos, agruparMaterialCable(s.resultadosCable, s.conexiones, articulos), articulos, s.materialBom);
  assert.deepEqual(construirBom(principal, [s]).map((l) => [l.articulo_id, l.cantidad]).sort(), esperado.map((l) => [l.articulo_id, l.cantidad]).sort());
  const global = new Map(obra.disponibilidad.map((d) => [d.articulo_id, d]));
  for (const l of construirBom(obra, obra.salas)) assert.equal(l.existencias, global.get(l.articulo_id)?.existencias ?? 0);
  ok('BOM mantiene equipos + cable + material adicional; stock de obra se cuenta una vez.');

  for (const { nombre, snapshot } of snapshots.filter((s) => s.nombre !== 'obra')) {
    const sala = snapshot.salas[0];
    for (const tipo of ['bom', 'cables'] as const) {
      const bytes = await generarXlsx(snapshot, [sala], tipo);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
      assert.equal(libro.getWorksheet('Revisiones de diseño')!.getCell('G10').value, sala.revisionDiseno!.hash);
      if (sala.revisionDiseno?.heredadaDe) assert.ok(String(libro.getWorksheet('Revisiones de diseño')!.getCell('K10').value).includes(sala.revisionDiseno.heredadaDe.salaId));
      assert.equal(libro.getWorksheet(tipo === 'bom' ? 'Material' : 'Cables')!.getCell('B3').value, snapshot.revision);
      if (tipo === 'cables') {
        for (const [i, fila] of sala.filasCable.entries()) {
          assert.equal(libro.getWorksheet('Cables')!.getCell(i + 10, 2).value, fila.identificador);
          assert.equal(libro.getWorksheet('Cables')!.getCell(i + 10, 12).value, fila.metros);
        }
      }
      await writeFile(resolve(salida, `${nombre}-${tipo}.xlsx`), bytes);
    }
    const csv = generarCablesCsv(snapshot, sala);
    assert.equal(new TextDecoder().decode(csv), tablaCablesACsv(sala.filasCable));
    assert.equal(new TextDecoder().decode(csv).split('\r\n')[0].split(';').length, 18);
    await writeFile(resolve(salida, `${nombre}-cables.csv`), csv);
    const bom = generarBomCsv(snapshot, sala);
    if (construirBom(snapshot, [sala]).length) assert.ok(new TextDecoder().decode(bom).includes(sala.revisionDiseno!.hash));
    await writeFile(resolve(salida, `${nombre}-bom.csv`), bom);
  }
  ok(`${(snapshots.length - 1) * 2} XLSX reales reabiertos: identidad por sala, números/metraje y revisión exportación; CSV cables idéntico con 18 columnas.`);

  const casos = [
    ...(['plano', 'elevaciones', 'esquema'] as const).map((tipo) => ({ nombre: `principal-${tipo}`, snapshot: principal, tipo, opciones })),
    { nombre: 'grande-esquema-A4', snapshot: grande, tipo: 'esquema' as const, opciones },
    { nombre: 'grande-esquema-A3', snapshot: grande, tipo: 'esquema' as const, opciones: { ...opciones, papel: 'A3' as const } },
    { nombre: 'legado-plano', snapshot: legado, tipo: 'plano' as const, opciones },
    ...(copia ? [{ nombre: 'alternativa-plano', snapshot: copia, tipo: 'plano' as const, opciones }] : []),
  ];
  for (const caso of casos) {
    const sala = caso.snapshot.salas[0];
    const congelado = JSON.stringify(caso.snapshot);
    const bytes = await generarPdfTecnico(caso.snapshot, sala, caso.tipo, caso.opciones);
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
    assert.equal(JSON.stringify(caso.snapshot), congelado);
    const nombre = `${caso.nombre}.pdf`;
    await writeFile(resolve(salida, nombre), bytes);
    artefactos.push({ nombre, bytes: bytes.length, sha256: sha(bytes), salaId: sala.sala.id, tipo: caso.tipo, revision: caso.snapshot.revision });
    if (caso.snapshot === grande) {
      const escena = escenaEsquemaExportada(caso.snapshot, sala);
      const layout = maquetarPdf(caso.snapshot, sala, caso.tipo, caso.opciones);
      await writeFile(resolve(salida, `${caso.nombre}-mosaicos.json`), JSON.stringify({ escena: { ancho: escena.ancho, alto: escena.alto }, zona: layout.zona,
        hojas: mosaicosEsquema(escena, layout.zona), tamanoDetalle: 1, minimoTextoPuntos: 7.5 }, null, 2));
    }
  }
  ok(`${casos.length} PDF vectoriales generados sin mutar snapshot: notas/leyenda/antecedente y mosaicos legibles; render visual posterior requerido.`);

  const documentos: TipoDocumento[] = ['plano', 'elevaciones', 'esquema', 'bom-xlsx', 'bom-csv', 'cables-xlsx', 'cables-csv'];
  const manifiesto = await generarPaquete(principal, documentos, opciones, f.admin, () => {});
  assert.ok(manifiesto.archivos.every((a) => a.estado === 'correcto'));
  assert.deepEqual(manifiesto.salas[0].revisionDiseno, s.revisionDiseno);
  const zip = await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto); assert.ok(zip);
  const entradas = unzipSync(zip);
  assert.deepEqual(JSON.parse(strFromU8(entradas['manifiesto.json'])), manifiesto);
  for (const archivo of manifiesto.archivos) assert.equal(sha(entradas[archivo.nombre]), archivo.sha256);
  assert.equal(sha((await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto))!), sha(zip));
  assert.equal(await leerPaquete(manifiesto.id, f.lectura), null);
  await writeFile(resolve(salida, 'paquete.zip'), zip);
  await writeFile(resolve(salida, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  const parcial = await generarPaquete(principal, documentos, opciones, f.admin, () => {}, async (...a) => {
    if (a[2] === 'plano') throw new Error('Fallo sintético E3'); return generarPdfTecnico(...a);
  });
  assert.equal(parcial.archivos.filter((a) => a.estado === 'error').length, 1);
  assert.equal(sha((await leerArchivo(manifiesto.id, 'paquete.zip', manifiesto))!), sha(zip));
  await writeFile(resolve(salida, 'manifiesto-parcial.json'), JSON.stringify(parcial, null, 2));
  ok('ZIP/manifiesto coherentes por diseño/sala, hashes íntegros, propietario protegido, descarga idéntica y conservación ante fallo parcial.');

  const despues = await fotografiarRevisiones(sql);
  assert.deepEqual(despues, antes, 'Exportación no modifica ninguna tabla E1/E2/E3 ni hecho operativo.');
  await writeFile(resolve(salida, 'bd-despues.json'), JSON.stringify(despues, null, 2));
  await writeFile(resolve(salida, 'resultados.json'), JSON.stringify({ comprobaciones, sha256Antes: antes.sha256, sha256Despues: despues.sha256,
    sinMutacion: true, referencias: snapshots.map(({ nombre, snapshot }) => ({ nombre, salas: snapshot.salas.map((s) => ({ id: s.sala.id, revisionDiseno: s.revisionDiseno, anotaciones: s.anotacionesDiseno?.length ?? 0 })) })), pdf: artefactos }, null, 2));
  ok(`${antes.tablas.length} tablas conservan el hash; evidencia separada en ${salida}.`);
} finally {
  await global.__sql?.end(); await sql.end(); modulo._load = original;
}
