import type { ComponenteCoste, SnapshotCorte, TotalesCoste } from './modelo';
import { totalPorMoneda } from './laboral';
export function componente(filas:readonly {importeMinor:string|null;moneda:string|null;conocido:boolean;desactualizado:boolean;huecos:string[];minutos?:number;minutosPendientes?:number}[]):ComponenteCoste {
  const conocidos=filas.filter(f=>f.conocido&&!f.desactualizado);
  const pendientes=filas.filter(f=>!f.conocido||f.desactualizado).length;
  const monedas=new Set(conocidos.map(f=>f.moneda));
  return {estado:conocidos.length===0?'sin_datos':pendientes||monedas.size>1?'parcial':'completo',totales:totalPorMoneda(conocidos),estimados:totalPorMoneda(filas.filter(f=>!f.conocido&&!f.desactualizado)),incluidos:filas.length,pendientes,desactualizados:filas.filter(f=>f.desactualizado).length,huecos:[...new Set(filas.flatMap(f=>f.huecos))],minutos:filas.some(f=>f.minutos!==undefined)?filas.reduce((s,f)=>s+(f.minutos??0),0):null,minutosPendientes:filas.some(f=>f.minutos!==undefined)?filas.reduce((s,f)=>s+(f.minutosPendientes??0),0):null};
}
export function combinarComponentes(componentes:SnapshotCorte['componentes']) {
  const c=Object.values(componentes).filter((c):c is ComponenteCoste=>!!c);
  const totales=totalPorMoneda(c.flatMap(f=>Object.entries(f.totales).map(([moneda,importeMinor])=>({moneda,importeMinor}))));
  const tiene=totales.EUR!==null||totales.USD!==null;
  const estado=!tiene?'sin_datos':c.some(f=>f.estado!=='completo')||(totales.EUR!==null&&totales.USD!==null)?'parcial':'completo';
  return {totales,estado:estado as SnapshotCorte['estado']};
}
export function compararCortes(previsto:SnapshotCorte,real:SnapshotCorte) {
  const misma=JSON.stringify({...previsto.alcance,componentes:[...previsto.alcance.componentes].sort()})===JSON.stringify({...real.alcance,componentes:[...real.alcance.componentes].sort()})&&JSON.stringify(previsto.salas)===JSON.stringify(real.salas);
  const comparable=misma&&previsto.tipo==='previsto'&&real.tipo==='real'&&previsto.estado==='completo'&&real.estado==='completo';
  const diferencias:TotalesCoste={EUR:null,USD:null};
  if(comparable) for(const moneda of ['EUR','USD'] as const) if(real.totales[moneda]!==null&&previsto.totales[moneda]!==null) diferencias[moneda]=(BigInt(real.totales[moneda]!)-BigInt(previsto.totales[moneda]!)).toString();
  return {comparable:comparable&&Object.values(diferencias).some(v=>v!==null),mismoAlcance:misma,previsto:previsto.totales,real:real.totales,diferencias,nota:'Diferencia real − previsto de los registros incluidos; no acredita coste total de obra.'};
}
