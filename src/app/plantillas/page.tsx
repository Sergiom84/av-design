import { hayConfiguracion } from '@/lib/supabase/servidor';
import { listarPlantillas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Campo, Boton, Tarjeta } from '@/components/ui';
import { guardarMedidasPlantilla } from '../acciones';
import { ETIQUETA_RUTA } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function Plantillas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const plantillas = await listarPlantillas();
  const sinMedidas = plantillas.filter((p) => p.largo_m == null).length;

  return (
    <>
      <Cabecera
        titulo="Plantillas de sala"
        descripcion="Deducidas de vuestro inventario. Rellena las medidas una sola vez: cada sala nueva las hereda y solo corriges lo que cambie."
      />

      {sinMedidas > 0 && (
        <div className="mb-6">
          <Aviso>
            {sinMedidas} de {plantillas.length} plantillas siguen sin medidas. Empieza por
            las de arriba: son las que más salas representan.
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {plantillas.map((p) => (
          <Tarjeta
            key={p.id}
            titulo={p.nombre}
            pie={
              p.n_salas_reales
                ? `${p.n_salas_reales} salas del inventario responden a esta plantilla`
                : undefined
            }
          >
            <div className="grid sm:grid-cols-[1fr_auto] gap-6">
              <div>
                <div className="t-etiqueta mb-2">Equipamiento estándar</div>
                <ul className="space-y-1">
                  {p.lineas.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="tabular-nums text-tinta-tenue w-6 shrink-0">
                        {l.cantidad}×
                      </span>
                      <span>
                        {l.modelo_texto ?? l.categoria}
                        {l.opcional && (
                          <span className="text-tinta-tenue"> · no en todas</span>
                        )}
                      </span>
                    </li>
                  ))}
                  {p.lineas.length === 0 && (
                    <li className="text-tinta-tenue">Sin equipamiento definido</li>
                  )}
                </ul>
              </div>

              <form action={guardarMedidasPlantilla} className="space-y-3 min-w-[13rem]">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Largo (m)">
                    <input
                      name="largo_m"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={p.largo_m ?? ''}
                      className="w-full"
                    />
                  </Campo>
                  <Campo etiqueta="Ancho (m)">
                    <input
                      name="ancho_m"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={p.ancho_m ?? ''}
                      className="w-full"
                    />
                  </Campo>
                  <Campo etiqueta="Alto (m)">
                    <input
                      name="alto_m"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={p.alto_m ?? ''}
                      className="w-full"
                    />
                  </Campo>
                  <Campo etiqueta="Falso techo (m)">
                    <input
                      name="alto_falso_techo_m"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={p.alto_falso_techo_m ?? ''}
                      className="w-full"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Ruta habitual">
                  <select
                    name="ruta_por_defecto"
                    defaultValue={p.ruta_por_defecto}
                    className="w-full"
                  >
                    {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
                      <option key={v} value={v}>
                        {e}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Boton>Guardar medidas</Boton>
              </form>
            </div>
          </Tarjeta>
        ))}
      </div>
    </>
  );
}
