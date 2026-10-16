import { z } from 'zod';
import { sesionActual } from '../sesion-servidor';
import { sql } from '../db';
import { mismoOrigen } from '../catalogo-tecnico';
import { entrada, configuracionSchema, calendarioSchema, identificador, uuid, LIMITES, ErrorInforme, errorSeguro } from './modelo';
import { RepositorioInformes } from './repositorio';
const nombre = z.string().trim().min(1).max(120);
const version = z.number().int().nonnegative();
const vista = z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/), creadaEn: z.string() }).strict();
const definicion = z.object({ nombre, configuracion: configuracionSchema }).strict();
const patch = definicion.extend({ version, archivada: z.boolean().optional() }).strict();
const grupo = z.object({ nombre, configuracion: configuracionSchema, miembros: z.array(uuid).max(100).refine(a => new Set(a).size === a.length) }).strict();
async function cuerpo(req: Request) {
    if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? ''))
        throw new ErrorInforme('ENTRADA_INVALIDA', 'El cuerpo debe usar application/json.');
    const reader = req.body?.getReader();
    if (!reader)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Falta el cuerpo JSON.');
    let n = 0;
    const trozos: Uint8Array[] = [];
    try {
        while (true) {
            const r = await reader.read();
            if (r.done)
                break;
            n += r.value.length;
            if (n > LIMITES.cuerpo) {
                await reader.cancel();
                throw new ErrorInforme('LIMITE_EXCEDIDO', 'La petición supera dieciséis KiB.', 413);
            }
            trozos.push(r.value);
        }
        const total = new Uint8Array(n);
        let inicio = 0;
        for (const t of trozos) {
            total.set(t, inicio);
            inicio += t.length;
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(total));
    }
    catch (error) {
        if (error instanceof ErrorInforme)
            throw error;
        throw new ErrorInforme('ENTRADA_INVALIDA', 'El cuerpo debe ser JSON válido.');
    }
    finally {
        reader.releaseLock();
    }
}
function json(valor: unknown, status = 200) {
    return Response.json(valor, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export async function atenderInforme(req: Request, ruta: string, parametros: Record<string, string> = {}) {
    try {
        const sesion = await sesionActual();
        if (!sesion)
            throw new ErrorInforme('USUARIO_NO_DISPONIBLE', 'Se necesita iniciar sesión.', 401);
        if (sesion.ficticio || sesion.debeCambiarClave)
            throw new ErrorInforme('USUARIO_NO_DISPONIBLE', 'Se necesita un usuario real con contraseña propia.', 403);
        if (req.method !== 'GET' && !mismoOrigen(req))
            throw new ErrorInforme('PERMISO_RETIRADO', 'Origen no permitido.', 403);
        const repo = new RepositorioInformes(sql);
        await repo.identidad(sesion.id);
        const usuarioId = sesion.id;
        for (const [clave, valor] of Object.entries(parametros))
            if (!(clave === 'archivoId' && valor === 'manifiesto'))
                identificador(valor);
        const id = parametros.id;
        if (ruta === 'definiciones' && req.method === 'GET')
            return json({ definiciones: await repo.definiciones(usuarioId) });
        if (ruta === 'definiciones' && req.method === 'POST') {
            const b = entrada(definicion, await cuerpo(req));
            return json(await repo.guardarDefinicion(usuarioId, b.nombre, b.configuracion), 201);
        }
        if (ruta === 'previa' && req.method === 'POST') {
            const b = entrada(z.object({ configuracion: configuracionSchema, calendario: calendarioSchema.optional() }).strict(), await cuerpo(req));
            return json(await repo.vistaPrevia(usuarioId, b.configuracion, undefined, b.calendario));
        }
        if (ruta === 'definicion' && req.method === 'GET')
            return json(await repo.propia(id, usuarioId));
        if (ruta === 'definicion' && req.method === 'PATCH') {
            const b = entrada(patch, await cuerpo(req));
            return json(await repo.guardarDefinicion(usuarioId, b.nombre, b.configuracion, id, b.version, b.archivada ?? false));
        }
        if (ruta === 'ejecutar' && req.method === 'POST') {
            const b = entrada(z.object({ version, vistaPrevia: vista, clavePeticion: uuid }).strict(), await cuerpo(req));
            const e = await repo.encolar(usuarioId, id, b.version, b.vistaPrevia, b.clavePeticion);
            return json({ id: e.id, estado: e.estado }, 202);
        }
        if (ruta === 'programaciones' && req.method === 'GET')
            return json({ programaciones: await repo.programaciones(id, usuarioId) });
        if (ruta === 'programaciones' && req.method === 'POST') {
            const b = entrada(z.object({ versionDefinicion: version, calendario: calendarioSchema }).strict(), await cuerpo(req));
            return json(await repo.guardarProgramacion(usuarioId, id, b.versionDefinicion, b.calendario), 201);
        }
        if (ruta === 'programacion' && req.method === 'PATCH') {
            const b = entrada(z.object({ version, activa: z.boolean(), calendario: calendarioSchema.optional() }).strict(), await cuerpo(req));
            return json(await repo.modificarProgramacion(usuarioId, id, b.version, b.activa, b.calendario));
        }
        if (ruta === 'ejecuciones' && req.method === 'GET') {
            const cursor = new URL(req.url).searchParams.get('cursor') ?? undefined;
            return json({ ...await repo.historial(usuarioId, cursor), ultimosCorrectos: await repo.ultimosCorrectos(usuarioId) });
        }
        if (ruta === 'ejecucion' && req.method === 'GET')
            return json(await repo.resultado(id, usuarioId));
        if (ruta === 'ejecucion' && req.method === 'POST') {
            const b = entrada(z.object({ estado: z.string(), intento: version }).strict(), await cuerpo(req));
            return json(await repo.revocar(id, usuarioId, b.estado, b.intento));
        }
        if (ruta === 'reintentar' && req.method === 'POST') {
            const b = entrada(z.object({ estado: z.string(), intento: version }).strict(), await cuerpo(req));
            return json(await repo.reintentar(id, usuarioId, b.estado, b.intento), 202);
        }
        if (ruta === 'archivo' && req.method === 'GET') {
            const a = await repo.descargar(id, parametros.archivoId, usuarioId);
            return new Response(new Uint8Array(a.contenido), { headers: { 'Content-Type': a.mime, 'Content-Length': String(a.contenido.length), 'Content-Disposition': `attachment; filename="${a.nombre}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-AV-Revision': a.revision, 'X-AV-SHA256': a.sha256 } });
        }
        if (ruta === 'grupos' && req.method === 'GET')
            return json({ grupos: await repo.grupos(usuarioId) });
        if (ruta === 'grupo' && req.method === 'GET') {
            const g = (await repo.grupos(usuarioId)).find(g => g.id === id);
            if (!g)
                throw new ErrorInforme('NO_ENCONTRADO', 'Grupo no encontrado.', 404);
            return json(g);
        }
        if (ruta === 'grupos' && req.method === 'POST') {
            const b = entrada(grupo, await cuerpo(req));
            return json(await repo.guardarGrupo(usuarioId, b.nombre, b.configuracion, b.miembros), 201);
        }
        if (ruta === 'grupo' && req.method === 'PATCH') {
            const b = entrada(grupo.extend({ version, activo: z.boolean() }).strict(), await cuerpo(req));
            return json(await repo.guardarGrupo(usuarioId, b.nombre, b.configuracion, b.miembros, id, b.version, b.activo));
        }
        if (ruta === 'destinatarios' && req.method === 'GET') {
            const url = new URL(req.url), config = url.searchParams.get('configuracion');
            let c: unknown;
            try {
                c = JSON.parse(config ?? 'null');
            }
            catch {
                throw new ErrorInforme('ENTRADA_INVALIDA', 'Configuración inválida.');
            }
            const busqueda = url.searchParams.get('q') ?? '';
            if (busqueda.length > 100 || String(config).length > 16384)
                throw new ErrorInforme('LIMITE_EXCEDIDO', 'Búsqueda demasiado larga.', 413);
            return json({ destinatarios: await repo.destinatarios(usuarioId, entrada(configuracionSchema, c), busqueda) });
        }
        if (ruta === 'runner' && req.method === 'GET')
            return json(await repo.estadoRunner(usuarioId));
        throw new ErrorInforme('NO_ENCONTRADO', 'Operación no disponible.', 404);
    }
    catch (error) {
        const seguro = errorSeguro(error);
        return json({ error: seguro.message, codigo: seguro.codigo }, seguro.status);
    }
}
