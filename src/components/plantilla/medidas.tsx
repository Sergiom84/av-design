import { Boton, Campo } from '@/components/ui';
import { guardarMedidasPlantilla } from '@/app/acciones';
import { ETIQUETA_RUTA, type PlantillaSala } from '@/lib/tipos';

/**
 * Las medidas de la plantilla: se rellenan una vez y las heredan todas las
 * salas que nazcan de ella. Es la tarea pendiente número uno del departamento,
 * porque sin esto ninguna sala nueva arranca con geometría.
 */
export function MedidasDePlantilla({ plantilla }: { plantilla: PlantillaSala }) {
  const p = plantilla;

  return (
    <form action={guardarMedidasPlantilla} className="space-y-3">
      <input type="hidden" name="id" value={p.id} />

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['largo_m', 'Largo (m)', p.largo_m],
            ['ancho_m', 'Ancho (m)', p.ancho_m],
            ['alto_m', 'Alto (m)', p.alto_m],
            ['alto_falso_techo_m', 'Falso techo (m)', p.alto_falso_techo_m],
            // La mesa la hereda la sala y es lo que hace que el croquis salga
            // dibujado desde el primer momento, sin tocar nada.
            ['mesa_largo_m', 'Mesa largo (m)', p.mesa_largo_m],
            ['mesa_ancho_m', 'Mesa ancho (m)', p.mesa_ancho_m],
            ['mesa_alto_cm', 'Mesa alto (cm)', p.mesa_alto_cm],
          ] as const
        ).map(([clave, etiqueta, valor]) => (
          <Campo key={clave} etiqueta={etiqueta}>
            <input
              name={clave}
              type="number"
              step="0.01"
              min="0"
              defaultValue={valor ?? ''}
              className="w-full num"
            />
          </Campo>
        ))}
      </div>

      <Campo etiqueta="Ruta habitual">
        <select name="ruta_por_defecto" defaultValue={p.ruta_por_defecto} className="w-full">
          {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
            <option key={v} value={v}>
              {e}
            </option>
          ))}
        </select>
      </Campo>

      <Boton>Guardar medidas</Boton>
    </form>
  );
}
