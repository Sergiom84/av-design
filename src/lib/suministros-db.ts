import {transaccionConControl} from './control-escritura';
import type { Sql, TransactionSql } from 'postgres';
import { extremoPorCategoria } from './tipos';
import type { CableSuministrado, ComponenteSuministro, ContextoSuministros, EstadoSuministroCable, SuministroSala } from './suministros';
import { ConexionRechazada } from './escritura-conexiones';

/** Participa en la instantánea del lector completo, sin abrir otra conexión. */
export async function leerSuministros(sql: TransactionSql, salaId: string): Promise<ContextoSuministros> {
  const suministros = await sql<SuministroSala[]>`select id,sala_id,articulo_id,composicion_id,estado,snapshot from sala_suministros where sala_id=${salaId} order by id`;
  const componentes = await sql<ComponenteSuministro[]>`select equipo_id,suministro_id,linea_id,ordinal from sala_componentes_suministro where sala_id=${salaId} order by equipo_id`;
  const cables = await sql<CableSuministrado[]>`
    select id,suministro_id,sala_id,linea_id,ordinal,tipo,propietario_equipo_id,puerto_fijo_id,ordinal_fijo,
           articulo_cable_id,longitud_utilizable_m,snapshot
    from sala_cables_suministrados where sala_id=${salaId} order by id`;
  return { suministros, componentes, cables: cables.map((k) => ({
    ...k,
    ordinal: Number(k.ordinal),
    ordinal_fijo: k.ordinal_fijo == null ? null : Number(k.ordinal_fijo),
    longitud_utilizable_m: k.longitud_utilizable_m == null ? null : Number(k.longitud_utilizable_m),
  })) };
}

/** Operación interna. El alta UI espera la atribución de compra y almacén L3B.
 * La composición es explícita: jamás se deduce del nombre de un equipo antiguo.
 */
export async function instanciarSuministro(sql: Sql, salaId: string, composicionId: string) {
  return transaccionConControl(sql, async (tx) => {
    const [sala] = await tx`select id,localizacion_id from salas where id=${salaId} for update`;
    if (!sala) throw new Error('Sala no encontrada.');
    const cierres = await tx`select h.id from hitos_proyecto h join localizaciones l on l.proyecto_id=h.proyecto_id where l.id=${sala.localizacion_id} and h.tipo='cierre'`;
    if (cierres.length) throw new Error('El proyecto está cerrado.');
    const [c] = await tx`select c.id,c.articulo_kit_id from articulo_composiciones c join articulos a on a.id=c.articulo_kit_id where c.id=${composicionId} and c.publicada and a.activo for share of c,a`;
    if (!c) throw new Error('Composición publicada y artículo activo requeridos.');
    const [suministro] = await tx`insert into sala_suministros(sala_id,articulo_id,composicion_id,snapshot) values (${salaId},${c.articulo_kit_id},${c.id},'{}') returning id`;
    const lineas = await tx`select l.*,a.categoria,a.activo from articulo_composicion_lineas l join articulos a on a.id=l.articulo_componente_id
      where l.composicion_id=${c.id} and l.inclusion='incluido' order by l.clave`;
    const cuerpos: string[] = [];
    for (const l of lineas) {
      if (!l.activo) throw new Error('La composición contiene un componente inactivo.');
      for (let ordinal = 1; ordinal <= l.cantidad; ordinal++) {
        const [equipo] = await tx`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad,extremo,posicion_confirmada)
          values (${salaId},${l.articulo_componente_id},${l.identidad},1,${extremoPorCategoria(l.categoria)}::extremo_cable,false) returning id`;
        await tx`insert into sala_componentes_suministro(equipo_id,suministro_id,sala_id,composicion_id,linea_id,ordinal,snapshot)
          values (${equipo.id},${suministro.id},${salaId},${c.id},${l.id},${ordinal},'{}')`;
        if (String(l.articulo_componente_id) === String(c.articulo_kit_id)) cuerpos.push(String(equipo.id));
      }
    }
    const latiguillos = await tx<{id:string;clave:string;identidad:string;cantidad:number;fuente:string}[]>`
      select id,clave,identidad,cantidad,fuente from articulo_composicion_lineas
      where composicion_id=${c.id} and inclusion='incluido' and rol='cable' order by clave`;
    const hechos = await tx<{clave:string;estado:string;valor:unknown;fuente_url:string|null;documento:string|null;apartado:string|null;consultado_en:Date|string|null}[]>`
      select clave,estado,valor,fuente_url,documento,apartado,consultado_en
      from articulo_datos_tecnicos where articulo_id=${c.articulo_kit_id} and tipo='suministro'`;
    const porClave = new Map(hechos.map((h) => [h.clave, h]));
    const puertos = await tx<{id:string;total:number;nombre:string;conector:string|null}[]>`
      select id,total,nombre,conector from puertos where articulo_id=${c.articulo_kit_id} order by orden,id`;
    for (const l of latiguillos) {
      const hecho = porClave.get(l.clave);
      const valor = hecho && typeof hecho.valor === 'object' && hecho.valor !== null
        ? hecho.valor as {referencia?: string; incluido?: boolean|null; longitud_m?: number|null; longitud_aplica?: boolean|null}
        : null;
      if (!hecho || hecho.estado === 'sin_documentar' || !valor || valor.incluido !== true) {
        throw new Error('El latiguillo incluido exige un hecho L1 documentado con inclusión.');
      }
      if (valor.longitud_aplica === false) continue;
      const longitud = valor.longitud_m == null ? null : Number(valor.longitud_m);
      const unido = cuerpos.length === 1 && puertos.length === 1 && Number(puertos[0].total) >= 1;
      for (let ordinal = 1; ordinal <= l.cantidad; ordinal++) {
        const snapshot = {
          referencia: valor.referencia ?? l.identidad,
          fuente: l.fuente,
          clave: l.clave,
          identidad: l.identidad,
          tipo: unido ? 'unido' : 'libre',
          longitud_utilizable_m: longitud,
          conectores: puertos[0] ? {nombre: puertos[0].nombre, conector: puertos[0].conector} : null,
          hecho: {
            estado: hecho.estado, fuente_url: hecho.fuente_url, documento: hecho.documento,
            apartado: hecho.apartado, consultado_en: hecho.consultado_en, valor,
          },
        };
        await tx`insert into sala_cables_suministrados(
          suministro_id,sala_id,linea_id,ordinal,tipo,propietario_equipo_id,puerto_fijo_id,ordinal_fijo,
          articulo_cable_id,longitud_utilizable_m,snapshot)
          values (${suministro.id},${salaId},${l.id},${ordinal},${unido ? 'unido' : 'libre'},
            ${unido ? cuerpos[0] : null},${unido ? puertos[0].id : null},${unido ? 1 : null},
            null,${longitud},${tx.json(snapshot)})`;
      }
    }
    await tx`update salas set diagrama_version=diagrama_version+1 where id=${salaId}`;
    return String(suministro.id);
  });
}

