import {transaccionConControl} from './control-escritura';
import type { Sql, TransactionSql } from 'postgres';
import { bloquearObraCompra, bloquearPedidoCompra } from './operaciones-compras';
import { proyectarCoberturaSuministros, type SuministroParaCobertura,
  type AsignacionPedidoParaCobertura, type ReservaParaCobertura,
  type MovimientoParaCobertura, type MovimientoSinAtribuir } from './cobertura-suministros';

type Atribucion = { suministroId: string; cantidad: 1 };
export type AtribucionDeRegistro =
  | { tipo: 'pedido'; registroId: string; atribuciones: (Atribucion & { recibido: 0 | 1 })[] }
  | { tipo: 'reserva'; registroId: string; atribuciones: Atribucion[] }
  | { tipo: 'movimiento'; registroId: string; atribuciones: (Atribucion & { salidaMovimientoId: string | null })[] };

/** Interna, sin acción/UI pública. Conserva el registro histórico original.
 * No atribuye stock a un pedido supuesto ni abre operaciones bloqueadas por L3A.
 */
export async function atribuirRegistroExistente(sql: Sql, entrada: AtribucionDeRegistro) {
  if (!entrada.atribuciones.length || entrada.atribuciones.some(a => a.cantidad !== 1)
    || new Set(entrada.atribuciones.map(a => a.suministroId)).size !== entrada.atribuciones.length) {
    throw new Error('Selecciona suministros distintos y una unidad por suministro.');
  }
  await transaccionConControl(sql, async tx => {
    if (entrada.tipo === 'pedido') {
      const [linea] = await tx`select pedido_id from pedido_lineas where id=${entrada.registroId}`;
      if (!linea) throw new Error('Línea de pedido inexistente.');
      await bloquearPedidoCompra(tx, linea.pedido_id);
      const [actual] = await tx`select pedido_id from pedido_lineas where id=${entrada.registroId} for update`;
      if (!actual || actual.pedido_id !== linea.pedido_id) throw new Error('La línea ha cambiado de pedido.');
    } else {
      const tabla = entrada.tipo === 'reserva' ? 'reservas' : 'movimientos';
      const [origen] = await tx`select sala_id from ${tx(tabla)} where id=${entrada.registroId}`;
      if (!origen?.sala_id) throw new Error('El registro requiere una sala explícita.');
      await bloquearObraCompra(tx, origen.sala_id);
      const [actual] = await tx`select sala_id from ${tx(tabla)} where id=${entrada.registroId} for update`;
      if (!actual || actual.sala_id !== origen.sala_id) throw new Error('El registro ha cambiado de sala.');
    }
    const ids = entrada.atribuciones.map(a => a.suministroId).sort();
    const suministros = await tx`select id from sala_suministros where id=any(${ids}::uuid[]) order by id for update`;
    if (suministros.length !== ids.length) throw new Error('Suministro inexistente.');
    for (const id of ids) {
      if (entrada.tipo === 'pedido') {
        const a = entrada.atribuciones.find(a => a.suministroId === id)!;
        await tx`insert into suministro_pedido_asignaciones(pedido_linea_id,suministro_id,cantidad,cantidad_recibida_atribuida)
          values(${entrada.registroId},${id},${a.cantidad},${a.recibido})`;
      } else if (entrada.tipo === 'reserva') {
        await tx`insert into reserva_suministros(reserva_id,suministro_id,cantidad) values(${entrada.registroId},${id},1)`;
      } else {
        const a = entrada.atribuciones.find(a => a.suministroId === id)!;
        await tx`insert into movimiento_suministros(movimiento_id,suministro_id,cantidad,salida_movimiento_id)
          values(${entrada.registroId},${id},${a.cantidad},${a.salidaMovimientoId})`;
      }
    }
  });
}

/** Puede reutilizar la transacción de un futuro lector compuesto. */
export async function leerAtribucionesSuministro(tx: TransactionSql, salaId: string) {
  const suministros = await tx<SuministroParaCobertura[]>`select id,articulo_id from sala_suministros where sala_id=${salaId} and estado='activo' order by id`;
  const ids = suministros.map(s => s.id);
  const asignacionesPedido = await tx<AsignacionPedidoParaCobertura[]>`select suministro_id,cantidad::float8,cantidad_recibida_atribuida::float8 as cantidad_recibida
    from suministro_pedido_asignaciones where suministro_id=any(${ids}::uuid[]) order by pedido_linea_id,suministro_id`;
  const reservas = await tx<ReservaParaCobertura[]>`select a.suministro_id,a.cantidad::float8,r.estado from reserva_suministros a
    join reservas r on r.id=a.reserva_id where a.suministro_id=any(${ids}::uuid[]) order by reserva_id,suministro_id`;
  const movimientos = await tx<MovimientoParaCobertura[]>`select a.suministro_id,a.movimiento_id,m.tipo,a.cantidad::float8,a.salida_movimiento_id
    from movimiento_suministros a join movimientos m on m.id=a.movimiento_id
    where a.suministro_id=any(${ids}::uuid[]) order by movimiento_id,suministro_id`;
  const movimientosSinAtribuir = await tx<MovimientoSinAtribuir[]>`select m.id as movimiento_id,m.articulo_id,m.tipo,
    (m.cantidad-coalesce((select sum(a.cantidad) from movimiento_suministros a where a.movimiento_id=m.id),0))::float8 as cantidad
    from movimientos m where m.sala_id=${salaId} and m.tipo in('entrada','salida','devolucion','baja')
    and m.articulo_id in(select articulo_id from sala_suministros where sala_id=${salaId} and estado='activo')
    and m.cantidad>coalesce((select sum(a.cantidad) from movimiento_suministros a where a.movimiento_id=m.id),0) order by m.id`;
  return proyectarCoberturaSuministros({ suministros, asignacionesPedido, reservas, movimientos, movimientosSinAtribuir });
}

export async function obtenerCoberturaSuministros(sql: Sql, salaId: string) {
  return sql.begin('isolation level repeatable read read only', tx => leerAtribucionesSuministro(tx, salaId));
}
