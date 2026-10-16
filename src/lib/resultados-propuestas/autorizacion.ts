import { identidadActual, exigir, autorizarAmbito, type Conexion, type Identidad } from '../seguimiento-propuestas/autorizacion';
import { ErrorResultado } from './modelo';
export type { Conexion, Identidad };
/** La política se evalúa antes de cualquier consulta financiera07/05/06. */
export function exigirResultado(u:Identidad,editar=false,tipo?:'sala'|'obra'){
 if(u.rol!=='admin')throw new ErrorResultado('Sólo administración puede consultar resultados financieros.',403);
 for(const s of ['usuarios','proyectos','salas','compras','catalogo','almacen'] as const)exigir(u,s,s==='usuarios'?'editar':s==='compras'&&editar?'editar':'ver');
 if(tipo)autorizarAmbito(u,tipo,editar);
}
export async function autorResultado(c:Conexion,id:string,editar=false){const u=await identidadActual(c,id);exigirResultado(u,editar);return u;}
