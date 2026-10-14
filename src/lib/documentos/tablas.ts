import ExcelJS from 'exceljs';
import { agruparMaterialCable } from '../calculo-cable';
import { tablaCablesACsv, type FilaCable } from '../cable-schedule';
import { agruparPorProveedor, calcularFaltante, necesidadDeSala, type LineaNecesidad } from '../compras';
import { ETIQUETA_RUTA, ETIQUETA_SENAL } from '../tipos';
import { codificarCsv, textoSeguroCsv } from './csv';
import type { SalaExportada, SnapshotExportacion } from './modelo';

export interface LineaBom extends LineaNecesidad {
  referencia: string | null;
  existencias: number;
  reservado_total: number;
  disponible_libre: number;
  reservado_propio: number;
  disponible_para_seleccion: number;
  a_comprar: number;
  proveedor: string | null;
  precio_unitario: number | null;
  estado_precio: 'Sin precio' | 'Orientativo' | 'Final';
  importe_necesidad: number | null;
  importe_compra: number | null;
}

/**
 * La necesidad siempre usa todos los equipos y conexiones del snapshot.
 * Los filtros del dibujo no forman parte de este contrato.
 */
export function necesidadExportada(snapshot: SnapshotExportacion, sala: SalaExportada): LineaNecesidad[] {
  const articulos = new Map(snapshot.articulos.map((a) => [a.id, a]));
  return necesidadDeSala(
    sala.equipos,
    agruparMaterialCable(sala.resultadosCable, sala.conexiones, articulos),
    articulos,
    sala.materialBom ?? [],
  );
}

/**
 * Consolida la selección ANTES de consultar el disponible: el mismo stock no
 * puede cubrir una sala y volver a cubrir otra. Solo suma las reservas propias
 * de las salas seleccionadas, no las del resto de la obra.
 */
export function construirBom(snapshot: SnapshotExportacion, seleccion: SalaExportada[]): LineaBom[] {
  const salas = salasUnicas(seleccion);
  const articulos = new Map(snapshot.articulos.map((a) => [a.id, a]));
  const porArticulo = new Map<string, LineaNecesidad>();
  const reservas = new Map<string, number>();
  for (const sala of salas) {
    for (const linea of necesidadExportada(snapshot, sala)) {
      const previa = porArticulo.get(linea.articulo_id);
      if (previa) {
        previa.cantidad = redondear(previa.cantidad + linea.cantidad);
        previa.origenes = [...new Set([...previa.origenes, ...linea.origenes])];
        previa.detalle.push(...linea.detalle.map((d) => `${sala.sala.nombre}: ${d}`));
      } else {
        porArticulo.set(linea.articulo_id, {
          ...linea,
          origenes: [...linea.origenes],
          detalle: linea.detalle.map((d) => salas.length > 1 ? `${sala.sala.nombre}: ${d}` : d),
        });
      }
    }
    for (const r of sala.reservas) {
      reservas.set(r.articulo_id, redondear((reservas.get(r.articulo_id) ?? 0) + r.cantidad));
    }
  }
  const disponibilidad = new Map(snapshot.disponibilidad.map((d) => [d.articulo_id, d]));
  const libre = new Map(snapshot.disponibilidad.map((d) => [d.articulo_id, d.disponible]));
  const faltantes = calcularFaltante([...porArticulo.values()], libre, reservas);
  const compras = new Map(agruparPorProveedor(faltantes, articulos).flatMap((g) => g.lineas.map((l) => [l.articulo_id, l] as const)));
  // La misma valoración existente sirve para necesidad y compra. No hay otra fórmula de precio.
  const valoracion = new Map(agruparPorProveedor(faltantes.map((f) => ({ ...f, falta: f.cantidad })), articulos)
    .flatMap((g) => g.lineas.map((l) => [l.articulo_id, l] as const)));
  return faltantes.map((f): LineaBom => {
    const articulo = articulos.get(f.articulo_id);
    const d = disponibilidad.get(f.articulo_id);
    const precio = articulo?.coste ?? null;
    return {
      ...f,
      referencia: articulo?.referencia ?? null,
      existencias: d?.existencias ?? 0,
      reservado_total: d?.reservado ?? 0,
      disponible_libre: d?.disponible ?? 0,
      reservado_propio: reservas.get(f.articulo_id) ?? 0,
      disponible_para_seleccion: f.disponible,
      a_comprar: f.falta,
      proveedor: articulo?.proveedor ?? null,
      precio_unitario: precio,
      estado_precio: precio == null ? 'Sin precio' : articulo?.coste_orientativo ? 'Orientativo' : 'Final',
      importe_necesidad: valoracion.get(f.articulo_id)?.importe ?? (precio == null ? null : 0),
      importe_compra: compras.get(f.articulo_id)?.importe ?? (precio == null ? null : 0),
    };
  }).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
}

