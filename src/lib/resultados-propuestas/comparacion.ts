import { rangoTrabajoMadrid } from '../tiempos/fechas';
import type { Aprobacion, ComparacionResultado, CorteParaPropuesta, MedidaAprobada, SeleccionResultado } from './modelo';
import { ErrorResultado, hash } from './modelo';
const monedas=['EUR','USD'] as const;
function mismaLista(a:string[],b:string[]){return hash([...a].sort())===hash([...b].sort());}
function validarMedidas(m:Record<string,MedidaAprobada>){for(const [moneda,v] of Object.entries(m))if(!monedas.includes(moneda as 'EUR')||!['sin_datos','parcial','completo'].includes(v.estado)||v.subtotal!==null&&!/^(0|[1-9]\d*)$/.test(v.subtotal)||!Number.isSafeInteger(v.ausentes)||v.ausentes<0||!Number.isSafeInteger(v.orientativas)||v.orientativas<0||(v.subtotal===null)!==(v.estado==='sin_datos')||v.estado==='completo'&&v.ausentes!==0)throw new ErrorResultado('La valoración aprobada es inconsistente.',503);}
/** Sólo resta enteros menores congelados; no tarifica ni revalora ninguna fuente. */
export function compararRegistrado(a:Aprobacion,c:CorteParaPropuesta,s:SeleccionResultado):ComparacionResultado{
 rangoTrabajoMadrid(s.cobertura.desde,s.cobertura.hasta);
 validarMedidas(a.base);validarMedidas(a.impuesto);validarMedidas(a.bruto);
 if(c.versionModelo!==1)throw new ErrorResultado('Modelo de corte no compatible.',422);
 if(!a.proyectoId)throw new ErrorResultado('La sala sin obra no tiene un ámbito05 comparable.',422);
 if(a.proyectoId!==c.proyectoId||s.cobertura.proyectoId!==a.proyectoId||!mismaLista(a.salaIds,c.salas)||!mismaLista(a.salaIds,s.cobertura.salaIds))throw new ErrorResultado('La obra y las salas deben coincidir exactamente con la revisión aprobada.',422);
 if(s.cobertura.desde!==c.periodo.desde||s.cobertura.hasta!==c.periodo.hasta)throw new ErrorResultado('El período declarado no coincide con el corte seleccionado.',422);
 const causas:string[]=[];
 if(!s.cobertura.periodoCompleto)causas.push('El período seleccionado no cubre todo el alcance aprobado declarado');
 if(c.alcance.tareas!==null)causas.push('El corte selecciona sólo tareas concretas');
 if(c.alcance.componentes.length!==2||!c.componentes.laboral||!c.componentes.material)causas.push('Falta revisar uno de los componentes laboral y material');
 if(!c.vigente||c.causasDesactualizacion.length)causas.push(...c.causasDesactualizacion,'El corte de costes está desactualizado');
 if(c.estado!=='completo')causas.push('El corte no es completo sobre sus registros');
 if(c.cobertura.pendientes||c.seleccion.pendientes.length)causas.push('Hay registros o movimientos pendientes de conciliar');
 if(c.seleccion.exclusiones.length||c.cobertura.conciliacionMaterial.excluidos)causas.push('Hay movimientos excluidos del corte');
 for(const tipo of ['laboral','material'] as const){const v=c.componentes[tipo];if(v&&(v.estado!=='completo'||v.pendientes||v.desactualizados))causas.push(`Cobertura ${tipo} incompleta`);}
 const versiones=[...c.seleccion.partes.flatMap(p=>p.valoracionId?[p.valoracionId]:[]),...c.seleccion.apuntes.map(p=>p.versionId)].sort();
 const fiscales=c.tratamientoFiscal;
 if(!c.fiscalmenteComparable||!versiones.length||!mismaLista(versiones,fiscales.map(f=>f.versionId))||fiscales.some(f=>f.base!=='sin_impuestos'||!f.referencia.trim()))causas.push('El tratamiento fiscal neto no está documentado para todas las versiones');
 const conBase=Object.keys(a.base).filter(m=>a.base[m].subtotal!==null),conCoste=monedas.filter(m=>c.totales[m]!==null);
 if(conBase.length!==1||conCoste.length!==1||conBase[0]!==conCoste[0])causas.push('Las monedas o unidades de comparación no coinciden en una moneda única');
 for(const m of Object.keys(a.base))if(a.base[m].estado!=='completo'||!a.impuesto[m]||a.impuesto[m].estado!=='completo'||!a.bruto[m]||a.bruto[m].estado!=='completo')causas.push('La base aprobada o su tratamiento de impuestos está incompleto');
 if(!Object.keys(a.base).length)causas.push('La revisión aceptada no contiene una valoración monetaria');
 causas.push(...c.huecos);
 const faltaBase=conBase.length===0,faltaCoste=conCoste.length===0;
 const estado=faltaBase||faltaCoste?'sin_datos':causas.length?'parcial':'comparable_registrado';
 const resultado:ComparacionResultado['monedas']={};
 for(const m of monedas){const base=a.base[m]?.subtotal??null,coste=c.totales[m];if(base===null&&coste===null)continue;const laboral=c.componentes.laboral?.totales[m]??null,material=c.componentes.material?.totales[m]??null;
  for(const valor of [coste,laboral,material])if(valor!==null&&!/^-?(0|[1-9]\d*)$/.test(valor))throw new ErrorResultado('Importe de costes no compatible.',503);
  if(estado==='comparable_registrado'&&(laboral===null||material===null||BigInt(laboral)+BigInt(material)!==BigInt(coste!)))throw new ErrorResultado('Los componentes no concuerdan con el corte.',503);
  resultado[m]={baseAprobadaMinor:base,laboralMinor:laboral,materialMinor:material,costeRegistradoMinor:coste,diferenciaMinor:estado==='comparable_registrado'&&base!==null&&coste!==null?(BigInt(base)-BigInt(coste)).toString():null};
 }
 return {estado,causas:[...new Set(causas)],monedas:resultado,etiqueta:'Diferencia entre base aprobada y costes registrados',nota:'Comparable sólo sobre los registros conciliados y la revisión de cobertura declarada. No acredita horas o material no registrados ni costes ajenos a este alcance.'};
}
