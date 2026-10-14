import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import {
  datosTecnicosSchema, dimensionEnMm, filtrosTecnicosSchema, MAX_ARCHIVO_TECNICO,
  leerCuerpoTecnico, mismoOrigen, permisoCatalogoTecnico, validarArchivoTecnico, validarArchivoTecnicoCompleto,
} from './catalogo-tecnico';
import { obtenerDatosTecnicos, guardarDatosTecnicos, guardarArchivoTecnico, obtenerArchivoTecnico } from './catalogo-tecnico-repositorio';
import { PERMISOS_POR_ROL } from './usuarios';

const base = { marca: 'PRUEBA', modelo: 'PRUEBA-IMPORT-01', origen: 'Ficha fabricante',
  url: 'https://example.com/modelo-exacto.pdf', fecha: '2026-10-13',
  ancho: 440, alto: null, fondo: null, unidad: 'mm', ru: 1 };
function crc32(bytes: Buffer): number {
  let resultado = 0xffffffff;
  for (const byte of bytes) { resultado ^= byte; for (let i = 0; i < 8; i++) resultado = (resultado >>> 1) ^ ((resultado & 1) ? 0xedb88320 : 0); }
  return (resultado ^ 0xffffffff) >>> 0;
}
function chunk(nombre: string, datos: Buffer) {
  const longitud = Buffer.alloc(4); longitud.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(nombre), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([longitud, cuerpo, crc]);
}
function png(ancho = 1, alto = 1) {
  const cabecera = Buffer.alloc(13); cabecera.writeUInt32BE(ancho, 0); cabecera.writeUInt32BE(alto, 4); cabecera[8] = 8; cabecera[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', cabecera),
    chunk('IDAT', deflateSync(Buffer.from([0,255,0,0]))), chunk('IEND', Buffer.alloc(0))]);
}

