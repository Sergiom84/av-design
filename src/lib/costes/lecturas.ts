import { ErrorCoste, type ConexionCostes, type MovimientoCoste, type ParteCoste, type TarifaCoste, type VersionMaterial } from './modelo';
import { iso } from './servicio';
export function tarifaFila(r:Record<string,unknown>):TarifaCoste {
  return {id:String(r.id),serieId:String(r.serie_id),numero:Number(r.numero),tecnicoId:String(r.tecnico_id),accion:r.accion as TarifaCoste['accion'],desde:String(r.desde),hastaExclusivo:r.hasta_exclusivo===null?null:String(r.hasta_exclusivo),precioHora:String(r.precio_hora),moneda:r.moneda as TarifaCoste['moneda'],calidad:r.calidad as TarifaCoste['calidad'],fuente:String(r.fuente),motivo:String(r.motivo),autorId:String(r.autor_id),creadoEn:iso(r.creado_en)};
}
export async function tarifasActuales(c:ConexionCostes,tecnicoIds:string[]) {
  if(!tecnicoIds.length) return [];
  return (await c`select distinct on(serie_id) id,serie_id,numero,tecnico_id,accion,desde::text,hasta_exclusivo::text,precio_hora::text,moneda,calidad,fuente,motivo,autor_id,creado_en from coste_tarifa_versiones where tecnico_id in ${c(tecnicoIds)} order by serie_id,numero desc`).map(tarifaFila);
}
export async function partesActuales(c:ConexionCostes,ids:string[]):Promise<ParteCoste[]> {
  if(!ids.length) return [];
  const filas=await c`select r.id as registro_id,r.actual_id,r.numero_actual,r.tecnico_id,r.proyecto_id,r.sala_id,r.tarea_id,v.inicio_utc,v.fin_utc,v.minutos,v.accion,t.titulo,tec.nombre as tecnico_nombre,
    (select l.id from coste_labor_versiones l where l.registro_id=r.id order by numero desc limit 1) as valoracion_id
    from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id join plan_tareas t on t.id=r.tarea_id join tecnicos tec on tec.id=r.tecnico_id where r.id in ${c(ids)} order by r.id`;
  return filas.map(r=>({registroId:String(r.registro_id),versionId:String(r.actual_id),numero:Number(r.numero_actual),tecnicoId:String(r.tecnico_id),proyectoId:String(r.proyecto_id),salaId:r.sala_id?String(r.sala_id):null,tareaId:String(r.tarea_id),inicioUtc:iso(r.inicio_utc),finUtc:iso(r.fin_utc),minutos:Number(r.minutos),accion:String(r.accion),titulo:String(r.titulo),tecnicoNombre:String(r.tecnico_nombre),valoracionActualId:r.valoracion_id?String(r.valoracion_id):null}));
}
export function movimientoFila(r:Record<string,unknown>):MovimientoCoste {
  return {id:String(r.id),articuloId:String(r.articulo_id),descripcion:String(r.descripcion),unidad:r.unidad as MovimientoCoste['unidad'],tipo:String(r.tipo),cantidad:String(r.cantidad),fecha:iso(r.fecha),salaId:r.sala_id?String(r.sala_id):null,proyectoActualId:r.proyecto_id?String(r.proyecto_id):null,ubicacionId:r.ubicacion_id?String(r.ubicacion_id):null,motivo:r.motivo===null?null:String(r.motivo),quien:r.quien===null?null:String(r.quien)};
}
export async function movimientosPorId(c:ConexionCostes,ids:string[]):Promise<MovimientoCoste[]> {
  if(!ids.length) return [];
  return (await c`select m.id,m.articulo_id,coalesce(a.descripcion,a.modelo) as descripcion,a.unidad::text,m.tipo::text,m.cantidad::text,m.fecha,m.sala_id,l.proyecto_id,m.ubicacion_id,m.motivo,m.quien from movimientos m join articulos a on a.id=m.articulo_id left join salas s on s.id=m.sala_id left join localizaciones l on l.id=s.localizacion_id where m.id in ${c(ids)} order by m.id`).map(movimientoFila);
}
export function materialFila(r:Record<string,unknown>):VersionMaterial {
  return {id:String(r.id),apunteId:String(r.apunte_id),numero:Number(r.numero),antecedenteId:r.antecedente_id?String(r.antecedente_id):null,movimientoId:String(r.movimiento_id),proyectoId:String(r.proyecto_id),salaId:r.sala_id?String(r.sala_id):null,tareaId:r.tarea_id?String(r.tarea_id):null,accion:String(r.accion),cantidad:String(r.cantidad),unidad:r.unidad as VersionMaterial['unidad'],tipoHecho:r.tipo_hecho as VersionMaterial['tipoHecho'],signo:Number(r.signo) as 1|-1,movimientoSnapshot:r.movimiento_snapshot as MovimientoCoste,movimientoSha256:String(r.movimiento_sha256),precioUnitario:r.precio_unitario===null?null:String(r.precio_unitario),moneda:r.moneda as VersionMaterial['moneda'],calidad:r.calidad as VersionMaterial['calidad'],importeMinor:r.importe_minor===null?null:String(r.importe_minor),origenSalidaVersionId:r.origen_salida_version_id?String(r.origen_salida_version_id):null,origenDevolucionVersionId:r.origen_devolucion_version_id?String(r.origen_devolucion_version_id):null,linaje:r.linaje as VersionMaterial['linaje'],evidencia:r.evidencia as VersionMaterial['evidencia'],motivo:String(r.motivo),autorId:String(r.autor_id),creadoEn:iso(r.creado_en)};
}
export async function versionesMaterial(c:ConexionCostes,versiones:string[],apuntes:string[]=[],opciones:{historial?:boolean;limite?:number;offset?:number}={}) {
  if(!versiones.length&&!apuntes.length) return [];
  const filtroV=versiones.length?c`v.id in ${c(versiones)}`:c`false`;
  const filtroA=apuntes.length?c`a.id in ${c(apuntes)} and ${opciones.historial?c`true`:c`not exists(select 1 from coste_material_versiones posterior where posterior.apunte_id=a.id and posterior.numero>v.numero)`}`:c`false`;
  const paginacion=opciones.limite===undefined?c``:c`limit ${opciones.limite} offset ${opciones.offset??0}`;
  return (await c`select v.id,v.apunte_id,v.numero,v.antecedente_id,a.movimiento_id,a.proyecto_id,a.sala_id,a.tarea_id,v.accion,v.cantidad::text,v.unidad,v.tipo_hecho,v.signo,v.movimiento_snapshot,v.movimiento_sha256,v.precio_unitario::text,v.moneda,v.calidad,v.importe_minor::text,v.origen_salida_version_id,v.origen_devolucion_version_id,v.linaje,v.evidencia,v.motivo,v.autor_id,v.creado_en from coste_material_versiones v join coste_material_apuntes a on a.id=v.apunte_id where (${filtroV} or ${filtroA}) order by a.id,v.numero desc ${paginacion}`).map(materialFila);
}
export async function actualesMaterial(c:ConexionCostes,proyectoId?:string,movimientoIds:string[]=[]) {
  const filtroP=proyectoId?c`a.proyecto_id=${proyectoId}`:c`false`;
  const filtroM=movimientoIds.length?c`a.movimiento_id in ${c(movimientoIds)}`:c`false`;
  const cabeceras=await c`select a.id from coste_material_apuntes a where (${filtroP} or ${filtroM}) order by a.id`;
  const todas=await versionesMaterial(c,[],cabeceras.map(a=>String(a.id)));
  return todas.filter((v,i)=>!todas.slice(0,i).some(a=>a.apunteId===v.apunteId));
}
export async function bloquearContextos(c:ConexionCostes,salas:string[],proyectos:string[],tareas:string[]=[],tecnicos:string[]=[]) {
  const unicos=(ids:string[])=>[...new Set(ids)].sort();
  if(salas.length) await c`select id from salas where id in ${c(unicos(salas))} order by id for update`;
  if(proyectos.length) await c`select id from proyectos where id in ${c(unicos(proyectos))} order by id for update`;
  if(tareas.length) {
    const planes=await c`select distinct plan_id from plan_tareas where id in ${c(unicos(tareas))} order by plan_id`;
    if(planes.length) await c`select id from planes where id in ${c(planes.map(p=>String(p.plan_id)))} order by id for update`;
    await c`select id from plan_tareas where id in ${c(unicos(tareas))} order by id for update`;
  }
  if(tecnicos.length) await c`select id from tecnicos where id in ${c(unicos(tecnicos))} order by id for update`;
}
export async function comprobarAsociacion(c:ConexionCostes,proyectoId:string,salaId:string|null,tareaId:string|null,permitirSalaHistorica=false) {
  const [p]=await c`select id from proyectos where id=${proyectoId}`;
  if(!p) throw new ErrorCoste('NO_ENCONTRADO','La obra no existe.',404);
  if(salaId) {
    const [s]=await c`select l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id=${salaId}`;
    if(!s||s.proyecto_id!==proyectoId&&!permitirSalaHistorica) throw new ErrorCoste('AMBITO_CAMBIADO','La sala seleccionada ya no pertenece a la obra.',409);
  }
  if(tareaId) {
    const [t]=await c`select p.proyecto_id,t.sala_id from plan_tareas t join planes p on p.id=t.plan_id where t.id=${tareaId}`;
    if(!t||t.proyecto_id!==proyectoId||(t.sala_id&&t.sala_id!==salaId)) throw new ErrorCoste('AMBITO_INVALIDO','La tarea no corresponde a esta asociación.',422);
  }
}
