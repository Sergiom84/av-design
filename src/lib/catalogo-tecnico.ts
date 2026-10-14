import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';
import { z } from 'zod';
import { puede, type Permisos } from './usuarios';

export const MAX_ARCHIVO_TECNICO = 5 * 1024 * 1024;
export type UnidadDimension = 'mm' | 'cm' | 'm';
export type TipoArchivoTecnico = 'imagen' | 'ficha';
export interface UsuarioTecnico {
  id: string;
  permisos: Permisos;
  debeCambiarClave: boolean;
  ficticio?: boolean;
}

export function permisoCatalogoTecnico(usuario: UsuarioTecnico | null, minimo: 'ver' | 'editar'): boolean {
  return Boolean(usuario && !usuario.debeCambiarClave && puede(usuario.permisos, 'catalogo', minimo));
}

export const fechaTecnicaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha ISO inválida.')
  .refine(valor => {
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return Number.isFinite(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor &&
      valor <= new Date().toISOString().slice(0, 10);
  }, 'La fecha debe existir y no puede ser futura.');
export const urlTecnicaSchema = z.string().trim().max(2048).refine(valor => {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password &&
      !/[\u0000-\u001f\u007f]/.test(valor);
  } catch { return false; }
}, 'El origen requiere una URL HTTPS sin credenciales ni controles.').transform(valor => new URL(valor).href);
export const procedenciaTecnicaSchema = z.object({
  marca: z.string().trim().min(1).max(200).nullable(),
  modelo: z.string().trim().min(1).max(300),
  origen: z.string().trim().min(1).max(200),
  url: urlTecnicaSchema,
  fecha: fechaTecnicaSchema,
}).strict();
const medida = z.number().finite().positive().max(1_000_000).nullable();
export const datosTecnicosSchema = procedenciaTecnicaSchema.extend({
  ancho: medida, alto: medida, fondo: medida,
  unidad: z.enum(['mm', 'cm', 'm']).nullable(),
  ru: z.number().finite().positive().max(1000).nullable(),
}).strict().refine(d => [d.ancho, d.alto, d.fondo].every(v => v === null) || d.unidad !== null,
  'Indica la unidad de las dimensiones conocidas.');
export type EntradaDatosTecnicos = z.infer<typeof datosTecnicosSchema>;
export type ProcedenciaTecnica = z.infer<typeof procedenciaTecnicaSchema>;

export const filtrosTecnicosSchema = z.object({
  q: z.string().trim().max(200).default(''),
  ancho_max_mm: z.number().finite().positive().max(1_000_000).optional(),
  alto_max_mm: z.number().finite().positive().max(1_000_000).optional(),
  fondo_max_mm: z.number().finite().positive().max(1_000_000).optional(),
  ru: z.number().finite().positive().max(1000).optional(),
}).strict();
export type FiltrosTecnicos = z.infer<typeof filtrosTecnicosSchema>;

export function dimensionEnMm(valor: number | null, unidad: UnidadDimension | null): number | null {
  if (valor === null || unidad === null) return null;
  return valor * ({ mm: 1, cm: 10, m: 1000 }[unidad]);
}

export function mismoOrigen(request: Request): boolean {
  const origen = request.headers.get('origin');
  if (!origen) return false;
  try { return new URL(origen).origin === new URL(request.url).origin; }
  catch { return false; }
}

