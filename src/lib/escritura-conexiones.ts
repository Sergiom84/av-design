import type postgres from 'postgres';
import { z } from 'zod';
import { esUuid } from './uuid';
import type { ExtremoConexion } from './tipos';

export type TransaccionConexiones = postgres.TransactionSql<Record<string, unknown>>;
export const esquemaExtremoConexion = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('equipo'), equipo_id: z.string().min(1).max(120), puerto_id: z.string().refine(esUuid), ordinal: z.number().int().min(1).max(10000) }).strict(),
  z.object({ tipo: z.literal('roseta'), toma_boca_id: z.string().refine(esUuid) }).strict(),
]);
export class ConexionRechazada extends Error {}
export function columnasExtremo(e: ExtremoConexion) {
  return e.tipo === 'equipo'
    ? { equipo_id: e.equipo_id, puerto_id: e.puerto_id, ordinal: e.ordinal, toma_boca_id: null }
    : { equipo_id: null, puerto_id: null, ordinal: null, toma_boca_id: e.toma_boca_id };
}

/** Sala/plantilla se bloquea antes. Recursos ordenados por UUID, sin UUID polimórficos. */
export async function bloquearYValidarExtremos(
  tx: TransaccionConexiones, propietarioId: string, extremos: ExtremoConexion[], plantilla = false,
) {
  const equipoIds = [...new Set(extremos.flatMap(e => e.tipo === 'equipo' ? [e.equipo_id] : []))].sort();
  const bocaIds = [...new Set(extremos.flatMap(e => e.tipo === 'roseta' ? [e.toma_boca_id] : []))].sort();
  const puertoIds = [...new Set(extremos.flatMap(e => e.tipo === 'equipo' ? [e.puerto_id] : []))].sort();
  if (equipoIds.some(id => !esUuid(id))) throw new ConexionRechazada('Algún equipo no tiene identidad válida.');
  const tablaEquipos = plantilla ? 'plantilla_articulos' : 'sala_equipos';
  const campoPropietario = plantilla ? 'plantilla_id' : 'sala_id';
  const tablaBocas = plantilla ? 'plantilla_toma_red_bocas' : 'toma_red_bocas';
  const tablaTomas = plantilla ? 'plantilla_tomas_red' : 'tomas_red';
  const campoToma = plantilla ? 'plantilla_toma_red_id' : 'toma_red_id';
  const equipos = equipoIds.length ? await tx<Array<{id:string; propietario_id:string; articulo_id:string|null; cantidad:string|number}>>`
    select id,${tx(campoPropietario)} as propietario_id,articulo_id,cantidad from ${tx(tablaEquipos)}
    where id in ${tx(equipoIds)} order by id for update` : [];
  if (equipos.length !== equipoIds.length || equipos.some(e => e.propietario_id !== propietarioId)) throw new ConexionRechazada('Algún equipo pertenece a otra sala o plantilla.');
  if (bocaIds.length) {
    const bocas = await tx<Array<{id:string; toma_id:string}>>`select id,${tx(campoToma)} as toma_id from ${tx(tablaBocas)} where id in ${tx(bocaIds)}`;
    if (bocas.length !== bocaIds.length) throw new ConexionRechazada('Alguna boca de roseta ya no existe.');
    const tomaIds = [...new Set(bocas.map(b => b.toma_id))].sort();
    const tomas = await tx<Array<{id:string; propietario_id:string; capacidad_documentada:number|null}>>`
      select id,${tx(campoPropietario)} as propietario_id,capacidad_documentada from ${tx(tablaTomas)} where id in ${tx(tomaIds)} order by id for update`;
    const actuales = await tx<Array<{id:string; toma_id:string; ordinal:number}>>`
      select id,${tx(campoToma)} as toma_id,ordinal from ${tx(tablaBocas)} where id in ${tx(bocaIds)} order by id for update`;
    if (actuales.length !== bocaIds.length || actuales.some(b => !tomas.some(t => t.id === b.toma_id && t.propietario_id === propietarioId && t.capacidad_documentada !== null && b.ordinal <= t.capacidad_documentada))) {
      throw new ConexionRechazada('Alguna boca de roseta es ajena o no tiene capacidad documentada.');
    }
  }
  const puertos = puertoIds.length ? await tx<Array<{id:string;articulo_id:string;total:number}>>`select id,articulo_id,total from puertos where id in ${tx(puertoIds)} order by id for update` : [];
  for (const e of extremos) if (e.tipo === 'equipo') {
    const equipo = equipos.find(f => f.id === e.equipo_id), puerto = puertos.find(p => p.id === e.puerto_id);
    if (!equipo || Number(equipo.cantidad) !== 1 || !puerto || puerto.articulo_id !== equipo.articulo_id || e.ordinal < 1 || e.ordinal > Number(puerto.total)) throw new ConexionRechazada('Elige un puerto y ordinal documentados de una sola unidad física.');
  }
}

export async function escribirParejaConexion(tx:TransaccionConexiones,id:string,origen:ExtremoConexion,destino:ExtremoConexion,plantilla=false) {
  const o = columnasExtremo(origen), d = columnasExtremo(destino);
  if (plantilla) {
    await tx`update plantilla_conexiones set origen_linea_id=${o.equipo_id},destino_linea_id=${d.equipo_id},detalle_extremos='completo' where id=${id}`;
    await tx`delete from plantilla_conexion_bocas where plantilla_conexion_id=${id}`;
    await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal,toma_boca_id) values
      (${id},'origen',${o.equipo_id},${o.puerto_id},${o.ordinal},${o.toma_boca_id}),(${id},'destino',${d.equipo_id},${d.puerto_id},${d.ordinal},${d.toma_boca_id})`;
  } else {
    await tx`update conexiones set origen_id=${o.equipo_id},destino_id=${d.equipo_id},puerto_origen_id=${o.puerto_id},puerto_destino_id=${d.puerto_id},detalle_extremos='completo' where id=${id}`;
    await tx`delete from conexion_bocas where conexion_id=${id}`;
    await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal,toma_boca_id) values
      (${id},'origen',${o.equipo_id},${o.puerto_id},${o.ordinal},${o.toma_boca_id}),(${id},'destino',${d.equipo_id},${d.puerto_id},${d.ordinal},${d.toma_boca_id})`;
  }
}
