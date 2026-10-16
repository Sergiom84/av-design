import { cabecera,metaRevision,eventosRevision,publicacion,type Cabecera,type MetaRevision } from '../seguimiento-propuestas/repositorio';
import { derivarEstado } from '../seguimiento-propuestas/estados';
import { leerRevision } from '../propuestas/repositorio';
import { leerCorteParaPropuesta } from '../costes/adaptador-propuestas';
import { exigirResultado,type Conexion,type Identidad } from './autorizacion';
import { ErrorResultado,hash,type Aprobacion,type SeleccionResultado } from './modelo';
export async function contexto(c:Conexion,u:Identidad,propuestaId:string,revisionId?:string,editar=false){
 exigirResultado(u,editar);
 const p=await cabecera(c,u,propuestaId,editar),r=await metaRevision(c,u,p,revisionId,editar);
 await publicacion(c,p.id,r.id);
 const eventos=await eventosRevision(c,p.id,r.id),estado=derivarEstado(eventos),ultimo=eventos.at(-1);
 const [flujo]=await c`select version,ultimo_evento_id from propuesta_seguimientos where revision_id=${r.id}`;
 if((flujo?.version??0)!==eventos.length||(flujo?.ultimo_evento_id??null)!==(ultimo?.id??null)||eventos.some(e=>e.revisionHash!==r.sha256))throw new ErrorResultado('El seguimiento de la revisión es inconsistente.',503);
 return {p,r,eventos,estado,ultimo,versionSeguimiento:eventos.length};
}
export async function aprobarFuente(c:Conexion,u:Identidad,p:Cabecera,r:MetaRevision,aceptacionId:string):Promise<Aprobacion>{
 exigirResultado(u);
 const revision=await leerRevision(c,u,p,r.id),v=revision.valoracion;
 const salas=await c`select s.id,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${c(r.salas.map(s=>s.id))} order by s.id`;
 if(salas.length!==r.salas.length)throw new ErrorResultado('Una sala de la fuente ya no existe.',409);
 const proyectos=[...new Set(salas.map(s=>s.proyecto_id as string|null))];
 const proyectoId=r.ambito_fuente.tipo==='obra'?r.ambito_fuente.id:proyectos.length===1?proyectos[0]:null;
 if(r.ambito_fuente.tipo==='obra'&&salas.some(s=>s.proyecto_id!==proyectoId))throw new ErrorResultado('Las salas ya no pertenecen a la obra aprobada.',409);
 const [aceptacion]=await c`select creado_en from propuesta_eventos where id=${aceptacionId} and propuesta_id=${p.id} and revision_id=${r.id} and tipo='aceptar' and revision_sha256=${r.sha256}`;
 if(!aceptacion)throw new ErrorResultado('Selecciona una aceptación de esta revisión exacta.',409);
 return {propuestaId:p.id,revisionId:r.id,revisionHash:r.sha256,numeroRevision:r.numero,aceptacionId,fechaAceptacion:new Date(aceptacion.creado_en).toISOString(),valoracionHash:v?hash(v):null,proyectoId,salaIds:r.salas.map(s=>s.id).sort(),base:Object.fromEntries(Object.entries(v?.totales??{}).map(([m,t])=>[m,t.base])),impuesto:Object.fromEntries(Object.entries(v?.totales??{}).map(([m,t])=>[m,t.impuesto])),bruto:Object.fromEntries(Object.entries(v?.totales??{}).map(([m,t])=>[m,t.total]))};
}
/** No consulta tablas05 directamente. El adaptador conserva ACL, integridad y vigencia05. */
export async function corteAutorizado(c:Conexion,u:Identidad,id:string){exigirResultado(u);return leerCorteParaPropuesta(c,u.id,id);}
export function comprobarActual(x:Awaited<ReturnType<typeof contexto>>,s:SeleccionResultado){
 if(x.p.actual_revision_id!==s.revisionId||x.r.sha256!==s.revisionHash||x.p.version!==s.versionPropuesta||x.p.archivada_en||x.estado!=='aceptada'||x.ultimo?.id!==s.aceptacionId||x.versionSeguimiento!==s.versionSeguimiento)throw new ErrorResultado('La aceptación o la revisión cambió. Conserva tu selección y prepara de nuevo.',409);
}
