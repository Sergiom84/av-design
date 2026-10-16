import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { autorCostes, exigirFinanzas } from './autorizacion';
import { entrada, ErrorCoste, confirmarLaboralSchema, laboralSchema, LIMITES_COSTES, type ConexionCostes, type SeleccionLaboral, type ValoracionLaboral } from './modelo';
import { bloquearContextos, partesActuales, tarifasActuales } from './lecturas';
import { bloquearPeticion, comprobarRevision, firmarRevision, operacionPrevia, registrarOperacion, sha256 } from './servicio';
import { valorarParte } from './laboral';
import { rangoTrabajoMadrid } from '../tiempos/fechas';
export async function construirLaboral(c:ConexionCostes,usuarioId:string,e:SeleccionLaboral):Promise<ValoracionLaboral[]> {
  const u=await autorCostes(c,usuarioId);
  const metadata=await c`select id,sala_id from tiempo_registros where id in ${c(e.partes.map(p=>p.registroId))}`;
  exigirFinanzas(u,{salas:metadata.some(m=>m.sala_id)});
  const partes=await partesActuales(c,e.partes.map(p=>p.registroId));
  if(partes.length!==e.partes.length)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra uno de los partes.',404);
  for(const p of partes)if(p.accion==='anulacion'||!e.partes.some(v=>v.registroId===p.registroId&&v.versionId===p.versionId))throw new ErrorCoste('VERSION_TIEMPO_CAMBIADA','Uno de los partes cambió o fue anulado. Revisa la selección.',409);
  const tarifas=await tarifasActuales(c,[...new Set(partes.map(p=>p.tecnicoId))]);
  return partes.map(p=>{const v=valorarParte(p,tarifas);return {...v,fuenteSha256:sha256({parte:p,tramos:v.tramos})};});
}
export async function prepararLaboral(c:ConexionCostes,usuarioId:string,bruto:unknown,secreto:string) {
  const seleccion=entrada(laboralSchema,bruto),valoraciones=await construirLaboral(c,usuarioId,seleccion),hash=sha256(valoraciones);
  return {seleccion,valoraciones,hash,token:firmarRevision(secreto,usuarioId,'laboral',hash)};
}
export async function confirmarLaboral(c:postgres.Sql,usuarioId:string,bruto:unknown,secreto:string,fallo?:()=>void) {
  const e=entrada(confirmarLaboralSchema,bruto);
  return c.begin(async tx=>{
    const u=await autorCostes(tx,usuarioId);
    const metadatos=await tx`select id,sala_id,proyecto_id,tarea_id,tecnico_id from tiempo_registros where id in ${tx(e.seleccion.partes.map(p=>p.registroId))} order by id`;
    exigirFinanzas(u,{salas:metadatos.some(m=>m.sala_id)});
    await bloquearPeticion(tx,usuarioId,e.clavePeticion);await autorCostes(tx,usuarioId);
    const hash=sha256(e),previa=await operacionPrevia(tx,usuarioId,e.clavePeticion,hash);if(previa)return previa;
    await bloquearContextos(tx,metadatos.filter(m=>m.sala_id).map(m=>String(m.sala_id)),metadatos.map(m=>String(m.proyecto_id)),metadatos.map(m=>String(m.tarea_id)),metadatos.map(m=>String(m.tecnico_id)));
    await tx`select id from tiempo_registros where id in ${tx(e.seleccion.partes.map(p=>p.registroId))} order by id for update`;
    const valoraciones=await construirLaboral(tx,usuarioId,e.seleccion);
    comprobarRevision(secreto,e.token,usuarioId,'laboral',sha256(valoraciones));
    const resultado=[];
    for(const v of valoraciones) {
      const [anterior]=await tx`select id,numero from coste_labor_versiones where registro_id=${v.parte.registroId} order by numero desc limit 1`;
      const id=randomUUID(),numero=(Number(anterior?.numero)||0)+1;
      await tx`insert into coste_labor_versiones(id,registro_id,tiempo_version_id,numero,antecedente_id,accion,tramos,totales,estado,fuente_sha256,motivo,autor_id) values(${id},${v.parte.registroId},${v.parte.versionId},${numero},${anterior?.id??null},${anterior?'revalorar':'valorar'},${tx.json(JSON.parse(JSON.stringify(v.tramos)))},${tx.json({documentados:v.totales,estimados:v.estimados,minutosPendientes:v.minutosPendientes})},${v.estado},${v.fuenteSha256},${e.seleccion.motivo},${usuarioId})`;
      resultado.push({id,registroId:v.parte.registroId,tiempoVersionId:v.parte.versionId,numero,estado:v.estado});fallo?.();
    }
    const salida={valoraciones:resultado};await registrarOperacion(tx,usuarioId,e.clavePeticion,hash,'laboral',salida);return salida;
  });
}
export async function listarPartesCoste(c:ConexionCostes,usuarioId:string,proyectoId:string,desde:string,hasta:string,pagina=1) {
  const u=await autorCostes(c,usuarioId);exigirFinanzas(u,{salas:true});const r=rangoTrabajoMadrid(desde,hasta);
  const [{total}]=await c`select count(*)::int as total from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id where r.proyecto_id=${proyectoId} and v.accion<>'anulacion' and v.inicio_utc<${r.finUtcExclusivo} and v.fin_utc>${r.inicioUtc}`;
  const ids=await c`select r.id from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id where r.proyecto_id=${proyectoId} and v.accion<>'anulacion' and v.inicio_utc<${r.finUtcExclusivo} and v.fin_utc>${r.inicioUtc} order by v.inicio_utc,r.id limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`;
  const partes=await partesActuales(c,ids.map(r=>String(r.id)));
  const versiones=partes.length?await c`select distinct on(registro_id) id,registro_id,tiempo_version_id,numero,accion,tramos,totales,estado,motivo,autor_id,creado_en from coste_labor_versiones where registro_id in ${c(partes.map(p=>p.registroId))} order by registro_id,numero desc`:[];
  return {partes:partes.map(p=>({...p,valoracion:versiones.find(v=>v.registro_id===p.registroId)??null,requiereRevaloracion:versiones.some(v=>v.registro_id===p.registroId&&(v.tiempo_version_id!==p.versionId||v.accion==='anular'))})),total:Number(total),pagina};
}
export async function historialLaboral(c:ConexionCostes,usuarioId:string,registroId:string,pagina=1) {
  const u=await autorCostes(c,usuarioId),[m]=await c`select sala_id from tiempo_registros where id=${registroId}`;
  if(!m)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra el parte.',404);exigirFinanzas(u,{salas:!!m.sala_id});
  return {versiones:await c`select id,numero,antecedente_id,tiempo_version_id,accion,tramos,totales,estado,fuente_sha256,motivo,autor_id,creado_en from coste_labor_versiones where registro_id=${registroId} order by numero desc limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`,pagina};
}
export async function anularLaboral(c:postgres.Sql,usuarioId:string,registroId:string,bruto:unknown,fallo?:()=>void) {
  const { z }=await import('zod'),{uuid,version,motivo}=await import('./modelo');
  const e=entrada(z.object({actualId:uuid,numeroActual:version,motivo,clavePeticion:uuid}).strict(),bruto);
  return c.begin(async tx=>{
    const u=await autorCostes(tx,usuarioId),[m]=await tx`select sala_id,proyecto_id,tarea_id,tecnico_id from tiempo_registros where id=${registroId}`;
    if(!m)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra el parte.',404);exigirFinanzas(u,{salas:!!m.sala_id});
    await bloquearPeticion(tx,usuarioId,e.clavePeticion);await autorCostes(tx,usuarioId);
    const h=sha256({registroId,...e}),previa=await operacionPrevia(tx,usuarioId,e.clavePeticion,h);if(previa)return previa;
    await bloquearContextos(tx,m.sala_id?[String(m.sala_id)]:[],[String(m.proyecto_id)],[String(m.tarea_id)],[String(m.tecnico_id)]);
    await tx`select id from tiempo_registros where id=${registroId} for update`;
    const [anterior]=await tx`select id,numero,tiempo_version_id,tramos,totales,estado,fuente_sha256,accion from coste_labor_versiones where registro_id=${registroId} order by numero desc limit 1`;
    if(!anterior||anterior.id!==e.actualId||Number(anterior.numero)!==e.numeroActual||anterior.accion==='anular')throw new ErrorCoste('VERSION_CAMBIADA','La valoración ya cambió o está anulada.',409);
    const id=randomUUID(),numero=Number(anterior.numero)+1;
    await tx`insert into coste_labor_versiones(id,registro_id,tiempo_version_id,numero,antecedente_id,accion,tramos,totales,estado,fuente_sha256,motivo,autor_id) values(${id},${registroId},${anterior.tiempo_version_id},${numero},${anterior.id},'anular',${tx.json(anterior.tramos)},${tx.json(anterior.totales)},${anterior.estado},${anterior.fuente_sha256},${e.motivo},${usuarioId})`;
    fallo?.();const salida={id,registroId,numero};await registrarOperacion(tx,usuarioId,e.clavePeticion,h,'laboral',salida);return salida;
  });
}
