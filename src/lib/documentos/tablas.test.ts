import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { calcularConexion, agruparMaterialCable, type ResultadoCable } from '../calculo-cable';
import { construirTablaCables, tablaCablesACsv } from '../cable-schedule';
import { calcularDisponibilidad } from '../almacen';
import { necesidadDeSala, calcularFaltante, agruparPorProveedor } from '../compras';
import { PARAMETROS_POR_DEFECTO, type Articulo, type Sala, type EquipoEnSala, type Conexion } from '../tipos';
import { avisosDeMaterial, construirBom, generarBomCsv, generarCablesCsv, generarXlsx } from './tablas';
import { textoSeguroCsv } from './csv';
import type { SalaExportada, SnapshotExportacion } from './modelo';

function articulo(id: string, cambios: Partial<Articulo> = {}): Articulo {
  return { id, referencia: `REF-${id}`, tipo: 'equipo', categoria: 'Pantalla', marca: 'Marca', modelo: id,
    descripcion: null, caracteristicas: null, observaciones: null, unidad: 'ud', coste: 10,
    coste_orientativo: false, pvp: null, proveedor: 'Proveedor', plazo_dias: null, stock_minimo: null,
    senal: null, conector_a: null, conector_b: null, longitudes_comerciales_m: null, bobina_m: null,
    diametro_mm: null, unidades_instaladas: null, activo: true, ...cambios };
}
const ARTICULOS = [articulo('pantalla', { modelo: 'Pantalla Ágora' }),
  articulo('soporte', { modelo: 'Soporte Ñ', coste: 20.25, coste_orientativo: true }),
  articulo('cable', { tipo: 'cable', modelo: 'Cat6A', unidad: 'm', coste: null, bobina_m: 100, senal: 'red' }),
  articulo('cero', { coste: 0 })];

function sala(id: string): SalaExportada {
  const s: Sala = { id, sede_id: null, localizacion_id: null, codigo: id, nombre: `Sala Ágora ${id}`, tipologia: 'PRUEBA-DOC-01',
    aforo: 8, plantilla_id: null, largo_m: 6, ancho_m: 4, alto_m: 3, alto_falso_techo_m: 2.7,
    alto_canaleta_m: 0.3, alto_suelo_tecnico_m: 0, ruta_por_defecto: 'falso_techo', notas: null,
    mesa_largo_m: null, mesa_ancho_m: null, mesa_alto_cm: null, mesa_x_m: null, mesa_y_m: null,
    mesa_rotacion_grados: 0, diagrama_version: 0, sillas_modo: 'derivadas' };
  const equipo = (ref: string, cantidad: number): EquipoEnSala => ({ id: `${id}-${ref}`, sala_id: id,
    articulo_id: ref, nombre: `${ref} Ágora`, cantidad, extremo: 'pantalla', posicion: { x_m: 1, y_m: 2, z_m: 1 },
    posicion_confirmada: true, rotacion_grados: 0 });
  const equipos = [equipo('pantalla', 3), equipo('soporte', 1), equipo('cero', 1)];
  const conexiones: Conexion[] = [{ id: `${id}-conexion`, sala_id: id, origen_id: equipos[0].id,
    destino_id: equipos[1].id, articulo_cable_id: 'cable', senal: 'red', ruta: null,
    longitud_manual_m: 6.25, notas: null, creado_en: '2026-10-13T08:00:00.000Z' }];
  const articulos = new Map(ARTICULOS.map((a) => [a.id, a]));
  const porEquipo = new Map(equipos.map((e) => [e.id, e]));
  const resultadosCable = conexiones.map((c) => calcularConexion(c, s, porEquipo, articulos))
    .filter((r): r is ResultadoCable => r !== null);
  return { sala: s, equipos, muebles: [], puertas: [], conexiones, tomas: [], puertos: [], reservas: [{ articulo_id: 'pantalla', cantidad: 1 }],
    posicionesEsquema: {}, resultadosCable,
    filasCable: construirTablaCables({ conexiones, equipos: porEquipo, tomas: new Map(), puertos: new Map(),
      articulos, resultados: new Map(resultadosCable.map((r) => [r.conexion_id, r])) }) };
}
function snapshot(salas = [sala('s1')]): SnapshotExportacion {
  return { revision: 'DOC-PRUEBA-01', creadoEn: '2026-10-13T08:00:00.000Z', proyecto: { id: 'p1', codigo: 'PRUEBA-DOC-01', nombre: 'Obra técnica Ágora' },
    salas, articulos: ARTICULOS, parametros: PARAMETROS_POR_DEFECTO,
    disponibilidad: [calcularDisponibilidad('pantalla', 4, 2, null), calcularDisponibilidad('cable', 2.5, 0, null)] };
}
async function leerXlsx(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes as unknown as Parameters<typeof libro.xlsx.load>[0]);
  return libro;
}

