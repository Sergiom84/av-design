import { Boton, Campo, Tarjeta } from '@/components/ui';
import { asignarSalaALocalizacion } from '@/app/acciones-proyectos';
import type { LocalizacionDeProyecto } from '@/lib/datos-proyectos';

/**
 * Adoptar salas de antes de la jerarquía. La sala elegida entra en la
 * localización elegida y arrastra la sede de la obra. Solo se enseña si
 * queda alguna sala suelta.
 */
export function AdopcionDeSalas({
  localizaciones,
  salasSueltas,
}: {
  localizaciones: LocalizacionDeProyecto[];
  salasSueltas: Array<{ id: string; nombre: string; codigo: string | null; sede: string | null }>;
}) {
  if (salasSueltas.length === 0) return null;

  return (
    <Tarjeta
      titulo="Adoptar salas sin proyecto"
      pie={`${salasSueltas.length} ${salasSueltas.length === 1 ? 'sala suelta' : 'salas sueltas'} de antes de la jerarquía. Adoptarlas no toca su diseño: solo las cuelga de la obra.`}
    >
      <form action={asignarSalaALocalizacion} className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Sala">
          <select name="sala_id" required className="w-64">
            {salasSueltas.map((s) => (
              <option key={s.id} value={s.id}>
                {[s.nombre, s.codigo, s.sede].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Localización">
          <select name="localizacion_id" required className="w-56">
            {localizaciones.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Boton variante="secundario">Adoptar</Boton>
      </form>
    </Tarjeta>
  );
}
