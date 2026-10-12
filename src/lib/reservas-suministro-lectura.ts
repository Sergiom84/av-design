import type { Sql, TransactionSql } from 'postgres';
import { leerAtribucionesSuministro } from './atribuciones-suministro-db';
import { disponibilidadDeArticulos } from './datos-almacen';

export interface FilaReservaSuministro {
  suministroId: string;
  referencia: string;
  reservado: number;
  servido: number;
  pendiente: number;
  disponible: number;
  /** Reserva B2b activa: la que Liberar/Preparar pueden operar. */
  reservaGestionadaId: string | null;
  /** Todos los reserva_id de reserva_suministros de esta unidad, cualquier estado. */
  reservasVinculadas: string[];
  cargaId: string | null;
}

/** Cobertura B1, saldo global y acción disponible pertenecen a una instantánea. */
export async function leerReservasSuministro(tx: TransactionSql, salaId: string): Promise<FilaReservaSuministro[]> {
  const cobertura = await leerAtribucionesSuministro(tx, salaId);
  const suministros = await tx<{id:string;articulo_id:string;referencia:string;reserva_id:string|null;reservas_vinculadas:string[];carga_id:string|null}[]>`
    select s.id,s.articulo_id,coalesce(s.snapshot->>'sku',a.referencia,a.modelo) as referencia,
      (select r.id from reservas r join reserva_suministros rs on rs.reserva_id=r.id
       where rs.suministro_id=s.id and r.estado='activa'
       and exists(select 1 from operaciones_reserva_kit o
         where o.reserva_id=r.id and o.suministro_id=s.id and o.operacion='reservar')) as reserva_id,
      coalesce((select array_agg(rs.reserva_id order by rs.reserva_id)
        from reserva_suministros rs where rs.suministro_id=s.id),'{}'::uuid[]) as reservas_vinculadas,
      (select o.carga_id from operaciones_carga_kit o
       where o.operacion='preparar' and not o.reutilizada
         and o.reserva_id=(select r.id from reservas r join reserva_suministros rs on rs.reserva_id=r.id
           where rs.suministro_id=s.id and r.estado='activa'
           and exists(select 1 from operaciones_reserva_kit g
             where g.reserva_id=r.id and g.suministro_id=s.id and g.operacion='reservar'))) as carga_id
    from sala_suministros s join articulos a on a.id=s.articulo_id
    where s.sala_id=${salaId} and s.estado='activo' order by s.creado_en,s.id`;
  const disponibilidad = await disponibilidadDeArticulos([...new Set(suministros.map(s => s.articulo_id))], tx);
  return suministros.map(s => {
    const c = cobertura.porSuministro.get(s.id);
    const d = disponibilidad.get(s.articulo_id);
    if (!c || !d) throw new Error('La lectura del suministro está incompleta.');
    return {suministroId:s.id,referencia:s.referencia,reservado:c.reservado,servido:c.servido,
      pendiente:c.pendiente,disponible:d.disponible,reservaGestionadaId:s.reserva_id,
      reservasVinculadas:(s.reservas_vinculadas??[]).map(String),cargaId:s.carga_id};
  });
}

export async function obtenerReservasSuministro(sql: Sql, salaId: string): Promise<FilaReservaSuministro[]> {
  return sql.begin('isolation level repeatable read read only', tx => leerReservasSuministro(tx, salaId));
}
