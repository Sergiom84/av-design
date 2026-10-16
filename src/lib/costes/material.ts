import { SIGNO_MOVIMIENTO } from '../almacen';
import { importeMaterialMinor, parsearDecimal } from '../importes';
import { ErrorCoste, type EntradaMaterial, type MovimientoCoste, type VersionMaterial } from './modelo';
export function signoConsumo(tipo:string):1|-1|null {
  if(tipo==='salida'||tipo==='baja'||tipo==='devolucion') return SIGNO_MOVIMIENTO[tipo]===1?-1:1;
  return null;
}
export interface MaterialResuelto { signo:1|-1; precioUnitario:string|null; moneda:VersionMaterial['moneda']; calidad:VersionMaterial['calidad']; importeMinor:string|null }
export function validarMaterial(e:EntradaMaterial,m:MovimientoCoste,origen:VersionMaterial|null,devolucion:VersionMaterial|null):MaterialResuelto {
  const signo=signoConsumo(m.tipo);
  if(signo===null) throw new ErrorCoste('HECHO_NO_IMPUTABLE','Entrada y ajuste son evidencia física, no consumo imputable.',422);
  if(m.unidad!==e.unidad) throw new ErrorCoste('UNIDAD_INCOMPATIBLE','La unidad no coincide con el artículo físico.',422);
  if(parsearDecimal(e.cantidad,2)>parsearDecimal(m.cantidad,2)) throw new ErrorCoste('CANTIDAD_EXCEDIDA','La cantidad supera el movimiento físico.',409);
  if((e.precioUnitario===null)!==(e.moneda===null)) throw new ErrorCoste('ENTRADA_INVALIDA','Precio y moneda se confirman juntos.');
  let precio=e.precioUnitario,moneda=e.moneda,calidad=e.calidad;
  if(e.linaje==='salida' && (m.tipo!=='salida'||e.origenSalidaVersionId||e.origenDevolucionVersionId)) throw new ErrorCoste('LINAJE_INVALIDO','La capa original requiere una salida sin otro origen.',422);
  if(e.linaje==='baja_directa' && (m.tipo!=='baja'||!e.evidencia.procedenciaDirecta||e.origenSalidaVersionId||e.origenDevolucionVersionId)) throw new ErrorCoste('LINAJE_INVALIDO','Identifica la procedencia de la baja directa y sus unidades no consumidas antes.',422);
  if(e.linaje==='devolucion'||e.linaje==='reingreso_baja') {
    if(!origen||origen.accion==='anular'||origen.tipoHecho!=='salida'||origen.linaje!=='salida'||origen.movimientoSnapshot.articuloId!==m.articuloId||origen.unidad!==e.unidad||origen.proyectoId!==e.proyectoId) throw new ErrorCoste('LINAJE_INVALIDO','Selecciona una versión vigente de salida de las mismas unidades y obra.',422);
    if(e.linaje==='devolucion' && (m.tipo!=='devolucion'||e.origenDevolucionVersionId)) throw new ErrorCoste('LINAJE_INVALIDO','La devolución sólo enlaza su salida original.',422);
    if(e.linaje==='reingreso_baja' && (m.tipo!=='baja'||!devolucion||devolucion.accion==='anular'||devolucion.linaje!=='devolucion'||devolucion.origenSalidaVersionId!==origen.id||devolucion.proyectoId!==e.proyectoId||devolucion.unidad!==e.unidad||devolucion.movimientoSnapshot.articuloId!==m.articuloId)) throw new ErrorCoste('LINAJE_INVALIDO','La baja de material devuelto requiere esa devolución y su capa original.',422);
    if(e.precioUnitario!==null && (parsearDecimal(e.precioUnitario,4)!==parsearDecimal(origen.precioUnitario??'0',4)||e.moneda!==origen.moneda)) throw new ErrorCoste('LINAJE_INVALIDO','El retorno conserva el precio y moneda de su capa; no admite repricing.',422);
    precio=origen.precioUnitario;moneda=origen.moneda;
    if(origen.calidad!=='documentado'&&calidad==='documentado') calidad=origen.calidad;
    if(devolucion && devolucion.calidad!=='documentado'&&calidad==='documentado') calidad=devolucion.calidad;
  } else if(e.origenSalidaVersionId||e.origenDevolucionVersionId) throw new ErrorCoste('LINAJE_INVALIDO','El linaje pendiente o directo no acepta enlaces de otra capa.',422);
  if(e.linaje==='pendiente') calidad='sin_valorar';
  if(calidad==='documentado' && (precio===null || moneda===null || !e.evidencia.referencia || !e.evidencia.fechaAdquisicion)) throw new ErrorCoste('EVIDENCIA_INCOMPLETA','Documentar exige referencia y fecha de adquisición, precio y moneda confirmados.',422);
  if(calidad==='sin_valorar') return {signo,precioUnitario:precio,moneda,calidad,importeMinor:null};
  return {signo,precioUnitario:precio,moneda,calidad,importeMinor:precio===null?null:(BigInt(signo)*importeMaterialMinor(parsearDecimal(precio,4),parsearDecimal(e.cantidad,2))).toString()};
}
