import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sesionActual } from '../sesion-servidor';
import { sql, hayConfiguracion } from '../db';
import { mismoOrigen } from '../catalogo-tecnico';
import { RepositorioPlanificacion } from './repositorio';
import { ErrorPlan, LIMITES_PLAN, entradaPlan, uuidPlan, versionPlan, motivoPlan, listaIds, filtroAgendaSchema, trabajoSchema, reglaSchema } from './modelo';
const grupoSchema = z.object({ nombre: z.string().trim().min(1).max(120), miembros: listaIds(100), activo: z.boolean().default(true), versionPlan, clavePeticion: uuidPlan, version: versionPlan.optional() }).strict();
const planSchema = z.object({ versionPlan, clavePeticion: uuidPlan, notas: z.string().trim().max(2000), archivado: z.boolean(), motivo: motivoPlan.optional() }).strict();
const restaurarSchema = z.object({ versionPlan, versionTarea: versionPlan, clavePeticion: uuidPlan, motivo: motivoPlan, eventoId: uuidPlan }).strict();
async function cuerpoPlan(req: Request) {
    if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? ''))
        throw new ErrorPlan('ENTRADA_INVALIDA', 'La petición debe ser JSON.');
    if (Number(req.headers.get('content-length')) > LIMITES_PLAN.cuerpo)
        throw new ErrorPlan('LIMITE_EXCEDIDO', 'Máximo 64 KiB por petición.', 413);
    const lector = req.body?.getReader();
    if (!lector)
        throw new ErrorPlan('ENTRADA_INVALIDA', 'Falta el cuerpo JSON.');
    const partes: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const r = await lector.read();
            if (r.done)
                break;
            total += r.value.byteLength;
            if (total > LIMITES_PLAN.cuerpo) {
                await lector.cancel();
                throw new ErrorPlan('LIMITE_EXCEDIDO', 'Máximo 64 KiB por petición.', 413);
            }
            partes.push(r.value);
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(partes)));
    }
    catch (e) {
        if (e instanceof ErrorPlan)
            throw e;
        throw new ErrorPlan('ENTRADA_INVALIDA', 'El cuerpo JSON no es válido.');
    }
    finally {
        lector.releaseLock();
    }
}
const respuesta = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export function errorSeguroPlan(e: unknown) {
    if (e instanceof ErrorPlan)
        return e;
    if (e instanceof z.ZodError)
        return new ErrorPlan('ENTRADA_INVALIDA', 'Comprueba los campos de planificación.');
    if (['40001', '40P01', '23505'].includes((e as {
        code?: string;
    })?.code ?? ''))
        return new ErrorPlan('CONFLICTO_CONCURRENCIA', 'Otra operación cambió el plan o su fuente. Revisa de nuevo.', 409);
    return new ErrorPlan('SERVICIO_NO_DISPONIBLE', 'No se pudo completar la operación de planificación. Reintenta sin perder tu edición.', 503);
}
function pagina(url: URL) {
    const p = Number(url.searchParams.get('pagina') ?? 1);
    if (!Number.isInteger(p) || p < 1 || p > 100000)
        throw new ErrorPlan('ENTRADA_INVALIDA', 'Página inválida.');
    return p;
}
export async function atenderPlan(req: Request, ruta: string, params: Record<string, string> = {}) {
    const solicitudId = randomUUID();
    try {
        if (!hayConfiguracion())
            throw new ErrorPlan('SERVICIO_NO_DISPONIBLE', 'La base de datos no está configurada.', 503);
        const sesion = await sesionActual();
        if (!sesion)
            throw new ErrorPlan('SESION_REQUERIDA', 'Inicia sesión.', 401);
        if (sesion.ficticio || sesion.debeCambiarClave)
            throw new ErrorPlan('PERMISO_DENEGADO', 'Usa una identidad real con contraseña definitiva.', 403);
        if (req.method !== 'GET' && !mismoOrigen(req))
            throw new ErrorPlan('ORIGEN_DENEGADO', 'La petición debe proceder de esta aplicación.', 403);
        for (const valor of Object.values(params))
            entradaPlan(uuidPlan, valor);
        const repo = new RepositorioPlanificacion(sql);
        await repo.identidad(sesion.id);
        const usuario = sesion.id, url = new URL(req.url), proyecto = params.proyectoId, id = params.id;
        const envolver = (v: unknown, status = 200) => respuesta({ solicitudId, ...(v && typeof v === 'object' && !Array.isArray(v) ? v : { resultado: v }) }, status);
        if (ruta === 'proyecto' && req.method === 'GET')
            return envolver(await repo.leerPlan(usuario, proyecto));
        if (ruta === 'proyecto' && req.method === 'POST') {
            const b = entradaPlan(z.object({ clavePeticion: uuidPlan }).strict(), await cuerpoPlan(req));
            return envolver(await repo.crearPlan(usuario, proyecto, b.clavePeticion), 201);
        }
        if (ruta === 'proyecto' && req.method === 'PATCH')
            return envolver(await repo.editarPlan(usuario, proyecto, entradaPlan(planSchema, await cuerpoPlan(req))));
        if (ruta === 'preparar' && req.method === 'POST')
            return envolver(await repo.preparar(usuario, proyecto, await cuerpoPlan(req)));
        if (ruta === 'confirmar' && req.method === 'POST')
            return envolver(await repo.confirmar(usuario, proyecto, await cuerpoPlan(req)));
        if (ruta === 'tareas' && req.method === 'GET')
            return envolver(await repo.tareas(usuario, proyecto, pagina(url), url.searchParams.get('estado') ?? undefined));
        if (ruta === 'tareas' && req.method === 'POST')
            return envolver(await repo.crearTarea(usuario, proyecto, await cuerpoPlan(req)), 201);
        if (ruta === 'tarea' && req.method === 'GET')
            return envolver(await repo.tarea(usuario, id));
        if (ruta === 'tarea' && req.method === 'PATCH')
            return envolver(await repo.editarTarea(usuario, id, await cuerpoPlan(req)));
        if (ruta === 'asignaciones' && req.method === 'PUT')
            return envolver(await repo.asignar(usuario, id, await cuerpoPlan(req)));
        if (ruta === 'historial' && req.method === 'GET')
            return envolver({ eventos: await repo.historial(usuario, id, pagina(url)) });
        if (ruta === 'historial' && req.method === 'POST')
            return envolver(await repo.restaurar(usuario, id, entradaPlan(restaurarSchema, await cuerpoPlan(req))));
        if (ruta === 'catalogo' && req.method === 'GET') {
            const modo = url.searchParams.get('modo') ?? 'busqueda';
            if (!['busqueda', 'administracion'].includes(modo))
                throw new ErrorPlan('ENTRADA_INVALIDA', 'Modo de catálogo inválido.');
            return envolver({ trabajos: await repo.catalogo(usuario, url.searchParams.get('q') ?? '', pagina(url), modo === 'administracion') });
        }
        if (ruta === 'catalogo' && req.method === 'POST')
            return envolver(await repo.guardarTrabajo(usuario, await cuerpoPlan(req)), 201);
        if (ruta === 'trabajo' && req.method === 'GET')
            return envolver(await repo.trabajo(usuario, id));
        if (ruta === 'trabajo' && req.method === 'PATCH') {
            const b = entradaPlan(trabajoSchema.extend({ version: versionPlan }).strict(), await cuerpoPlan(req));
            const { version, ...valor } = b;
            entradaPlan(versionPlan, version);
            return envolver(await repo.guardarTrabajo(usuario, valor, id, Number(version)));
        }
        if (ruta === 'reglas' && req.method === 'GET')
            return envolver({ reglas: await repo.reglas(usuario, pagina(url)) });
        if (ruta === 'reglas' && req.method === 'POST')
            return envolver(await repo.guardarRegla(usuario, await cuerpoPlan(req)), 201);
        if (ruta === 'regla' && req.method === 'GET')
            return envolver(await repo.regla(usuario, id));
        if (ruta === 'regla' && req.method === 'PATCH') {
            const b = entradaPlan(reglaSchema.extend({ version: versionPlan }).strict(), await cuerpoPlan(req));
            const { version, ...valor } = b;
            entradaPlan(versionPlan, version);
            return envolver(await repo.guardarRegla(usuario, valor, id, Number(version)));
        }
        if (ruta === 'grupos' && req.method === 'GET')
            return envolver({ grupos: await repo.grupos(usuario, proyecto) });
        if (ruta === 'grupos' && req.method === 'POST')
            return envolver(await repo.guardarGrupo(usuario, proyecto, entradaPlan(grupoSchema, await cuerpoPlan(req))), 201);
        if (ruta === 'grupo' && req.method === 'GET') {
            const obra = await repo.proyectoDeGrupo(usuario, id);
            return envolver((await repo.grupos(usuario, obra)).find(g => g.id === id));
        }
        if (ruta === 'grupo' && req.method === 'PATCH') {
            const obra = await repo.proyectoDeGrupo(usuario, id);
            return envolver(await repo.guardarGrupo(usuario, obra, entradaPlan(grupoSchema, await cuerpoPlan(req)), id));
        }
        if (ruta === 'tecnicos' && req.method === 'GET')
            return envolver({ tecnicos: await repo.tecnicos(usuario, url.searchParams.get('q') ?? '', url.searchParams.get('tareaId') ?? undefined) });
        if (ruta === 'agenda' && req.method === 'GET') {
            const bruto = Object.fromEntries(url.searchParams);
            const filtro = entradaPlan(filtroAgendaSchema, { ...bruto, historial: bruto.historial === '1' });
            return envolver(await repo.agenda(usuario, filtro, new Date()));
        }
        throw new ErrorPlan('NO_ENCONTRADO', 'Operación no disponible.', 404);
    }
    catch (e) {
        const error = errorSeguroPlan(e);
        return respuesta({ solicitudId, error: error.message, codigo: error.codigo, ...(error.detalle ? { detalle: error.detalle } : {}) }, error.status);
    }
}
