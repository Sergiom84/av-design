import { z } from 'zod';
import { hayConfiguracion, sql } from '../db';
import { sesionActual } from '../sesion-servidor';
import { ErrorConsulta, LIMITES_CONSULTA, validar } from './modelo';
import { RepositorioConsultas } from './repositorio';
export const CABECERAS_CONSULTA = { 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export function mismoOrigenConsulta(req: Request) { const origen = req.headers.get('origin'); if (!origen || origen !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')
    throw new ErrorConsulta('ORIGEN', 'La petición debe proceder de esta aplicación.', 403); }
/** Cota de bytes durante la lectura, antes de decodificar o parsear JSON. */
export async function leerJsonConsulta<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
    const tipo = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (tipo !== 'application/json')
        throw new ErrorConsulta('ENTRADA_INVALIDA', 'Envía un cuerpo JSON.', 400);
    const longitud = request.headers.get('content-length');
    if (longitud && (!/^\d+$/.test(longitud) || Number(longitud) > LIMITES_CONSULTA.cuerpo))
        throw new ErrorConsulta('LIMITE', 'La petición supera 16 KiB.', 413);
    const reader = request.body?.getReader();
    if (!reader)
        throw new ErrorConsulta('ENTRADA_INVALIDA', 'Falta el cuerpo JSON.', 400);
    let bytes = 0;
    const trozos: Uint8Array[] = [];
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes += value.byteLength;
            if (bytes > LIMITES_CONSULTA.cuerpo) {
                await reader.cancel();
                throw new ErrorConsulta('LIMITE', 'La petición supera 16 KiB.', 413);
            }
            trozos.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const total = new Uint8Array(bytes);
    let offset = 0;
    for (const t of trozos) {
        total.set(t, offset);
        offset += t.byteLength;
    }
    try {
        return validar(schema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(total)));
    }
    catch (e) {
        if (e instanceof ErrorConsulta)
            throw e;
        throw new ErrorConsulta('ENTRADA_INVALIDA', 'El cuerpo JSON no es válido.', 400);
    }
}
export function errorHttpConsulta(e: unknown): Response { const error = e instanceof ErrorConsulta ? e : new ErrorConsulta('NO_DISPONIBLE', 'La consulta local no está disponible. Conserva tu pregunta y vuelve a intentarlo.', 503); return Response.json({ error: error.message, codigo: error.codigo }, { status: error.status, headers: CABECERAS_CONSULTA }); }
export async function ejecutarHttpConsulta(req: Request, mutacion: boolean, fn: (r: RepositorioConsultas, id: string) => Promise<unknown>) {
    try {
        if (mutacion)
            mismoOrigenConsulta(req);
        const yo = await sesionActual();
        if (!yo)
            throw new ErrorConsulta('IDENTIDAD', 'Sin sesión.', 401);
        if (yo.ficticio || yo.debeCambiarClave)
            throw new ErrorConsulta('IDENTIDAD', 'Se necesita un usuario real con contraseña definitiva.', 403);
        if (!hayConfiguracion())
            throw new ErrorConsulta('NO_DISPONIBLE', 'La consulta local no está disponible.', 503);
        return Response.json(await fn(new RepositorioConsultas(sql), yo.id), { headers: CABECERAS_CONSULTA });
    }
    catch (e) {
        return errorHttpConsulta(e);
    }
}
export const paginaConsultaSchema = z.object({ cursor: z.string().max(300).optional() }).strict();
export const turnosConsultaSchema = z.object({ desde: z.coerce.number().int().min(0).max(100).default(0) }).strict();
