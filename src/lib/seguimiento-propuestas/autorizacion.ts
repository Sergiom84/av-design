import type postgres from 'postgres';
import { puede, esRol, esSeccion, esAcceso, resolverPermisos, type Permisos, type Seccion, type Acceso, type Rol } from '../usuarios';
import { ErrorSeguimiento, identificador, type Filtros } from './modelo';
export type Conexion = ReturnType<typeof postgres>;
export interface Identidad { id: string; nombre: string; rol: Rol; permisos: Permisos; }
export async function identidadActual(c: Conexion, id: string): Promise<Identidad> {
    identificador(id);
    const [u] = await c`select id,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${id}`;
    if (!u || !u.activo) throw new ErrorSeguimiento('Se necesita una identidad activa.', 401);
    if (u.debe_cambiar_clave || !esRol(u.rol) || id === '00000000-0000-0000-0000-000000000000') throw new ErrorSeguimiento('Se necesita una identidad real con contraseña definitiva.', 403);
    const ajustes: Partial<Record<Seccion, Acceso>> = {};
    for (const a of await c`select seccion,acceso from usuario_permisos where usuario_id=${id}`) if (esSeccion(a.seccion) && esAcceso(a.acceso)) ajustes[a.seccion] = a.acceso;
    return { id: u.id, nombre: u.nombre, rol: u.rol, permisos: resolverPermisos(u.rol, ajustes) };
}
export function exigir(u: Identidad, seccion: Seccion, acceso: Acceso = 'ver') { if (!puede(u.permisos, seccion, acceso)) throw new ErrorSeguimiento('No tienes permiso para el seguimiento o sus fuentes.', 403); }
export function autorizarAmbito(u: Identidad, tipo: 'sala' | 'obra', editar = false) { exigir(u, 'salas', tipo === 'sala' && editar ? 'editar' : 'ver'); if (tipo === 'obra') exigir(u, 'proyectos', editar ? 'editar' : 'ver'); }
export function autorizarFiltros(u: Identidad, f: Filtros) { exigir(u, 'salas'); if (f.ambito.tipo === 'obra') exigir(u, 'proyectos'); if (f.importes) exigir(u, 'compras'); }
export function exigirFinanzas(u: Identidad) { if (u.rol !== 'admin') throw new ErrorSeguimiento('Sólo administración puede consultar resultados financieros.', 403); for (const s of ['usuarios', 'proyectos', 'salas', 'compras', 'catalogo', 'almacen'] as const) exigir(u, s, s === 'usuarios' ? 'editar' : 'ver'); }
