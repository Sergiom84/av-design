import { ErrorSeguimiento, LIMITES, estados, validar, uuid, type Estado } from './modelo';
import { ServicioSeguimiento } from './servicio';
export function respuesta(valor: unknown, status = 200) { return Response.json(valor, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export async function cuerpo(req: Request): Promise<unknown> {
    if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? '')) throw new ErrorSeguimiento('Se necesita application/json.', 400);
    const lector = req.body?.getReader(); if (!lector) throw new ErrorSeguimiento('Falta el cuerpo JSON.', 400);
    const partes: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const r = await lector.read(); if (r.done) break; bytes += r.value.length; if (bytes > LIMITES.cuerpo) { await lector.cancel(); throw new ErrorSeguimiento('La solicitud supera 64 KiB.', 413); } partes.push(r.value); } return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(partes))); }
    catch (e) { if (e instanceof ErrorSeguimiento) throw e; throw new ErrorSeguimiento('JSON inválido.', 400); }
    finally { lector.releaseLock(); }
}
export function filtrosUrl(url: URL) {
    const p = url.searchParams, tipo = p.get('tipo'), archivo = p.get('archivo') ?? 'todas', importes = p.get('importes') ?? '0';
    if (importes !== '0' && importes !== '1') throw new ErrorSeguimiento('Filtro de importes inválido.', 400);
    if (tipo !== 'sala' && tipo !== 'obra' && tipo !== 'seleccion') throw new ErrorSeguimiento('Selecciona el ámbito de la cohorte.', 400);
    const ambito = tipo === 'seleccion' ? { tipo, ids: p.getAll('propuesta') } : { tipo, id: p.get('id') };
    return { desde: p.get('desde'), hasta: p.get('hasta'), observadoEn: p.get('observadoEn'), archivo, ambito, importes: importes === '1' };
}
function validarQuery(url: URL, permitidas: string[], repetibles: string[] = []) { for (const clave of url.searchParams.keys()) if (!permitidas.includes(clave) || (!repetibles.includes(clave) && url.searchParams.getAll(clave).length !== 1)) throw new ErrorSeguimiento('Filtro desconocido o duplicado.', 400); }
export async function atenderSeguimiento(req: Request, ruta: 'detalle' | 'opciones' | 'embudo' | 'lista', parametros: { id?: string } = {}) {
    try {
        const { sql, hayConfiguracion } = await import('../db');
        const { sesionActual } = await import('../sesion-servidor');
        if (!hayConfiguracion()) throw new ErrorSeguimiento('Base de datos sin configurar.', 503);
        const sesion = await sesionActual();
        if (!sesion) throw new ErrorSeguimiento('Inicia sesión.', 401);
        if (sesion.ficticio || sesion.debeCambiarClave) throw new ErrorSeguimiento('Se necesita una identidad real con contraseña definitiva.', 403);
        if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin) throw new ErrorSeguimiento('Origen no permitido.', 403);
        const servicio = new ServicioSeguimiento(sql), url = new URL(req.url);
        if (parametros.id) validar(uuid, parametros.id);
        if (ruta === 'detalle' && parametros.id) {
            if (req.method === 'GET') { validarQuery(url, ['revision']); const revision = url.searchParams.get('revision') ?? undefined; if (revision) validar(uuid, revision); return respuesta(await servicio.detalle(sesion.id, parametros.id, revision)); }
            if (req.method === 'POST') { await servicio.autorizarRegistro(sesion.id, parametros.id); validarQuery(url, []); const datos = await cuerpo(req); if (!datos || typeof datos !== 'object' || (datos as { propuestaId?: string }).propuestaId !== parametros.id) throw new ErrorSeguimiento('La propuesta no coincide con la ruta.', 400); return respuesta(await servicio.registrar(sesion.id, datos), 201); }
        }
        if (ruta === 'opciones' && req.method === 'GET') {
            validarQuery(url, ['q', 'pagina', 'capacidad']);
            if (url.searchParams.has('capacidad')) { if (url.searchParams.get('capacidad') !== 'resultados') throw new ErrorSeguimiento('Capacidad desconocida.'); return respuesta(await servicio.capacidadResultados(sesion.id)); }
            const pagina = url.searchParams.get('pagina') ?? '0'; if (!/^\d+$/.test(pagina)) throw new ErrorSeguimiento('Página inválida.');
            return respuesta(await servicio.opcionesPropuestas(sesion.id, url.searchParams.get('q') ?? '', Number(pagina)));
        }
        if ((ruta === 'embudo' || ruta === 'lista') && req.method === 'GET') {
            validarQuery(url, ['tipo', 'id', 'propuesta', 'desde', 'hasta', 'observadoEn', 'archivo', 'importes', 'token', 'etapa', 'cursor', 'compararDesde', 'compararHasta'], ['propuesta']);
            const token = url.searchParams.get('token') ?? undefined, etapa = url.searchParams.get('etapa') ?? undefined, cursor = url.searchParams.get('cursor') ?? undefined;
            if (ruta === 'lista' && !token) throw new ErrorSeguimiento('El detalle requiere token del embudo.', 400);
            if (etapa && !estados.includes(etapa as Estado)) throw new ErrorSeguimiento('Etapa inválida.', 400);
            const compararDesde = url.searchParams.get('compararDesde'), compararHasta = url.searchParams.get('compararHasta'); if (Boolean(compararDesde) !== Boolean(compararHasta)) throw new ErrorSeguimiento('Completa ambas fechas de comparación.', 400);
            return respuesta(await servicio.embudo(sesion.id, filtrosUrl(url), { token, etapa: etapa as Estado | undefined, cursor, ...(compararDesde && compararHasta ? { comparar: { desde: compararDesde, hasta: compararHasta } } : {}) }));
        }
        throw new ErrorSeguimiento('Operación no disponible.', 404);
    } catch (e) {
        if (e instanceof ErrorSeguimiento) return respuesta({ error: e.message }, e.status);
        if (['23505', '40001', '40P01'].includes((e as { code?: string })?.code ?? '')) return respuesta({ error: 'El documento cambió. Conserva el motivo y recarga para comparar.' }, 409);
        return respuesta({ error: 'No se pudo completar el seguimiento. Se conserva el historial.' }, 503);
    }
}