const COLUMNAS_BOM = [
  ['articulo_id', 'ID artículo', 38], ['referencia', 'Referencia', 20],
  ['descripcion', 'Descripción', 38], ['origenes', 'Origen', 17], ['unidad', 'Unidad', 9],
  ['necesidad', 'Necesidad', 14], ['existencias', 'Existencias', 14],
  ['reservado_total', 'Reservado total', 16], ['disponible_libre', 'Disponible libre', 18],
  ['reservado_propio', 'Reservado propio', 18], ['disponible_para_seleccion', 'Disponible selección', 19],
  ['a_comprar', 'A comprar', 14], ['proveedor', 'Proveedor', 25],
  ['precio_unitario_eur', 'Precio unitario (€)', 19], ['estado_precio', 'Estado precio', 17],
  ['importe_necesidad_eur', 'Importe necesidad (€)', 22], ['importe_compra_eur', 'Importe compra (€)', 21],
  ['detalle', 'Detalle', 65],
] as const;

function filaBom(l: LineaBom): Array<string | number | null> {
  return [l.articulo_id, l.referencia, l.descripcion, l.origenes.join(' + '), l.unidad,
    l.cantidad, l.existencias, l.reservado_total, l.disponible_libre, l.reservado_propio,
    l.disponible_para_seleccion, l.a_comprar, l.proveedor, l.precio_unitario, l.estado_precio,
    l.importe_necesidad, l.importe_compra, l.detalle.join(' | ')];
}

export function generarBomCsv(snapshot: SnapshotExportacion, seleccion: SalaExportada | SalaExportada[]): Uint8Array {
  const salas = salasUnicas(Array.isArray(seleccion) ? seleccion : [seleccion]);
  const contexto = [snapshot.revision, snapshot.creadoEn, snapshot.proyecto?.codigo ?? null,
    snapshot.proyecto?.nombre ?? null, salas.map((s) => s.sala.codigo ?? s.sala.nombre).join(' | ')];
  return codificarCsv(
    ['revision', 'fecha_snapshot', 'obra_codigo', 'obra_nombre', 'salas_seleccionadas', ...COLUMNAS_BOM.map((c) => c[0])],
    construirBom(snapshot, salas).map((l) => [...contexto, ...filaBom(l)]),
  );
}

/** Conserva las 18 columnas, dialecto, orden y valores del CSV de cables existente. */
export function generarCablesCsv(_snapshot: SnapshotExportacion, sala: SalaExportada): Uint8Array {
  return new TextEncoder().encode(`\uFEFF${tablaCablesACsv(sala.filasCable.map(filaCableSegura))}`);
}

