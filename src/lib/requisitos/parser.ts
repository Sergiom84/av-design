import { spawn, execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

export const LIMITES_EXTRACCION = { bytes: 5 * 1024 * 1024, paginas: 100,
  textoBytes: 1024 * 1024, caracteresPagina: 20_000, milisegundos: 15_000,
  memoriaBytes: 256 * 1024 * 1024 } as const;
export class ErrorExtraccion extends Error {
  constructor(public readonly codigo: string, public readonly estadoHttp = 422,
    public readonly proceso?: { pid: number | undefined; cerrado: boolean; senial: string | null }) {
    super(codigo); this.name = 'ErrorExtraccion';
  }
}
const esquemaResultado = z.object({ ok: z.literal(true), parser: z.literal('pdfjs-dist'),
  parserVersion: z.literal('6.4.299'), estado: z.enum(['con_texto', 'sin_texto', 'mixto']),
  paginas: z.array(z.object({ numero: z.number().int().min(1).max(100),
    texto: z.string().max(20_000) }).strict()).min(1).max(100) }).strict();
export type TextoPdfExtraido = z.infer<typeof esquemaResultado>;
const ejecutar = promisify(execFile);
async function memoriaResidente(pid: number): Promise<number> {
  if (process.platform === 'linux') {
    const estado = await readFile(`/proc/${pid}/status`, 'utf8');
    const rss = /^VmRSS:\s+(\d+) kB$/mu.exec(estado);
    if (!rss) throw new Error('RSS no disponible.');
    return Number(rss[1]) * 1024;
  }
  if (process.platform === 'darwin') {
    const { stdout } = await ejecutar('/bin/ps', ['-o', 'rss=', '-p', String(pid)], { timeout: 1000 });
    const rss = stdout.trim();
    if (!/^\d+$/u.test(rss)) throw new Error('RSS no disponible.');
    return Number(rss) * 1024;
  }
  throw new Error('Monitor de memoria no disponible.');
}

/** No abre archivos del documento ni evalúa contenido; el caller autoriza antes de proporcionar bytes. */
export async function extraerPdfLocal(bytes: Uint8Array,
  opciones: { signal?: AbortSignal; tiempoMaximoMs?: number } = {}): Promise<TextoPdfExtraido> {
  if (!bytes.length || bytes.length > LIMITES_EXTRACCION.bytes) throw new ErrorExtraccion('limite_archivo', 413);
  if (!Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from('%PDF-'))) throw new ErrorExtraccion('firma_pdf');
  if (opciones.signal?.aborted) throw new ErrorExtraccion('cancelado', 409);
  const tiempo = opciones.tiempoMaximoMs ?? LIMITES_EXTRACCION.milisegundos;
  if (!Number.isInteger(tiempo) || tiempo < 1 || tiempo > LIMITES_EXTRACCION.milisegundos) throw new ErrorExtraccion('limite_tiempo', 400);
  if (!['linux', 'darwin'].includes(process.platform)) throw new ErrorExtraccion('extractor_no_disponible', 503);
  const trabajador = resolve(process.cwd(), 'src/lib/requisitos/parser-worker.mjs');
  const modulosDeclarados = resolve(process.cwd(), 'node_modules');
  const modulos = await realpath(modulosDeclarados);
  return new Promise((aceptar, rechazar) => {
    const hijo = spawn(process.execPath, ['--permission', `--allow-fs-read=${trabajador}`,
      `--allow-fs-read=${modulos}`, `--allow-fs-read=${modulosDeclarados}`, '--allow-addons', '--max-old-space-size=128',
      '--disallow-code-generation-from-strings', '--no-global-search-paths', trabajador], {
      env: { NODE_ENV: 'production', TZ: 'UTC', LANG: 'C' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'json',
    });
    let codigo: string | null = null, resultado: TextoPdfExtraido | undefined;
    let cerrado = false, consultandoMemoria = false;
    const terminar = (motivo: string) => { codigo ??= motivo; if (!cerrado) hijo.kill('SIGKILL'); };
    const cancelar = () => terminar('cancelado');
    const reloj = setTimeout(() => terminar('tiempo_agotado'), tiempo);
    const monitor = setInterval(() => {
      if (!hijo.pid || cerrado || consultandoMemoria) return;
      consultandoMemoria = true;
      void memoriaResidente(hijo.pid).then(rss => {
        if (!cerrado && rss > LIMITES_EXTRACCION.memoriaBytes) terminar('limite_memoria');
      }).catch(() => { if (!cerrado && hijo.exitCode === null && hijo.signalCode === null) terminar('monitor_no_disponible'); })
        .finally(() => { consultandoMemoria = false; });
    }, 50);
    opciones.signal?.addEventListener('abort', cancelar, { once: true });
    hijo.on('message', mensaje => {
      if (codigo || resultado) return;
      const r = esquemaResultado.safeParse(mensaje);
      if (r.success) {
        const paginas = r.data.paginas;
        if (paginas.some((p, i) => p.numero !== i + 1) ||
          paginas.reduce((n, p) => n + Buffer.byteLength(p.texto), 0) > LIMITES_EXTRACCION.textoBytes) terminar('integridad_parser');
        else resultado = r.data;
      } else {
        const error = z.object({ ok: z.literal(false), codigo: z.enum(['formato', 'limite_archivo',
          'limite_paginas', 'pdf_cifrado', 'contenido_activo', 'limite_texto_pagina', 'limite_texto',
          'pdf_no_valido', 'extractor_no_disponible']) }).strict().safeParse(mensaje);
        if (error.success) codigo = error.data.codigo;
        else terminar('integridad_parser');
      }
    });
    hijo.once('error', () => terminar('extractor_no_disponible'));
    hijo.once('close', (estado, senial) => {
      cerrado = true; clearTimeout(reloj); clearInterval(monitor);
      opciones.signal?.removeEventListener('abort', cancelar);
      if (codigo || estado !== 0 || !resultado) {
        const causa = codigo ?? 'extractor_no_disponible';
        rechazar(new ErrorExtraccion(causa, causa.includes('limite') ? 413 :
          ['extractor_no_disponible', 'monitor_no_disponible', 'integridad_parser'].includes(causa) ? 503 :
            causa === 'cancelado' ? 409 : 422, { pid: hijo.pid, cerrado, senial }));
      } else aceptar(resultado);
    });
    hijo.send({ base64: Buffer.from(bytes).toString('base64') }, e => { if (e) terminar('extractor_no_disponible'); });
    // La cancelación entre la primera comprobación y el listener tampoco publica un resultado.
    if (opciones.signal?.aborted) cancelar();
  });
}

export function extraerTxtLocal(bytes: Uint8Array): { parser: 'utf8'; parserVersion: '1'; texto: string } {
  if (!bytes.length || bytes.length > LIMITES_EXTRACCION.bytes) throw new ErrorExtraccion('limite_archivo', 413);
  let texto: string;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new ErrorExtraccion('utf8_no_valido'); }
  if (texto.includes('\0')) throw new ErrorExtraccion('texto_con_nul');
  if (Buffer.byteLength(texto) > LIMITES_EXTRACCION.textoBytes) throw new ErrorExtraccion('limite_texto', 413);
  return { parser: 'utf8', parserVersion: '1', texto };
}
