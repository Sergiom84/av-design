import { Enlace, Tarjeta, Vacio } from '@/components/ui';
import { ETIQUETA_PEDIDO } from '@/lib/tipos';
import type { PedidoConTotales } from '@/lib/datos-almacen';

/**
 * Los pedidos, del más reciente al más antiguo.
 *
 * El estado es el ciclo real: borrador mientras se prepara, pedido cuando se
 * ha mandado, recibido parcial mientras llega a trozos, recibido cuando está
 * todo. Lo dice la recepción, no quien teclea.
 */
export function ListaPedidos({ pedidos }: { pedidos: PedidoConTotales[] }) {
  if (pedidos.length === 0) {
    return (
      <Tarjeta titulo="Pedidos">
        <Vacio>
          Sin pedidos. Se generan desde una sala, con lo que falta agrupado por
          proveedor.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Pedidos">
      <table className="datos">
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Proveedor</th>
            <th>Obra</th>
            <th>Estado</th>
            <th className="num">Líneas</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td>
                <Enlace href={`/compras/${p.id}`}>
                  {p.referencia ?? 'Pedido sin referencia'}
                </Enlace>
              </td>
              <td className="text-tinta-tenue">{p.proveedor ?? '—'}</td>
              <td className="text-tinta-tenue">{p.sala ?? '—'}</td>
              <td
                className={
                  p.estado === 'recibido'
                    ? 'text-tinta-tenue'
                    : p.estado === 'borrador'
                      ? 'text-aviso'
                      : undefined
                }
              >
                {ETIQUETA_PEDIDO[p.estado]}
              </td>
              <td className="num">{p.lineas}</td>
              <td className="num">
                {p.total != null ? `${p.total.toFixed(2)} €` : '—'}
                {p.orientativas > 0 && (
                  <span className="text-aviso ml-1">orientativo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}