function filaCableSegura(fila: FilaCable): FilaCable {
  return {
    ...fila,
    identificador: textoSeguroCsv(fila.identificador), origen: textoSeguroCsv(fila.origen),
    puerto_origen: fila.puerto_origen == null ? null : textoSeguroCsv(fila.puerto_origen),
    conector_origen: fila.conector_origen == null ? null : textoSeguroCsv(fila.conector_origen),
    destino: textoSeguroCsv(fila.destino),
    puerto_destino: fila.puerto_destino == null ? null : textoSeguroCsv(fila.puerto_destino),
    conector_destino: fila.conector_destino == null ? null : textoSeguroCsv(fila.conector_destino),
    toma_red: fila.toma_red == null ? null : textoSeguroCsv(fila.toma_red),
    articulo_cable: fila.articulo_cable == null ? null : textoSeguroCsv(fila.articulo_cable),
    avisos: fila.avisos.map(textoSeguroCsv),
  };
}

const COLUMNAS_CABLES = [
  ['sala', 'Sala', 28], ['id_cable', 'ID cable', 16], ['equipo_origen', 'Equipo origen', 32],
  ['puerto_origen', 'Puerto origen', 25], ['conector_origen', 'Conector origen', 19],
  ['equipo_destino', 'Equipo destino', 32], ['puerto_destino', 'Puerto destino', 25],
  ['conector_destino', 'Conector destino', 19], ['toma_red', 'Roseta de red', 25],
  ['senal', 'Señal', 18], ['ruta', 'Ruta', 22], ['metros', 'Metros', 14],
  ['recorrido_m', 'Recorrido (m)', 16], ['holgura_origen_m', 'Holgura origen (m)', 20],
  ['holgura_destino_m', 'Holgura destino (m)', 21], ['margen_m', 'Margen (m)', 15],
  ['articulo_cable', 'Artículo cable', 36], ['longitud_comercial_m', 'Longitud comercial (m)', 25],
  ['avisos', 'Avisos', 64],
] as const;

