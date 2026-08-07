import { Aviso, Boton, Campo, ContenedorTabla, Enlace, Tarjeta, Vacio } from '@/components/ui';
import {
  borrarReserva,
  crearReserva,
  liberarReserva,
  reservarLoDisponible,
} from '@/app/acciones-almacen';
import type { Disponibilidad } from '@/lib/almacen';
import { ETIQUETA_RESERVA } from '@/lib/tipos';
import type { FilaReserva } from '@/lib/datos-almacen';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';

/**
 * Material apartado para esta obra.
 *
 * Reservado no es salido: sigue en el estante, pero ya no está disponible para
 * otra sala. Es lo que evita el fallo de partida —pedir dos veces lo mismo
 * porque estaba comprometido y no se veía— y lo que hace que la lista de
 * carga tenga de dónde salir.
 */
export function ReservasDeSala({
  salaId,
  reservas,
  disponibilidad,
}: {
  salaId: string;
  reservas: FilaReserva[];
  disponibilidad: Map<string, Disponibilidad>;
}) {
  const activas = reservas.filter((r) => r.estado === 'activa');
  const resto = reservas.filter((r) => r.estado !== 'activa');

  return (
    <Tarjeta
      titulo="Material reservado"
      pie="Lo reservado sigue en almacén hasta que se carga. Al confirmar la carga se convierte en salida."
    >
      {reservas.length === 0 ? (
        <Vacio>
          Sin reservas. Aparta aquí el material de esta obra para que otra no cuente con
          él.
        </Vacio>
      ) : (
        <ContenedorTabla etiqueta="Material reservado">
        <table className="datos">
          <thead>
            <tr>
              <th>Referencia</th>
              <th className="num">Cantidad</th>
              <th>Estado</th>
              <th className="num">Disponible ahora</th>
              <th>Notas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...activas, ...resto].map((r) => {
              const d = disponibilidad.get(r.articulo_id);
              return (
                <tr key={r.id}>
                  <td>
                    <Enlace href={`/articulo/${r.articulo_id}`}>{r.descripcion}</Enlace>
                  </td>
                  <td className="num">
                    {r.cantidad} {r.unidad}
                  </td>
                  <td
                    className={r.estado === 'activa' ? undefined : 'text-tinta-tenue'}
                  >
                    {ETIQUETA_RESERVA[r.estado]}
                  </td>
                  <td className="num text-tinta-tenue">
                    {d ? `${d.disponible} de ${d.existencias}` : '—'}
                  </td>
                  <td className="text-tinta-tenue">{r.notas ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    {r.estado === 'activa' && (
                      <form action={liberarReserva} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="sala_id" value={salaId} />
                        <Boton variante="secundario">Liberar</Boton>
                      </form>
                    )}{' '}
                    <form action={borrarReserva} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="sala_id" value={salaId} />
                      <Boton variante="peligro">Quitar</Boton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      {[...disponibilidad.values()].some((d) => d.sobre_reservado) && (
        <div className="mt-4">
          <Aviso tono="alerta">
            Hay artículos con más reservado que existencias. Se puede seguir —el material
            puede estar pedido— pero alguien está contando con algo que no está en el
            estante.
          </Aviso>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-linea space-y-3">
        <form action={crearReserva} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="sala_id" value={salaId} />
          <BuscadorArticulo etiqueta="Referencia" requerido className="w-full sm:w-[18rem]" />
          <Campo etiqueta="Cantidad">
            <input
              name="cantidad"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="w-24"
            />
          </Campo>
          <Campo etiqueta="Quién">
            <input name="quien" className="w-32" />
          </Campo>
          <Boton>Reservar</Boton>
        </form>

        <form action={reservarLoDisponible} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="sala_id" value={salaId} />
          <Boton variante="secundario">Reservar todo lo disponible</Boton>
          <span className="text-tinta-tenue pb-1">
            Aparta de golpe lo que la obra necesita y el almacén puede dar. Lo que no hay
            se compra.
          </span>
        </form>
      </div>
    </Tarjeta>
  );
}
