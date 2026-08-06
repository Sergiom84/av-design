import { Boton, Campo, Tarjeta } from '@/components/ui';
import { crearVisita } from '@/app/acciones-checkin';
import type { Sala } from '@/lib/tipos';

/**
 * Abrir una visita de check-in a una sala.
 *
 * Aquí sí hay un `<select>` con todas las salas: son 390 como mucho y una sola
 * vez en la página, no una por fila. Lo que no cabe en un desplegable es el
 * catálogo, con sus 948 referencias repetidas por bloque; para eso está
 * `buscador-articulo`.
 */
export function AltaDeVisita({ salas }: { salas: Sala[] }) {
  return (
    <Tarjeta titulo="Nueva visita">
      <form action={crearVisita} className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Sala">
          <select name="sala_id" required defaultValue="" className="max-w-[18rem]">
            <option value="" disabled>
              Elegir sala
            </option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {[s.codigo, s.nombre].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Nombre" ayuda="En blanco: la sala y la fecha de hoy">
          <input name="nombre" className="w-48" />
        </Campo>
        <Campo etiqueta="Quién va">
          <input name="quien" className="w-32" />
        </Campo>
        <Boton variante="principal">Abrir visita</Boton>
      </form>
    </Tarjeta>
  );
}
