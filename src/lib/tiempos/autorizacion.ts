import type postgres from 'postgres';
import { esRol, esSeccion, esAcceso, resolverPermisos, puede, type Rol, type Permisos, type Seccion, type Acceso } from '../usuarios';
import { ErrorTiempo, uuidTiempo, type IdentidadTiempos } from './modelo';
export type ConexionTiempos = ReturnType<typeof postgres>;
export interface AutorTiempos { id: string; nombre: string; rol: Rol; permisos: Permisos; tecnicoId: string | null }
export const gestionaTiempos = (u: AutorTiempos) => puede(u.permisos, 'proyectos', 'editar');
export const veSalasTiempo = (u: AutorTiempos) => puede(u.permisos, 'salas', 'ver');
export async function autorTiempos(c: ConexionTiempos, usuarioId: string): Promise<AutorTiempos> {
  if (!uuidTiempo.safeParse(usuarioId).success || usuarioId === '00000000-0000-0000-0000-000000000000') throw new ErrorTiempo('PERMISO_DENEGADO', 'Se necesita una identidad real.', 403);
  const [u] = await c`select id,nombre,rol::text,activo,debe_cambiar_clave,tecnico_id from usuarios where id=${usuarioId}`;
  if (!u || !u.activo) throw new ErrorTiempo('SESION_REQUERIDA', 'Inicia sesión con un usuario activo.', 401);
  if (u.debe_cambiar_clave || !esRol(u.rol)) throw new ErrorTiempo('PERMISO_DENEGADO', 'Se necesita contraseña definitiva y rol vigente.', 403);
  const ajustes: Partial<Record<Seccion, Acceso>> = {};
  for (const p of await c`select seccion,acceso from usuario_permisos where usuario_id=${usuarioId}`) if (esSeccion(p.seccion) && esAcceso(p.acceso)) ajustes[p.seccion] = p.acceso;
  const autor = { id: String(u.id), nombre: String(u.nombre), rol: u.rol, permisos: resolverPermisos(u.rol, ajustes), tecnicoId: u.tecnico_id ? String(u.tecnico_id) : null };
  if (!puede(autor.permisos, 'proyectos', 'ver')) throw new ErrorTiempo('PERMISO_DENEGADO', 'Sin permiso para consultar tiempos.', 403);
  return autor;
}
export function exigirGestorTiempos(u: AutorTiempos) {
  if (!gestionaTiempos(u)) throw new ErrorTiempo('PERMISO_DENEGADO', 'Se necesita permiso de gestión de proyectos.', 403);
}
/** Devuelve sólo la cuenta inequívoca; nunca expone las cuentas del técnico. */
export async function titularDelTecnico(c: ConexionTiempos, tecnicoId: string): Promise<string | null> {
  const filas = await c`select id from usuarios where tecnico_id=${tecnicoId} and activo order by id limit 2`;
  return filas.length === 1 ? String(filas[0].id) : null;
}
export async function identidadTiempos(c: ConexionTiempos, u: AutorTiempos): Promise<IdentidadTiempos> {
  let resuelto = false;
  if (u.tecnicoId) {
    const [t] = await c`select activo from tecnicos where id=${u.tecnicoId}`;
    resuelto = !!t?.activo && await titularDelTecnico(c, u.tecnicoId) === u.id;
  }
  return { usuarioId: u.id, gestionar: gestionaTiempos(u), tecnicoId: resuelto ? u.tecnicoId : null, puedeRegistrar: resuelto && u.rol !== 'lectura', aviso: resuelto ? null : 'VINCULO_TECNICO_NO_RESUELTO', alcance: [u.id, u.rol, u.permisos.proyectos, u.permisos.salas, resuelto ? u.tecnicoId : 'sin-vinculo'].join(':') };
}
export async function exigirPropioTiempos(c: ConexionTiempos, u: AutorTiempos, tecnicoId: string) {
  if (u.rol === 'lectura') throw new ErrorTiempo('PERMISO_DENEGADO', 'El rol de lectura sólo consulta tiempos.', 403);
  const identidad = await identidadTiempos(c, u);
  if (!identidad.puedeRegistrar || identidad.tecnicoId !== tecnicoId) throw new ErrorTiempo('VINCULO_TECNICO_NO_RESUELTO', 'El vínculo con el técnico debe resolverse desde administración. Acude al gestor.', 403);
}
