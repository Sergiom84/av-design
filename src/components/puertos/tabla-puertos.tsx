import type { Puerto } from '@/lib/tipos';
import { ETIQUETA_SENAL, ETIQUETA_SENTIDO } from '@/lib/tipos';
import { Aviso, Boton, Campo, ContenedorTabla, Tarjeta } from '@/components/ui';
import { anadirPuerto, borrarPuerto, guardarPuerto } from '@/app/acciones';

/**
 * Los puertos de un artículo: los conectores físicos que trae el equipo.
 *
 * Se edita aquí mismo, fila a fila. Los formularios van fuera de la tabla y
 * los controles los apuntan con el atributo `form`: un formulario no puede
 * anidarse dentro de otro, y meter uno por celda rompería la tabla.
 *
 * Un puerto dado de alta aquí lleva `fuente = 'app'` y la siembra no lo pisa,
 * porque alguien lo ha mirado en el equipo real.
 */
export function TablaPuertos({
  articuloId,
  puertos,
}: {
  articuloId: string;
  puertos: Puerto[];
}) {
  const total = puertos.reduce((s, p) => s + p.total, 0);

  return (
    <Tarjeta
      titulo={
        puertos.length
          ? `Puertos (${puertos.length} tipos · ${total} conectores)`
          : 'Puertos'
      }
      pie="El nombre es el literal que serigrafía el fabricante: HDMI IN 1, LAN PoE, MIC IN 1. Es lo que lee el técnico en la trasera del equipo."
    >
      {puertos.length === 0 ? (
        <Aviso tono="alerta">
          Este artículo no tiene puertos. Sin ellos no se puede decir de qué
          salida a qué entrada va un cable, así que no se puede dibujar el
          esquema de la sala ni generar la tabla de cables.
        </Aviso>
      ) : (
        <>
          {/* Un formulario por fila, fuera de la tabla y referenciado con `form`. */}
          {puertos.map((p) => (
            <form key={`f-${p.id}`} id={`puerto-${p.id}`} action={guardarPuerto} className="hidden">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="articulo_id" value={articuloId} />
            </form>
          ))}
          {puertos.map((p) => (
            <form key={`b-${p.id}`} id={`borrar-puerto-${p.id}`} action={borrarPuerto} className="hidden">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="articulo_id" value={articuloId} />
            </form>
          ))}

          <ContenedorTabla etiqueta="Puertos">
          <table className="datos">
            <thead>
              <tr>
                <th className="num">Orden</th>
                <th>Nombre</th>
                <th className="num">Total</th>
                <th>Sentido</th>
                <th>Señal</th>
                <th>Conector</th>
                <th>Notas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {puertos.map((p) => (
                <tr key={p.id}>
                  <td className="num">
                    <input
                      form={`puerto-${p.id}`}
                      name="orden"
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={p.orden ?? ''}
                      aria-label={`Orden de ${p.nombre}`}
                      className="num w-16"
                    />
                  </td>
                  <td>
                    <input
                      form={`puerto-${p.id}`}
                      name="nombre"
                      defaultValue={p.nombre}
                      required
                      aria-label="Nombre del puerto"
                      className="w-40"
                    />
                  </td>
                  <td className="num">
                    <input
                      form={`puerto-${p.id}`}
                      name="total"
                      type="number"
                      step="1"
                      min="1"
                      defaultValue={p.total}
                      aria-label={`Cuántos ${p.nombre} hay`}
                      className="num w-16"
                    />
                  </td>
                  <td>
                    <select
                      form={`puerto-${p.id}`}
                      name="sentido"
                      defaultValue={p.sentido}
                      aria-label={`Sentido de ${p.nombre}`}
                    >
                      {Object.entries(ETIQUETA_SENTIDO).map(([v, e]) => (
                        <option key={v} value={v}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      form={`puerto-${p.id}`}
                      name="senal"
                      defaultValue={p.senal}
                      aria-label={`Señal de ${p.nombre}`}
                    >
                      {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
                        <option key={v} value={v}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      form={`puerto-${p.id}`}
                      name="conector"
                      defaultValue={p.conector ?? ''}
                      placeholder="RJ45"
                      aria-label={`Conector de ${p.nombre}`}
                      className="w-28"
                    />
                  </td>
                  <td>
                    <input
                      form={`puerto-${p.id}`}
                      name="notas"
                      defaultValue={p.notas ?? ''}
                      aria-label={`Notas de ${p.nombre}`}
                      className="w-48"
                    />
                  </td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <Boton form={`puerto-${p.id}`} variante="secundario">
                        Guardar
                      </Boton>
                      <Boton form={`borrar-puerto-${p.id}`} variante="peligro">
                        Borrar
                      </Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ContenedorTabla>
        </>
      )}

      <form action={anadirPuerto} className="mt-4 pt-4 border-t border-linea">
        <input type="hidden" name="articulo_id" value={articuloId} />
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <Campo etiqueta="Nombre">
            <input name="nombre" required placeholder="HDMI IN 1" className="w-full" />
          </Campo>
          <Campo etiqueta="Total">
            <input
              name="total"
              type="number"
              step="1"
              min="1"
              defaultValue={1}
              className="w-full num"
            />
          </Campo>
          <Campo etiqueta="Sentido">
            <select name="sentido" defaultValue="entrada" className="w-full">
              {Object.entries(ETIQUETA_SENTIDO).map(([v, e]) => (
                <option key={v} value={v}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Señal">
            <select name="senal" defaultValue="hdmi" className="w-full">
              {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
                <option key={v} value={v}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Conector">
            <input name="conector" placeholder="HDMI A" className="w-full" />
          </Campo>
          <Campo etiqueta="Orden">
            <input name="orden" type="number" step="1" min="0" className="w-full num" />
          </Campo>
        </div>
        <div className="mt-3">
          <Boton>Añadir puerto</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