describe('datos técnicos verificados por modelo exacto', () => {
  it('conserva dimensiones parciales y ausencia sin inferir RU', () => {
    const salida = datosTecnicosSchema.parse({ ...base, ru: null });
    assert.equal(salida.ancho, 440); assert.equal(salida.alto, null); assert.equal(salida.fondo, null); assert.equal(salida.ru, null);
    assert.equal(datosTecnicosSchema.safeParse({ ...base, ancho: null, unidad: null, ru: null }).success, true);
  });
  it('exige unidades admitidas para cualquier medida, dimensión positiva y RU positivo', () => {
    for (const campos of [{ unidad: null }, { unidad: 'in' }, { ancho: 0 }, { alto: -1 }, { ru: 0 }, { fondo: NaN }, { ancho: Infinity }])
      assert.equal(datosTecnicosSchema.safeParse({ ...base, ...campos }).success, false);
  });
  it('rechaza URL no HTTPS, credenciales, fechas inexistentes o futuras y fuente ausente', () => {
    for (const campos of [{ url: 'http://example.com' }, { url: 'https://usuario:clave@example.com' },
      { url: 'javascript:alert(1)' }, { url: 'https://exa\nmple.com' }, { fecha: '2026-02-30' }, { fecha: '2999-01-01' }, { fecha: '13-10-2026' }, { origen: '' }])
      assert.equal(datosTecnicosSchema.safeParse({ ...base, ...campos }).success, false);
    assert.equal(datosTecnicosSchema.parse({ ...base, url: ' HTTPS://EXAMPLE.COM/modelo.pdf ' }).url, 'https://example.com/modelo.pdf');
  });
  it('convierte unidades conocidas para filtros y mantiene null', () => {
    assert.equal(dimensionEnMm(44, 'cm'), 440); assert.equal(dimensionEnMm(.44, 'm'), 440);
    assert.equal(dimensionEnMm(440, 'mm'), 440); assert.equal(dimensionEnMm(null, 'mm'), null);
    assert.equal(dimensionEnMm(20, null), null);
    assert.equal(filtrosTecnicosSchema.safeParse({ q: 'exacto', ancho_max_mm: -1 }).success, false);
  });
  it('controla sesión, contraseña provisional y permisos de lectura/escritura', () => {
    const lectura = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.lectura, debeCambiarClave: false };
    assert.equal(permisoCatalogoTecnico(null, 'ver'), false);
    assert.equal(permisoCatalogoTecnico(lectura, 'ver'), true); assert.equal(permisoCatalogoTecnico(lectura, 'editar'), false);
    assert.equal(permisoCatalogoTecnico({ ...lectura, debeCambiarClave: true }, 'ver'), false);
    assert.equal(permisoCatalogoTecnico({ ...lectura, permisos: { ...lectura.permisos, catalogo: 'oculto' } }, 'ver'), false);
  });
  it('no consulta ni escribe SQL si falta permiso o hay contraseña provisional', async () => {
    const db = (() => { throw new Error('No debía consultar SQL'); }) as unknown as Parameters<typeof obtenerDatosTecnicos>[0];
    const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: { ...PERMISOS_POR_ROL.lectura, catalogo: 'oculto' as const }, debeCambiarClave: false };
    await assert.rejects(obtenerDatosTecnicos(db, usuario, 'e2000000-0000-4000-8000-000000000002'), /Sin permiso/);
    await assert.rejects(guardarDatosTecnicos(db, { ...usuario, permisos: PERMISOS_POR_ROL.admin, debeCambiarClave: true }, 'e2000000-0000-4000-8000-000000000002', base), /Sin permiso/);
  });
  it('exige mismo origen en APIs mutantes', () => {
    assert.equal(mismoOrigen(new Request('https://av.example/api', { headers: { origin: 'https://av.example' } })), true);
    for (const origin of [undefined, 'https://atacante.example', 'null', 'https://av.example.evil'])
      assert.equal(mismoOrigen(new Request('https://av.example/api', { headers: origin ? { origin } : {} })), false);
  });
  it('limita el cuerpo real incluso sin Content-Length o con uno falso', async () => {
    const exactamente = new Request('https://av.example/api', { method: 'POST', body: '12345' });
    assert.equal(Buffer.from(await leerCuerpoTecnico(exactamente, 5)).toString(), '12345');
    await assert.rejects(leerCuerpoTecnico(new Request('https://av.example/api', { method: 'POST', body: '123456' }), 5), /límite/);
    await assert.rejects(leerCuerpoTecnico(new Request('https://av.example/api', { method: 'POST', body: '123456', headers: { 'content-length': '1' } }), 5), /límite/);
    await assert.rejects(leerCuerpoTecnico(new Request('https://av.example/api', { method: 'POST', body: '123', headers: { 'content-length': '99' } }), 5), /límite/);
    await assert.rejects(leerCuerpoTecnico(new Request('https://av.example/api'), 5), /Falta el cuerpo/);
  });
  it('no inicia escritura con datos inválidos ni un identificador de otro formato', async () => {
    const db = (() => { throw new Error('No debía consultar SQL'); }) as unknown as Parameters<typeof obtenerDatosTecnicos>[0];
    const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.admin, debeCambiarClave: false };
    await assert.rejects(guardarDatosTecnicos(db, usuario, 'e2000000-0000-4000-8000-000000000002', { ...base, unidad: null }), /unidad/);
    await assert.rejects(obtenerDatosTecnicos(db, usuario, 'MODELO-INVENTADO'), /UUID/);
  });
  it('rechaza metadatos del modelo anterior antes de escribir si la referencia cambió', async () => {
    let consultas = 0;
    const transaccion = (() => { consultas++; return Promise.resolve([{ marca: 'PRUEBA', modelo: 'PRUEBA-IMPORT-01-B' }]); });
    const db = { begin: async (funcion: (tx: unknown) => Promise<unknown>) => funcion(transaccion) } as unknown as Parameters<typeof guardarDatosTecnicos>[0];
    const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.admin, debeCambiarClave: false };
    await assert.rejects(guardarDatosTecnicos(db, usuario, 'e2000000-0000-4000-8000-000000000002', base), /modelo han cambiado/);
    assert.equal(consultas, 1);
  });
});

