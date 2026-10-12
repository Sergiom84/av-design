import { sql } from '@/lib/db';
import { Tarjeta, Vacio } from '@/components/ui';

export async function HistorialRecepcion({ pedidoId }: { pedidoId: string }) {
  const entradas = await sql`select m.id, m.creado_en, m.quien, m.cantidad, u.nombre as almacen,
      a.modelo from movimientos m join pedido_lineas l on l.id = m.pedido_linea_id
    join articulos a on a.id = m.articulo_id left join ubicaciones u on u.id = m.ubicacion_id
    where l.pedido_id = ${pedidoId} order by m.creado_en desc, m.id`;
  return <Tarjeta titulo="Recepciones registradas">
    {entradas.length === 0 ? <Vacio>Sin recepciones registradas con trazabilidad de línea.</Vacio> :
      <ol className="divide-y divide-linea-suave">{entradas.map((e) => <li key={String(e.id)} className="py-3">
        <strong>{String(e.cantidad)} × {String(e.modelo)}</strong>
        <p>{String(e.almacen ?? 'Sin almacén')} · {String(e.quien ?? 'Sin autor registrado')} · {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(e.creado_en))}</p>
      </li>)}</ol>}
  </Tarjeta>;
}