/** Limita también requests sin Content-Length antes de parsear JSON/multipart. */
export async function leerCuerpoTecnico(request: Request, maximo: number): Promise<Uint8Array> {
  const declarado = request.headers.get('content-length');
  if (declarado && Number(declarado) > maximo) throw new Error('La solicitud excede el límite de tamaño.');
  if (!request.body) throw new Error('Falta el cuerpo de la petición.');
  const lector = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > maximo) { await lector.cancel(); throw new Error('La solicitud excede el límite de tamaño.'); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  return Buffer.concat(partes, total);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function dimensionesImagen(ancho: number, alto: number) {
  if (ancho < 1 || alto < 1 || ancho > 8192 || alto > 8192 || ancho * alto > 16_777_216) {
    throw new Error('La imagen excede 8192 px por lado o 16 megapíxeles.');
  }
}
function comprobarPng(bytes: Buffer): void {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Firma PNG inválida.');
  let cursor = 8;
  let cabecera = false;
  let fin = false;
  let ancho = 0, alto = 0, profundidad = 0, canales = 0, entrelazado = false;
  const comprimidos: Buffer[] = [];
  while (cursor + 12 <= bytes.length) {
    const largo = bytes.readUInt32BE(cursor);
    if (cursor + largo + 12 > bytes.length) throw new Error('PNG truncado.');
    const tipo = bytes.toString('ascii', cursor + 4, cursor + 8);
    const contenido = bytes.subarray(cursor + 8, cursor + 8 + largo);
    if (crc32(bytes.subarray(cursor + 4, cursor + 8 + largo)) !== bytes.readUInt32BE(cursor + largo + 8)) throw new Error('CRC PNG inválido.');
    if (!cabecera && tipo !== 'IHDR') throw new Error('Falta la cabecera PNG.');
    if (tipo === 'IHDR') {
      if (cabecera || largo !== 13) throw new Error('Cabecera PNG inválida.');
      ancho = contenido.readUInt32BE(0); alto = contenido.readUInt32BE(4);
      dimensionesImagen(ancho, alto);
      if (![0, 2, 3, 4, 6].includes(contenido[9]) || contenido[10] || contenido[11] || contenido[12] > 1) throw new Error('Formato PNG inválido.');
      profundidad = contenido[8];
      const permitidas: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
      if (!permitidas[contenido[9]].includes(profundidad)) throw new Error('Profundidad PNG inválida.');
      canales = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[contenido[9]];
      entrelazado = contenido[12] === 1;
      cabecera = true;
    }
    if (tipo === 'IDAT') comprimidos.push(contenido);
    cursor += largo + 12;
    if (tipo === 'IEND') { if (largo !== 0) throw new Error('Final PNG inválido.'); fin = true; break; }
  }
  if (!cabecera || !fin || cursor !== bytes.length || !comprimidos.length) throw new Error('PNG incompleto.');
  try {
    const pixeles = inflateSync(Buffer.concat(comprimidos), { maxOutputLength: 128 * 1024 * 1024 });
    let posicion = 0;
    const pasadas = entrelazado ? [[0,0,8,8], [4,0,8,8], [0,4,4,8], [2,0,4,4], [0,2,2,4], [1,0,2,2], [0,1,1,2]] : [[0,0,1,1]];
    for (const [x, y, saltoX, saltoY] of pasadas) {
      const columnas = Math.max(0, Math.ceil((ancho - x) / saltoX));
      const filas = Math.max(0, Math.ceil((alto - y) / saltoY));
      if (!columnas || !filas) continue;
      const filaBytes = 1 + Math.ceil(columnas * canales * profundidad / 8);
      for (let fila = 0; fila < filas; fila++) {
        if (posicion + filaBytes > pixeles.length || pixeles[posicion] > 4) throw new Error('Fila PNG inválida.');
        posicion += filaBytes;
      }
    }
    if (posicion !== pixeles.length) throw new Error('Longitud PNG inválida.');
  }
  catch { throw new Error('Contenido de imagen PNG inválido.'); }
}
function comprobarJpeg(bytes: Buffer): void {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || !bytes.subarray(-2).equals(Buffer.from([255, 217]))) throw new Error('Firma o final JPEG inválidos.');
  let cursor = 2;
  let dimensiones = false;
  let escaneo = false;
  let cuantizacion = false;
  let huffman = false;
  while (cursor < bytes.length - 2) {
    if (bytes[cursor++] !== 0xff) throw new Error('Segmento JPEG inválido.');
    while (bytes[cursor] === 0xff) cursor++;
    const marca = bytes[cursor++];
    if (marca === 0xd8 || marca === 0xd9 || marca === 0x00 || cursor + 2 > bytes.length) throw new Error('Segmento JPEG inválido.');
    const largo = bytes.readUInt16BE(cursor);
    if (largo < 2 || cursor + largo > bytes.length - 2) throw new Error('JPEG truncado.');
    if (marca === 0xda) { escaneo = largo >= 6 && cursor + largo < bytes.length - 2; break; }
    if (marca === 0xdb) cuantizacion = largo >= 67;
    if (marca === 0xc4) huffman = largo >= 19;
    if ([0xc0, 0xc1, 0xc2].includes(marca)) {
      if (largo < 8) throw new Error('Cabecera JPEG inválida.');
      dimensionesImagen(bytes.readUInt16BE(cursor + 5), bytes.readUInt16BE(cursor + 3));
      dimensiones = true;
    }
    cursor += largo;
  }
  if (!dimensiones || !escaneo || !cuantizacion || !huffman) throw new Error('JPEG sin imagen o tablas de decodificación.');
}
function comprobarWebp(bytes: Buffer): void {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Firma o tamaño WebP inválidos.');
  let cursor = 12;
  let imagen = false;
  while (cursor + 8 <= bytes.length) {
    const tipo = bytes.toString('ascii', cursor, cursor + 4);
    const largo = bytes.readUInt32LE(cursor + 4);
    const inicio = cursor + 8;
    if (inicio + largo > bytes.length) throw new Error('WebP truncado.');
    if (tipo === 'VP8 ' && largo > 10) {
      if (!bytes.subarray(inicio + 3, inicio + 6).equals(Buffer.from([157, 1, 42]))) throw new Error('Contenido WebP inválido.');
      const cabecera = bytes.readUIntLE(inicio, 3);
      if ((cabecera & 1) || (cabecera >>> 5) > largo - 10) throw new Error('Datos WebP inválidos.');
      dimensionesImagen(bytes.readUInt16LE(inicio + 6) & 0x3fff, bytes.readUInt16LE(inicio + 8) & 0x3fff);
      imagen = true;
    }
    if (tipo === 'VP8L' && largo > 5) {
      if (bytes[inicio] !== 0x2f) throw new Error('Contenido WebP inválido.');
      const datos = bytes.readUInt32LE(inicio + 1);
      if (datos >>> 29) throw new Error('Versión WebP inválida.');
      dimensionesImagen((datos & 0x3fff) + 1, ((datos >>> 14) & 0x3fff) + 1);
      imagen = true;
    }
    if (tipo === 'ANIM' || tipo === 'ANMF') throw new Error('Las imágenes animadas no están admitidas.');
    cursor = inicio + largo + (largo & 1);
  }
  if (!imagen || cursor !== bytes.length) throw new Error('WebP sin imagen o incompleto.');
}

