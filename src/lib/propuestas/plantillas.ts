import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { autorizarPlantilla, identidadActual, type ConexionPropuestas } from './autorizacion';
import { ErrorPropuesta, entrada, hash, identificador, seccionesSchema } from './modelo';
import { validarVariables } from './variables';
export const plantillaSchema = z.object({ nombre: z.string().trim().min(1).max(160), secciones: seccionesSchema, activo: z.boolean() }).strict();
export async function listarPlantillas(sql: ConexionPropuestas, usuarioId: string) {
    autorizarPlantilla(await identidadActual(sql, usuarioId));
    const filas = await sql `select id,nombre,version,secciones,activo from propuesta_plantillas order by nombre,id limit 50`;
    return filas.map(f => ({ ...f, hash: hash({ nombre: f.nombre, secciones: f.secciones, version: f.version, activo: f.activo }) }));
}
export async function leerPlantilla(sql: ConexionPropuestas, usuarioId: string, id: string) {
    autorizarPlantilla(await identidadActual(sql, usuarioId));
    identificador(id);
    const [p] = await sql `select id,nombre,version,secciones,activo from propuesta_plantillas where id=${id}`;
    if (!p)
        throw new ErrorPropuesta('Plantilla no encontrada.', 404);
    return { id: String(p.id), nombre: String(p.nombre), version: Number(p.version), secciones: p.secciones as Array<{
            id: string;
            titulo: string;
            texto: string;
        }>, activo: Boolean(p.activo), hash: hash({ nombre: p.nombre, secciones: p.secciones, version: p.version, activo: p.activo }) };
}
export async function guardarPlantilla(sql: ConexionPropuestas, usuarioId: string, datos: unknown, id?: string, version?: number) {
    const e = entrada(plantillaSchema, datos);
    for (const s of e.secciones) {
        validarVariables(s.titulo);
        validarVariables(s.texto);
    }
    // Sólo el esquema textual estricto: ninguna copia del documento completo.
    return sql.begin(async (tx) => {
        const c = tx as unknown as ConexionPropuestas;
        autorizarPlantilla(await identidadActual(c, usuarioId), true);
        if (id) {
            identificador(id);
            const [p] = await c `update propuesta_plantillas set nombre=${e.nombre},secciones=${c.json(e.secciones)},activo=${e.activo},version=version+1,autor_id=${usuarioId},actualizado_en=now() where id=${id} and version=${version ?? -1} returning id,version`;
            if (!p)
                throw new ErrorPropuesta('La plantilla cambió; conserva tus textos y compara.', 409);
            return p;
        }
        const secciones = e.secciones.map(s => ({ ...s, id: randomUUID() }));
        const [p] = await c `insert into propuesta_plantillas(nombre,secciones,activo,autor_id) values(${e.nombre},${c.json(secciones)},${e.activo},${usuarioId}) returning id,version`;
        return p;
    });
}
