import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarArticulos, obtenerParametros, obtenerSala } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Cabecera, Campo, Dato, Tarjeta, Vacio } from '@/components/ui';
import {
  anadirConexion,
  anadirEquipo,
  borrarConexion,
  borrarEquipo,
  borrarSala,
  guardarEquipo,
  guardarSala,
} from '../../acciones';
import {
  agruparMaterialCable,
  calcularConexion,
  dimensionarCanalizacion,
  ResultadoCable,
} from '@/lib/calculo-cable';
import {
  ETIQUETA_EXTREMO,
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  Extremo,
  Ruta,
  Senal,
} from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function DetalleSala({ params }: PageProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const completa = await obtenerSala(id);
  if (!completa) notFound();

  const { sala, equipos, conexiones } = completa;
  const [articulos, parametros] = await Promise.all([
    listarArticulos(),
    obtenerParametros(),
  ]);

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const cables = articulos.filter((a) => a.tipo === 'cable');

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  const resultados = sinMedidas
    ? []
    : (conexiones
        .map((c) => calcularConexion(c, sala, equiposPorId, porId, parametros))
        .filter(Boolean) as ResultadoCable[]);

  const material = agruparMaterialCable(resultados, conexiones, porId);
  const totalMetros = resultados.reduce((a, r) => a + r.longitud_m, 0);

  const diametros = conexiones
    .map((c) => (c.articulo_cable_id ? porId.get(c.articulo_cable_id)?.diametro_mm : null))
    .filter((d): d is number => typeof d === 'number');
  const canalizacion = diametros.length
    ? dimensionarCanalizacion(diametros, parametros)
    : null;

  return (
    <>
      <Cabecera
        titulo={sala.nombre}
        descripcion={[sala.edificio, sala.nivel, sala.tipologia]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <form action={borrarSala}>
            <input type="hidden" name="id" value={sala.id} />
            <Boton variante="peligro">Borrar sala</Boton>
          </form>
        }
      />

      {sinMedidas && (
        <div className="mb-6">
          <Aviso tono="alerta">
            Faltan las medidas de la sala. Sin largo, ancho y alto no se puede calcular
            ningún metro de cable.
          </Aviso>
        </div>
      )}

      <div className="grid xl:grid-cols-[22rem_1fr] gap-6 items-start">
        {/* ------------------------------------------------------ geometría */}
        <Tarjeta titulo="Medidas y ruta">
          <form action={guardarSala} className="space-y-3">
            <input type="hidden" name="id" value={sala.id} />
            <Campo etiqueta="Nombre">
              <input name="nombre" defaultValue={sala.nombre} className="w-full" />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Edificio">
                <input name="edificio" defaultValue={sala.edificio ?? ''} className="w-full" />
              </Campo>
              <Campo etiqueta="Nivel">
                <input name="nivel" defaultValue={sala.nivel ?? ''} className="w-full" />
              </Campo>
              <Campo etiqueta="Código">
                <input name="codigo" defaultValue={sala.codigo ?? ''} className="w-full" />
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

        <div className="space-y-6">
          {/* --------------------------------------------------- resultado */}
          <Tarjeta titulo="Cable necesario">
            {resultados.length === 0 ? (
              <Vacio>
                {sinMedidas
                  ? 'Rellena las medidas de la sala.'
                  : 'Añade equipos y define qué conecta con qué.'}
              </Vacio>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-6 mb-6">
                  <Dato etiqueta="Tiradas" valor={resultados.length} />
                  <Dato
                    etiqueta="Metros totales"
                    valor={totalMetros.toFixed(2)}
                    sufijo="m"
                  />
                  <Dato
                    etiqueta="Tirada más larga"
                    valor={Math.max(...resultados.map((r) => r.longitud_m)).toFixed(2)}
                    sufijo="m"
                  />
                </div>

                <table className="datos">
                  <thead>
                    <tr>
                      <th>Tirada</th>
                      <th>Ruta</th>
                      <th className="num">Subida</th>
                      <th className="num">Horizontal</th>
                      <th className="num">Bajada</th>
                      <th className="num">Holguras</th>
                      <th className="num">Total</th>
                      <th className="num">Se pide</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => (
                      <tr key={r.conexion_id}>
                        <td>{r.etiqueta}</td>
                        <td>{ETIQUETA_RUTA[r.ruta]}</td>
                        <td className="num">{r.detalle.subida_m}</td>
                        <td className="num">{r.detalle.horizontal_m}</td>
                        <td className="num">{r.detalle.bajada_m}</td>
                        <td className="num">
                          {(r.holgura_origen_m + r.holgura_destino_m).toFixed(2)}
                        </td>
                        <td className="num">
                          <strong>{r.longitud_m.toFixed(2)}</strong>
                          {r.manual && (
                            <span className="text-tinta-tenue"> manual</span>
                          )}
                        </td>
                        <td className="num">
                          {r.longitud_comercial_m != null
                            ? `${r.longitud_comercial_m} m`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Tarjeta>

          {/* ------------------------------------------------ material */}
          {material.length > 0 && (
            <Tarjeta
              titulo="Material a comprar"
              pie={
                canalizacion
                  ? `Canalización: ${canalizacion.cables_con_reserva} cables con reserva · ${canalizacion.sugerencia}`
                  : undefined
              }
            >
              <table className="datos">
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Tiradas</th>
                    <th>Se pide</th>
                    <th className="num">Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {material.map((l, i) => (
                    <tr key={i}>
                      <td>{l.descripcion}</td>
                      <td className="num">
                        {l.cantidad} {l.unidad}
                      </td>
                      <td className="num">{l.tiradas}</td>
                      <td>{l.a_pedir}</td>
                      <td className="num">
                        {l.coste_estimado != null
                          ? `${l.coste_estimado.toFixed(2)} €`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}

          {/* ------------------------------------------------- equipos */}
          <Tarjeta titulo="Equipos en la sala">
            {equipos.length === 0 ? (
              <Vacio>Sin equipos. Añade el primero abajo.</Vacio>
            ) : (
              <table className="datos">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Extremo</th>
                    <th className="num">X</th>
                    <th className="num">Y</th>
                    <th className="num">Z</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {equipos.map((e) => (
                    <tr key={e.id}>
                      <td colSpan={6} className="p-0">
                        <form
                          action={guardarEquipo}
                          className="flex flex-wrap items-end gap-2 px-3 py-2"
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="sala_id" value={sala.id} />
                          <input
                            name="nombre"
                            defaultValue={e.nombre}
                            className="flex-1 min-w-[12rem]"
                            aria-label="Nombre del equipo"
                          />
                          <select
                            name="extremo"
                            defaultValue={e.extremo}
                            aria-label="Tipo de extremo"
                          >
                            {Object.entries(ETIQUETA_EXTREMO).map(([v, et]) => (
                              <option key={v} value={v}>
                                {et}
                              </option>
                            ))}
                          </select>
                          {(['x_m', 'y_m', 'z_m'] as const).map((eje) => (
                            <input
                              key={eje}
                              name={eje}
                              type="number"
                              step="0.01"
                              defaultValue={e.posicion[eje]}
                              className="w-20"
                              aria-label={eje.replace('_m', '').toUpperCase()}
                            />
                          ))}
                          <Boton variante="secundario">Guardar</Boton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <form
              action={anadirEquipo}
              className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-linea"
            >
              <input type="hidden" name="sala_id" value={sala.id} />
              <Campo etiqueta="Del catálogo">
                <select name="articulo_id" className="min-w-[16rem]" defaultValue="">
                  <option value="">— elegir equipo —</option>
                  {articulos
                    .filter((a) => a.tipo === 'equipo')
                    .slice(0, 300)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {[a.marca, a.modelo].filter(Boolean).join(' ')} · {a.categoria}
                      </option>
                    ))}
                </select>
              </Campo>
              <Campo etiqueta="Extremo">
                <select name="extremo" defaultValue="pantalla">
                  {Object.entries(ETIQUETA_EXTREMO).map(([v, et]) => (
                    <option key={v} value={v}>
                      {et}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="X (m)">
                <input name="x_m" type="number" step="0.01" defaultValue="0" className="w-20" />
              </Campo>
              <Campo etiqueta="Y (m)">
                <input name="y_m" type="number" step="0.01" defaultValue="0" className="w-20" />
              </Campo>
              <Campo etiqueta="Z (m)">
                <input name="z_m" type="number" step="0.01" defaultValue="1.2" className="w-20" />
              </Campo>
              <Boton>Añadir equipo</Boton>
            </form>
          </Tarjeta>

          {/* ---------------------------------------------- conexiones */}
          <Tarjeta titulo="Conexiones">
            {conexiones.length === 0 ? (
              <Vacio>Sin conexiones definidas.</Vacio>
            ) : (
              <table className="datos">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Señal</th>
                    <th>Cable</th>
                    <th>Ruta</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {conexiones.map((c) => (
                    <tr key={c.id}>
                      <td>{equiposPorId.get(c.origen_id)?.nombre ?? '—'}</td>
                      <td>{equiposPorId.get(c.destino_id)?.nombre ?? '—'}</td>
                      <td>{ETIQUETA_SENAL[c.senal]}</td>
                      <td>
                        {c.articulo_cable_id
                          ? (porId.get(c.articulo_cable_id)?.modelo ?? '—')
                          : <span className="text-alerta">sin asignar</span>}
                      </td>
                      <td>{ETIQUETA_RUTA[(c.ruta ?? sala.ruta_por_defecto) as Ruta]}</td>
                      <td>
                        <form action={borrarConexion}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="sala_id" value={sala.id} />
                          <Boton variante="peligro">Quitar</Boton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <form
              action={anadirConexion}
              className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-linea"
            >
              <input type="hidden" name="sala_id" value={sala.id} />
              <Campo etiqueta="Origen">
                <select name="origen_id" required defaultValue="">
                  <option value="">—</option>
                  {equipos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Destino">
                <select name="destino_id" required defaultValue="">
                  <option value="">—</option>
                  {equipos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Señal">
                <select name="senal" defaultValue="hdmi">
                  {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
                    <option key={v} value={v as Senal}>
                      {e}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Cable">
                <select name="articulo_cable_id" defaultValue="" className="min-w-[14rem]">
                  <option value="">— sin asignar —</option>
                  {cables.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.modelo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Ruta">
                <select name="ruta" defaultValue="">
                  <option value="">Por defecto de la sala</option>
                  {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
                    <option key={v} value={v as Ruta}>
                      {e}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Longitud manual" ayuda="Vacío = calculada">
                <input
                  name="longitud_manual_m"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-24"
                />
              </Campo>
              <Boton>Añadir conexión</Boton>
            </form>
          </Tarjeta>

          {equipos.length > 0 && (
            <Tarjeta titulo="Quitar equipos">
              <div className="flex flex-wrap gap-2">
                {equipos.map((e) => (
                  <form key={e.id} action={borrarEquipo}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="sala_id" value={sala.id} />
                    <Boton variante="peligro">
                      {e.nombre} · {ETIQUETA_EXTREMO[e.extremo as Extremo]}
                    </Boton>
                  </form>
                ))}
              </div>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
