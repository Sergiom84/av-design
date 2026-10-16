import { randomUUID } from 'node:crypto';
import { extraerPdfLocal, extraerTxtLocal } from './parser';
import { ErrorRequisito, LIMITES_REQUISITOS, hash, hashBytes, resultadoExtraccionSchema, validar, type Candidato, type ResultadoExtraccion } from './modelo';
import type { Base } from './fuentes';

function idEstable(semilla: string): string { const h = hash(semilla); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; }
/** La necesidad local pertenece al original, no al intento de extracción. */
export function idOrigenLocal(ancla: Candidato['ancla']): string {
  return idEstable(hash({ documentoId: ancla.documentoId, pagina: ancla.pagina, linea: ancla.linea,
    inicio: ancla.inicio, fin: ancla.fin, sha256: ancla.sha256 }));
}
/** Los desplazamientos son UTF-16 del texto conservado, nunca índices de bytes. */
export function detectarCandidatos(documentoId: string, extraccionId: string, paginas: ResultadoExtraccion['paginas'], manual = false): Candidato[] {
  const candidatos: Candidato[] = [];
  for (const p of paginas) {
    let inicio = 0, linea = 1;
    for (const fragmento of p.texto.split(/\n/u)) {
      const literal = /^\s*(Sala|Área|Area|Localización|Localizacion|Modelo|Cantidad|Unidad|Puerto|Ancho|Alto|Fondo|RU)\s*:\s*(.+)$/iu.exec(fragmento);
      const hipotesis = !literal && /(?:^|[^\p{L}])(?:área|area|sala|modelo|puerto)(?=$|[^\p{L}])/iu.test(fragmento);
      if (fragmento.trim() && (literal || hipotesis || manual)) {
        if (fragmento.length > 2000) throw new ErrorRequisito('LIMITE', 'Un fragmento supera 2.000 caracteres.', 413);
        const campo = literal?.[1].toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? 'texto';
        const clase = ['sala','area','localizacion'].includes(campo) ? 'area' : ['modelo','cantidad','unidad'].includes(campo) ? 'material' : campo === 'puerto' ? 'puerto' : ['ancho','alto','fondo','ru'].includes(campo) ? 'tecnico' : 'hipotesis';
        const ancla: Candidato['ancla'] = { documentoId, extraccionId, pagina: p.numero, linea: p.numero === null ? linea : null,
          inicio, fin: inicio + fragmento.length, sha256: hash(fragmento), metodo: manual ? 'transcripcion_manual' : literal ? 'literal_estructurado' : 'hipotesis' };
        candidatos.push({ id: manual ? idEstable(`${extraccionId}:${p.numero}:${linea}:${inicio}`) : idOrigenLocal(ancla), clase,
          fragmento, original: { [campo]: literal?.[2].trim() ?? fragmento }, ambiguedades: literal ? [] : ['Hipótesis: requiere interpretar y revisar cada campo.'],
          ancla });
        if (candidatos.length > LIMITES_REQUISITOS.candidatos) throw new ErrorRequisito('LIMITE', 'La extracción supera 500 candidatos.', 413);
      }
      inicio += fragmento.length + 1; linea++;
    }
  }
  return candidatos;
}
export function construirExtraccion(documentoId: string, extraccionId: string, paginas: ResultadoExtraccion['paginas'], estado: ResultadoExtraccion['estado'], manual = false, motivoManual?: string): ResultadoExtraccion {
  return validar(resultadoExtraccionSchema, { versionModelo: 1, estado, paginas,
    ...(manual && motivoManual ? { motivoManual } : {}),
    candidatos: detectarCandidatos(documentoId, extraccionId, paginas, manual),
    avisos: [...(manual ? ['Transcripción manual: no cotejada automáticamente con el original.'] : []),
      ...paginas.filter(p => !p.texto.trim()).map(p => `Página ${p.numero}: sin texto extraíble; no se ha realizado OCR.`)] });
}
/** Locks de sesión de Postgres: 1/persona y 2/global, liberados también al caer el servidor. */
export async function conCuotaParser<T>(db: Base, usuarioId: string, ejecutar: () => Promise<T>): Promise<T> {
  const c = await db.reserve(); let persona = false, global: number | null = null;
  try {
    const [r] = await c`select pg_try_advisory_lock(hashtextextended(${'rea10-parser-persona:' + usuarioId},0)) as ok`;
    if (!r.ok) throw new ErrorRequisito('CUOTA', 'Ya hay una extracción en curso para tu usuario.', 429); persona = true;
    for (let i = 0; i < LIMITES_REQUISITOS.parsers; i++) {
      const [g] = await c`select pg_try_advisory_lock(hashtextextended(${'rea10-parser-global:' + i},0)) as ok`;
      if (g.ok) { global = i; break; }
    }
    if (global === null) throw new ErrorRequisito('CUOTA', 'El extractor local está ocupado. Vuelve a intentarlo.', 429);
    return await ejecutar();
  } finally {
    try { if (global !== null) await c`select pg_advisory_unlock(hashtextextended(${'rea10-parser-global:' + global},0))`; if (persona) await c`select pg_advisory_unlock(hashtextextended(${'rea10-parser-persona:' + usuarioId},0))`; }
    finally { c.release(); }
  }
}
export async function parsearFuente(documentoId: string, mime: string, bytes: Uint8Array, signal?: AbortSignal) {
  const extraccionId = randomUUID();
  if (mime === 'application/pdf') {
    const r = await extraerPdfLocal(bytes, { signal });
    const resultado = construirExtraccion(documentoId, extraccionId, r.paginas, r.estado);
    return { extraccionId, resultado, parser: r.parser, parserVersion: r.parserVersion, metodo: 'pdf_local', textoSha256: hash(r.paginas.map(p => p.texto)), fuenteSha256: hashBytes(bytes) };
  }
  if (mime === 'text/plain') {
    const r = extraerTxtLocal(bytes); const paginas = [{ numero: null, texto: r.texto }];
    return { extraccionId, resultado: construirExtraccion(documentoId, extraccionId, paginas, r.texto.trim() ? 'con_texto' : 'sin_texto'), parser: r.parser, parserVersion: r.parserVersion, metodo: 'txt_utf8', textoSha256: hash(paginas.map(p => p.texto)), fuenteSha256: hashBytes(bytes) };
  }
  return { extraccionId, resultado: construirExtraccion(documentoId, extraccionId, [], 'referencia'), parser: 'referencia-e2', parserVersion: '1', metodo: 'referencia_e2', textoSha256: hash([]), fuenteSha256: hashBytes(bytes) };
}
