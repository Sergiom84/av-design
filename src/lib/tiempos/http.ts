import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sesionActual } from '../sesion-servidor';
import { sql, hayConfiguracion } from '../db';
import { mismoOrigen } from '../catalogo-tecnico';
import { partesMadrid } from '../informes/periodos';
import { ErrorIntervaloReal } from './fechas';
import { ErrorTiempo, entradaTiempo, LIMITES_TIEMPOS, uuidTiempo } from './modelo';
import { RepositorioTiempos } from './repositorio';

export const respuestaTiempo = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export function errorSeguroTiempo(e: unknown): ErrorTiempo {
  if (e instanceof ErrorTiempo) return e;
  if (e instanceof ErrorIntervaloReal) return new ErrorTiempo(e.codigo, e.message, ['HORA_AMBIGUA', 'HORA_INEXISTENTE'].includes(e.codigo) ? 422 : e.status, e.detalles);
  if (e instanceof z.ZodError) return new ErrorTiempo('ENTRADA_INVALIDA', 'Comprueba los campos de la solicitud.');
  if (['23505','40001','40P01'].includes((e as { code?: string })?.code ?? '')) return new ErrorTiempo('CONFLICTO_CONCURRENCIA', 'Otra operación cambió el registro. Recarga y compara antes de guardar.', 409);
  return new ErrorTiempo('SERVICIO_NO_DISPONIBLE', 'No se pudo completar la operación. Conserva tu edición y reintenta.', 503);
}
export async function cuerpoTiempo(req: Request) {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? '')) throw new ErrorTiempo('ENTRADA_INVALIDA', 'La solicitud debe ser JSON.');
  if (Number(req.headers.get('content-length')) > LIMITES_TIEMPOS.cuerpo) throw new ErrorTiempo('LIMITE_EXCEDIDO', 'Máximo 64 KiB por solicitud.', 413);
  const lector = req.body?.getReader();
  if (!lector) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Falta el cuerpo JSON.');
  let total = 0; const partes: Uint8Array[] = [];
  try {
    for (;;) { const r = await lector.read(); if (r.done) break; total += r.value.byteLength; if (total > LIMITES_TIEMPOS.cuerpo) { await lector.cancel(); throw new ErrorTiempo('LIMITE_EXCEDIDO', 'Máximo 64 KiB por solicitud.', 413); } partes.push(r.value); }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(partes)));
  } catch (e) { if (e instanceof ErrorTiempo) throw e; throw new ErrorTiempo('ENTRADA_INVALIDA', 'El cuerpo JSON no es válido.'); }
  finally { lector.releaseLock(); }
}
export function filtroTiempo(url: URL) {
  const hoy = partesMadrid(new Date()).fecha;
  const desde = url.searchParams.get('desde') ?? hoy.slice(0, 8) + '01', hasta = url.searchParams.get('hasta') ?? hoy;
  if (url.searchParams.has('desde') !== url.searchParams.has('hasta')) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Indica ambas fechas.');
  const pagina = Number(url.searchParams.get('pagina') ?? 1);
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Página inválida.');
  return { desde, hasta, pagina };
}
export async function atenderTiempo(req: Request, ruta: string, params: Record<string, string> = {}) {
  const solicitudId = randomUUID();
  try {
    if (!hayConfiguracion()) throw new ErrorTiempo('SERVICIO_NO_DISPONIBLE', 'La base de datos no está configurada.', 503);
    const sesion = await sesionActual();
    if (!sesion) throw new ErrorTiempo('SESION_REQUERIDA', 'Inicia sesión.', 401);
    if (sesion.ficticio || sesion.debeCambiarClave) throw new ErrorTiempo('PERMISO_DENEGADO', 'Usa una identidad real con contraseña definitiva.', 403);
    if (req.method !== 'GET' && !mismoOrigen(req)) throw new ErrorTiempo('ORIGEN_DENEGADO', 'La solicitud debe proceder de esta aplicación.', 403);
    for (const valor of Object.values(params)) entradaTiempo(uuidTiempo, valor);
    const repo = new RepositorioTiempos(sql), url = new URL(req.url), usuario = sesion.id;
    const cuerpo = req.method === 'GET' ? undefined : await cuerpoTiempo(req);
    await repo.identidad(usuario);
    const respuesta = (v: unknown, status = 200) => respuestaTiempo({ solicitudId, ...v as object }, status);
    const gestionTexto = url.searchParams.get('gestion');
    if (gestionTexto != null && !['0','1'].includes(gestionTexto)) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Modo de gestión inválido.');
    const gestion = gestionTexto === '1';
    if (ruta === 'mios' && req.method === 'GET') return respuesta(await repo.listar(usuario, filtroTiempo(url)));
    if (ruta === 'mios' && req.method === 'POST') return respuesta(await repo.crear(usuario, cuerpo), 201);
    if (ruta === 'proyecto' && req.method === 'GET') return respuesta(await repo.listar(usuario, filtroTiempo(url), params.id));
    if (ruta === 'proyecto' && req.method === 'POST') return respuesta(await repo.crear(usuario, cuerpo, params.id), 201);
    if (ruta === 'tareas' && req.method === 'GET') return respuesta(await repo.tareas(usuario, url.searchParams.get('q') ?? '', url.searchParams.get('proyectoId') ?? undefined, gestion));
    if (ruta === 'tecnicos' && req.method === 'GET') return respuesta(await repo.tecnicos(usuario, url.searchParams.get('q') ?? ''));
    if (ruta === 'registro' && req.method === 'GET') return respuesta({ registro: await repo.registro(usuario, params.id) });
    if (ruta === 'registro' && req.method === 'PATCH') return respuesta(await repo.corregir(usuario, params.id, cuerpo, gestion));
    if (ruta === 'anular' && req.method === 'POST') return respuesta(await repo.anular(usuario, params.id, cuerpo, gestion));
    if (ruta === 'historial' && req.method === 'GET') return respuesta(await repo.historial(usuario, params.id, filtroTiempo(url).pagina));
    if (ruta === 'historial' && req.method === 'POST') return respuesta(await repo.restaurar(usuario, params.id, cuerpo, gestion));
    if (ruta === 'relacionados' && req.method === 'GET') return respuesta(await repo.relacionados(usuario, params.id, filtroTiempo(url).pagina));
    throw new ErrorTiempo('NO_ENCONTRADO', 'Operación no disponible.', 404);
  } catch (e) { const error = errorSeguroTiempo(e); return respuestaTiempo({ solicitudId, error: error.message, codigo: error.codigo, ...(error.detalle ? { detalle: error.detalle } : {}) }, error.status); }
}
