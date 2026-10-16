import { z } from 'zod';
import { sql, hayConfiguracion } from '../db';
import { sesionActual } from '../sesion-servidor';
import { ServicioPropuestas } from './servicio';
import { ErrorPropuesta, entrada, identificador, entradaSchema, baseSchema, previaSchema, uuid, LIMITES } from './modelo';
import { identidadActual, exigir } from './autorizacion';
import { listarPropuestas, obtenerPropuesta, historialPropuesta, descargarPdf, opcionesContexto } from './repositorio';
import { listarPlantillas, leerPlantilla, guardarPlantilla, plantillaSchema } from './plantillas';
import { precioCatalogo } from './valoracion';
const preparacion = z.object({ entrada: entradaSchema, base: baseSchema, propuestaId: uuid.nullable(), fuenteRevisada: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const publicacion = preparacion.omit({ propuestaId: true, fuenteRevisada: true }).extend({ previa: previaSchema, clavePeticion: uuid }).strict();
function json(valor: unknown, status = 200) { return Response.json(valor, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export async function cuerpo(req: Request) {
    if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? ''))
        throw new ErrorPropuesta('Se necesita application/json.', 400);
    const lector = req.body?.getReader();
    if (!lector)
        throw new ErrorPropuesta('Falta el cuerpo JSON.', 400);
    const partes: Uint8Array[] = [];
    let bytes = 0;
    try {
        while (true) {
            const r = await lector.read();
            if (r.done)
                break;
            bytes += r.value.length;
            if (bytes > LIMITES.cuerpo) {
                await lector.cancel();
                throw new ErrorPropuesta('La solicitud supera 128 KiB.', 413);
            }
            partes.push(r.value);
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(partes)));
    }
    catch (error) {
        if (error instanceof ErrorPropuesta)
            throw error;
        throw new ErrorPropuesta('JSON inválido.', 400);
    }
    finally {
        lector.releaseLock();
    }
}
export async function atenderPropuesta(req: Request, ruta: string, parametros: Record<string, string> = {}) {
    try {
        if (!hayConfiguracion())
            throw new ErrorPropuesta('Base de datos sin configurar.', 503);
        const sesion = await sesionActual();
        if (!sesion)
            throw new ErrorPropuesta('Inicia sesión.', 401);
        if (sesion.ficticio || sesion.debeCambiarClave)
            throw new ErrorPropuesta('Se necesita una identidad real con contraseña definitiva.', 403);
        if (req.method !== 'GET' && req.headers.get('origin') !== new URL(req.url).origin)
            throw new ErrorPropuesta('Origen no permitido.', 403);
        const u = await identidadActual(sql, sesion.id), servicio = new ServicioPropuestas(sql);
        for (const valor of Object.values(parametros))
            identificador(valor);
        const id = parametros.id, url = new URL(req.url);
        if (ruta === 'lista' && req.method === 'GET') {
            const tipo = url.searchParams.get('tipo'), contexto = url.searchParams.get('id');
            if ((tipo !== 'sala' && tipo !== 'obra') || !contexto)
                throw new ErrorPropuesta('Indica el ámbito.', 400);
            identificador(contexto);
            return json({ propuestas: await listarPropuestas(sql, u.id, { tipo, id: contexto }), contexto: await opcionesContexto(sql, u.id, tipo, contexto, { q: url.searchParams.get('q') ?? '', pagina: Number(url.searchParams.get('pagina') ?? 0), seleccionadas: url.searchParams.getAll('sala'), revisionIds: url.searchParams.getAll('revision') }) });
        }
        if (ruta === 'preparar' && req.method === 'POST') {
            const b = entrada(preparacion, await cuerpo(req));
            return json(await servicio.preparar(u.id, b.entrada, b.propuestaId, b.base, b.fuenteRevisada));
        }
        if ((ruta === 'lista' || ruta === 'detalle') && req.method === 'POST') {
            const b = entrada(publicacion, await cuerpo(req));
            return json(await servicio.publicar(u.id, b.entrada, b.previa, b.base, b.clavePeticion, id ?? null), 201);
        }
        if (ruta === 'detalle' && req.method === 'GET')
            return json(await obtenerPropuesta(sql, u.id, id));
        if (ruta === 'detalle' && req.method === 'PATCH') {
            const b = entrada(z.object({ version: z.number().int().nonnegative(), archivada: z.boolean(), motivo: z.string().trim().min(1).max(500), clavePeticion: uuid }).strict(), await cuerpo(req));
            return json(await servicio.archivar(u.id, id, b.version, b.archivada, b.motivo, b.clavePeticion));
        }
        if (ruta === 'actualizar' && req.method === 'POST') {
            const b = entrada(z.object({ entrada: entradaSchema, base: baseSchema }).strict(), await cuerpo(req));
            return json(await servicio.actualizarFuente(u.id, id, b.entrada, b.base));
        }
        if (ruta === 'historial' && req.method === 'GET')
            return json({ revisiones: await historialPropuesta(sql, u.id, id) });
        if (ruta === 'revision' && req.method === 'GET')
            return json(await obtenerPropuesta(sql, u.id, id, parametros.revisionId));
        if (ruta === 'pdf' && req.method === 'GET') {
            const a = await descargarPdf(sql, u.id, id, parametros.revisionId);
            return new Response(new Uint8Array(a.contenido), { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(a.bytes), 'Content-Disposition': `attachment; filename="${a.nombre}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-AV-Revision': a.revision, 'X-AV-SHA256': a.sha256 } });
        }
        if (ruta === 'plantillas' && req.method === 'GET')
            return json({ plantillas: await listarPlantillas(sql, u.id) });
        if (ruta === 'plantilla' && req.method === 'GET')
            return json(await leerPlantilla(sql, u.id, id));
        if (ruta === 'plantillas' && req.method === 'POST')
            return json(await guardarPlantilla(sql, u.id, await cuerpo(req)), 201);
        if (ruta === 'plantilla' && req.method === 'PATCH') {
            const b = entrada(plantillaSchema.extend({ version: z.number().int().nonnegative() }).strict(), await cuerpo(req));
            const { version, ...datos } = b;
            return json(await guardarPlantilla(sql, u.id, datos, id, version));
        }
        if (ruta === 'precios' && req.method === 'GET') {
            exigir(u, 'compras');
            exigir(u, 'catalogo');
            const articuloId = url.searchParams.get('articuloId');
            if (articuloId) {
                identificador(articuloId);
                return json(await precioCatalogo(sql, u, articuloId, new Date().toISOString()));
            }
            const q = url.searchParams.get('q') ?? '';
            if (q.length < 2 || q.length > 100)
                throw new ErrorPropuesta('Escribe entre dos y cien caracteres.', 400);
            const filas = await sql `select id,marca,modelo,referencia from articulos where activo and concat_ws(' ',marca,modelo,referencia) ilike ${`%${q}%`} order by marca,modelo,id limit 20`;
            return json({ articulos: filas });
        }
        throw new ErrorPropuesta('Operación no disponible.', 404);
    }
    catch (error) {
        if (error instanceof ErrorPropuesta)
            return json({ error: error.message }, error.status);
        if (error instanceof z.ZodError)
            return json({ error: 'Comprueba los campos.' }, 400);
        if (['40001', '40P01', '23505'].includes((error as {
            code?: string;
        })?.code ?? ''))
            return json({ error: 'La propuesta cambió durante la operación. Conserva tu edición y compara.' }, 409);
        return json({ error: 'No se pudo completar la operación. Se conserva la última revisión correcta.' }, 503);
    }
}
