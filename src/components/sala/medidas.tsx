import { Boton, Campo, Tarjeta } from '@/components/ui';
import { guardarSala } from '@/app/acciones';
import { ETIQUETA_RUTA, type Sala } from '@/lib/tipos';

/**
 * La geometría de la sala. Es el dato que XTEN-AV no pide en ningún punto de
 * su flujo (docs/06, apartado 6) y sin el cual no hay metros que calcular.
 */
export function Medidas({ sala }: { sala: Sala }) {
  return (
    <Tarjeta titulo="Medidas y ruta">
      <form action={guardarSala} className="space-y-3">
        <input type="hidden" name="id" value={sala.id} />
        <Campo etiqueta="Nombre">
          <input name="nombre" defaultValue={sala.nombre} className="w-full" />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Sede">
            <input name="sede" defaultValue={sala.sede ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Edificio">
            <input name="edificio" defaultValue={sala.edificio ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Nivel">
            <input name="nivel" defaultValue={sala.nivel ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Código">
            <input name="codigo" defaultValue={sala.codigo ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Tipología">
            <input name="tipologia" defaultValue={sala.tipologia ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Aforo">
            <input
              name="aforo"
              type="number"
              min="0"
              defaultValue={sala.aforo ?? ''}
              className="w-full"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Largo (m)">
            <input
              name="largo_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.largo_m || ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Ancho (m)">
            <input
              name="ancho_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.ancho_m || ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Alto (m)">
            <input
              name="alto_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_m || ''}
              className="w-full"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Falso techo">
            <input
              name="alto_falso_techo_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_falso_techo_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Canaleta">
            <input
              name="alto_canaleta_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_canaleta_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Suelo técnico">
            <input
              name="alto_suelo_tecnico_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_suelo_tecnico_m ?? ''}
              className="w-full"
            />
          </Campo>
        </div>

        <Campo
          etiqueta="Ruta por defecto"
          ayuda="Por dónde discurren los cables salvo que la conexión diga otra cosa."
        >
          <select
            name="ruta_por_defecto"
            defaultValue={sala.ruta_por_defecto}
            className="w-full"
          >
            {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Notas">
          <textarea name="notas" defaultValue={sala.notas ?? ''} rows={3} className="w-full" />
        </Campo>

        <Boton>Guardar</Boton>
      </form>
    </Tarjeta>
  );
}
