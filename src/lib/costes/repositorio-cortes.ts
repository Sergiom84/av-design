import { cantidadesMaterial } from './conciliacion';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { REGLA_REDONDEO } from '../importes';
import { rangoTrabajoMadrid, repartirMinutosMadrid } from '../tiempos/fechas';
import { autorCostes, exigirFinanzas, type AutorCostes } from './autorizacion';
import { actualesMaterial, bloquearContextos, partesActuales, tarifasActuales } from './lecturas';
import { componente, combinarComponentes, compararCortes } from './resumen';
import { laboralPrevisto, materialPrevisto } from './previstos';
import { autorizarFuentesMaterial, vigenciaMaterial } from './repositorio-material';
import { entrada, ErrorCoste, alcanceSchema, confirmarCorteSchema, corteSchema, LIMITES_COSTES, type AlcanceCoste, type ComponenteCoste, type ConexionCostes, type EntradaCorte, type SnapshotCorte, type TramoCoste } from './modelo';
import { bloquearPeticion, comprobarRevision, firmarRevision, iso, operacionPrevia, registrarOperacion, sha256 } from './servicio';
interface BaseCorte {id:string;serieId:string;numero:number;antecedenteId:string|null;proyectoId:string;tipo:string;sha256:string;creadoEn:string;autorId:string;snapshot:SnapshotCorte}
async function salasDeAlcance(c:ConexionCostes,u:AutorCostes,a:AlcanceCoste) {
  rangoTrabajoMadrid(a.desde,a.hasta);exigirFinanzas(u,{salas:a.salas.modo==='seleccion',material:a.componentes.includes('material')});
  const [p]=await c`select id,nombre from proyectos where id=${a.proyectoId}`;if(!p)throw new ErrorCoste('NO_ENCONTRADO','La obra no existe.',404);
  const salas=await c`select s.id,l.proyecto_id from salas s join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${a.proyectoId} order by s.id`;
  if(salas.length)exigirFinanzas(u,{salas:true});
  const seleccion=a.salas.modo==='todas'?salas.map(s=>String(s.id)):[...a.salas.ids].sort();
  if(seleccion.some(id=>!salas.some(s=>s.id===id)))throw new ErrorCoste('AMBITO_CAMBIADO','Una sala de la selección ya no pertenece a la obra.',409);
  if(a.tareas!==null&&a.tareas.length) {
    const tareas=await c`select t.id,t.sala_id,p.proyecto_id from plan_tareas t join planes p on p.id=t.plan_id where t.id in ${c(a.tareas)}`;
    if(tareas.length!==a.tareas.length||tareas.some(t=>t.proyecto_id!==a.proyectoId||(a.salas.modo==='seleccion'&&(!t.sala_id||!seleccion.includes(String(t.sala_id))))))throw new ErrorCoste('ALCANCE_INVALIDO','La selección de tareas no corresponde al alcance de salas y obra.',422);
  }
  return seleccion;
}
function filtrosParte(c:ConexionCostes,a:AlcanceCoste,salas:string[]) {
  const s=a.salas.modo==='todas'?c`true`:salas.length?c`r.sala_id in ${c(salas)}`:c`false`;
  const t=a.tareas===null?c`true`:a.tareas.length?c`r.tarea_id in ${c(a.tareas)}`:c`false`;
  return {s,t};
}
async function realLaboral(c:ConexionCostes,a:AlcanceCoste,salas:string[]) {
  const periodo=rangoTrabajoMadrid(a.desde,a.hasta),{s,t}=filtrosParte(c,a,salas);
  const registros=await c`select r.id,r.actual_id from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id where r.proyecto_id=${a.proyectoId} and ${s} and ${t} and v.accion<>'anulacion' and v.inicio_utc<${periodo.finUtcExclusivo} and v.fin_utc>${periodo.inicioUtc} order by r.id limit ${LIMITES_COSTES.filasCorte+1}`;
  if(registros.length>LIMITES_COSTES.filasCorte)throw new ErrorCoste('LIMITE_EXCEDIDO','Reduce el alcance de partes del corte.',413);
  const partes=await partesActuales(c,registros.map(p=>String(p.id)));
  const valoraciones=registros.length?await c`select distinct on(registro_id) id,registro_id,tiempo_version_id,numero,accion,tramos,totales,estado,fuente_sha256 from coste_labor_versiones where registro_id in ${c(registros.map(r=>String(r.id)))} order by registro_id,numero desc`:[];
  const seleccion=partes.map(p=>{
    const v=valoraciones.find(v=>v.registro_id===p.registroId);
    const dias=repartirMinutosMadrid(p.inicioUtc,p.finUtc).filter(d=>d.fecha>=a.desde&&d.fecha<=a.hasta);
    const minutos=dias.reduce((s,d)=>s+d.minutos,0),desactualizado=!!v&&(v.tiempo_version_id!==p.versionId||v.accion==='anular');
    const tramos=v?(v.tramos as TramoCoste[]).filter(t=>t.fecha>=a.desde&&t.fecha<=a.hasta):[];
    return {parte:p,valoracionId:v?String(v.id):null,tiempoValoradoId:v?String(v.tiempo_version_id):null,numeroValoracion:v?Number(v.numero):null,fuenteSha256:v?String(v.fuente_sha256):null,tramos,minutos,desactualizado,pendiente:!v||desactualizado||tramos.some(t=>!t.tarifa||t.tarifa.calidad!=='validada'),minutosPendientes:!v||desactualizado?minutos:tramos.filter(t=>!t.tarifa||t.tarifa.calidad!=='validada').reduce((s,t)=>s+t.minutos,0)};
  });
  const resumen=componente(seleccion.flatMap(v=>v.tramos.length&&!v.desactualizado?v.tramos.map(t=>({moneda:t.tarifa?.moneda??null,importeMinor:t.importeMinor,conocido:t.tarifa?.calidad==='validada'&&!v.desactualizado,desactualizado:v.desactualizado,huecos:v.desactualizado?['Parte corregido o valoración anulada; requiere revaloración']:!t.tarifa?['Parte sin tarifa documentada']:t.tarifa.calidad==='estimada'?['Tarifa estimada en trabajo real']:[],minutos:t.minutos,minutosPendientes:v.desactualizado||t.tarifa?.calidad!=='validada'?t.minutos:0})):[{moneda:null,importeMinor:null,conocido:false,desactualizado:v.desactualizado,huecos:[v.desactualizado?'Parte corregido o valoración anulada; requiere revaloración':'Parte sin valoración'],minutos:v.minutos,minutosPendientes:v.minutos}]));
  resumen.incluidos=seleccion.length;resumen.pendientes=seleccion.filter(p=>p.pendiente).length;resumen.desactualizados=seleccion.filter(p=>p.desactualizado).length;
  return {resumen,seleccion};
}
async function realMaterial(c:ConexionCostes,u:AutorCostes,e:EntradaCorte,salas:string[]) {
  const a=e.alcance;exigirFinanzas(u,{material:true,salas:true});
  const cabeceras=await c`select id from coste_material_apuntes where proyecto_id=${a.proyectoId} order by id limit ${LIMITES_COSTES.filasCorte+1}`;
  if(cabeceras.length>LIMITES_COSTES.filasCorte)throw new ErrorCoste('LIMITE_EXCEDIDO','Reduce el alcance material del corte.',413);
  await autorizarFuentesMaterial(c,u,[],cabeceras.map(v=>String(v.id)));
  const todas=await actualesMaterial(c,a.proyectoId);
  const versiones=todas.filter(v=>v.accion!=='anular'&&(a.salas.modo==='todas'||v.salaId&&salas.includes(v.salaId))&&(a.tareas===null||v.tareaId&&a.tareas.includes(v.tareaId))).filter(v=>{const fecha=v.movimientoSnapshot.fecha;const r=rangoTrabajoMadrid(a.desde,a.hasta);return fecha>=r.inicioUtc&&fecha<r.finUtcExclusivo;});
  const seleccion=await Promise.all(versiones.map(async v=>({...v,causasDesactualizacion:await vigenciaMaterial(c,u,v)})));
  const resumen=componente(seleccion.map(v=>({moneda:v.moneda,importeMinor:v.importeMinor,conocido:v.calidad==='documentado'&&v.linaje!=='pendiente',desactualizado:v.causasDesactualizacion.length>0,huecos:[...v.causasDesactualizacion,...(v.calidad!=='documentado'||v.linaje==='pendiente'?['Apunte material pendiente o estimado']:[])]})));
  const rango=rangoTrabajoMadrid(a.desde,a.hasta),filtroS=salas.length?c`m.sala_id in ${c(salas)}`:c`false`;
  const filasCandidatas=a.tareas===null?await c`select m.id,m.tipo::text,m.cantidad::text,a.unidad::text,coalesce(reparto.cantidad,0)::text as repartido from movimientos m join articulos a on a.id=m.articulo_id left join lateral (select sum(cv.cantidad) as cantidad from coste_material_apuntes ca join coste_material_versiones cv on cv.apunte_id=ca.id where ca.movimiento_id=m.id and cv.accion<>'anular' and not exists(select 1 from coste_material_versiones posterior where posterior.apunte_id=ca.id and posterior.numero>cv.numero)) reparto on true where ${filtroS} and m.tipo in ('salida','devolucion','baja') and m.fecha>=${rango.inicioUtc} and m.fecha<${rango.finUtcExclusivo} and m.cantidad>coalesce(reparto.cantidad,0) order by m.id limit ${LIMITES_COSTES.filasCorte+1}`:[];
  const candidatos=filasCandidatas.map(v=>({id:String(v.id),tipo:String(v.tipo),...cantidadesMaterial(String(v.cantidad),String(v.repartido)),unidad:v.unidad as 'ud'|'m'}));
  if(candidatos.length>LIMITES_COSTES.filasCorte)throw new ErrorCoste('LIMITE_EXCEDIDO','Reduce el alcance de conciliación.',413);
  if(e.exclusionesMaterial.some(x=>!candidatos.some(c=>c.id===x.movimientoId)))throw new ErrorCoste('EXCLUSION_CAMBIADA','Una exclusión ya no corresponde a los movimientos pendientes del alcance.',409);
  const pendientes=candidatos.filter(v=>!e.exclusionesMaterial.some(e=>e.movimientoId===v.id));
  if(pendientes.length) {resumen.pendientes+=pendientes.length;resumen.huecos.push('Movimientos candidatos sin atribución humana: '+pendientes.length);if(resumen.estado==='completo')resumen.estado='parcial';}
  return {resumen,seleccion,candidatos,exclusiones:e.exclusionesMaterial.map(e=>({...candidatos.find(c=>c.id===e.movimientoId)!,...e,detalleCongelado:true})),pendientes};
}
export async function construirCorte(c:ConexionCostes,usuarioId:string,e:EntradaCorte):Promise<SnapshotCorte> {
  const u=await autorCostes(c,usuarioId),a=e.alcance;let salas=await salasDeAlcance(c,u,a);
  if(e.tipo==='real'&&a.salas.modo==='todas') {
    const historicas=a.componentes.includes('material')?await c`select sala_id from tiempo_registros where proyecto_id=${a.proyectoId} and sala_id is not null union select sala_id from coste_material_apuntes where proyecto_id=${a.proyectoId} and sala_id is not null`:await c`select sala_id from tiempo_registros where proyecto_id=${a.proyectoId} and sala_id is not null`;
    salas=[...new Set([...salas,...historicas.map(s=>String(s.sala_id))])].sort();
  }
  exigirFinanzas(u,{salas:salas.length>0,material:a.componentes.includes('material'),bom:e.tipo==='previsto'&&a.componentes.includes('material')});
  const componentes:SnapshotCorte['componentes']={},seleccion:SnapshotCorte['seleccion']={partes:[],apuntes:[],plan:[],bom:[],pendientes:[],exclusiones:[]};
  let fiscal= e.tratamientoFiscal,permisosFuente={pedido:false,carga:false,bom:false};
  const jerarquia=salas.length?await c`select s.id,s.localizacion_id,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${c(salas)} order by s.id`:[];
  const fuentes:Record<string,unknown>={alcance:a,salas,jerarquia,redondeo:REGLA_REDONDEO};
  if(e.tipo==='comparacion') {
    if(!e.cortePrevistoId||!e.corteRealId)throw new ErrorCoste('ENTRADA_INVALIDA','Selecciona un corte previsto y otro real.');
    const previsto=await leerCorteEnConexion(c,usuarioId,e.cortePrevistoId),real=await leerCorteEnConexion(c,usuarioId,e.corteRealId);
    if(previsto.proyectoId!==a.proyectoId||real.proyectoId!==a.proyectoId)throw new ErrorCoste('ALCANCE_INVALIDO','Los cortes pertenecen a otra obra.',422);
    const comparacion=compararCortes(previsto.snapshot,real.snapshot);
    const vigente=!previsto.causasDesactualizacion.length&&!real.causasDesactualizacion.length;
    const mismo=sha256(a)===sha256(real.snapshot.alcance)&&sha256(a)===sha256(previsto.snapshot.alcance);
    const valido=comparacion.comparable&&vigente&&mismo;
    const datos={...comparacion,cortePrevisto:{id:previsto.id,hash:previsto.sha256,estado:previsto.snapshot.estado},corteReal:{id:real.id,hash:real.sha256,estado:real.snapshot.estado},comparable:valido,diferencias:valido?comparacion.diferencias:{EUR:null,USD:null},vigente};
    const huecos=[...(!vigente?['Cortes de origen desactualizados']:[]),...(!mismo?['Alcance distinto']:[]),...(!comparacion.comparable?['Cobertura o moneda no comparable']:[])];
    return {versionModelo:1,tipo:e.tipo,alcance:a,salas,fechaFuentes:new Date().toISOString(),componentes,seleccion,totales:real.snapshot.totales,estado:valido?'completo':'parcial',cobertura:real.snapshot.cobertura,huecos,fuentesSha256:sha256({previsto:previsto.sha256,real:real.sha256,vigente,mismo}),permisosFuente:{pedido:previsto.snapshot.permisosFuente.pedido||real.snapshot.permisosFuente.pedido,carga:previsto.snapshot.permisosFuente.carga||real.snapshot.permisosFuente.carga,bom:previsto.snapshot.permisosFuente.bom||real.snapshot.permisosFuente.bom},tratamientoFiscal:real.snapshot.tratamientoFiscal,comparacion:datos};
  }
  if(e.tipo==='previsto') {
    if(e.tratamientoFiscal.length)throw new ErrorCoste('ENTRADA_INVALIDA','La declaración fiscal corresponde a versiones de coste real.');
    if(a.componentes.includes('laboral')) {
      const tecnicos=await c`select distinct pa.tecnico_id from plan_asignaciones pa join plan_tareas t on t.id=pa.tarea_id join planes p on p.id=t.plan_id where p.proyecto_id=${a.proyectoId} and pa.activo order by pa.tecnico_id`;
      const tarifas=await tarifasActuales(c,tecnicos.map(t=>String(t.tecnico_id))),v=await laboralPrevisto(c,a,salas,tarifas);
      componentes.laboral=v.resumen;seleccion.plan=[v.fuente];fuentes.plan=v.fuente;
    }
    if(a.componentes.includes('material')) {const m=await materialPrevisto(c,u,a,salas);componentes.material=m.resumen;seleccion.bom=[m.fuente];fuentes.bom=m.fuente;permisosFuente.bom=true;permisosFuente.pedido=true;permisosFuente.carga=true;}
  } else {
    if(a.componentes.includes('laboral')) {const v=await realLaboral(c,a,salas);componentes.laboral=v.resumen;seleccion.partes=v.seleccion;fuentes.partes=v.seleccion;}
    if(a.componentes.includes('material')) {
      const v=await realMaterial(c,u,e,salas);componentes.material=v.resumen;seleccion.apuntes=v.seleccion;seleccion.pendientes=v.pendientes;seleccion.exclusiones=v.exclusiones;fuentes.material=v;
      permisosFuente={pedido:v.seleccion.some(v=>!!v.evidencia.pedidoLineaId),carga:v.seleccion.some(v=>!!v.evidencia.cargaLineaId),bom:false};
    }
    const ids=[...seleccion.partes.flatMap(p=>(p as {valoracionId:string|null}).valoracionId?[(p as {valoracionId:string}).valoracionId]:[]),...seleccion.apuntes.map(v=>(v as {id:string}).id)];
    if(fiscal.some(f=>!ids.includes(f.versionId)))throw new ErrorCoste('FISCALIDAD_NO_CORRESPONDE','La declaración fiscal debe referir una versión exacta incluida.',422);
    fiscal=ids.map(versionId=>fiscal.find(f=>f.versionId===versionId)??{versionId,base:'no_resuelto' as const,referencia:'',motivo:'Tratamiento fiscal no declarado'});
  }
  const {totales,estado}=combinarComponentes(componentes),lista=Object.values(componentes).filter((x):x is ComponenteCoste=>!!x);
  const filas=seleccion.partes.length+seleccion.apuntes.length+seleccion.pendientes.length+(seleccion.exclusiones?.length??0)+seleccion.plan.reduce<number>((n,p)=>n+(p as {tareas:unknown[];valoraciones:unknown[]}).tareas.length+(p as {tareas:unknown[];valoraciones:unknown[]}).valoraciones.length,0)+seleccion.bom.reduce<number>((n,b)=>n+(b as {lineas:unknown[]}).lineas.length,0);
  if(filas>LIMITES_COSTES.filasCorte)throw new ErrorCoste('LIMITE_EXCEDIDO','Máximo 10.000 filas por corte.',413);
  const snapshot:SnapshotCorte={versionModelo:1,tipo:e.tipo,alcance:a,salas,fechaFuentes:new Date().toISOString(),componentes,seleccion,totales,estado,cobertura:{registrados:lista.reduce((n,c)=>n+c.incluidos,0),pendientes:lista.reduce((n,c)=>n+c.pendientes,0),revisadoComo:'registros_del_alcance',obraEntera:false,...(e.tipo==='real'&&a.componentes.includes('material')?{conciliacionMaterial:{candidatos:seleccion.pendientes.length+(seleccion.exclusiones?.length??0),pendientes:seleccion.pendientes.length,excluidos:seleccion.exclusiones?.length??0}}:{})},huecos:[...new Set(lista.flatMap(c=>c.huecos))],fuentesSha256:sha256(fuentes),permisosFuente,tratamientoFiscal:fiscal};
  if(Buffer.byteLength(JSON.stringify(snapshot))>LIMITES_COSTES.bytesCorte)throw new ErrorCoste('LIMITE_EXCEDIDO','Máximo 10 MiB por corte. Reduce el alcance.',413);
  return snapshot;
}
export async function prepararCorte(c:ConexionCostes,u:string,bruto:unknown,secreto:string) {
  const seleccion=entrada(corteSchema,bruto),snapshot=await construirCorte(c,u,seleccion),hash=sha256({fuentes:snapshot.fuentesSha256,seleccion});
  return {seleccion,snapshot,hash,token:firmarRevision(secreto,u,'corte',hash)};
}
export async function confirmarCorte(c:postgres.Sql,usuarioId:string,bruto:unknown,secreto:string,fallo?:()=>void) {
  const e=entrada(confirmarCorteSchema,bruto);
  return c.begin(async tx=>{
    const u=await autorCostes(tx,usuarioId),a=e.seleccion.alcance;
    exigirFinanzas(u,{salas:true,material:a.componentes.includes('material'),bom:e.seleccion.tipo==='previsto'&&a.componentes.includes('material')});
    await bloquearPeticion(tx,usuarioId,e.clavePeticion);await autorCostes(tx,usuarioId);
    const hash=sha256(e),previa=await operacionPrevia(tx,usuarioId,e.clavePeticion,hash);if(previa)return previa;
    const salas=await salasDeAlcance(tx,u,a);
    const registros=await tx`select id,sala_id,tarea_id,tecnico_id from tiempo_registros where proyecto_id=${a.proyectoId}`;
    const apuntes=a.componentes.includes('material')?await tx`select sala_id,tarea_id from coste_material_apuntes where proyecto_id=${a.proyectoId}`:[];
    const tareas=await tx`select t.id from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${a.proyectoId}`;
    const tecnicos=await tx`select distinct pa.tecnico_id from plan_asignaciones pa join plan_tareas t on t.id=pa.tarea_id join planes p on p.id=t.plan_id where p.proyecto_id=${a.proyectoId} and pa.activo`;
    await bloquearContextos(tx,[...salas,...registros.flatMap(r=>r.sala_id?[String(r.sala_id)]:[]),...apuntes.flatMap(r=>r.sala_id?[String(r.sala_id)]:[])],[a.proyectoId],tareas.map(t=>String(t.id)),[...registros.map(r=>String(r.tecnico_id)),...tecnicos.map(t=>String(t.tecnico_id))]);
    const snapshot=await construirCorte(tx,usuarioId,e.seleccion);
    comprobarRevision(secreto,e.token,usuarioId,'corte',sha256({fuentes:snapshot.fuentesSha256,seleccion:e.seleccion}));
    let anterior:Record<string,unknown>|undefined;
    if(e.seleccion.serieId) {
      [anterior]=await tx`select id,numero,proyecto_id,tipo from coste_cortes where serie_id=${e.seleccion.serieId} order by numero desc limit 1`;
      if(!anterior||anterior.id!==e.seleccion.actualId||Number(anterior.numero)!==e.seleccion.numeroActual||anterior.proyecto_id!==a.proyectoId||anterior.tipo!==e.seleccion.tipo)throw new ErrorCoste('VERSION_CAMBIADA','El corte ha cambiado. Revisa su historial.',409);
    } else if(e.seleccion.actualId||e.seleccion.numeroActual)throw new ErrorCoste('ENTRADA_INVALIDA','Un corte nuevo no tiene antecedente.');
    const id=randomUUID(),serieId=e.seleccion.serieId??randomUUID(),numero=(Number(anterior?.numero)||0)+1;
    const almacenado={...snapshot,entrada:e.seleccion};
    await tx`insert into coste_cortes(id,proyecto_id,serie_id,numero,antecedente_id,tipo,alcance,snapshot,sha256,estado,autor_id) values(${id},${a.proyectoId},${serieId},${numero},${anterior?String(anterior.id):null},${e.seleccion.tipo},${tx.json(JSON.parse(JSON.stringify(a)))},${tx.json(JSON.parse(JSON.stringify(almacenado)))},${sha256(almacenado)},${snapshot.estado},${usuarioId})`;
    fallo?.();const resultado={id,serieId,numero,hash:sha256(almacenado),estado:snapshot.estado};await registrarOperacion(tx,usuarioId,e.clavePeticion,hash,'corte',resultado);return resultado;
  });
}
export async function leerCorteEnConexion(c:ConexionCostes,usuarioId:string,id:string):Promise<BaseCorte&{causasDesactualizacion:string[];fiscalmenteComparable:boolean}> {
  const u=await autorCostes(c,usuarioId);
  const [meta]=await c`select proyecto_id,alcance,tipo,snapshot->'permisosFuente' as permisos from coste_cortes where id=${id}`;
  if(!meta)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra el corte.',404);
  const a=entrada(alcanceSchema,meta.alcance),p=meta.permisos as SnapshotCorte['permisosFuente'];
  exigirFinanzas(u,{salas:true,material:a.componentes.includes('material'),pedido:p?.pedido,carga:p?.carga,bom:p?.bom});
  const [r]=await c`select id,serie_id,numero,antecedente_id,proyecto_id,tipo,sha256,snapshot,creado_en,autor_id from coste_cortes where id=${id}`;
  const snapshot=r.snapshot as SnapshotCorte&{entrada:EntradaCorte};
  if(snapshot.versionModelo!==1||sha256(snapshot)!==r.sha256)throw new ErrorCoste('CORTE_INCONSISTENTE','No se pudo verificar la integridad del corte.',503);
  const causas:string[]=[];
  try {const actual=await construirCorte(c,usuarioId,snapshot.entrada);if(actual.fuentesSha256!==snapshot.fuentesSha256)causas.push('Fuentes, versiones o cobertura actuales distintas del corte');}
  catch(error){if(error instanceof ErrorCoste&&[401,403].includes(error.status))throw error;causas.push('El alcance o las fuentes del corte requieren conciliación');}
  return {id:String(r.id),serieId:String(r.serie_id),numero:Number(r.numero),antecedenteId:r.antecedente_id?String(r.antecedente_id):null,proyectoId:String(r.proyecto_id),tipo:String(r.tipo),sha256:String(r.sha256),creadoEn:iso(r.creado_en),autorId:String(r.autor_id),snapshot,causasDesactualizacion:causas,fiscalmenteComparable:snapshot.tipo==='real'&&snapshot.tratamientoFiscal.length>0&&snapshot.tratamientoFiscal.every(f=>f.base==='sin_impuestos'&&!!f.referencia)};
}
export async function listarCortes(c:ConexionCostes,usuarioId:string,proyectoId:string,pagina=1,tipo?:EntradaCorte['tipo']) {
  const u=await autorCostes(c,usuarioId);exigirFinanzas(u,{salas:true});
  // Sólo metadatos; cada snapshot tiene su autorización completa en su GET.
  const filtro=tipo?c`tipo=${tipo}`:c`true`;
  const [{total}]=await c`select count(*)::int as total from coste_cortes where proyecto_id=${proyectoId} and ${filtro}`;
  const filas=await c`select id,serie_id,numero,tipo,estado,creado_en from coste_cortes where proyecto_id=${proyectoId} and ${filtro} order by creado_en desc,id limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`;
  return {cortes:filas,pagina,total:Number(total)};
}
