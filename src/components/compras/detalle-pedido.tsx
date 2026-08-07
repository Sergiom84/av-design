import { Aviso, Boton, Campo, ContenedorTabla, Dato, Enlace, Tarjeta } from '@/components/ui';
import { QuienTecnico } from '@/components/ciclo-vida/quien';
import {
  borrarLineaPedido,
  cambiarEstadoPedido,
  guardarPedido,
  recibirLineaPedido,
  recibirPedidoCompleto,
} from '@/app/acciones-almacen';
import { pendienteDeRecibir } from '@/lib/compras';
import { ETIQUETA_PEDIDO, type LineaPedido, type Pedido, type Ubicacion } from '@/lib/tipos';

/** La ficha del pedido: quién, para qué obra y en qué estado va. */
export function CabeceraPedido({ pedido }: { pedido: Pedido }) {
  return (
    <Tarjeta titulo="Pedido">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Dato etiqueta="Proveedor" valor={pedido.proveedor ?? 'Sin proveedor'} />
        <Dato
          etiqueta="Obra"
          valor={
            pedido.sala_id ? (
              <Enlace href={`/salas/${pedido.sala_id}`}>{pedido.sala}</Enlace>
            ) : (
              'Reposición de almacén'
            )
          }
        />
        <Dato etiqueta="Estado" valor={ETIQUETA_PEDIDO[pedido.estado]} />
        <Dato etiqueta="Fecha" valor={pedido.fecha ?? '—'} />
      </div>

      <form action={guardarPedido} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={pedido.id} />
        <Campo etiqueta="Referencia">
          <input
            name="referencia"
            defaultValue={pedido.referencia ?? ''}
            className="min-w-[14rem]"
          />
        </Campo>
        <Campo etiqueta="Fecha">
          <input name="fecha" type="date" defaultValue={pedido.fecha ?? ''} />
        </Campo>
        <Campo etiqueta="Notas">
          <input name="notas" defaultValue={pedido.notas ?? ''} className="min-w-[14rem]" />
        </Campo>
        <Boton variante="secundario">Guardar</Boton>
      </form>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-linea">
        {(['borrador', 'pedido', 'recibido'] as const).map((estado) => (
          <form key={estado} action={cambiarEstadoPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <input type="hidden" name="estado" value={estado} />
            <Boton
              variante={pedido.estado === estado ? 'principal' : 'secundario'}
              disabled={pedido.estado === estado}
            >
              {ETIQUETA_PEDIDO[estado]}
            </Boton>
          </form>
        ))}
      </div>
    </Tarjeta>
  );
}

/**
 * Las líneas y su recepción.
 *
 * Recibir sube la cantidad **y** genera la entrada en almacén, en la misma
 * transacción. Si hubiera que teclearlo dos veces, la segunda no se haría y el
 * stock volvería a estar desactualizado.
 */
export function LineasPedido({
  pedido,
  lineas,
  ubicaciones,
}: {
  pedido: Pedido;
  lineas: LineaPedido[];
  ubicaciones: Ubicacion[];
}) {
  const orientativas = lineas.filter((l) => l.precio_orientativo);
  const total = lineas
    .map((l) => (l.precio_unitario != null ? l.precio_unitario * l.cantidad : 0))
    .reduce((t, i) => t + i, 0);
  const pendientes = lineas.filter((l) => pendienteDeRecibir(l) > 0);

  return (
    <Tarjeta
      titulo="Líneas"
      pie={`Total ${total.toFixed(2)} € · ${pendientes.length} de ${lineas.length} líneas pendientes de recibir`}
    >
      {orientativas.length > 0 && (
        <div className="mb-4">
          <Aviso>
            <strong>{orientativas.length}</strong>{' '}
            {orientativas.length === 1 ? 'línea se valora' : 'líneas se valoran'} con
            precio orientativo: {orientativas.map((l) => l.descripcion).join(', ')}. Se
            puede presupuestar con él; para mandar el pedido hace falta oferta escrita.
          </Aviso>
        </div>
      )}

      <ContenedorTabla etiqueta="Líneas del pedido">
      <table className="datos">
        <thead>
          <tr>
            <th>Referencia</th>
            <th className="num">Pedido</th>
            <th className="num">Recibido</th>
            <th className="num">Pendiente</th>
            <th className="num">Precio</th>
            <th>Recibir</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => {
            const pendiente = pendienteDeRecibir(l);
            return (
              <tr key={l.id}>
                <td>
                  <Enlace href={`/articulo/${l.articulo_id}`}>{l.descripcion}</Enlace>
                </td>
                <td className="num">
                  {l.cantidad} {l.unidad}
                </td>
                <td className="num">{l.cantidad_recibida}</td>
                <td className={`num ${pendiente > 0 ? '' : 'text-tinta-tenue'}`}>
                  {pendiente > 0 ? pendiente : '—'}
                </td>
                <td className="num">
                  {l.precio_unitario != null ? `${l.precio_unitario.toFixed(2)} €` : '—'}
                  {l.precio_orientativo && (
                    <span className="text-aviso ml-1">orientativo</span>
                  )}
                </td>
                <td>
                  {pendiente > 0 && pedido.estado !== 'borrador' ? (
                    <form
                      action={recibirLineaPedido}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="pedido_id" value={pedido.id} />
                      <input
                        name="cantidad"
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={pendiente}
                        className="w-20"
                        aria-label={`Cantidad recibida de ${l.descripcion}`}
                      />
                      <select
                        name="ubicacion_id"
                        defaultValue={ubicaciones.find((u) => !u.es_furgoneta)?.id ?? ''}
                        aria-label="Ubicación de entrada"
                      >
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                      <Boton variante="secundario">Recibir</Boton>
                    </form>
                  ) : (
                    <span className="text-tinta-tenue">
                      {pedido.estado === 'borrador' ? 'Mándalo primero' : 'Completa'}
                    </span>
                  )}
                </td>
                <td>
                  <form action={borrarLineaPedido}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="pedido_id" value={pedido.id} />
                    <Boton variante="peligro">Quitar</Boton>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </ContenedorTabla>

      {pendientes.length > 0 && pedido.estado !== 'borrador' && (
        <form
          action={recibirPedidoCompleto}
          className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-linea"
        >
          <input type="hidden" name="id" value={pedido.id} />
          <Campo etiqueta="Ubicación de entrada">
            <select
              name="ubicacion_id"
              defaultValue={ubicaciones.find((u) => !u.es_furgoneta)?.id ?? ''}
            >
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Quién">
            <QuienTecnico rol="recepcion" />
          </Campo>
          <Boton>Recibir todo lo pendiente</Boton>
        </form>
      )}
    </Tarjeta>
  );
}