describe('decodificación completa y acotada de archivos técnicos', () => {
  function webpCorrupto() {
    const webp = Buffer.alloc(32);
    webp.write('RIFF', 0); webp.writeUInt32LE(24, 4); webp.write('WEBP', 8);
    webp.write('VP8L', 12); webp.writeUInt32LE(12, 16); webp[20] = 0x2f;
    return webp;
  }
  const sinPaleta = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64');

  it('rechaza WebP de 32 bytes sin píxeles y PNG indexado sin PLTE de la revisión', async () => {
    for (const [bytes, mime] of [[webpCorrupto(), 'image/webp'], [sinPaleta, 'image/png']] as const) {
      // Las cabeceras parecen correctas; la decodificación detecta la corrupción.
      assert.equal(validarArchivoTecnico(bytes, mime, 'corrupta', 'imagen').mime, mime);
      await assert.rejects(validarArchivoTecnicoCompleto(bytes, mime, 'corrupta', 'imagen'), /corrupto|decodificar/);
    }
  });
  it('acepta y decodifica los tres raster válidos conservando exactamente bytes, hash y tamaño', async () => {
    const { default: sharp } = await import('sharp');
    const imagenes = [
      [png(), 'image/png'],
      [await sharp(png()).jpeg().toBuffer(), 'image/jpeg'],
      [await sharp(png()).webp().toBuffer(), 'image/webp'],
    ] as const;
    for (const [bytes, mime] of imagenes) {
      const resultado = await validarArchivoTecnicoCompleto(bytes, mime, 'PRUEBA-IMPORT-01', 'imagen');
      assert.equal(resultado.mime, mime); assert.equal(resultado.tamano_bytes, bytes.length);
      assert.equal(resultado.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual(resultado.bytes, bytes);
    }
  });
  it('rechaza JPEG con tabla Huffman inválida aunque firma y segmentos sean completos', async () => {
    const { default: sharp } = await import('sharp');
    const jpeg = await sharp(png()).jpeg().toBuffer();
    const tabla = jpeg.indexOf(Buffer.from([255, 196]));
    assert.ok(tabla > 0); jpeg[tabla + 4] = 0xff;
    assert.equal(validarArchivoTecnico(jpeg, 'image/jpeg', 'roto.jpg', 'imagen').mime, 'image/jpeg');
    await assert.rejects(validarArchivoTecnicoCompleto(jpeg, 'image/jpeg', 'roto.jpg', 'imagen'), /corrupto|decodificar/);
  });
  it('mantiene los límites de 5 MiB, 8192 px por lado y 16M píxeles antes de decodificar', async () => {
    await assert.rejects(validarArchivoTecnicoCompleto(Buffer.alloc(MAX_ARCHIVO_TECNICO + 1), 'image/png', 'grande.png', 'imagen'), /5 MiB/);
    await assert.rejects(validarArchivoTecnicoCompleto(png(8193, 1), 'image/png', 'ancha.png', 'imagen'), /8192 px/);
    await assert.rejects(validarArchivoTecnicoCompleto(png(4097, 4096), 'image/png', 'muchospixeles.png', 'imagen'), /16 megapíxeles/);
  });
  it('el repositorio rechaza la sustitución corrupta antes de iniciar cualquier escritura', async () => {
    let transacciones = 0;
    const db = { begin: () => { transacciones++; throw new Error('No debía empezar una transacción'); } } as unknown as Parameters<typeof guardarArchivoTecnico>[0];
    const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.admin, debeCambiarClave: false };
    const entrada = { marca: base.marca, modelo: base.modelo, origen: base.origen, url: base.url, fecha: base.fecha };
    for (const [bytes, mime] of [[webpCorrupto(), 'image/webp'], [sinPaleta, 'image/png']] as const) {
      const archivo = validarArchivoTecnico(bytes, mime, 'corrupta', 'imagen');
      await assert.rejects(guardarArchivoTecnico(db, usuario, 'e2000000-0000-4000-8000-000000000002', entrada, archivo), /corrupto|decodificar/);
    }
    assert.equal(transacciones, 0);
  });
  it('la descarga también rechaza un archivo corrupto con hash y tamaño coherentes', async () => {
    const archivo = validarArchivoTecnico(webpCorrupto(), 'image/webp', 'roto.webp', 'imagen');
    const fila = { ...archivo, id: 'e2000000-0000-4000-8000-000000000003', articulo_id: 'e2000000-0000-4000-8000-000000000002',
      marca: base.marca, modelo: base.modelo, origen: base.origen, url: base.url, fecha: base.fecha, verificado_en: '2026-10-14T12:00:00Z' };
    const db = (() => Promise.resolve([fila])) as unknown as Parameters<typeof obtenerArchivoTecnico>[0];
    const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.admin, debeCambiarClave: false };
    await assert.rejects(obtenerArchivoTecnico(db, usuario, fila.articulo_id, fila.id), /corrupto|decodificar/);
  });
});