describe('exportación BOM y cables', () => {
  test('la BOM coincide con la cadena de compra existente y mantiene precio ausente, orientativo y cero', () => {
    const snap = snapshot(); const s = snap.salas[0];
    const articulos = new Map(snap.articulos.map((a) => [a.id, a]));
    const necesidad = necesidadDeSala(s.equipos, agruparMaterialCable(s.resultadosCable, s.conexiones, articulos), articulos);
    const faltantes = calcularFaltante(necesidad, new Map(snap.disponibilidad.map((d) => [d.articulo_id, d.disponible])), new Map([['pantalla', 1]]));
    const compras = agruparPorProveedor(faltantes, articulos).flatMap((g) => g.lineas);
    const bom = construirBom(snap, [s]);
    assert.deepEqual(bom.map((l) => [l.articulo_id, l.cantidad, l.a_comprar]), faltantes.map((l) => [l.articulo_id, l.cantidad, l.falta]));
    for (const compra of compras) assert.equal(bom.find((l) => l.articulo_id === compra.articulo_id)?.importe_compra, compra.importe);
    assert.equal(bom.find((l) => l.articulo_id === 'pantalla')?.a_comprar, 0);
    assert.equal(bom.find((l) => l.articulo_id === 'cable')?.importe_compra, null);
    assert.equal(bom.find((l) => l.articulo_id === 'soporte')?.estado_precio, 'Orientativo');
    assert.equal(bom.find((l) => l.articulo_id === 'cero')?.precio_unitario, 0);
    assert.equal(bom.find((l) => l.articulo_id === 'cero')?.importe_compra, 0);
  });

  test('la obra suma necesidad y reservas propias una vez, y comparte el stock sin duplicarlo', () => {
    const snap = snapshot([sala('s1'), sala('s2')]);
    const bom = construirBom(snap, snap.salas);
    const pantalla = bom.find((l) => l.articulo_id === 'pantalla')!;
    assert.deepEqual([pantalla.cantidad, pantalla.existencias, pantalla.disponible_libre, pantalla.reservado_propio,
      pantalla.disponible_para_seleccion, pantalla.a_comprar], [6, 4, 2, 2, 4, 2]);
    assert.equal(bom.find((l) => l.articulo_id === 'cable')?.a_comprar, 10);
    assert.deepEqual(construirBom(snap, [snap.salas[0], snap.salas[0]]), construirBom(snap, [snap.salas[0]]));
    assert.equal(construirBom(snap, [snap.salas[0]]).find((l) => l.articulo_id === 'pantalla')?.reservado_propio, 1);
  });

  test('un equipo y un cable del mismo artículo se consolidan sin cambiar sus cantidades', () => {
    const snap = snapshot(); const s = snap.salas[0];
    snap.articulos = snap.articulos.map((a) => a.id === 'cable' ? { ...a, unidad: 'ud', longitudes_comerciales_m: [10] } : a);
    s.equipos.push({ ...s.equipos[0], id: 'latiguillo', articulo_id: 'cable', nombre: 'Latiguillo', cantidad: 2 });
    const porEquipo = new Map(s.equipos.map((e) => [e.id, e]));
    s.resultadosCable = [calcularConexion(s.conexiones[0], s.sala, porEquipo, new Map(snap.articulos.map((a) => [a.id, a])))!];
    const cable = construirBom(snap, [s]).find((l) => l.articulo_id === 'cable')!;
    assert.equal(cable.cantidad, 3); assert.deepEqual(cable.origenes, ['equipo', 'cable']);
  });

  test('CSV de cables conserva exactamente dialecto y las 18 columnas de la exportación actual', () => {
    const snap = snapshot(); const s = snap.salas[0];
    const csv = new TextDecoder().decode(generarCablesCsv(snap, s));
    assert.equal(csv, tablaCablesACsv(s.filasCable)); // TextDecoder consume la marca UTF-8.
    assert.equal(csv.split('\r\n')[0].split(';').length, 18);
    assert.match(csv, /6,25/); assert.match(csv, /Ágora/);
    assert.deepEqual([...generarCablesCsv(snap, s).slice(0, 3)], [239, 187, 191]);
  });

  test('CSV neutraliza fórmulas en todos los textos sin tocar números ni escapar mal comillas', () => {
    const snap = snapshot(); const s = snap.salas[0];
    s.filasCable[0].origen = ' =SUM(1;2)'; s.filasCable[0].puerto_origen = '\t=HYPERLINK("url")';
    s.filasCable[0].avisos = ['@SUM(1)', 'Texto "con comillas"'];
    const csv = new TextDecoder().decode(generarCablesCsv(snap, s));
    assert.ok(csv.includes('"\' =SUM(1;2)"'));
    assert.ok(csv.includes('"\'\t=HYPERLINK(""url"")"'));
    assert.ok(csv.includes("'@SUM(1)"));
    snap.articulos = snap.articulos.map((a) => ({ ...a, marca: null, modelo: '=1+1', proveedor: '+cmd' }));
    const bom = new TextDecoder().decode(generarBomCsv(snap, s));
    assert.ok(bom.includes("'=1+1")); assert.ok(bom.includes("'+cmd"));
    assert.equal(textoSeguroCsv('Un producto'), 'Un producto');
    assert.equal(textoSeguroCsv('-2+1'), "'-2+1");
    assert.equal(textoSeguroCsv('\u0000=2+2'), "'\u0000=2+2");
  });

  test('el XLSX real conserva tipos, campos vacíos, acentos, alcance y totales', async () => {
    const snap = snapshot([sala('s1'), sala('s2')]);
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    assert.equal(libro.worksheets.length, 2);
    const hoja = libro.getWorksheet('Material')!;
    const filas = construirBom(snap, snap.salas);
    for (const [i, l] of filas.entries()) {
      const n = 10 + i;
      assert.equal(hoja.getCell(n, 6).value, l.cantidad);
      assert.equal(typeof hoja.getCell(n, 6).value, 'number');
      assert.equal(hoja.getCell(n, 14).value, l.precio_unitario);
      assert.equal(hoja.getCell(n, 15).value, l.estado_precio);
      assert.equal(hoja.getCell(n, 17).value, l.importe_compra);
      assert.equal(hoja.getCell(n, 3).value, l.descripcion);
    }
    assert.equal(hoja.getCell('B3').value, snap.revision);
    assert.ok(hoja.getCell('B4').value instanceof Date);
    assert.equal(hoja.getCell(10 + filas.length, 17).value, 60.5);
    assert.equal(hoja.getCell(10 + filas.length, 16).value, 100.5);
    const detalle = libro.getWorksheet('Necesidad por sala')!;
    assert.equal(detalle.columnCount, 7); // Ninguna copia del stock por sala.
    assert.equal(detalle.getCell('F10').type, ExcelJS.ValueType.Number);
  });

  test('XLSX de cables contiene metros numéricos y ausencia visible y mantiene identificadores por sala', async () => {
    const snap = snapshot([sala('s1'), sala('s2')]);
    snap.salas[1].filasCable[0].metros = null;
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, 'cables'));
    const hoja = libro.getWorksheet('Cables')!;
    assert.equal(hoja.getCell('L10').value, 6.25);
    assert.equal(hoja.getCell('L10').type, ExcelJS.ValueType.Number);
    assert.equal(hoja.getCell('L11').value, null);
    assert.equal(hoja.getCell('B10').value, 'RED-1000'); assert.equal(hoja.getCell('B11').value, 'RED-1000');
    assert.notEqual(hoja.getCell('A10').value, hoja.getCell('A11').value);
    assert.equal(hoja.getCell('L12').value, 6.25);
    assert.match(String(hoja.getCell('C13').value), /Sin cálculo: 1/);
  });

  test('el XLSX escribe datos que parecen fórmula como texto literal y exportar no muta el snapshot', async () => {
    const snap = snapshot(); snap.articulos = snap.articulos.map((a) => ({ ...a, marca: null, modelo: '=2+2' }));
    const antes = structuredClone(snap);
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    assert.equal(libro.getWorksheet('Material')!.getCell('C10').value, '=2+2');
    assert.equal(libro.getWorksheet('Material')!.getCell('C10').type, ExcelJS.ValueType.String);
    generarBomCsv(snap, snap.salas); generarCablesCsv(snap, snap.salas[0]);
    assert.deepEqual(snap, antes);
  });

  test('las ausencias de catálogo y metros se explican sin inventar cantidades ni precios', async () => {
    const snap = snapshot(); const s = snap.salas[0];
    s.equipos.push({ ...s.equipos[0], id: 'sin-articulo', articulo_id: '', nombre: 'Equipo libre', cantidad: 7 });
    s.conexiones[0].articulo_cable_id = null; s.filasCable[0].metros = null;
    const avisos = avisosDeMaterial(snap, [s]);
    assert.ok(avisos.some((a) => a.includes('Equipo libre')));
    assert.ok(avisos.some((a) => a.includes('sin cable asignado')));
    assert.ok(avisos.some((a) => a.includes('sin cálculo de metros')));
    assert.equal(construirBom(snap, [s]).some((l) => l.articulo_id === ''), false);
    const libro = await leerXlsx(await generarXlsx(snap, [s], 'bom'));
    assert.ok(libro.getWorksheet('Material')!.getSheetValues().flat(2).some((v) => typeof v === 'string' && v.includes('Equipo libre')));
  });
});
