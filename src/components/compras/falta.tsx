import { Aviso, Boton, ContenedorTabla, Enlace, Tarjeta, Vacio } from '@/components/ui';
import { crearPedidoDesdeFalta } from '@/app/acciones-almacen';
import type { GrupoProveedor, LineaFaltante } from '@/lib/compras';

/**
 * Lo que hay que comprar para dejar la sala montada.
 *
 *   material necesario − disponible en almacén = lo que falta
 *
 * El material necesario lo dan la lista de equipos de la sala y el cálculo de
 * cable; el disponible, el almacén. Agrupado por proveedor, porque un pedido
 * se manda a un proveedor y no a un catálogo.
 */
export function QueFalta({
  salaId,
  faltantes,
  grupos,
  sinCatalogar,
}: {
  salaId: string;
  faltantes: LineaFaltante[];
  grupos: GrupoProveedor[];
  sinCatalogar: string[];
}) {
  const hayFalta = grupos.length > 0;

  return (
    <Tarjeta
      titulo="Qué falta"
      pie="Necesario menos disponible. Lo ya reservado para esta obra no vuelve a contarse: apartarlo no es comprarlo dos veces."
    >
      {sinCatalogar.length > 0 && (
        <div className="mb-4">
          <Aviso>
            <strong>{sinCatalogar.length}</strong>{' '}
            {sinCatalogar.length === 1 ? 'equipo' : 'equipos'} de la sala sin referencia
            de catálogo: {sinCatalogar.join(', ')}. No se pueden pedir hasta que tengan
            ficha.
          </Aviso>
        </div>
      )}

      {faltantes.length === 0 ? (
        <Vacio>
          La sala no tiene material asignado todavía. Añade equipos y conexiones y aquí
          saldrá qué hay que comprar.
        </Vacio>
      ) : (
        <ContenedorTabla etiqueta="Qué falta">
        <table className="datos">
          <thead>
            <tr>
              <th>Referencia</th>
              <th className="num">Necesario</th>
              <th className="num">En almacén</th>
              <th className="num">Falta</th>
              <th>De dónde sale</th>
            </tr>
          </thead>
          <tbody>
            {faltantes.map((l) => (
              <tr key={l.articulo_id}>
                <td>
                  <Enlace href={`/articulo/${l.articulo_id}`}>{l.descripcion}</Enlace>
                </td>
                <td className="num">
                  {l.cantidad} {l.unidad}
                </td>
                <td className="num text-tinta-tenue">{l.disponible}</td>
                <td className={`num ${l.falta > 0 ? 'text-alerta' : ''}`}>
                  {l.falta > 0 ? l.falta : '—'}
                </td>
                <td className="text-tinta-tenue">{l.detalle.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      {hayFalta && (
        <div className="mt-6 pt-4 border-t border-linea space-y-6">
          <h3 className="t-subtitulo">Pedidos por proveedor</h3>

          {grupos.map((g) => (
            <div key={g.proveedor ?? 'sin-proveedor'} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <span className="t-subtitulo">{g.proveedor ?? 'Sin proveedor'}</span>{' '}
                  <span className="text-tinta-tenue">
                    · {g.lineas.length}{' '}
                    {g.lineas.length === 1 ? 'línea' : 'líneas'}
                    {g.total != null ? ` · ${g.total.toFixed(2)} €` : ''}
                  </span>
                </div>
                {g.proveedor && (
                  <form action={crearPedidoDesdeFalta}>
                    <input type="hidden" name="sala_id" value={salaId} />
                    <input type="hidden" name="proveedor" value={g.proveedor} />
                    <Boton variante="secundario">Crear pedido</Boton>
                  </form>
                )}
              </div>

              {g.lineas_orientativas > 0 && (
                <Aviso>
                  {g.lineas_orientativas}{' '}
                  {g.lineas_orientativas === 1 ? 'línea se valora' : 'líneas se valoran'}{' '}
                  con precio orientativo. Sirve para presupuestar; para pedir hace falta
                  oferta escrita del proveedor.
                </Aviso>
              )}
              {g.lineas_sin_precio > 0 && (
                <Aviso tono="neutro">
                  {g.lineas_sin_precio}{' '}
                  {g.lineas_sin_precio === 1 ? 'línea' : 'líneas'} sin precio en el
                  catálogo. El pedido se puede preparar igual; el importe no sale.
                </Aviso>
              )}

              <ContenedorTabla etiqueta={`Pedido ${g.proveedor ?? 'sin proveedor'}`}>
              <table className="datos">
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Precio</th>
                    <th className="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lineas.map((l) => (
                    <tr key={l.articulo_id}>
                      <td>
                        <Enlace href={`/articulo/${l.articulo_id}`}>
                          {l.descripcion}
                        </Enlace>
                      </td>
                      <td className="num">
                        {l.cantidad} {l.unidad}
                      </td>
                      <td className="num">
                        {l.precio_unitario != null
                          ? `${l.precio_unitario.toFixed(2)} €`
                          : '—'}
                        {l.precio_orientativo && (
                          <span className="text-aviso ml-1">orientativo</span>
                        )}
                      </td>
                      <td className="num">
                        {l.importe != null ? `${l.importe.toFixed(2)} €` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </ContenedorTabla>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}
