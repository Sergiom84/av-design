import { z } from 'zod';
import { autorizarDocumento, exigir, identidad, seccionesFuente, type Conexion } from './fuentes';
import { candidatoSchema, ErrorRequisito, hash, resultadoExtraccionSchema, uuid, validar } from './modelo';

const opcionesSchema=z.object({proyectoId:uuid}).strict();
/** Primera fase09: no se carga nombre, bytes, extracción.resultado ni decisiones. */
export async function autorizarMetadatosRequisito(db:Conexion,usuarioId:string,documentoId:string,opciones:{proyectoId:string}){
  validar(uuid,documentoId);const o=validar(opcionesSchema,opciones);const u=await identidad(db,usuarioId);const d=await autorizarDocumento(db,u,documentoId);
  if(d.proyectoId!==o.proyectoId)throw new ErrorRequisito('AMBITO','La fuente pertenece a otra obra.',409);
  const [x]=await db`select id,sha256,creado_en from requisitos_extracciones where documento_id=${d.id} order by creado_en desc,id desc limit 1`;
  return {id:d.id,proyectoId:d.proyectoId,version:d.version,sha256:d.sha256,extraccionId:x?.id??null,extraccionSha256:x?.sha256??null,requiere:seccionesFuente(d),observadoEn:x?new Date(x.creado_en).toISOString():d.creadoEn};
}
const lecturaSchema=opcionesSchema.extend({texto:z.boolean(),extraccionId:uuid.optional(),candidatoIds:z.array(uuid).min(1).max(20).refine(ids=>new Set(ids).size===ids.length).optional()}).strict();
export async function leerFuenteRequisito(db:Conexion,usuarioId:string,documentoId:string,opciones:z.infer<typeof lecturaSchema>){
  const o=validar(lecturaSchema,opciones);const meta=await autorizarMetadatosRequisito(db,usuarioId,documentoId,{proyectoId:o.proyectoId});
  const base={...meta,hash:hash(meta),href:`/proyectos/${meta.proyectoId}/requisitos?documento=${documentoId}`,etiqueta:'Documento de requisitos',hechos:[] as Array<{etiqueta:string;valor:string;campo:string;ancla:ReturnType<typeof resultadoExtraccionSchema.parse>['candidatos'][number]['ancla']}>,avisos:[] as string[]};
  if(!o.texto||!o.candidatoIds){if(o.texto)base.avisos.push('Selecciona explícitamente entre uno y veinte fragmentos revisados.');return base;}
  const extraccionId=o.extraccionId??meta.extraccionId;if(!extraccionId)throw new ErrorRequisito('FUENTE','No hay texto extraído consultable.',409);
  // Decisiones ya autorizadas; sólo IDs de candidatos revisados, nunca reconstruir fragmentos de planes.
  const planes=await db`select case p.destino
    when 'areas_bom' then jsonb_path_query_array(p.decisiones,'$.datos.areas[*].candidatoId')||jsonb_path_query_array(p.decisiones,'$.datos.material[*].candidatoId')
    when 'catalogo' then jsonb_path_query_array(p.decisiones,'$.datos.filas[*].candidatoId')
    when 'ofertas' then jsonb_path_query_array(p.decisiones,'$.datos.filas[*].candidatoId')
    else jsonb_build_array(p.decisiones#>>'{datos,candidatoId}') end as candidato_ids
    from requisitos_planes p where p.extraccion_id=${extraccionId} and p.autor_id=${usuarioId} and p.estado<>'purgado' and p.decisiones->>'revisadoPor'=${usuarioId}`;
  const revisados=new Set(planes.flatMap(p=>validar(z.array(uuid).max(500),p.candidato_ids)));
  if(o.candidatoIds.some(id=>!revisados.has(id)))throw new ErrorRequisito('REVISION','Sólo se consultan fragmentos elegidos y revisados.',409);
  await autorizarMetadatosRequisito(db,usuarioId,documentoId,{proyectoId:o.proyectoId});
  const [x]=await db`select e.sha256,e.creado_en,
    (select coalesce(jsonb_agg(c.valor),'[]'::jsonb) from jsonb_array_elements(e.resultado->'candidatos') as c(valor) where c.valor->>'id'=any(${o.candidatoIds}::text[])) as candidatos
    from requisitos_extracciones e where e.id=${extraccionId} and e.documento_id=${documentoId} and e.resultado is not null`;
  if(!x)throw new ErrorRequisito('FUENTE','La extracción ya no está disponible.',409);
  const candidatos=validar(z.array(candidatoSchema).max(20),x.candidatos);
  base.hechos=o.candidatoIds.map(id=>{const c=candidatos.find(c=>c.id===id);if(!c)throw new ErrorRequisito('FUENTE','El fragmento no pertenece a esta extracción.',409);return {etiqueta:`${c.ancla.pagina===null?'Línea '+c.ancla.linea:'Página '+c.ancla.pagina} · ${c.ancla.metodo}`,valor:c.fragmento,campo:`extraccion:${extraccionId}.candidato:${id}`,ancla:c.ancla};});
  base.hash=hash({meta,extraccionId,extraccionSha256:x.sha256,candidatoIds:o.candidatoIds,hechos:base.hechos});
  await autorizarMetadatosRequisito(db,usuarioId,documentoId,{proyectoId:o.proyectoId});return base;
}
export async function listarFuentesRequisito(db:Conexion,usuarioId:string,proyectoId:string){
  validar(uuid,proyectoId);const u=await identidad(db,usuarioId);exigir(u,['proyectos','salas']);
  const ids=await db`select id from requisitos_documentos where autor_id=${usuarioId} and proyecto_id=${proyectoId} and estado='activo' order by creado_en,id limit 100`;
  const fuentes=[];for(const {id} of ids){try{fuentes.push(await autorizarMetadatosRequisito(db,usuarioId,id,{proyectoId}));}catch(e){if(!(e instanceof ErrorRequisito)||e.status===503)throw e;}}
  return fuentes;
}