describe('archivos técnicos durables', () => {
  it('acepta archivos JPEG y WebP reales de un píxel', () => {
    const jpeg = Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z', 'base64');
    const webp = Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=', 'base64');
    assert.equal(validarArchivoTecnico(jpeg, 'image/jpeg', 'modelo.jpg', 'imagen').mime, 'image/jpeg');
    assert.equal(validarArchivoTecnico(webp, 'image/webp', 'modelo.webp', 'imagen').mime, 'image/webp');
    assert.throws(() => validarArchivoTecnico(jpeg.subarray(0, -2), 'image/jpeg', 'a.jpg', 'imagen'), /JPEG/);
    assert.throws(() => validarArchivoTecnico(webp.subarray(0, -2), 'image/webp', 'a.webp', 'imagen'), /WebP/);
  });
  it('acepta una ficha PDF real y rechaza una referencia xref fuera del archivo', async () => {
    const pdf = new PDFDocument();
    const partes: Buffer[] = [];
    const completado = new Promise<Buffer>((resolve, reject) => {
      pdf.on('data', parte => partes.push(parte)); pdf.on('end', () => resolve(Buffer.concat(partes))); pdf.on('error', reject);
    });
    pdf.text('Ficha sintética PRUEBA-IMPORT-01'); pdf.end();
    const bytes = await completado;
    assert.equal(validarArchivoTecnico(bytes, 'application/pdf', 'ficha.pdf', 'ficha').mime, 'application/pdf');
    assert.deepEqual((await validarArchivoTecnicoCompleto(bytes, 'application/pdf', 'ficha.pdf', 'ficha')).bytes, bytes);
    const rota = Buffer.from(bytes.toString('latin1').replace(/startxref\s+\d+/, 'startxref\n999999999'), 'latin1');
    assert.throws(() => validarArchivoTecnico(rota, 'application/pdf', 'ficha.pdf', 'ficha'), /PDF válido/);
  });
  it('valida PNG real, hash de bytes y nombre seguro sin confiar en extensión', () => {
    const bytes = png();
    const archivo = validarArchivoTecnico(bytes, 'image/png', '../../modelo\r\n".svg', 'imagen');
    assert.equal(archivo.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(archivo.tamano_bytes, bytes.length); assert.equal(archivo.nombre, 'modelo.png');
    assert.deepEqual(archivo.bytes, bytes);
  });
  it('rechaza MIME contradictorio, SVG, bytes trucados y formatos incompletos', () => {
    assert.throws(() => validarArchivoTecnico(png(), 'image/jpeg', 'modelo.jpg', 'imagen'), /JPEG/);
    assert.throws(() => validarArchivoTecnico(Buffer.from('<svg/>'), 'image/svg+xml', 'modelo.svg', 'imagen'), /no admitido/);
    assert.throws(() => validarArchivoTecnico(png().subarray(0, 20), 'image/png', 'modelo.png', 'imagen'), /truncado|incompleto/);
    const roto = png(); roto[30] ^= 1;
    assert.throws(() => validarArchivoTecnico(roto, 'image/png', 'modelo.png', 'imagen'), /CRC/);
    assert.throws(() => validarArchivoTecnico(Buffer.from('%PDF-1.4\n'), 'application/pdf', 'ficha.pdf', 'ficha'), /PDF válido/);
    assert.throws(() => validarArchivoTecnico(Buffer.from('RIFFfakeWEBP'), 'image/webp', 'modelo.webp', 'imagen'), /WebP/);
  });
  it('rechaza archivos vacíos y superiores a 5 MiB antes de inspeccionar formato', () => {
    assert.throws(() => validarArchivoTecnico(Buffer.alloc(0), 'image/png', 'a.png', 'imagen'), /5 MiB/);
    assert.throws(() => validarArchivoTecnico(Buffer.alloc(MAX_ARCHIVO_TECNICO + 1), 'image/png', 'a.png', 'imagen'), /5 MiB/);
  });
  it('sólo admite PDF como ficha y raster como imagen', () => {
    assert.throws(() => validarArchivoTecnico(png(), 'image/png', 'a.png', 'ficha'), /Ficha: PDF/);
    assert.throws(() => validarArchivoTecnico(Buffer.from('%PDF-1.4\n'), 'application/pdf', 'a.pdf', 'imagen'), /Ficha: PDF/);
  });
});
