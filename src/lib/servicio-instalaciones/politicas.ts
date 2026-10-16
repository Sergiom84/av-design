import { fechaCivil,partesMadrid,sumarDias,medianocheMadrid } from '../informes/periodos';
import { instanteLocal } from '../planificacion/fechas';
import { ErrorServicio,type Condiciones,type DatosVisita } from './modelo';
export function civil(v:string,ahora?:Date){try{fechaCivil(v);}catch{throw new ErrorServicio('Fecha civil inválida.');}if(ahora&&v>partesMadrid(ahora).fecha)throw new ErrorServicio('La fecha real no puede ser futura.',422);return v;}
export function instante(v:Parameters<typeof instanteLocal>[0],ahora?:Date){let t:string;try{t=instanteLocal(v);}catch(e){throw new ErrorServicio(e instanceof Error?e.message:'Hora de Madrid inválida.',422);}if(ahora&&Date.parse(t)>+ahora)throw new ErrorServicio('El instante real no puede ser futuro.',422);return t;}
export function validarCondiciones(v:Condiciones){
  if(v.desde)civil(v.desde);if(v.final.tipo==='fecha'){civil(v.final.fecha);if(v.desde&&v.final.fecha<=v.desde)throw new ErrorServicio('El final exclusivo debe ser posterior al inicio.',422);}
  if(v.ambito==='activos'&&!v.activos.length||v.ambito==='sala'&&v.activos.length||new Set(v.activos).size!==v.activos.length||new Set(v.incluidos).size!==v.incluidos.length||new Set(v.excluidos).size!==v.excluidos.length||v.incluidos.some(t=>v.excluidos.includes(t)))throw new ErrorServicio('Comprueba el ámbito y los tipos incluidos/excluidos.',422);
  return v;
}
export function validarVisita(v:DatosVisita,ahora:Date){
  civil(v.fecha,ahora);if(new Set(v.tecnicos).size!==v.tecnicos.length)throw new ErrorServicio('No repitas técnicos.');
  if(Boolean(v.inicio)!==Boolean(v.fin))throw new ErrorServicio('Inicio y fin se aportan juntos o se dejan desconocidos.',422);
  let intervalo=null;if(v.inicio&&v.fin){const inicio=instante(v.inicio,ahora),fin=instante(v.fin,ahora),minutos=(Date.parse(fin)-Date.parse(inicio))/60000;if(minutos<1||minutos>1440||v.inicio.fecha!==v.fecha)throw new ErrorServicio('La visita admite hasta 24 horas reales y empieza en la fecha indicada.',422);intervalo={inicio,fin,minutos};}
  return {...v,intervalo};
}
export function cobertura(v:Condiciones,activoId:string,tipo:string|null,apertura:string,deteccion:string|null){
  const referencia=v.referenciaTemporal==='apertura_registrada'?apertura:deteccion;
  const inputs={activoId,tipo,referencia,regla:v.referenciaTemporal};
  if(v.ambito==='activos'&&!v.activos.includes(activoId))return {resultado:'no_cubierta',razon:'Fuera del ámbito de activos.',inputs};
  if(tipo&&v.excluidos.includes(tipo as Condiciones['excluidos'][number]))return {resultado:'no_cubierta',razon:'Tipo excluido expresamente.',inputs};
  if(!referencia||!v.desde||v.final.tipo==='desconocido'||!tipo||!v.incluidos.includes(tipo as Condiciones['incluidos'][number]))return {resultado:'no_determinable',razon:'Faltan fecha, vigencia o tipo expresamente incluido.',inputs};
  const dia=partesMadrid(new Date(referencia)).fecha;
  if(dia<v.desde||v.final.tipo==='fecha'&&dia>=v.final.fecha)return {resultado:'no_cubierta',razon:'Fuera de la vigencia.',inputs};
  return {resultado:'cubierta',razon:'Ámbito, tipo y vigencia expresamente incluidos.',inputs};
}
export function plazo(regla:Condiciones['primeraAtencion'],apertura:string,deteccion:string|null,limiteAportado:Parameters<typeof instanteLocal>[0]|null){
  if(!regla)return {regla:null,limite:null,exclusivo:false,razon:'SLA no definido.'};
  const origen=regla.origen==='apertura_registrada'?apertura:deteccion;
  if(!origen)return {regla,limite:null,exclusivo:false,razon:'Origen temporal desconocido.'};
  let limite:string|null=null;
  if(regla.regla==='minutos_reales')limite=new Date(Date.parse(origen)+regla.cantidad*60000).toISOString();
  if(regla.regla==='dias_civiles')limite=medianocheMadrid(sumarDias(partesMadrid(new Date(origen)).fecha,regla.cantidad+1)).toISOString();
  if(regla.regla==='fecha_limite'&&limiteAportado)limite=instante(limiteAportado);
  if(limite&&Date.parse(limite)<Date.parse(origen))throw new ErrorServicio('El límite no puede ser anterior al origen del SLA.',422);
  return {regla,limite,exclusivo:regla.regla==='dias_civiles',razon:limite?'Condición explícita aplicada.':'Falta fecha límite aportada.'};
}
export function evaluarPlazo(p:ReturnType<typeof plazo>,actuacion:string|null,ahora:Date){
  if(!p.regla)return {...p,estado:'sin_plazo',actuacion,observadoEn:ahora.toISOString()};
  if(!p.limite)return {...p,estado:'no_determinable',actuacion,observadoEn:ahora.toISOString()};
  const t=actuacion?Date.parse(actuacion):+ahora,l=Date.parse(p.limite),dentro=p.exclusivo?t<l:t<=l;
  return {...p,estado:actuacion?(dentro?'dentro_de_plazo':'incumplido'):(dentro?'pendiente':'incumplido'),actuacion,observadoEn:ahora.toISOString()};
}