export async function aplicarEstadoCableEnTx(
  tx: TransactionSql,
  conexionId: string,
  estado: EstadoSuministroCable,
  cableId: string | null,
) {
  const [c] = await tx`select id,sala_id from conexiones where id=${conexionId} for update`;
  if (!c) throw new ConexionRechazada('La conexión ya no existe.');
  await tx`select id from salas where id=${c.sala_id} for update`;
  if (estado === 'incluido') {
    if (!cableId) throw new ConexionRechazada('Incluido exige un latiguillo físico de la sala.');
    const [k] = await tx`select id,sala_id,suministro_id from sala_cables_suministrados where id=${cableId} for update`;
    if (!k || String(k.sala_id) !== String(c.sala_id)) throw new ConexionRechazada('El cable no pertenece a esta sala.');
    await tx`select id from sala_suministros where id=${k.suministro_id} for update`;
    await tx`update conexiones set estado_suministro='incluido', cable_suministrado_id=${cableId}, decision_heredada=false where id=${conexionId}`;
    return;
  }
  await tx`update conexiones set estado_suministro=${estado}, cable_suministrado_id=null, decision_heredada=false where id=${conexionId}`;
}

export async function desasignarCablesDeConexiones(tx: TransactionSql, ids: string[]) {
  if (ids.length === 0) return;
  await tx`update conexiones set estado_suministro='por_determinar', cable_suministrado_id=null, decision_heredada=false
    where id in ${tx(ids)} and (estado_suministro='incluido' or cable_suministrado_id is not null)`;
}

export async function asignarCableSuministrado(sql: Sql, conexionId: string, cableId: string) {
  return transaccionConControl(sql, (tx) => aplicarEstadoCableEnTx(tx, conexionId, 'incluido', cableId));
}

export async function retirarAsignacionCable(sql: Sql, conexionId: string, destino: 'por_determinar' | 'adicional' = 'por_determinar') {
  return transaccionConControl(sql, (tx) => aplicarEstadoCableEnTx(tx, conexionId, destino, null));
}

export async function marcarCableAdicional(sql: Sql, conexionId: string) {
  return transaccionConControl(sql, async (tx) => {
    const [c] = await tx`select cable_suministrado_id from conexiones where id=${conexionId} for update`;
    if (!c) throw new ConexionRechazada('La conexión ya no existe.');
    if (c.cable_suministrado_id) throw new ConexionRechazada('Retira la asignación del latiguillo antes de marcarlo adicional.');
    await aplicarEstadoCableEnTx(tx, conexionId, 'adicional', null);
  });
}