export interface ArchivoTecnicoValidado {
  bytes: Buffer;
  sha256: string;
  tamano_bytes: number;
  mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  nombre: string;
  tipo: TipoArchivoTecnico;
}
/** Sólo firma y estructura. Para persistir o servir imágenes usar el decoder completo. */
export function validarArchivoTecnico(datos: Uint8Array, mime: string, nombre: string, tipo: TipoArchivoTecnico): ArchivoTecnicoValidado {
  if (!datos.length || datos.length > MAX_ARCHIVO_TECNICO) throw new Error('El archivo debe ocupar entre 1 byte y 5 MiB.');
  const bytes = Buffer.from(datos);
  const formatos = { 'image/png': ['png', comprobarPng], 'image/jpeg': ['jpg', comprobarJpeg], 'image/webp': ['webp', comprobarWebp] } as const;
  let extension: string;
  if (tipo === 'ficha' && mime === 'application/pdf') {
    const texto = bytes.toString('latin1');
    const final = /\bstartxref\s+(\d+)\s+%%EOF\s*$/.exec(texto);
    const posicion = final ? Number(final[1]) : -1;
    const referencia = posicion >= 0 && posicion < bytes.length ? texto.slice(posicion, posicion + 4096) : '';
    const xrefValido = referencia.startsWith('xref') || /^\d+\s+\d+\s+obj\b/.test(referencia) && /\/Type\s*\/XRef\b/.test(referencia);
    if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(texto) || !final || !xrefValido || !/\/Root\s+\d+\s+\d+\s+R\b/.test(texto)) throw new Error('La ficha no contiene un PDF válido completo.');
    extension = 'pdf';
  } else if (tipo === 'imagen' && mime in formatos) {
    const formato = formatos[mime as keyof typeof formatos];
    formato[1](bytes);
    extension = formato[0];
  } else throw new Error('Imagen: PNG, JPEG o WebP. Ficha: PDF. SVG no admitido.');
  const base = nombre.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f"<>:]/g, '').replace(/\.[^.]*$/, '').trim().slice(0, 100) || tipo;
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), tamano_bytes: bytes.length,
    mime: mime as ArchivoTecnicoValidado['mime'], nombre: `${base}.${extension}`, tipo };
}

/** Decodifica todos los píxeles antes de guardar/servir, sin modificar bytes ni hash. */
export async function validarArchivoTecnicoCompleto(datos: Uint8Array, mime: string, nombre: string,
  tipo: TipoArchivoTecnico): Promise<ArchivoTecnicoValidado> {
  const archivo = validarArchivoTecnico(datos, mime, nombre, tipo);
  if (archivo.tipo !== 'imagen') return archivo;
  try {
    const imagen = sharp(archivo.bytes, {
      failOn: 'warning', limitInputPixels: 16_777_216, sequentialRead: true,
    }).timeout({ seconds: 5 });
    const metadata = await imagen.metadata();
    const formato = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[archivo.mime as 'image/png' | 'image/jpeg' | 'image/webp'];
    if (metadata.format !== formato || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
      throw new Error('Formato raster inesperado.');
    }
    dimensionesImagen(metadata.width, metadata.height);
    // Uchar fija 1 byte por canal: máximo 16M píxeles × 4 = 64 MiB.
    const { data, info } = await imagen.raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
    dimensionesImagen(info.width, info.height);
    if (info.channels < 1 || info.channels > 4 || data.length > 64 * 1024 * 1024 ||
      data.length !== info.width * info.height * info.channels) throw new Error('Píxeles incompletos.');
  } catch {
    throw new Error('El contenido de la imagen está corrupto o no se puede decodificar dentro de los límites admitidos.');
  }
  return archivo;
}
