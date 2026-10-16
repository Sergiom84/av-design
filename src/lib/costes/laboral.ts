import { importeLaboralMinor, parsearDecimal, REGLA_REDONDEO, sumarImportesConocidos } from '../importes';
import { repartirMinutosMadrid } from '../tiempos/fechas';
import { tarifaEnFecha } from './tarifas';
import type { ParteCoste, TarifaCoste, TotalesCoste, TramoCoste, ValoracionLaboral } from './modelo';
export function totalPorMoneda(filas:readonly {moneda:string|null;importeMinor:string|null}[]):TotalesCoste {
  const sumar=(moneda:string) => sumarImportesConocidos(filas.filter(f=>f.moneda===moneda).map(f=> f.importeMinor===null?null:BigInt(f.importeMinor)))?.toString()??null;
  return { EUR:sumar('EUR'), USD:sumar('USD') };
}
export function valorarParte(parte:ParteCoste,tarifas:TarifaCoste[]):Omit<ValoracionLaboral,'fuenteSha256'> {
  const tramos:TramoCoste[]=repartirMinutosMadrid(parte.inicioUtc,parte.finUtc).map(d=>{
    const tarifa=tarifaEnFecha(tarifas,parte.tecnicoId,d.fecha);
    return {...d,tarifa,importeMinor:tarifa?importeLaboralMinor(parsearDecimal(tarifa.precioHora,4),BigInt(d.minutos)).toString():null,divisor:'6000',redondeo:REGLA_REDONDEO};
  });
  const conocidos=tramos.filter(t=>t.tarifa?.calidad==='validada');
  const estimados=tramos.filter(t=>t.tarifa?.calidad==='estimada');
  const totales=totalPorMoneda(conocidos.map(t=>({moneda:t.tarifa!.moneda,importeMinor:t.importeMinor})));
  const pendientes=tramos.filter(t=>!t.tarifa||t.tarifa.calidad!=='validada').reduce((n,t)=>n+t.minutos,0);
  const monedas=new Set(tramos.filter(t=>t.tarifa).map(t=>t.tarifa!.moneda));
  return {parte,tramos,totales,estimados:totalPorMoneda(estimados.map(t=>({moneda:t.tarifa!.moneda,importeMinor:t.importeMinor}))),estado:conocidos.length===0?'sin_datos':pendientes||monedas.size>1?'parcial':'completo',minutosPendientes:pendientes,valoracionActualId:parte.valoracionActualId};
}
