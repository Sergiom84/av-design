import { esAcceso, esRol, esSeccion, puede, resolverPermisos, type Acceso, type Permisos, type Rol, type Seccion } from '../usuarios';
import { ErrorCoste, uuid, type ConexionCostes } from './modelo';
export interface AutorCostes { id:string; nombre:string; rol:Rol; permisos:Permisos }
export function tieneCapacidadFinanciera(u: {rol:string; permisos:Permisos}): boolean {
  return u.rol === 'admin' && puede(u.permisos,'usuarios','editar') && puede(u.permisos,'proyectos','ver');
}
export function exigirFinanzas(u: AutorCostes, requisitos:{salas?:boolean;material?:boolean;pedido?:boolean;carga?:boolean;bom?:boolean} = {}) {
  if (!tieneCapacidadFinanciera(u) || requisitos.salas && !puede(u.permisos,'salas','ver') || requisitos.material && (!puede(u.permisos,'almacen','ver') || !puede(u.permisos,'catalogo','ver')) || requisitos.pedido && !puede(u.permisos,'compras','ver') || requisitos.carga && !puede(u.permisos,'carga','ver') || requisitos.bom && ['salas','catalogo','almacen','compras','carga','parametros'].some(s => !puede(u.permisos,s as Seccion,'ver'))) {
    throw new ErrorCoste('PERMISO_DENEGADO','No tienes permiso para este contenido financiero.',403);
  }
}
/** Sólo identidad y ACL actuales antes de cualquier SELECT de tablas privadas. */
export async function autorCostes(c:ConexionCostes,usuarioId:string):Promise<AutorCostes> {
  if (!uuid.safeParse(usuarioId).success || usuarioId === '00000000-0000-0000-0000-000000000000') throw new ErrorCoste('PERMISO_DENEGADO','Usa un usuario real.',403);
  const [u] = await c`select id,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${usuarioId}`;
  if (!u || !u.activo) throw new ErrorCoste('SESION_REQUERIDA','Inicia sesión con un usuario activo.',401);
  if (u.debe_cambiar_clave || !esRol(u.rol)) throw new ErrorCoste('PERMISO_DENEGADO','Se necesita una contraseña definitiva y un rol vigente.',403);
  const cambios:Partial<Record<Seccion,Acceso>>={};
  for (const p of await c`select seccion,acceso from usuario_permisos where usuario_id=${usuarioId}`) if(esSeccion(p.seccion)&&esAcceso(p.acceso)) cambios[p.seccion]=p.acceso;
  const autor={id:String(u.id),nombre:String(u.nombre),rol:u.rol,permisos:resolverPermisos(u.rol,cambios)};
  exigirFinanzas(autor); return autor;
}
