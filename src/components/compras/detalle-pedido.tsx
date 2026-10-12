import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import { randomUUID } from 'node:crypto';
import { Aviso, Boton, Campo, ContenedorTabla, Dato, Enlace, Tarjeta } from '@/components/ui';
import {
  borrarLineaPedido,
  cambiarEstadoPedido,
  guardarPedido,
  recibirLineaPedido,
  recibirPedidoCompleto,
  registrarOfertaLinea,
} from '@/app/acciones-almacen';
import { pendienteDeRecibir } from '@/lib/compras';
import { ETIQUETA_PEDIDO, type LineaPedido, type Pedido, type Ubicacion } from '@/lib/tipos';

/** La ficha del pedido: quién, para qué obra y en qué estado va. */
export function CabeceraPedido({
  pedido,
  tienePreciosOrientativos,
  compraPendiente,
  ubicaciones,
  proyecto,
}: {
  pedido: Pedido;
  tienePreciosOrientativos: boolean;
  compraPendiente: boolean;
  ubicaciones: Ubicacion[];
  proyecto?: { id: string; nombre: string } | null;
}) {
  return (
    <Tarjeta titulo="Pedido">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Dato etiqueta="Proveedor" valor={pedido.proveedor ?? 'Sin proveedor'} />
        <Dato
          etiqueta="Obra"
          valor={
            pedido.sala_id ? (
              <Enlace href={`/salas/${pedido.sala_id}`}>{pedido.sala}</Enlace>
            ) : proyecto ? (
              <Enlace href={`/proyectos/${proyecto.id}`}>{proyecto.nombre}</Enlace>
            ) : (
              'Reposición de almacén'
            )
          }
        />
        <Dato etiqueta="Estado" valor={ETIQUETA_PEDIDO[pedido.estado]} />
        <Dato etiqueta="Fecha" valor={pedido.fecha ?? '—'} />
      </div>

      <FormularioMutacion key={JSON.stringify(pedido)} action={guardarPedido} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={pedido.id} />
        <Campo etiqueta="Empresa (opcional)">
          <input name="proveedor" defaultValue={pedido.proveedor ?? ''} />
        </Campo>
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
        <Campo etiqueta="Entrega estimada">
          <input name="entrega_prevista" type="date" defaultValue={pedido.entrega_prevista ?? ''} />
        </Campo>
        <Campo etiqueta="Almacén de entrega">
          <select name="ubicacion_prevista_id" defaultValue={pedido.ubicacion_prevista_id ?? ''}>
            <option value="">Por confirmar</option>
            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Notas">
          <input name="notas" defaultValue={pedido.notas ?? ''} className="min-w-[14rem]" />
        </Campo>
        <Boton variante="secundario">Guardar</Boton>
      </FormularioMutacion>

      <FormularioMutacion action={cambiarEstadoPedido} className="mt-4">
        <input type="hidden" name="id" value={pedido.id} />
        <input type="hidden" name="estado" value="pedido" />
        <Boton disabled={tienePreciosOrientativos || !compraPendiente}>
          Registrar compra de todo lo pendiente
        </Boton>
      </FormularioMutacion>
      {tienePreciosOrientativos && (
        <p className="text-sm text-aviso mt-3">
          Añade una oferta final para poder mandar y recibir este pedido.
        </p>
      )}
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
  soloRecepcion = false,
  lineasKit = [],
}: {
  pedido: Pedido;
  lineas: LineaPedido[];
  ubicaciones: Ubicacion[];
  soloRecepcion?: boolean;
  lineasKit?: string[];
}) {
  const orientativas = lineas.filter((l) => l.precio_orientativo);
  const total = lineas
    .map((l) => (l.precio_unitario != null ? l.precio_unitario * l.cantidad : 0))
    .reduce((t, i) => t + i, 0);
  const pendientes = lineas.filter((l) => pendienteDeRecibir(l) > 0);

  return (
    <Tarjeta
      titulo="Checklist de compra y recepción"
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
            <th>Compra</th>
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
                  {l.notas && <p className="text-tinta-tenue whitespace-pre-line">{l.notas}</p>}
                </td>
                <td>
                  {l.comprado_en ? <span>Comprado · {l.comprado_en}<br />{l.comprado_por ?? 'Autor no registrado (histórico)'}</span> : (
                    <FormularioMutacion action={cambiarEstadoPedido}>
                      <input type="hidden" name="id" value={pedido.id} />
                      <input type="hidden" name="linea_id" value={l.id} />
                      <input type="hidden" name="estado" value="pedido" />
                      <Boton variante="secundario" disabled={soloRecepcion || l.precio_orientativo}>Marcar comprado</Boton>
                    </FormularioMutacion>
                  )}
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
                  {!l.comprado_en && <details className="mt-2 text-left">
                    <summary className="cursor-pointer min-h-11">Registrar oferta final</summary>
                    <fieldset disabled={soloRecepcion}><FormularioMutacion action={registrarOfertaLinea} className="space-y-2">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="pedido_id" value={pedido.id} />
                      <Campo etiqueta="Precio unitario (€)"><input name="precio" type="number" min="0" step="0.01" required className="w-32" /></Campo>
                      <Campo etiqueta="Referencia de la oferta"><input name="oferta" required maxLength={300} className="w-48" /></Campo>
                      <Boton variante="secundario">Guardar oferta</Boton>
                    </FormularioMutacion></fieldset>
                  </details>}
                </td>
                <td>
                  {pendiente > 0 && l.comprado_en && !l.precio_orientativo ? (
                    <FormularioMutacion
                      action={recibirLineaPedido}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="recepcion_id" value={randomUUID()} />
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="pedido_id" value={pedido.id} />
                      <input
                        name="cantidad"
                        type="number"
                        step={lineasKit.includes(l.id) ? '1' : '0.01'}
                        min={lineasKit.includes(l.id) ? '1' : '0.01'}
                        defaultValue={pendiente}
                        max={pendiente}
                        className="w-20"
                        aria-label={`Cantidad recibida de ${l.descripcion}`}
                      />
                      <select
                        name="ubicacion_id"
                        defaultValue={pedido.ubicacion_prevista_id ?? ubicaciones.find((u) => !u.es_furgoneta)?.id ?? ''}
                        aria-label="Ubicación de entrada"
                      >
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                      <Boton variante="secundario">Recibir</Boton>
                    </FormularioMutacion>
                  ) : (
                    <span className="text-tinta-tenue">
                      {l.precio_orientativo
                        ? 'Oferta final pendiente'
                        : !l.comprado_en
                          ? 'Compra pendiente'
                          : 'Completa'}
                    </span>
                  )}
                </td>
                <td>
                  <FormularioMutacion action={borrarLineaPedido}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="pedido_id" value={pedido.id} />
                    <Boton variante="peligro" disabled={soloRecepcion || Boolean(l.comprado_en) || l.cantidad_recibida > 0}>Quitar</Boton>
                  </FormularioMutacion>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </ContenedorTabla>

      {pendientes.length > 0 && pendientes.every((l) => l.comprado_en && !l.precio_orientativo) && (
        <FormularioMutacion
          action={recibirPedidoCompleto}
          className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-linea"
        >
          <input type="hidden" name="recepcion_id" value={randomUUID()} />
          <input type="hidden" name="id" value={pedido.id} />
          <Campo etiqueta="Ubicación de entrada">
            <select
              name="ubicacion_id"
              defaultValue={pedido.ubicacion_prevista_id ?? ubicaciones.find((u) => !u.es_furgoneta)?.id ?? ''}
            >
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Boton>Recibir todo lo pendiente</Boton>
        </FormularioMutacion>
      )}
    </Tarjeta>
  );
}
