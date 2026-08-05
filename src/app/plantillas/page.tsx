import { hayConfiguracion } from '@/lib/db';
import { listarArticulos, listarPlantillas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Cabecera, Campo, Tarjeta } from '@/components/ui';
import {
  ajustarLineaPlantilla,
  anadirLineaPlantilla,
  borrarLineaPlantilla,
  guardarLineaPlantilla,
  guardarMedidasPlantilla,
} from '../acciones';
import { ETIQUETA_RUTA } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function Plantillas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [plantillas, equipos] = await Promise.all([
    listarPlantillas(),
    listarArticulos('equipo'),
  ]);
  const sinMedidas = plantillas.filter((p) => p.largo_m == null).length;

  return (
    <>
      <Cabecera
        titulo="Plantillas de sala"
        descripcion="Deducidas de vuestro inventario. Rellena las medidas una sola vez y ajusta el equipamiento: cada sala nueva lo hereda y solo corriges lo que cambie."
      />

      {sinMedidas > 0 && (
        <div className="mb-6">
          <Aviso>
            {sinMedidas} de {plantillas.length} plantillas siguen sin medidas. Empieza por
            las de arriba: son las que más salas representan.
          </Aviso>
        </div>
      )}

      <div className="space-y-6">
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
            <div className="grid xl:grid-cols-[1fr_15rem] gap-8 items-start">
              {/* ------------------------------------------- equipamiento */}
              <div>
                <div className="t-etiqueta mb-2">Equipamiento estándar</div>

                {p.lineas.length === 0 ? (
                  <p className="text-tinta-tenue mb-3">Sin equipamiento definido.</p>
                ) : (
                  <table className="datos mb-3">
                    <thead>
                      <tr>
                        <th className="num">Cantidad</th>
                        <th>Equipo</th>
                        <th>Sección</th>
                        <th>En todas las salas</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {p.lineas.map((l) => (
                        <tr key={l.id}>
                          <td className="num whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <form action={ajustarLineaPlantilla} className="inline">
                                <input type="hidden" name="id" value={l.id} />
                                <input type="hidden" name="paso" value="-1" />
                                <Boton variante="secundario" aria-label="Quitar una unidad">
                                  −
                                </Boton>
                              </form>
                              <span className="w-8 text-center tabular-nums">
                                {l.cantidad}
                              </span>
                              <form action={ajustarLineaPlantilla} className="inline">
                                <input type="hidden" name="id" value={l.id} />
                                <input type="hidden" name="paso" value="1" />
                                <Boton variante="secundario" aria-label="Añadir una unidad">
                                  +
                                </Boton>
                              </form>
                            </span>
                          </td>
                          <td>{l.modelo_texto ?? l.categoria}</td>
                          <td className="text-tinta-tenue">{l.categoria}</td>
                          <td>
                            <form
                              action={guardarLineaPlantilla}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="id" value={l.id} />
                              <input type="hidden" name="cantidad" value={l.cantidad} />
                              <input
                                type="checkbox"
                                name="opcional"
                                defaultChecked={l.opcional}
                                aria-label={`${l.modelo_texto ?? l.categoria}: no está en todas las salas`}
                              />
                              <span className="text-tinta-tenue">
                                {l.opcional ? 'no en todas' : 'siempre'}
                              </span>
                              <Boton variante="secundario">Guardar</Boton>
                            </form>
                          </td>
                          <td>
                            <form action={borrarLineaPlantilla}>
                              <input type="hidden" name="id" value={l.id} />
                              <Boton variante="peligro">Quitar</Boton>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <form
                  action={anadirLineaPlantilla}
                  className="flex flex-wrap items-end gap-2 pt-3 border-t border-linea"
                >
                  <input type="hidden" name="plantilla_id" value={p.id} />
                  <Campo etiqueta="Añadir del catálogo">
                    <select
                      name="articulo_id"
                      required
                      defaultValue=""
                      className="min-w-[20rem]"
                    >
                      <option value="">— elegir equipo —</option>
                      {equipos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {[a.marca, a.modelo].filter(Boolean).join(' ')} · {a.categoria}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Cantidad">
                    <input
                      name="cantidad"
                      type="number"
                      min="1"
                      defaultValue="1"
                      className="w-20 num"
                    />
                  </Campo>
                  <label className="flex items-center gap-2 pb-1.5">
                    <input type="checkbox" name="opcional" />
                    <span className="text-tinta-tenue">No en todas</span>
                  </label>
                  <Boton>Añadir</Boton>
                </form>
              </div>

              {/* ------------------------------------------------ medidas */}
              <form action={guardarMedidasPlantilla} className="space-y-3">
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
