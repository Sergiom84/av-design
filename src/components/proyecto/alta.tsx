import { crearProyecto } from '@/app/acciones-proyectos';
import { Boton, Campo, Tarjeta } from '@/components/ui';
import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/datos-proyectos';

/**
 * Alta de la obra. Nombre y poco más: la obra nace con la localización
 * "Sin asignar" y las demás se añaden desde su portada. La sede es el mismo
 * texto libre con sugerencias del alta de sala.
 */
export function AltaDeProyecto({ sedes }: { sedes: string[] }) {
  return (
    <Tarjeta
      titulo="Nuevo proyecto"
      pie={`Nace con la localización "${LOCALIZACION_SIN_ASIGNAR}". Las demás se añaden desde su portada.`}
    >
      <form action={crearProyecto} className="grid sm:grid-cols-2 gap-3 max-w-xl">
        <Campo etiqueta="Nombre">
          <input
            name="nombre"
            required
            placeholder="Renovación salas TP 2026"
            className="w-full"
          />
        </Campo>
        <Campo etiqueta="Código">
          <input name="codigo" placeholder="TP26" className="w-full" />
        </Campo>
        <Campo etiqueta="Sede">
          <input
            name="sede"
            list="sedes-conocidas-proyecto"
            placeholder="Madrid"
            className="w-full"
          />
          <datalist id="sedes-conocidas-proyecto">
            {sedes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Notas">
          <input name="notas" className="w-full" />
        </Campo>
        <div className="sm:col-span-2">
          <Boton>Crear proyecto</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
