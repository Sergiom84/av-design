import type postgres from 'postgres';
import { puede, esRol, esSeccion, esAcceso, resolverPermisos, type Permisos, type Seccion, type Acceso } from '../usuarios';
import { ErrorPropuesta, identificador, type Ambito } from './modelo';
export type ConexionPropuestas = ReturnType<typeof postgres>;
export interface IdentidadPropuesta {
    id: string;
    nombre: string;
    permisos: Permisos;
}
export async function identidadActual(sql: ConexionPropuestas, id: string): Promise<IdentidadPropuesta> {
    identificador(id);
    const [u] = await sql `select id,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${id}`;
    if (!u || !u.activo)
        throw new ErrorPropuesta('Se necesita una identidad activa.', 401);
    if (u.debe_cambiar_clave || !esRol(u.rol))
        throw new ErrorPropuesta('Se necesita una identidad con contraseña definitiva.', 403);
    const ajustes: Partial<Record<Seccion, Acceso>> = {};
    for (const f of await sql `select seccion,acceso from usuario_permisos where usuario_id=${id}`) {
        if (esSeccion(f.seccion) && esAcceso(f.acceso))
            ajustes[f.seccion] = f.acceso;
    }
    return { id: u.id, nombre: u.nombre, permisos: resolverPermisos(u.rol, ajustes) };
}
export function exigir(u: IdentidadPropuesta, seccion: Seccion, acceso: Acceso = 'ver'): void {
    if (!puede(u.permisos, seccion, acceso))
        throw new ErrorPropuesta('No tienes permiso para esta operación o sus fuentes.', 403);
}
export function autorizar(u: IdentidadPropuesta, ambito: Ambito, editar = false): void {
    exigir(u, 'salas', ambito.tipo === 'sala' && editar ? 'editar' : 'ver');
    if (ambito.tipo === 'obra')
        exigir(u, 'proyectos', editar ? 'editar' : 'ver');
}
export function autorizarPlantilla(u: IdentidadPropuesta, editar = false): void {
    exigir(u, 'salas');
    if (editar && !puede(u.permisos, 'salas', 'editar') && !puede(u.permisos, 'proyectos', 'editar'))
        throw new ErrorPropuesta('No puedes editar plantillas documentales.', 403);
}
export function autorizarBom(u: IdentidadPropuesta): void {
    for (const s of ['salas', 'proyectos', 'catalogo', 'parametros', 'almacen', 'compras'] as const)
        exigir(u, s);
}
