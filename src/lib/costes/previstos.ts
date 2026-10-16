import { necesidadExportada } from '../necesidad-tecnica';
import { importeMaterialMinor, parsearDecimal } from '../importes';
import { rangoTrabajoMadrid } from '../tiempos/fechas';
import { exigirFinanzas, type AutorCostes } from './autorizacion';
import { componente } from './resumen';
import { valorarParte } from './laboral';
import { iso, sha256 } from './servicio';
import { ErrorCoste, LIMITES_COSTES, type AlcanceCoste, type ConexionCostes, type TarifaCoste } from './modelo';
export interface ReservaPrevista { tecnicoId:string; tareaId:string; inicioUtc:string; finUtc:string }
/** Cada técnico aporta la unión temporal, aun cuando haya tareas en conflicto. */
export function unirReservasPorTecnico(filas:ReservaPrevista[],inicio:string,fin:string) {
  const grupos=new Map<string,Array<{inicio:number;fin:number;tareas:string[]}>>();
  for(const f of filas) {
    const a=Math.max(Date.parse(inicio),Date.parse(f.inicioUtc)),b=Math.min(Date.parse(fin),Date.parse(f.finUtc));
    if(b<=a) continue;
    const lista=grupos.get(f.tecnicoId)??[];lista.push({inicio:a,fin:b,tareas:[f.tareaId]});grupos.set(f.tecnicoId,lista);
  }
  return [...grupos].sort(([a],[b])=>a.localeCompare(b)).flatMap(([tecnicoId,lista])=>{
    const unidos:Array<{inicio:number;fin:number;tareas:string[]}>=[];
    for(const r of lista.sort((a,b)=>a.inicio-b.inicio||a.fin-b.fin)) {
      const ultimo=unidos.at(-1);
      if(ultimo&&r.inicio<=ultimo.fin) {ultimo.fin=Math.max(ultimo.fin,r.fin);ultimo.tareas=[...new Set([...ultimo.tareas,...r.tareas])].sort();}
      else unidos.push({...r});
    }
    return unidos.map(r=>({tecnicoId,inicioUtc:new Date(r.inicio).toISOString(),finUtc:new Date(r.fin).toISOString(),minutos:(r.fin-r.inicio)/60000,tareas:r.tareas}));
  });
}
export async function laboralPrevisto(c:ConexionCostes,a:AlcanceCoste,salas:string[],tarifas:TarifaCoste[]) {
  const rango=rangoTrabajoMadrid(a.desde,a.hasta);
  const filtroT=a.tareas===null?c`true`:a.tareas.length?c`t.id in ${c(a.tareas)}`:c`false`;
  const filtroS=a.salas.modo==='todas'?c`true`:salas.length?c`t.sala_id in ${c(salas)}`:c`false`;
  const tareas=await c`select t.id,t.version,t.sala_id,t.estado,t.duracion_estimada_min,t.inicio_utc,t.fin_utc,p.id as plan_id,p.version as version_plan,p.archivado_en from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${a.proyectoId} and ${filtroT} and ${filtroS} order by t.id limit ${LIMITES_COSTES.filasCorte+1}`;
  if(tareas.length>LIMITES_COSTES.filasCorte) throw new ErrorCoste('LIMITE_EXCEDIDO','Reduce el alcance del corte.',413);
  const asignaciones=tareas.length?await c`select tarea_id,tecnico_id,activo from plan_asignaciones where tarea_id in ${c(tareas.map(t=>String(t.id)))} order by tarea_id,tecnico_id`:[];
  const programadas=tareas.filter(t=>t.inicio_utc&&t.fin_utc&&t.estado!=='anulada'&&!t.archivado_en);
  const reservas=programadas.flatMap(t=>asignaciones.filter(r=>r.tarea_id===t.id&&r.activo).map(r=>({tecnicoId:String(r.tecnico_id),tareaId:String(t.id),inicioUtc:iso(t.inicio_utc),finUtc:iso(t.fin_utc)})));
  const unidos=unirReservasPorTecnico(reservas,rango.inicioUtc,rango.finUtcExclusivo);
  const valoraciones=unidos.map((r,i)=>valorarParte({registroId:'previsto-'+i,versionId:sha256(r),numero:1,tecnicoId:r.tecnicoId,proyectoId:a.proyectoId,salaId:null,tareaId:r.tareas[0],inicioUtc:r.inicioUtc,finUtc:r.finUtc,minutos:r.minutos,accion:'previsto',titulo:'Persona-minutos planificados',tecnicoNombre:'',valoracionActualId:null},tarifas));
  const filas=valoraciones.flatMap(v=>v.tramos.map(t=>({importeMinor:t.importeMinor,moneda:t.tarifa?.moneda??null,conocido:!!t.tarifa,desactualizado:false,huecos:t.tarifa?[]:['Intervalo planificado sin tarifa'],minutos:t.minutos,minutosPendientes:t.tarifa?0:t.minutos})));
  const sinIntervalo=tareas.filter(t=>t.estado!=='anulada'&&(!t.inicio_utc||!asignaciones.some(r=>r.tarea_id===t.id&&r.activo)));
  const desconocidos=sinIntervalo.map(()=>({importeMinor:null,moneda:null,conocido:false,desactualizado:false,huecos:['Tarea sin intervalo o técnico; duración estimada separada'],minutos:0,minutosPendientes:0}));
  return {resumen:componente([...filas,...desconocidos]),fuente:{tareas:tareas.map(t=>({...t,inicio_utc:t.inicio_utc?iso(t.inicio_utc):null,fin_utc:t.fin_utc?iso(t.fin_utc):null,archivado_en:t.archivado_en?iso(t.archivado_en):null})),asignaciones,unidos,valoraciones,duracionesEstimadas:tareas.map(t=>({tareaId:t.id,minutos:t.duracion_estimada_min}))}};
}
export async function materialPrevisto(c:ConexionCostes,u:AutorCostes,a:AlcanceCoste,salas:string[]) {
  exigirFinanzas(u,{salas:true,material:true,bom:true});
  if(a.tareas!==null) throw new ErrorCoste('ALCANCE_BOM_NO_RESUELTO','La necesidad E1 cubre salas completas. Para material previsto selecciona salas sin filtrar tareas.',422);
  if(!salas.length) return {resumen:componente([]),fuente:{salas:[],lineas:[]}};
  const {conConexionDeLectura}=await import('../db');
  const {cargarSnapshotEnLectura}=await import('../documentos/datos');
  const snapshot=await conConexionDeLectura(c,()=>cargarSnapshotEnLectura(salas,a.proyectoId));
  const articulos=await c`select id,coste::text,coste_orientativo,unidad::text from articulos where id in ${c(snapshot.articulos.map(v=>v.id))} order by id`;
  const precios=new Map(articulos.map(v=>[String(v.id),v]));
  const lineas=snapshot.salas.flatMap(s=>necesidadExportada(snapshot,s).map(l=>{
    const p=precios.get(l.articulo_id),cantidad=String(l.cantidad),precio=p?.coste===null||p?.coste===undefined?null:String(p.coste);
    try {parsearDecimal(cantidad,2);if(precio!==null)parsearDecimal(precio,4);} catch {throw new ErrorCoste('FUENTE_DECIMAL_NO_SOPORTADA','La fuente BOM requiere una precisión no soportada. Revisa la fuente.',422);}
    return {salaId:s.sala.id,articuloId:l.articulo_id,descripcion:l.descripcion,cantidad,unidad:l.unidad,origenes:l.origenes,detalle:l.detalle,precioUnitario:precio,moneda:'EUR' as const,calidad:precio===null?'sin_precio':p?.coste_orientativo?'orientativo':'final',importeMinor:precio===null?null:importeMaterialMinor(parsearDecimal(precio,4),parsearDecimal(cantidad,2)).toString()};
  })).sort((a,b)=>a.salaId.localeCompare(b.salaId)||a.articuloId.localeCompare(b.articuloId));
  const {avisosDeMaterial}=await import('../documentos/tablas');
  const avisos=avisosDeMaterial(snapshot,snapshot.salas);
  const fuente={avisos,salas:snapshot.salas.map(s=>({id:s.sala.id,version:s.sala.diagrama_version,revision:s.revisionDiseno})),parametros:snapshot.parametros,lineas};
  return {resumen:componente([...lineas.map(l=>({importeMinor:l.importeMinor,moneda:l.moneda,conocido:l.importeMinor!==null,desactualizado:false,huecos:l.importeMinor===null?['Necesidad BOM sin precio previsto']:[]})),...avisos.map(aviso=>({importeMinor:null,moneda:null,conocido:false,desactualizado:false,huecos:[aviso]}))]),fuente};
}
