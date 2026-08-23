import { crearProyecto } from '@/app/acciones-proyectos';
import { Boton, Campo, Tarjeta } from '@/components/ui';
import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/datos-proyectos';
import { listarTecnicosConRoles } from '@/lib/datos-ciclo';
import { tecnicosDeRol } from '@/lib/ciclo-vida';

/**
 * Alta de la obra. Nombre y poco más: la obra nace con la localización
 * "Sin asignar" y las demás se añaden desde su portada. La sede es el mismo
 * texto libre con sugerencias del alta de sala. Elegir quién la inicia
 * registra el hito de inicio en el mismo alta: es el hecho de proyecto que
 * el plan P1 viejo colgaba de cada sala.
 *
 * El código llega propuesto (`codigoSugerido`) porque es la referencia que
 * acaba en una factura y un campo vacío sin explicación no dice qué se
 * espera dentro. Sigue siendo editable: una obra puede traer la referencia
 * del cliente.
 */
export async function AltaDeProyecto({
  sedes,
  codigoSugerido,
}: {
  sedes: string[];
  codigoSugerido: string;
}) {
  const { tecnicos, roles } = await listarTecnicosConRoles();
  const iniciadores = tecnicosDeRol(tecnicos, roles, 'inicio');

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
        <Campo
          etiqueta="Código"
          ayuda="Referencia de la obra para facturas y pedidos. Día, mes, año y el número del día; se puede sustituir por la referencia del cliente."
        >
          <input
            name="codigo"
            defaultValue={codigoSugerido}
            placeholder={codigoSugerido}
            className="w-full"
          />
        </Campo>
        <Campo
          etiqueta="Sede"
          ayuda="La instalación: Madrid, Canarias. El edificio y la planta son localizaciones dentro de la obra."
        >
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
        {iniciadores.length > 0 && (
          <Campo
            etiqueta="Quién lo inicia"
            ayuda="Registra el hito de inicio del proyecto. Se puede dejar vacío."
          >
            <select name="tecnico_inicio_id" className="w-full">
              <option value="">—</option>
              {iniciadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="sm:col-span-2">
          <Boton>Crear proyecto</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
