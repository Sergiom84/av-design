import type { CandidatoConciliacion, ExclusionMaterial, SnapshotCorte } from './modelo';
import { formatearDecimal, parsearDecimal } from '../importes';
/** Cantidades físicas y económicas siempre en la misma escala decimal. */
export function cantidadesMaterial(cantidad:string,repartido:string) {
  return {cantidad:formatearDecimal(parsearDecimal(cantidad,2),2),repartido:formatearDecimal(parsearDecimal(repartido,2),2),pendiente:formatearDecimal(parsearDecimal(cantidad,2)-parsearDecimal(repartido,2),2)};
}
/** Compatibilidad histórica exclusivamente desde el JSON congelado, nunca desde movimientos vivos. */
export function conciliacionCongelada(s:SnapshotCorte) {
  const pendientes=(s.seleccion.pendientes??[]).map(p=>{const v=p as CandidatoConciliacion;return {...v,repartido:v.repartido??null,pendiente:v.pendiente??null,unidad:v.unidad??null};});
  const entrada=(s as SnapshotCorte&{entrada?:{exclusionesMaterial?:Array<{movimientoId:string;motivo:string}>}}).entrada;
  const exclusiones:ExclusionMaterial[]=s.seleccion.exclusiones??(entrada?.exclusionesMaterial??[]).map(e=>({id:e.movimientoId,...e,tipo:'Movimiento excluido',cantidad:null,repartido:null,pendiente:null,unidad:null,detalleCongelado:false}));
  return {pendientes,exclusiones,cobertura:s.cobertura.conciliacionMaterial??{candidatos:pendientes.length+exclusiones.length,pendientes:pendientes.length,excluidos:exclusiones.length}};
}
