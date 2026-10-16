import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { calcularConexion, agruparMaterialCable, type ResultadoCable } from '../calculo-cable';
import { construirTablaCables, tablaCablesACsv } from '../cable-schedule';
import { calcularDisponibilidad } from '../almacen';
import { necesidadDeSala, calcularFaltante, agruparPorProveedor } from '../compras';
import { PARAMETROS_POR_DEFECTO, type Articulo, type Sala, type EquipoEnSala, type Conexion } from '../tipos';
import { avisosDeMaterial, construirBom, generarBomCsv, generarCablesCsv, generarXlsx, necesidadExportada } from './tablas';
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
  test('la proyección técnica sin precios conserva la necesidad canónica de E1', () => {
    const snap = snapshot();
    const s = snap.salas[0];
    s.materialBom = [{ articulo_id: 'pantalla', descripcion: 'Pantalla adicional', unidad: 'ud', cantidad: 3 }];
    const articulos = snap.articulos.map(({ id, marca, modelo, unidad, bobina_m }) =>
      ({ id, marca, modelo, unidad, bobina_m }));
    const tecnica = necesidadExportada({ articulos }, {
      equipos: s.equipos.map(({ articulo_id, nombre, cantidad }) => ({ articulo_id, nombre, cantidad })),
      conexiones: s.conexiones,
      resultadosCable: s.resultadosCable,
      materialBom: s.materialBom,
    });
    const proyectar = ({ articulo_id, cantidad, unidad, detalle, origenes }: ReturnType<typeof necesidadExportada>[number]) =>
      ({ articulo_id, cantidad, unidad, detalle, origenes });
    assert.deepEqual(tecnica.map(proyectar), construirBom(snap, [s]).map(proyectar));
    assert.equal(tecnica.find(l => l.articulo_id === 'pantalla')?.cantidad, 6);
    assert.equal(tecnica.find(l => l.articulo_id === 'cable')?.cantidad, 6.25);
    assert.equal(tecnica.find(l => l.articulo_id === 'cable')?.unidad, 'm');
    assert.ok(tecnica.every(l => !('coste' in l) && !('precio_unitario' in l) && !('disponible' in l)));
  });

  test('XLSX identifica cada diseño y BOM CSV conserva su hash sin tocar el CSV de cables', async () => {
    const snap = snapshot(); const s = snap.salas[0];
    s.revisionDiseno = { estado: 'revision', id: 'r1', numero: 1, nombre: 'Base sintética', autor: 'Técnico de prueba',
      creadoEn: snap.creadoEn, hash: 'a'.repeat(64), antecedente: null, heredadaDe: null };
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    const hoja = libro.getWorksheet('Revisiones de diseño')!;
    assert.ok(hoja);
    assert.equal(hoja.getCell('D10').value, 'r1');
    assert.equal(hoja.getCell('G10').value, 'a'.repeat(64));
    assert.equal(hoja.getCell('H10').value, 'Técnico de prueba');
    assert.ok(new TextDecoder().decode(generarBomCsv(snap, s)).includes('a'.repeat(64)));
    assert.equal(new TextDecoder().decode(generarCablesCsv(snap, s)), tablaCablesACsv(s.filasCable));
  });
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

  test('las reservas de salas no seleccionadas siguen comprometidas y la BOM adicional usa la necesidad actual', () => {
    const snap = snapshot([sala('s1'), sala('s2')]);
    snap.disponibilidad = [calcularDisponibilidad('pantalla', 10, 8, null)];
    snap.salas[0].reservas = [{ articulo_id: 'pantalla', cantidad: 1 }, { articulo_id: 'pantalla', cantidad: 1 }];
    snap.salas[1].reservas = [{ articulo_id: 'pantalla', cantidad: 6 }];
    snap.salas[0].materialBom = [{ articulo_id: 'pantalla', descripcion: 'Pantalla de catálogo', unidad: 'ud', cantidad: 2.5, nota: 'Ámbito adicional' }];
    const antes = structuredClone(snap);
    const seleccion = construirBom(snap, [snap.salas[0]]).find((l) => l.articulo_id === 'pantalla')!;
    assert.deepEqual([seleccion.cantidad, seleccion.reservado_total, seleccion.disponible_libre,
      seleccion.reservado_propio, seleccion.disponible_para_seleccion, seleccion.a_comprar], [5.5, 8, 2, 2, 4, 1.5]);
    assert.deepEqual(seleccion.origenes, ['equipo', 'bom']);
    assert.equal(seleccion.importe_necesidad, 55);
    assert.equal(seleccion.importe_compra, 15);
    const obra = construirBom(snap, snap.salas).find((l) => l.articulo_id === 'pantalla')!;
    assert.deepEqual([obra.cantidad, obra.reservado_propio, obra.disponible_para_seleccion, obra.a_comprar], [8.5, 8, 10, 0]);
    assert.deepEqual(snap, antes);
  });


  test('alternativas con longitudes comerciales distintas no atribuyen a toda la obra la longitud de la primera sala', async () => {
    const snap = snapshot([sala('s1'), sala('s2')]);
    snap.articulos = snap.articulos.map((a) => a.id === 'cable'
      ? { ...a, unidad: 'ud', modelo: 'Latiguillo HDMI', longitudes_comerciales_m: [3, 5] } : a);
    for (const [i, s] of snap.salas.entries()) {
      s.conexiones[0].longitud_manual_m = i === 0 ? 4 : 2;
      s.resultadosCable = [calcularConexion(s.conexiones[0], s.sala,
        new Map(s.equipos.map((e) => [e.id, e])), new Map(snap.articulos.map((a) => [a.id, a])))!];
    }
    const antes = structuredClone(snap);
    const bom = construirBom(snap, snap.salas), cable = bom.find((l) => l.articulo_id === 'cable')!;
    assert.equal(cable.cantidad, 2);
    assert.match(cable.descripcion, /5 m/);
    assert.match(cable.descripcion, /3 m/);
    assert.ok(cable.detalle.some((d) => d.includes('s1') && d.includes('5 m')));
    assert.ok(cable.detalle.some((d) => d.includes('s2') && d.includes('3 m')));
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    assert.equal(libro.getWorksheet('Material')!.getCell(bom.indexOf(cable) + 10, 3).value, cable.descripcion);
    assert.ok(new TextDecoder().decode(generarBomCsv(snap, snap.salas)).includes(cable.descripcion));
    assert.deepEqual(snap, antes);
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

  test('un subtotal sin ningún precio o metraje queda vacío y un total de precio cero sigue siendo numérico', async () => {
    const snap = snapshot();
    snap.articulos = snap.articulos.map((a) => ({ ...a, coste: null }));
    const filas = construirBom(snap, snap.salas);
    const sinPrecios = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    const material = sinPrecios.getWorksheet('Material')!;
    assert.equal(material.getCell(10 + filas.length, 16).value, null);
    assert.equal(material.getCell(10 + filas.length, 17).value, null);
    assert.ok(filas.every((l) => l.importe_necesidad === null && l.importe_compra === null && l.estado_precio === 'Sin precio'));
    snap.salas[0].filasCable[0].metros = null;
    const sinMetros = await leerXlsx(await generarXlsx(snap, snap.salas, 'cables'));
    assert.equal(sinMetros.getWorksheet('Cables')!.getCell('L11').value, null);
    snap.articulos = snap.articulos.map((a) => ({ ...a, coste: 0, coste_orientativo: false }));
    const conCeros = await leerXlsx(await generarXlsx(snap, snap.salas, 'bom'));
    assert.equal(conCeros.getWorksheet('Material')!.getCell(10 + filas.length, 16).value, 0);
    assert.equal(conCeros.getWorksheet('Material')!.getCell(10 + filas.length, 16).type, ExcelJS.ValueType.Number);
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


test('las cabeceras de todas las hojas reservan espacio para texto y autofiltro', async () => {
  const snap = snapshot();
  snap.salas[0].revisionDiseno = { estado: 'borrador', id: null, numero: null, nombre: null, autor: null,
    creadoEn: null, hash: 'a'.repeat(64), antecedente: null, heredadaDe: null };
  for (const tipo of ['bom', 'cables'] as const) {
    const libro = await leerXlsx(await generarXlsx(snap, snap.salas, tipo));
    for (const hoja of libro.worksheets) hoja.getRow(9).eachCell((celda, indice) => {
      assert.ok(hoja.getColumn(indice).width! >= String(celda.value).length + 6,
        `${hoja.name}: ${celda.value} necesita anchura para el botón del autofiltro`);
    });
  }
});
