import { fechaCivil } from '../informes/periodos';
import { ErrorCoste, type EntradaTarifa, type TarifaCoste } from './modelo';
export function validarVigencia(t:Pick<EntradaTarifa,'desde'|'hastaExclusivo'>) {
  try { fechaCivil(t.desde); if(t.hastaExclusivo) fechaCivil(t.hastaExclusivo); } catch { throw new ErrorCoste('ENTRADA_INVALIDA','Fecha civil de vigencia inválida.'); }
  if(t.hastaExclusivo && t.hastaExclusivo<=t.desde) throw new ErrorCoste('ENTRADA_INVALIDA','El final exclusivo debe ser posterior al inicio.');
}
export function comprobarSolapamientoTarifa(nueva:EntradaTarifa, actuales:TarifaCoste[]) {
  validarVigencia(nueva);
  if(nueva.accion==='anular') return;
  if(actuales.some(t => t.accion!=='anular' && t.serieId!==nueva.serieId && t.tecnicoId===nueva.tecnicoId && (!t.hastaExclusivo || nueva.desde<t.hastaExclusivo) && (!nueva.hastaExclusivo || t.desde<nueva.hastaExclusivo))) throw new ErrorCoste('SOLAPAMIENTO_TARIFA','Ya hay una tarifa vigente para ese técnico en parte del período.',409);
}
export function tarifaEnFecha(tarifas:TarifaCoste[], tecnicoId:string, fecha:string):TarifaCoste|null {
  const vigentes=tarifas.filter(t=> t.accion!=='anular' && t.tecnicoId===tecnicoId && t.desde<=fecha && (!t.hastaExclusivo||fecha<t.hastaExclusivo));
  if(vigentes.length>1) throw new ErrorCoste('TARIFA_AMBIGUA','Hay tarifas superpuestas; concilia las vigencias.',409);
  return vigentes[0]??null;
}
