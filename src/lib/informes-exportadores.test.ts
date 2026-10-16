import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generarCsvInforme, generarLibroInforme, generarPdfInforme, sellarSnapshot, sha256 } from './informes/exportadores';
import { serializarCanonico, type SnapshotInforme } from './informes/modelo';
const snapshot: SnapshotInforme = { versionModelo: 1, versionGenerador: 'rea03-1', revision: '', ejecucionId: 'd3000000-0000-4000-8000-000000000001', definicion: { id: 'd3000000-0000-4000-8000-000000000002', nombre: 'Informe de prueba con tildes', version: 0, propietarioId: 'd3000000-0000-4000-8000-000000000003', configuracion: { versionModelo: 1, versionRegistro: 1, clave: 'carga_actual', ambito: { tipo: 'sala', id: 'd3000000-0000-4000-8000-000000000004' }, periodo: { modo: 'actual' }, formatos: ['pdf', 'csv', 'xlsx'], audiencia: { usuarios: [], grupos: [] } }, programacion: null, versionGenerador: 'rea03-1' }, definicionSha256: 'a'.repeat(64), periodo: { modo: 'actual', zona: 'Europe/Madrid' }, ambito: { solicitado: { tipo: 'sala', id: 'd3000000-0000-4000-8000-000000000004' }, nombre: 'Sala sintética', salas: [], proyectos: [] }, previstaEn: '2026-10-15T08:00:00.000Z', observadoEn: '2026-10-15T08:01:00.000Z', columnas: [{ clave: 'texto', titulo: 'Texto completo', tipo: 'texto' }, { clave: 'cantidad', titulo: 'Cantidad', tipo: 'numero' }], filas: [{ clave: '1', valores: { texto: '=SUM(A1)\nTildes ñ y salto', cantidad: -3 } }, { clave: '2', valores: { texto: null, cantidad: 0 } }], avisos: [] };
test('revisión y SHA canónicos se reproducen', () => {
    const a = sellarSnapshot(snapshot), b = sellarSnapshot(structuredClone(snapshot));
    assert.deepEqual(a, b);
    assert.match(a.snapshot.revision, /^INF-[0-9a-f]{12}$/);
    assert.equal(a.sha256, sha256(serializarCanonico(a.snapshot)));
});
test('CSV BOM, escape de fórmula y negativo numérico', () => {
    const { snapshot: s, sha256: h } = sellarSnapshot(snapshot);
    const texto = new TextDecoder().decode(generarCsvInforme(s, h));
    assert.match(texto, /'=SUM\(A1\)/);
    assert.match(texto, /-3,00/);
    assert.match(texto, /;0,00/);
    const bytes = generarCsvInforme(s, h);
    assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
});
test('XLSX reabierto mantiene tipos numéricos, texto seguro y contexto', async () => {
    const { snapshot: s, sha256: h } = sellarSnapshot(snapshot);
    const b = await generarLibroInforme(s, h);
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(Buffer.from(b) as unknown as ExcelJS.Buffer);
    assert.equal(w.getWorksheet('Datos')!.getCell('C2').value, -3);
    assert.equal(w.getWorksheet('Datos')!.getCell('C3').value, 0);
    assert.equal(typeof w.getWorksheet('Datos')!.getCell('B2').value, 'string');
    assert.ok(w.getWorksheet('Informe'));
});
test('PDF real paginado envuelve texto y continúa filas largas', async () => {
    const s = structuredClone(snapshot);
    s.filas[0].valores.texto = 'Texto largo ñ, con salto\n'.repeat(1500);
    const { snapshot: captura, sha256: h } = sellarSnapshot(s);
    const bytes = await generarPdfInforme(captura, h);
    assert.equal(Buffer.from(bytes).subarray(0, 8).toString(), '%PDF-1.3');
    assert.ok(bytes.length > 3000);
});
test('el pie no crea páginas implícitas y el título máximo conserva dos páginas', async () => {
    const s = structuredClone(snapshot);
    s.definicion.nombre = 'W'.repeat(120);
    const sellado = sellarSnapshot(s);
    const bytes = await generarPdfInforme(sellado.snapshot, sellado.sha256);
    assert.equal((Buffer.from(bytes).toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 2);
});
test('el contexto de enlace no colisiona con la columna detalle BOM', () => {
    const s = structuredClone(snapshot);
    s.columnas.push({ clave: 'detalle', titulo: 'Detalle BOM', tipo: 'texto' });
    s.filas[0].valores.detalle = 'Detalle de la necesidad';
    const sellado = sellarSnapshot(s);
    const texto = new TextDecoder().decode(generarCsvInforme(sellado.snapshot, sellado.sha256));
    const cabeceras = texto.split('\r\n')[0].split(';');
    assert.equal(new Set(cabeceras).size, cabeceras.length);
    assert.ok(cabeceras.includes('enlace_detalle'));
    assert.ok(cabeceras.includes('detalle'));
});
test('CSV acotado falla antes de montar un archivo expandido por contexto', async () => {
    const { LIMITES } = await import('./informes/modelo');
    const s = structuredClone(snapshot);
    s.filas = Array.from({ length: 50 }, (_, i) => ({ clave: String(i), valores: { texto: 'valor', cantidad: 0 } }));
    const limiteOriginal = LIMITES.archivo;
    Object.assign(LIMITES, { archivo: 3000 });
    try {
        assert.throws(() => generarCsvInforme(s, 'a'.repeat(64)), { codigo: 'LIMITE_EXCEDIDO' });
    }
    finally {
        Object.assign(LIMITES, { archivo: limiteOriginal });
    }
});
test('XLSX conserva texto largo en celdas canónicas y hoja legible de continuaciones', async () => {
    const s = structuredClone(snapshot);
    const texto = 'Texto con tildes ñ y saltos\n'.repeat(100);
    s.filas[0].valores.texto = texto;
    const sellado = sellarSnapshot(s);
    const bytes = await generarLibroInforme(sellado.snapshot, sellado.sha256);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
    assert.equal(libro.getWorksheet('Datos')!.getCell('B2').value, texto);
    const partes = libro.getWorksheet('Textos completos')!;
    assert.ok(partes);
    assert.equal((partes.getRows(2, partes.rowCount - 1) ?? []).map(f => String(f.getCell(4).value)).join(''), texto);
});
test('XLSX rechaza celdas mayores de32767 sin entregar un libro inválido', async () => {
    const s = structuredClone(snapshot);
    s.filas[0].valores.texto = 'a'.repeat(32768);
    await assert.rejects(() => generarLibroInforme(s, 'a'.repeat(64)), { codigo: 'LIMITE_EXCEDIDO' });
});
test('PDF rechaza URLs de usuario en el enlace de detalle', async () => {
    for (const enlace of ['https://usuario.invalid/datos', '//usuario.invalid', '/salas/no-es-uuid', '/salas/../../privado']) {
        const s = structuredClone(snapshot);
        s.filas[0].enlace = enlace;
        await assert.rejects(() => generarPdfInforme(s, 'a'.repeat(64)), { codigo: 'DATOS_INVALIDOS' });
    }
});