export async function generarXlsx(snapshot: SnapshotExportacion, seleccion: SalaExportada[], tipo: 'bom' | 'cables'): Promise<Uint8Array> {
  const salas = salasUnicas(seleccion);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'AV_design';
  libro.created = new Date(snapshot.creadoEn);
  libro.modified = new Date(snapshot.creadoEn);
  if (tipo === 'bom') {
    const lineas = construirBom(snapshot, salas);
    const hoja = crearHoja(libro, snapshot, salas, 'Material', COLUMNAS_BOM);
    escribirTabla(hoja, lineas.map(filaBom), [6, 7, 8, 9, 10, 11, 12, 14, 16, 17], [14, 16, 17]);
    const filaTotal = 10 + lineas.length;
    hoja.getCell(filaTotal, 3).value = 'Subtotal conocido (€)';
    hoja.getCell(filaTotal, 16).value = sumaConocida(lineas.map((l) => l.importe_necesidad));
    hoja.getCell(filaTotal, 17).value = sumaConocida(lineas.map((l) => l.importe_compra));
    hoja.getRow(filaTotal).font = { name: 'Arial', size: 10, bold: true };
    for (const c of [16, 17]) hoja.getCell(filaTotal, c).numFmt = '#,##0.00 "€"';
    hoja.getCell(filaTotal + 1, 3).value = `Sin precio: ${lineas.filter((l) => l.estado_precio === 'Sin precio').length} líneas. Orientativo: ${lineas.filter((l) => l.estado_precio === 'Orientativo').length} líneas.`;
    hoja.getCell(filaTotal + 2, 3).value = 'Los importes vacíos no son cero. El subtotal incluye solo importes conocidos y puede ser parcial.';
    const avisos = avisosDeMaterial(snapshot, salas);
    for (const [i, aviso] of avisos.entries()) hoja.getCell(filaTotal + 4 + i, 3).value = aviso;
    if (salas.length > 1) {
      const columnas = [['sala', 'Sala', 28], ['articulo_id', 'ID artículo', 38], ['descripcion', 'Descripción', 38],
        ['origenes', 'Origen', 17], ['unidad', 'Unidad', 9], ['necesidad', 'Necesidad', 14], ['detalle', 'Detalle', 65]] as const;
      const detalle = crearHoja(libro, snapshot, salas, 'Necesidad por sala', columnas);
      escribirTabla(detalle, salas.flatMap((s) => necesidadExportada(snapshot, s).map((l) => [
        etiquetaSala(s), l.articulo_id, l.descripcion, l.origenes.join(' + '), l.unidad, l.cantidad, l.detalle.join(' | '),
      ])), [6]);
    }
  } else {
    const hoja = crearHoja(libro, snapshot, salas, 'Cables', COLUMNAS_CABLES);
    const filas = salas.flatMap((s) => s.filasCable.map((f) => [
      etiquetaSala(s), f.identificador, f.origen, f.puerto_origen, f.conector_origen,
      f.destino, f.puerto_destino, f.conector_destino, f.toma_red, ETIQUETA_SENAL[f.senal],
      f.ruta ? ETIQUETA_RUTA[f.ruta] : null, f.metros, f.recorrido_m, f.holgura_origen_m,
      f.holgura_destino_m, f.margen_m, f.articulo_cable, f.longitud_comercial_m, f.avisos.join(' | ') || null,
    ]));
    escribirTabla(hoja, filas, [12, 13, 14, 15, 16, 18]);
    const filaTotal = 10 + filas.length;
    hoja.getCell(filaTotal, 3).value = 'Metros conocidos';
    hoja.getCell(filaTotal, 12).value = sumaConocida(salas.flatMap((s) => s.filasCable.map((f) => f.metros)));
    hoja.getCell(filaTotal, 12).numFmt = '#,##0.00';
    hoja.getRow(filaTotal).font = { name: 'Arial', size: 10, bold: true };
    const ausentes = salas.flatMap((s) => s.filasCable).filter((f) => f.metros == null).length;
    hoja.getCell(filaTotal + 1, 3).value = `Sin cálculo: ${ausentes} conexiones. Los metros vacíos no son cero; el subtotal puede ser parcial.`;
  }
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

type Columnas = ReadonlyArray<readonly [string, string, number]>;
function crearHoja(libro: ExcelJS.Workbook, snapshot: SnapshotExportacion, salas: SalaExportada[], nombre: string, columnas: Columnas): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 9, showGridLines: false }],
    properties: { defaultRowHeight: 24, tabColor: { argb: 'FF3669D9' } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:9' },
  });
  // Excel dibuja el botón del autofiltro dentro de la celda de cabecera.
  // Reservar anchura además del texto evita que tape «Unidad», «Reservado
  // total» o «Disponible selección», sin reducir la fuente de la tabla.
  hoja.columns = columnas.map(([clave, cabecera, ancho]) => ({
    key: clave, width: Math.max(ancho, cabecera.length + 6),
  }));
  hoja.getCell('A2').value = `${nombre} · ${snapshot.proyecto?.nombre ?? salas[0]?.sala.nombre ?? 'Selección vacía'}`;
  hoja.getCell('A2').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF182338' } };
  hoja.getCell('A3').value = 'Revisión'; hoja.getCell('B3').value = snapshot.revision;
  hoja.getCell('A4').value = 'Fecha (UTC)'; hoja.getCell('B4').value = new Date(snapshot.creadoEn);
  hoja.getCell('B4').numFmt = 'dd/mm/yyyy hh:mm';
  hoja.getCell('A5').value = 'Salas'; hoja.getCell('B5').value = salas.map(etiquetaSala).join(' | ');
  hoja.getCell('A6').value = nombre === 'Cables'
    ? 'Metros = corte o pedido por conexión. Longitud comercial = tamaño del latiguillo elegido por el cálculo existente.'
    : nombre === 'Necesidad por sala'
      ? 'Necesidad por sala = equipo + cable por artículo. Las cantidades de unidades y metros se mantienen separadas.'
      : 'Disponible libre = existencias − todas las reservas activas. Reservado propio = solo las salas seleccionadas.';
  hoja.getCell('A7').value = nombre === 'Cables'
    ? 'Las longitudes vacías indican ausencia de cálculo. El subtotal de metros incluye solo las longitudes conocidas.'
    : nombre === 'Necesidad por sala'
      ? 'El almacén y los faltantes de la selección se consultan en Material; el disponible de almacén no se repite por sala.'
      : 'A comprar = necesidad − disponible libre − reservado propio, mínimo cero. El stock se cuenta una vez en Material.';
  hoja.getCell('A8').value = 'La selección conserva todos los equipos y cables de la sala; los filtros del dibujo no afectan a las cantidades.';
  for (let fila = 3; fila <= 8; fila++) hoja.getRow(fila).font = { name: 'Arial', size: 10 };
  hoja.getRow(9).values = columnas.map(([, nombreColumna]) => nombreColumna);
  hoja.getRow(9).height = 32;
  hoja.getRow(9).eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243E6F' } };
    celda.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  });
  return hoja;
}

