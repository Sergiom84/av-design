import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { ErrorImportacion, MAXIMO_BYTES_IMPORTACION, MAXIMO_FILAS_IMPORTACION, type EntradaImportacion } from './modelo';

const COLUMNAS = new Set([
  'referencia', 'marca', 'modelo', 'categoria', 'tipo', 'unidad', 'descripcion',
  'observaciones', 'cantidad', 'nota', 'presupuesto', 'proveedor', 'fecha', 'moneda',
  'unidad_compra', 'unidades_por_compra', 'precio_compra', 'origen', 'vinculante', 'kit', 'notas',
]);
const MAXIMO_TEXTO_CELDA = 2000;
const MAXIMO_DESCOMPRIMIDO = 20 * 1024 * 1024;

export interface FilaLeida { fila: number; datos: Record<string, string>; errores: string[] }
export interface ArchivoLeido {
  nombre: string; sha256: string; bytes: number; formato: 'csv' | 'xlsx'; filas: FilaLeida[];
}

export async function leerArchivoImportacion(archivo: EntradaImportacion['archivo']): Promise<ArchivoLeido> {
  if (!(archivo.bytes instanceof Uint8Array) || !archivo.bytes.byteLength) throw new ErrorImportacion('El archivo está vacío.');
  if (archivo.bytes.byteLength > MAXIMO_BYTES_IMPORTACION) throw new ErrorImportacion('El archivo supera 5 MiB.');
  if (!archivo.nombre || archivo.nombre.length > 180 || /[/\\\u0000-\u001f]/u.test(archivo.nombre)) {
    throw new ErrorImportacion('Nombre de archivo no permitido.');
  }
  const extension = archivo.nombre.toLowerCase().split('.').pop();
  if (extension !== 'csv' && extension !== 'xlsx') throw new ErrorImportacion('Sólo se admiten CSV UTF-8 y XLSX.');
  let filas: FilaLeida[];
  if (extension === 'csv') {
    let texto: string;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(archivo.bytes).replace(/^\uFEFF/u, ''); }
    catch { throw new ErrorImportacion('El CSV debe estar codificado en UTF-8.'); }
    if (texto.includes('\0')) throw new ErrorImportacion('El CSV contiene bytes nulos.');
    const primera = texto.split(/\r?\n/u)[0] ?? '';
    const separador = primera.includes(';') ? ';' : ',';
    filas = convertirTabla(parsearCsv(texto, separador));
  } else {
    const libroSeguro = comprobarXlsx(archivo.bytes);
    const libro = new ExcelJS.Workbook();
    try { await libro.xlsx.load(Buffer.from(libroSeguro) as never); }
    catch { throw new ErrorImportacion('No se puede leer el libro XLSX.'); }
    if (libro.worksheets.length !== 1) throw new ErrorImportacion('El XLSX debe contener una sola hoja.');
    const hoja = libro.worksheets[0];
    if (hoja.rowCount > MAXIMO_FILAS_IMPORTACION + 1) throw new ErrorImportacion('El libro supera 500 filas de datos.');
    if (hoja.columnCount > COLUMNAS.size) throw new ErrorImportacion('El libro tiene demasiadas columnas.');
    const tabla: Array<{ fila: number; celdas: string[]; errores: string[] }> = [];
    hoja.eachRow({ includeEmpty: true }, (fila, numero) => {
      const errores: string[] = [];
      const celdas: string[] = [];
      for (let columna = 1; columna <= hoja.columnCount; columna++) {
        const valor = fila.getCell(columna).value;
        if (valor == null) celdas.push('');
        else if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') celdas.push(String(valor));
        else if (valor instanceof Date && Number.isFinite(valor.getTime())) celdas.push(valor.toISOString().slice(0, 10));
        else { celdas.push(''); errores.push(`Columna ${columna}: fórmula, enlace o celda activa no admitida.`); }
      }
      tabla.push({ fila: numero, celdas, errores });
    });
    filas = convertirTabla(tabla);
  }
  if (!filas.length) throw new ErrorImportacion('No hay filas de datos.');
  return { nombre: archivo.nombre, sha256: createHash('sha256').update(archivo.bytes).digest('hex'),
    bytes: archivo.bytes.byteLength, formato: extension, filas };
}

