import { Boton, Campo, ContenedorTabla, Enlace, Tarjeta, Vacio } from '@/components/ui';
import { QuienTecnico } from '@/components/ciclo-vida/quien';
import { crearCargaDesdeReservas } from '@/app/acciones-almacen';
import { ETIQUETA_CARGA } from '@/lib/tipos';
import type { CargaConResumen } from '@/lib/datos-almacen';

/**
 * Las cargas de esta obra, y el botón para preparar una nueva.
 *
 * La lista sale de las reservas activas: lo que se apartó es lo que sube a la
 * furgoneta. Sin reservas no hay carga, a propósito — cargar sin apartar es
 * como se lleva a obra material que otra sala estaba esperando.
 */
export function CargasDeSala({
  salaId,
  nombreSala,
  cargas,
  reservasActivas,
}: {
  salaId: string;
  nombreSala: string;
  cargas: CargaConResumen[];
  reservasActivas: number;
}) {
  return (
    <Tarjeta
      titulo="Carga de furgoneta"
      pie="La lista se marca desde el móvil, de pie en el almacén. Al confirmarla, lo marcado sale del stock."
    >
      {cargas.length === 0 ? (
        <Vacio>Sin cargas preparadas para esta sala.</Vacio>
      ) : (
        <ContenedorTabla etiqueta="Carga de furgoneta">
        <table className="datos">
          <thead>
            <tr>
              <th>Carga</th>
              <th>Estado</th>
              <th className="num">Marcadas</th>
            </tr>
          </thead>
          <tbody>
            {cargas.map((c) => (
              <tr key={c.id}>
                <td>
                  <Enlace href={`/carga/${c.id}`}>{c.nombre}</Enlace>
                </td>
                <td className={c.estado === 'cerrada' ? 'text-tinta-tenue' : undefined}>
                  {ETIQUETA_CARGA[c.estado]}
                </td>
                <td className="num">
                  {c.cargadas} / {c.lineas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      <form
        action={crearCargaDesdeReservas}
        className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-linea"
      >
        <input type="hidden" name="sala_id" value={salaId} />
        <Campo etiqueta="Nombre de la carga">
          <input
            name="nombre"
            defaultValue={`Carga · ${nombreSala}`}
            className="min-w-[14rem]"
          />
        </Campo>
        <Campo etiqueta="Quién">
          <QuienTecnico />
        </Campo>
        <Boton disabled={reservasActivas === 0}>Preparar carga</Boton>
        <span className="text-tinta-tenue pb-1">
          {reservasActivas === 0
            ? 'Antes hay que reservar el material de la obra.'
            : `${reservasActivas} ${reservasActivas === 1 ? 'reserva activa' : 'reservas activas'}.`}
        </span>
      </form>
    </Tarjeta>
  );
}