function escribirTabla(hoja: ExcelJS.Worksheet, filas: Array<Array<string | number | null>>, numericas: number[], moneda: number[] = []): void {
  for (const [indice, valores] of filas.entries()) {
    const fila = hoja.getRow(10 + indice);
    fila.values = valores;
    fila.height = Math.min(409, Math.max(24, ...valores.map((valor, columna) => {
      if (typeof valor !== 'string') return 24;
      const ancho = hoja.getColumn(columna + 1).width ?? 20;
      const lineas = valor.split('\n').reduce((total, linea) => total + Math.max(1, Math.ceil(linea.length / (ancho - 2))), 0);
      return lineas * 14 + 10;
    })));
    fila.eachCell({ includeEmpty: true }, (celda, columna) => {
      celda.font = { name: 'Arial', size: 10, color: { argb: 'FF182338' } };
      celda.alignment = { horizontal: numericas.includes(columna) ? 'right' : 'left', vertical: 'middle', wrapText: !numericas.includes(columna), indent: 1 };
      if (numericas.includes(columna)) celda.numFmt = moneda.includes(columna) ? '#,##0.00 "€"' : '#,##0.00';
      if (indice % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5FA' } };
    });
  }
  hoja.autoFilter = { from: { row: 9, column: 1 }, to: { row: Math.max(9, 9 + filas.length), column: hoja.columnCount } };
}

function salasUnicas(salas: SalaExportada[]): SalaExportada[] {
  return [...new Map(salas.map((s) => [s.sala.id, s])).values()];
}
function etiquetaSala(sala: SalaExportada): string {
  return [sala.sala.codigo, sala.sala.nombre].filter(Boolean).join(' · ');
}
function sumaConocida(importes: Array<number | null>): number | null {
  const conocidos = importes.filter((importe): importe is number => importe != null);
  return conocidos.length ? redondear(conocidos.reduce((total, importe) => total + importe, 0)) : null;
}
function redondear(n: number): number { return Math.round(n * 100) / 100; }

/** Lo que las funciones de compra excluyen sin referencia queda explícito en el documento. */
export function avisosDeMaterial(snapshot: SnapshotExportacion, salas: SalaExportada[]): string[] {
  const articulos = new Set(snapshot.articulos.map((a) => a.id));
  return salas.flatMap((s) => [
    ...s.equipos.filter((e) => !e.articulo_id || !articulos.has(e.articulo_id)).map((e) => `${etiquetaSala(s)}: equipo sin referencia de catálogo: ${e.nombre}.`),
    ...s.conexiones.filter((c) => !c.articulo_cable_id).map((c) => `${etiquetaSala(s)}: conexión sin cable asignado: ${s.filasCable.find((f) => f.conexion_id === c.id)?.identificador ?? c.id}.`),
    ...s.filasCable.filter((f) => f.metros == null).map((f) => `${etiquetaSala(s)}: ${f.identificador} sin cálculo de metros; falta medida o extremo.`),
  ]);
}
