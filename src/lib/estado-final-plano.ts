import type { coordenadasFueraDeSala } from './plano-editor';
type Validable=Parameters<typeof coordenadasFueraDeSala>[0];
export interface CoordenadasPersistidas {
  sala: NonNullable<Validable['sala']>;
  equipos: Array<Validable['equipos'][number]>;
  mobiliario: Array<NonNullable<Validable['mobiliario_cambio']>[number]>;
  tomas: Array<Validable['tomas'][number]>;
}
/** El patch modifica un diseño; su ausencia de una fila nunca la elimina. */
export function estadoFinalCoordenadas(actual:CoordenadasPersistidas,p:{
  sala:Validable['sala'];equipos:Validable['equipos'];equipos_alta:NonNullable<Validable['equipos_alta']>;
  mobiliario_cambio:NonNullable<Validable['mobiliario_cambio']>;mobiliario_baja:readonly string[];
  mobiliario_alta:NonNullable<Validable['mobiliario_alta']>;tomas:Validable['tomas'];
}):Validable {
  const equipos=new Map(actual.equipos.map(e=>[e.id,e]));
  const muebles=new Map(actual.mobiliario.map(m=>[m.id,m]));
  const tomas=new Map(actual.tomas.map(t=>[t.id,t]));
  for(const e of p.equipos)equipos.set(e.id,e);
  for(const id of p.mobiliario_baja)muebles.delete(id);
  for(const m of p.mobiliario_cambio)muebles.set(m.id,m);
  for(const t of p.tomas)tomas.set(t.id,t);
  return{sala:p.sala ?? actual.sala,equipos:[...equipos.values(),...p.equipos_alta],mobiliario_cambio:[...muebles.values(),...p.mobiliario_alta],tomas:[...tomas.values()]};
}
