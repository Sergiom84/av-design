import type postgres from 'postgres';
import { esRol,esSeccion,esAcceso,resolverPermisos,puede,type Permisos,type Acceso,type Seccion } from '../usuarios';
import { ErrorServicio, id, validar } from './modelo';
export type Conexion = ReturnType<typeof postgres>;
export interface Autor { id:string; nombre:string; permisos:Permisos }
export async function autor(c:Conexion, usuarioId:string):Promise<Autor> {
  validar(id,usuarioId); if(usuarioId==='00000000-0000-0000-0000-000000000000')throw new ErrorServicio('Usa una identidad real.',403);
  const [u]=await c`select id,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${usuarioId}`;
  if(!u||!u.activo)throw new ErrorServicio('Inicia sesión con un usuario activo.',401);
  if(u.debe_cambiar_clave||!esRol(u.rol))throw new ErrorServicio('Usa una contraseña definitiva y un rol vigente.',403);
  const e:Partial<Record<Seccion,Acceso>>={};for(const p of await c`select seccion,acceso from usuario_permisos where usuario_id=${usuarioId}`)if(esSeccion(p.seccion)&&esAcceso(p.acceso))e[p.seccion]=p.acceso;
  const a={id:String(u.id),nombre:String(u.nombre),permisos:resolverPermisos(u.rol,e)}; exigir(a);return a;
}
export function exigir(a:Autor,editar=false,obra=false,catalogo=false) {
  if(!puede(a.permisos,'salas',editar?'editar':'ver')||obra&&!puede(a.permisos,'proyectos',editar?'editar':'ver')||catalogo&&!puede(a.permisos,'catalogo','ver')) throw new ErrorServicio('No tienes permiso para este contexto de servicio.',403);
}
export const veObras=(a:Autor)=>puede(a.permisos,'proyectos','ver');
export const veCatalogo=(a:Autor)=>puede(a.permisos,'catalogo','ver');
export async function contextoSala(c:Conexion,salaId:string){validar(id,salaId);const [s]=await c`select s.id,s.nombre,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id=${salaId}`;if(!s)throw new ErrorServicio('La sala no existe.',404);return {salaId:String(s.id),nombre:String(s.nombre),proyectoId:s.proyecto_id?String(s.proyecto_id):null};}
