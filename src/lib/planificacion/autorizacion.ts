import type postgres from 'postgres';
import { esRol, esAcceso, esSeccion, resolverPermisos, puede, type Permisos, type Acceso, type Seccion } from '../usuarios';
import { ErrorPlan, uuidPlan } from './modelo';
export type ConexionPlan = ReturnType<typeof postgres>;
export interface AutorPlan {
    id: string;
    nombre: string;
    permisos: Permisos;
}
export async function autorPlan(c: ConexionPlan, usuarioId: string): Promise<AutorPlan> {
    if (!uuidPlan.safeParse(usuarioId).success || usuarioId === '00000000-0000-0000-0000-000000000000')
        throw new ErrorPlan('SESION_REQUERIDA', 'Se necesita un usuario real.', 403);
    const [u] = await c `select id,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${usuarioId}`;
    if (!u || !u.activo)
        throw new ErrorPlan('SESION_REQUERIDA', 'Inicia sesión con un usuario activo.', 401);
    if (u.debe_cambiar_clave || !esRol(u.rol))
        throw new ErrorPlan('PERMISO_DENEGADO', 'Se necesita una contraseña definitiva y un rol vigente.', 403);
    const excepciones: Partial<Record<Seccion, Acceso>> = {};
    for (const f of await c `select seccion,acceso from usuario_permisos where usuario_id=${usuarioId}`)
        if (esSeccion(f.seccion) && esAcceso(f.acceso))
            excepciones[f.seccion] = f.acceso;
    const autor = { id: String(u.id), nombre: String(u.nombre), permisos: resolverPermisos(u.rol, excepciones) };
    exigirPlan(autor);
    return autor;
}
export function exigirPlan(u: AutorPlan, editar = false, salas = false, catalogo = false) {
    if (!puede(u.permisos, 'proyectos', editar ? 'editar' : 'ver') || salas && !puede(u.permisos, 'salas', 'ver') || catalogo && !puede(u.permisos, 'catalogo', 'ver'))
        throw new ErrorPlan('PERMISO_DENEGADO', 'No tienes permiso para este contenido de planificación.', 403);
}
export const veSalas = (u: AutorPlan) => puede(u.permisos, 'salas', 'ver');
export const veCatalogo = (u: AutorPlan) => puede(u.permisos, 'catalogo', 'ver');
