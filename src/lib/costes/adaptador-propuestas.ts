import { conciliacionCongelada } from './conciliacion';
import type { ConexionCostes } from './modelo';
import { leerCorteEnConexion } from './repositorio-cortes';
import { ErrorCoste } from './modelo';
/** Único lector05 reutilizado por07; el llamante conserva su transacción. */
export async function leerCorteParaPropuesta(conexion:ConexionCostes,usuarioId:string,corteId:string) {
  const corte=await leerCorteEnConexion(conexion,usuarioId,corteId);
  if(corte.tipo!=='real')throw new ErrorCoste('CORTE_NO_REAL','Selecciona un corte real de costes registrados.',422);
  const s=corte.snapshot,conciliacion=conciliacionCongelada(s);
  return {id:corte.id,hash:corte.sha256,versionModelo:s.versionModelo,fecha:corte.creadoEn,fechaFuentes:s.fechaFuentes,proyectoId:corte.proyectoId,alcance:s.alcance,salas:s.salas,periodo:{desde:s.alcance.desde,hasta:s.alcance.hasta,zona:'Europe/Madrid' as const},componentes:s.componentes,seleccion:{pendientes:conciliacion.pendientes,exclusiones:conciliacion.exclusiones,partes:s.seleccion.partes.map(p=>{const v=p as {parte:{registroId:string;versionId:string;tareaId:string;salaId:string|null};valoracionId:string|null;tiempoValoradoId:string|null};return {...v.parte,valoracionId:v.valoracionId,tiempoValoradoId:v.tiempoValoradoId};}),apuntes:s.seleccion.apuntes.map(p=>{const v=p as {id:string;apunteId:string;movimientoId:string;tareaId:string|null;salaId:string|null};return {versionId:v.id,apunteId:v.apunteId,movimientoId:v.movimientoId,tareaId:v.tareaId,salaId:v.salaId};})},totales:s.totales,estado:s.estado,cobertura:{...s.cobertura,conciliacionMaterial:conciliacion.cobertura},huecos:s.huecos,tratamientoFiscal:s.tratamientoFiscal,fiscalmenteComparable:corte.fiscalmenteComparable,causasDesactualizacion:corte.causasDesactualizacion,vigente:corte.causasDesactualizacion.length===0};
}