/** Preflight del directorio ZIP antes de descomprimir o pasar bytes a ExcelJS. */
export function comprobarXlsx(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new ErrorImportacion('La firma del archivo no es XLSX.');
  let total = 0; let archivos = 0; let tipos = false; let libro = false;
  const nombres = new Set<string>();
  try {
    unzipSync(bytes, { filter: (entrada) => {
      archivos++;
      if (nombres.has(entrada.name)) throw new ErrorImportacion('El XLSX contiene entradas ZIP repetidas.');
      nombres.add(entrada.name);
      total += entrada.originalSize;
      if (archivos > 100 || total > MAXIMO_DESCOMPRIMIDO || entrada.originalSize > 10 * 1024 * 1024) {
        throw new ErrorImportacion('El contenido descomprimido del XLSX supera el límite.');
      }
      if (/^(?:\/|.*(?:^|\/)\.\.(?:\/|$))/u.test(entrada.name) || /(?:vbaProject|externalLinks|embeddings|activeX)/iu.test(entrada.name)) {
        throw new ErrorImportacion('El XLSX contiene macros, enlaces externos u objetos activos.');
      }
      if (entrada.name === '[Content_Types].xml') tipos = true;
      if (entrada.name === 'xl/workbook.xml') libro = true;
      return false;
    } });
  } catch (error) {
    if (error instanceof ErrorImportacion) throw error;
    throw new ErrorImportacion('El contenedor XLSX es inválido.');
  }
  if (!tipos || !libro) throw new ErrorImportacion('El ZIP no es un libro XLSX.');
  // ExcelJS recibe un ZIP reconstruido de tamaño comprobado. Un directorio ZIP
  // con tamaños declarados falsos no pasa sus streams originales al parser.
  let extraidos: ReturnType<typeof unzipSync>;
  try { extraidos = unzipSync(bytes); }
  catch { throw new ErrorImportacion('El contenido del XLSX está corrupto.'); }
  let real = 0;
  for (const [nombre, contenido] of Object.entries(extraidos)) {
    real += contenido.byteLength;
    if (real > MAXIMO_DESCOMPRIMIDO || contenido.byteLength > 10 * 1024 * 1024) throw new ErrorImportacion('El contenido real del XLSX supera el límite.');
    if (nombre.endsWith('.xml') || nombre.endsWith('.rels')) {
      const xml = new TextDecoder().decode(contenido);
      if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new ErrorImportacion('Declaraciones XML activas no admitidas.');
      if (/TargetMode\s*=\s*["']External["']/iu.test(xml) || /vbaProject|macroEnabled/iu.test(xml)) throw new ErrorImportacion('Macros o relaciones externas no admitidas.');
      if (nombre.startsWith('xl/') && nombre.endsWith('.xml')) {
        extraidos[nombre] = new TextEncoder().encode(normalizarNamespaceHoja(xml));
      }
    }
  }
  return zipSync(extraidos, { level: 0 });
}

/** ExcelJS reconoce SpreadsheetML sin prefijo, aunque OOXML permite prefijos.
 * Sólo se normaliza el namespace estándar, sin alterar textos ni r:id.
 * El archivo original se conserva para hash/procedencia/descarga del lote.
 */
export function normalizarNamespaceHoja(xml: string): string {
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const prefijos = [...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)\s*=\s*(["'])([^"']+)\2/gu)]
    .filter(m => m[3] === namespace).map(m => m[1]);
  for (const prefijo of new Set(prefijos)) {
    const escapado = prefijo.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const declaraciones = [...xml.matchAll(new RegExp(`xmlns:${escapado}\\s*=\\s*(["'])([^"']+)\\1`, 'gu'))];
    if (declaraciones.some(m => m[2] !== namespace)) throw new ErrorImportacion('El namespace SpreadsheetML cambia dentro del archivo.');
    xml = xml.replace(new RegExp(`(<\\/?)${escapado}:(?=[A-Za-z_])`, 'gu'), '$1');
    // Sax de ExcelJS no exige namespace. Retirar únicamente la declaración
    // del prefijo evita duplicar xmlns cuando ya existe un namespace por defecto.
    xml = xml.replace(new RegExp(`\\s+xmlns:${escapado}\\s*=\\s*(["'])${namespace.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\1`, 'gu'), '');
  }
  // OOXML admite fecha ISO con t="d". ExcelJS la interpreta como un serial
  // numérico (2026 → 1905); convertirla a texto de calendario evita inventar
  // otra fecha. Una fecha inválida queda como literal y la revisión la rechaza.
  return xml.replace(/<c\b[^>]*\bt\s*=\s*(["'])d\1[^>]*>[\s\S]*?<\/c>/gu, celda =>
    celda.replace(/\bt\s*=\s*(["'])d\1/u, 't="str"').replace(/<v>([^<]*)<\/v>/u, (_v, texto: string) => {
      const dia = texto.slice(0, 10);
      const valido = fechaIsoValida(dia) && (texto === dia || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(texto) && Number.isFinite(new Date(texto).getTime())));
      return `<v>${valido ? dia : texto}</v>`;
    }),
  );
}

function parsearCsv(texto: string, separador: string): Array<{ fila: number; celdas: string[]; errores: string[] }> {
  const tabla: Array<{ fila: number; celdas: string[]; errores: string[] }> = [];
  let fila = 1; let inicio = 1; let celda = ''; let celdas: string[] = []; let comillas = false; let cerrada = false;
  const terminar = () => {
    celdas.push(celda); tabla.push({ fila: inicio, celdas, errores: [] });
    if (tabla.length > MAXIMO_FILAS_IMPORTACION + 1) throw new ErrorImportacion('El CSV supera 500 filas de datos.');
    celdas = []; celda = ''; cerrada = false; inicio = fila + 1;
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') { comillas = false; cerrada = true; }
      else { celda += c; if (c === '\n') fila++; }
    } else if (c === '"') {
      if (celda || cerrada) throw new ErrorImportacion('Comillas inválidas en CSV.');
      comillas = true;
    } else if (c === separador) { celdas.push(celda); celda = ''; cerrada = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      terminar(); fila++;
    } else {
      if (cerrada && !/\s/u.test(c)) throw new ErrorImportacion('Texto después de cerrar una celda CSV.');
      celda += c;
    }
    if (celda.length > MAXIMO_TEXTO_CELDA) throw new ErrorImportacion('Una celda supera 2000 caracteres.');
    if (celdas.length > COLUMNAS.size) throw new ErrorImportacion('El CSV tiene demasiadas columnas.');
  }
  if (comillas) throw new ErrorImportacion('Una celda CSV tiene comillas sin cerrar.');
  if (celda || celdas.length) terminar();
  return tabla;
}

function convertirTabla(tabla: Array<{ fila: number; celdas: string[]; errores: string[] }>): FilaLeida[] {
  const cabecera = tabla.shift();
  if (!cabecera || cabecera.errores.length) throw new ErrorImportacion('La cabecera no es texto simple.');
  const nombres = cabecera.celdas.map(c => c.trim().toLowerCase().replace(/ /gu, '_'));
  if (new Set(nombres).size !== nombres.length || nombres.some(n => !COLUMNAS.has(n))) {
    throw new ErrorImportacion('Cabeceras repetidas o no admitidas. Usa las columnas de la plantilla.');
  }
  if (!nombres.includes('referencia') && !(nombres.includes('marca') && nombres.includes('modelo'))) {
    throw new ErrorImportacion('La cabecera necesita referencia o marca y modelo.');
  }
  const filas = tabla.filter(f => f.celdas.some(c => c.trim()) || f.errores.length).map(f => {
    const errores = [...f.errores];
    if (f.celdas.length !== nombres.length) errores.push('El número de celdas no coincide con la cabecera.');
    const datos: Record<string, string> = {};
    nombres.forEach((n, i) => {
      const literal = f.celdas[i] ?? '';
      if (literal.length > MAXIMO_TEXTO_CELDA) errores.push(`${n}: supera 2000 caracteres.`);
      if (/^[\s]*[=+@\t\r]/u.test(literal) || /^\s*-(?!\d+(?:[.,]\d+)?\s*$)/u.test(literal)) errores.push(`${n}: celda peligrosa o fórmula no admitida.`);
      datos[n] = literal.trim();
    });
    return { fila: f.fila, datos, errores };
  });
  if (filas.length > MAXIMO_FILAS_IMPORTACION) throw new ErrorImportacion('El archivo supera 500 filas de datos.');
  return filas;
}

export function numeroImportado(texto: string | undefined): number | null {
  if (!texto?.trim()) return null;
  if (!/^-?\d+(?:[.,]\d+)?$/u.test(texto.trim())) return NaN;
  return Number(texto.replace(',', '.'));
}
export function claveLiteral(texto: string | null | undefined): string {
  return (texto ?? '').trim().normalize('NFC').toLocaleUpperCase('es');
}
export function fechaIsoValida(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(texto) && Number.isFinite(new Date(`${texto}T00:00:00Z`).getTime()) &&
    new Date(`${texto}T00:00:00Z`).toISOString().slice(0, 10) === texto;
}
