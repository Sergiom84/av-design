import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import { crearPlantillaDesdeSala } from '@/app/acciones';
import type { EquipoEnSala, Sala } from '@/lib/tipos';

/**
 * El camino de vuelta: de sala terminada a plantilla propia.
 *
 * XTEN-AV lo tiene ("Save as X-DRAW Template") y es lo que permite dejar de
 * heredar las plantillas deducidas del inventario y empezar a usar las que el
 * departamento ha comprobado en obra.
 */
export function GuardarComoPlantilla({
  sala,
  equipos,
}: {
  sala: Sala;
  equipos: EquipoEnSala[];
}) {
  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  return (
    <Tarjeta titulo="Guardar como plantilla">
      {sinMedidas && (
        <div className="mb-4">
          <Aviso>
            Esta sala no tiene todas las medidas: la plantilla saldrá sin ellas y las
            salas que nazcan de ella tampoco calcularán metros.
          </Aviso>
        </div>
      )}

      <form action={crearPlantillaDesdeSala} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="sala_id" value={sala.id} />
        <Campo
          etiqueta="Nombre de la plantilla"
          ayuda={`Se guardan las medidas (${sala.largo_m || '—'} × ${sala.ancho_m || '—'} × ${sala.alto_m || '—'} m), la tipología, el aforo, la ruta y ${equipos.length} equipos.`}
        >
          <input
            name="nombre"
            defaultValue={`${sala.nombre} (plantilla)`}
            className="min-w-[18rem]"
          />
        </Campo>
        <Boton variante="secundario">Crear plantilla</Boton>
      </form>
    </Tarjeta>
  );
}
