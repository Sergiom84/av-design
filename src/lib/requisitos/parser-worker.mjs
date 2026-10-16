// Proceso dedicado: sólo recibe bytes; nunca rutas, URLs, permisos ni secretos.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';

const denegar = () => { throw new Error('RED_NO_PERMITIDA'); };
globalThis.fetch = async () => { denegar(); };
globalThis.WebSocket = class { constructor() { denegar(); } };
http.request = http.get = https.request = https.get = denegar;
net.connect = net.createConnection = net.Socket.prototype.connect = denegar;
tls.connect = dgram.createSocket = dns.lookup = dns.resolve = denegar;
syncBuiltinESMExports();
console.log = console.warn = console.error = () => {};
process.once('disconnect', () => process.exit(1));
setTimeout(() => process.exit(124), 15_000).unref();

const fallo = codigo => {
  process.send?.({ ok: false, codigo }, () => process.exit(0));
};
process.once('message', async mensaje => {
  let tarea;
  try {
    if (!mensaje || typeof mensaje.base64 !== 'string' || mensaje.base64.length > 7_000_000) return fallo('formato');
    const bytes = new Uint8Array(Buffer.from(mensaje.base64, 'base64'));
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return fallo('limite_archivo');
    const { getDocument, version } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    class SinRecursos { async fetch() { throw new Error('RECURSO_NO_PERMITIDO'); } }
    tarea = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false,
      disableFontFace: true, useWorkerFetch: false, useWasm: false, enableXfa: false,
      disableAutoFetch: true, disableStream: true, disableRange: true, stopAtErrors: true,
      CMapReaderFactory: SinRecursos, StandardFontDataFactory: SinRecursos,
      WasmFactory: SinRecursos, verbosity: 0 });
    const pdf = await tarea.promise;
    if (pdf.numPages > 100) return fallo('limite_paginas');
    // Incluso cifrado sin contraseña de apertura queda fuera de esta extracción.
    if (await pdf.getPermissions() !== null) return fallo('pdf_cifrado');
    if (pdf.isPureXfa || (await pdf.getAttachments())?.size ||
        (await pdf.getJSActions())?.size || await pdf.hasJSActions() ||
        (await pdf.getFieldObjects())?.size) return fallo('contenido_activo');
    const apertura = await pdf.getOpenAction();
    if (apertura && [...apertura.keys()].some(k => k !== 'dest')) return fallo('contenido_activo');
    const paginas = [];
    let total = 0;
    for (let numero = 1; numero <= pdf.numPages; numero++) {
      const pagina = await pdf.getPage(numero);
      if ((await pagina.getJSActions())?.size) return fallo('contenido_activo');
      const anotaciones = await pagina.getAnnotations();
      if (anotaciones.some(a => ['Widget', 'FileAttachment', 'Sound', 'Movie', 'Screen', 'RichMedia'].includes(a.subtype) ||
          a.jsActions || a.actions || a.resetForm || a.submitForm || a.attachment || a.file || a.newWindow)) return fallo('contenido_activo');
      const contenido = await pagina.getTextContent({ disableNormalization: true });
      let texto = '';
      for (const item of contenido.items) {
        if (!('str' in item)) continue;
        texto += item.str + (item.hasEOL ? '\n' : ' ');
        if (texto.length > 20_000 && texto.trimEnd().length > 20_000) return fallo('limite_texto_pagina');
      }
      texto = texto.trimEnd();
      total += Buffer.byteLength(texto, 'utf8');
      if (total > 1024 * 1024) return fallo('limite_texto');
      paginas.push({ numero, texto });
      pagina.cleanup();
    }
    await tarea.destroy(); tarea = null;
    const conTexto = paginas.filter(p => p.texto.trim()).length;
    process.send?.({ ok: true, parser: 'pdfjs-dist', parserVersion: version,
      estado: conTexto === 0 ? 'sin_texto' : conTexto === paginas.length ? 'con_texto' : 'mixto', paginas }, () => process.exit(0));
  } catch (e) {
    try { await tarea?.destroy(); } catch { /* El padre siempre termina el proceso. */ }
    fallo(e?.name === 'PasswordException' ? 'pdf_cifrado' :
      ['ERR_MODULE_NOT_FOUND','ERR_ACCESS_DENIED'].includes(e?.code) ? 'extractor_no_disponible' : 'pdf_no_valido');
  }
});
