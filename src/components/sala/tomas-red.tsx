import { Boton, Campo, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import { anadirToma, borrarToma, guardarToma } from '@/app/acciones';
import { UBICACIONES_TOMA, type EquipoEnSala, type TomaRed } from '@/lib/tipos';

/**
 * Las rosetas de red del edificio en esta sala: "este Room Navigator pincha en
 * la toma 12". El código es el número que hay escrito en la placa, no un
 * identificador nuestro.
 *
 * Decisión deliberada de esta iteración: la toma NO es extremo de tirada.
 * Es dónde pincha un equipo y una columna informativa de la tabla de cables.
 * Convertirla en extremo obligaría a que `calcularConexion()` aceptara puntos
 * que no son equipos, y `src/lib/calculo-cable.ts` es lógica probada y
 * congelada. Cuando haga falta medir de equipo a roseta, se decide entonces y
 * pasa antes por `calculo-cable.test.ts`, como manda el contrato del proyecto.
 */
export function TomasDeRed({
  salaId,
  tomas,
  equipos,
}: {
  salaId: string;
  tomas: TomaRed[];
  equipos: EquipoEnSala[];
}) {
  const equiposPorToma = new Map<string, string[]>();
  for (const e of equipos) {
    if (!e.toma_red_id) continue;
    const lista = equiposPorToma.get(e.toma_red_id) ?? [];
    lista.push(e.nombre);
    equiposPorToma.set(e.toma_red_id, lista);
  }

  const ubicaciones = (
    <>
      <option value="">—</option>
      {UBICACIONES_TOMA.map((u) => (
        <option key={u} value={u}>
          {u.charAt(0).toUpperCase() + u.slice(1)}
        </option>
      ))}
    </>
  );

  return (
    <Tarjeta
      titulo="Tomas de red"
      pie="El código es lo que pone en la placa de la roseta. La posición es documental: la tirada se calcula entre equipos, no hasta la toma."
    >
      {tomas.length === 0 ? (
        <Vacio>Sin tomas de red. Añade la primera abajo.</Vacio>
      ) : (
        <>
          {tomas.map((t) => (
            <form
              key={`b-${t.id}`}
              id={`borrar-toma-${t.id}`}
              action={borrarToma}
              className="hidden"
            >
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="sala_id" value={salaId} />
            </form>
          ))}

          <ContenedorTabla etiqueta="Tomas de red">
          <table className="datos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Ubicación</th>
                <th className="num">X</th>
                <th className="num">Y</th>
                <th className="num">Z</th>
                <th>Notas</th>
                <th>Pincha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tomas.map((t) => (
                <tr key={t.id}>
                  <td colSpan={6} className="p-0">
                    <form
                      action={guardarToma}
                      id={`toma-${t.id}`}
                      className="flex flex-wrap items-end gap-2 px-3 py-2"
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="sala_id" value={salaId} />
                      <input
                        name="codigo"
                        defaultValue={t.codigo}
                        required
                        className="w-24"
                        aria-label="Código de la roseta"
                      />
                      <select
                        name="ubicacion"
                        defaultValue={t.ubicacion ?? ''}
                        aria-label="Ubicación de la roseta"
                      >
                        {ubicaciones}
                      </select>
                      {(['x_m', 'y_m', 'z_m'] as const).map((eje) => (
                        <input
                          key={eje}
                          name={eje}
                          type="number"
                          step="0.01"
                          defaultValue={t[eje] ?? ''}
                          className="w-20"
                          aria-label={eje.replace('_m', '').toUpperCase()}
                        />
                      ))}
                      <input
                        name="notas"
                        defaultValue={t.notas ?? ''}
                        className="flex-1 min-w-[10rem]"
                        aria-label="Notas de la roseta"
                      />
                      <Boton variante="secundario">Guardar</Boton>
                    </form>
                  </td>
                  <td className="text-tinta-tenue">
                    {equiposPorToma.get(t.id)?.join(', ') ?? '—'}
                  </td>
                  <td>
                    <Boton form={`borrar-toma-${t.id}`} variante="peligro">
                      Quitar
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ContenedorTabla>
        </>
      )}

      <form
        action={anadirToma}
        className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-linea"
      >
        <input type="hidden" name="sala_id" value={salaId} />
        <Campo etiqueta="Código">
          <input name="codigo" required placeholder="12" className="w-24" />
        </Campo>
        <Campo etiqueta="Ubicación">
          <select name="ubicacion" defaultValue="">
            {ubicaciones}
          </select>
        </Campo>
        <Campo etiqueta="X (m)">
          <input name="x_m" type="number" step="0.01" className="w-20" />
        </Campo>
        <Campo etiqueta="Y (m)">
          <input name="y_m" type="number" step="0.01" className="w-20" />
        </Campo>
        <Campo etiqueta="Z (m)">
          <input name="z_m" type="number" step="0.01" className="w-20" />
        </Campo>
        <Campo etiqueta="Notas">
          <input name="notas" className="min-w-[12rem]" />
        </Campo>
        <Boton>Añadir toma</Boton>
      </form>
    </Tarjeta>
  );
}
