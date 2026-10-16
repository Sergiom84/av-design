/** Libro de obra desde el mismo snapshot final guardado; sin conexión a BD. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { generarXlsx, construirBom } from '../src/lib/documentos/tablas';
import type { SnapshotExportacion } from '../src/lib/documentos/modelo';
const tanda = process.argv.find(a => a.startsWith('--tanda='))?.slice(8) ?? 'final';
if (!/^[a-z0-9-]+$/.test(tanda)) throw new Error('Tanda inválida.');
const carpeta = resolve('output/e3-revisiones/documentos', tanda);
const snapshot = JSON.parse(await readFile(resolve(carpeta, 'snapshot-obra.json'), 'utf8')) as SnapshotExportacion;
assert.equal(snapshot.salas.length, 2);
for (const tipo of ['bom', 'cables'] as const) {
  const bytes = await generarXlsx(snapshot, snapshot.salas, tipo);
  await writeFile(resolve(carpeta, `obra-${tipo}.xlsx`), bytes);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const revisiones = libro.getWorksheet('Revisiones de diseño')!;
  for (const [i, sala] of snapshot.salas.entries()) {
    assert.equal(revisiones.getCell(i + 10, 1).value, sala.sala.id);
    assert.equal(revisiones.getCell(i + 10, 7).value, sala.revisionDiseno?.hash);
  }
  if (tipo === 'bom') {
    const hoja = libro.getWorksheet('Material')!;
    for (const [i, linea] of construirBom(snapshot, snapshot.salas).entries()) {
      assert.equal(hoja.getCell(i + 10, 1).value, linea.articulo_id);
      assert.equal(hoja.getCell(i + 10, 6).value, linea.cantidad);
      assert.equal(linea.existencias, snapshot.disponibilidad.find(d => d.articulo_id === linea.articulo_id)?.existencias ?? 0);
    }
  }
}
await writeFile(resolve(carpeta, 'xlsx-obra-resultados.json'), JSON.stringify({ libros: 2, salas: 2, revision: snapshot.revision, stockContadoUnaVez: true, sinConexionBD: true }, null, 2));
console.log('2 XLSX de obra reabiertos: dos referencias de diseño y stock contado una vez. Sin conexión a BD.');
