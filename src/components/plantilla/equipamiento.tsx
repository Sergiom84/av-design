import { Boton, Campo, ContenedorTabla } from '@/components/ui';
import { anadirLineaPlantilla, operarLineaPlantilla } from '@/app/acciones';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { ETIQUETA_EXTREMO, type LineaPlantilla } from '@/lib/tipos';

/**
 * El equipamiento estándar de la plantilla. Lo que no está marcado como "no en
 * todas" es exactamente lo que hereda cada sala nueva.
 *
 * Cada fila tiene un solo formulario, escondido, y sus controles lo referencian
 * con `form=`: un `<form>` no puede ser hijo de `<tr>`, y cuatro formularios
 * por fila repetían el identificador de la línea cuatro veces. Es el mismo
 * recurso que usan las conexiones de la sala.
 */
export function EquipamientoDePlantilla({
  plantillaId,
  lineas,
  orden,
}: {
  plantillaId: string;
  lineas: LineaPlantilla[];
  /** Posición de la plantilla en la página. Solo sirve para nombrar formularios. */
  orden: number;
}) {
  // Corto a propósito: se repite en cinco controles de cada fila.
  const idFormulario = (i: number) => `f${orden}-${i}`;

  return (
    <div>
      {lineas.length === 0 ? (
        <p className="text-tinta-tenue mb-3">Sin equipamiento definido.</p>
      ) : (
        <ContenedorTabla etiqueta="Equipamiento de la plantilla">
        <table className="datos mb-3">
          <thead>
            <tr>
              <th className="num">Cantidad</th>
              <th>Equipo</th>
              <th>Sección</th>
              <th>Dónde va</th>
              <th className="num">X</th>
              <th className="num">Y</th>
              <th className="num">Z</th>
              <th>En todas las salas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const f = idFormulario(i);
              const equipo = l.modelo_texto ?? l.categoria;
              return (
                <tr key={l.id}>
                  <td className="num whitespace-nowrap">
                    <form id={f} action={operarLineaPlantilla} className="hidden">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="cantidad" value={l.cantidad} />
                    </form>
                    <span className="inline-flex items-center gap-1">
                      <Boton
                        variante="secundario"
                        form={f}
                        name="operacion"
                        value="menos"
                        aria-label="Quitar una unidad"
                      >
                        −
                      </Boton>
                      <span className="w-8 text-center tabular-nums">{l.cantidad}</span>
                      <Boton
                        variante="secundario"
                        form={f}
                        name="operacion"
                        value="mas"
                        aria-label="Añadir una unidad"
                      >
                        +
                      </Boton>
                    </span>
                  </td>
                  <td>{equipo}</td>
                  <td className="text-tinta-tenue">{l.categoria}</td>
                  {/*
                    Colocar el equipo aquí es colocarlo en las 144 salas que
                    salen de esta plantilla. Vacío significa "dedúcelo": la sala
                    lo pone donde suele ir y el croquis lo dibuja discontinuo.
                  */}
                  <td>
                    <select
                      form={f}
                      name="extremo"
                      defaultValue={l.extremo ?? ''}
                      aria-label={`${equipo}: dónde va`}
                    >
                      <option value="">deducir</option>
                      {Object.entries(ETIQUETA_EXTREMO).map(([v, e]) => (
                        <option key={v} value={v}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(
                    [
                      ['x_m', l.x_m, 'largo'],
                      ['y_m', l.y_m, 'ancho'],
                      ['z_m', l.z_m, 'altura'],
                    ] as const
                  ).map(([clave, valor, eje]) => (
                    <td key={clave} className="num">
                      <input
                        form={f}
                        name={clave}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={valor ?? ''}
                        aria-label={`${equipo}: ${eje} en metros`}
                        className="w-16 num"
                      />
                    </td>
                  ))}
                  <td>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        form={f}
                        name="opcional"
                        defaultChecked={l.opcional}
                        aria-label={`${equipo}: no está en todas las salas`}
                      />
                      <span className="text-tinta-tenue">
                        {l.opcional ? 'no en todas' : 'siempre'}
                      </span>
                      <Boton
                        variante="secundario"
                        form={f}
                        name="operacion"
                        value="guardar"
                      >
                        Guardar
                      </Boton>
                    </span>
                  </td>
                  <td>
                    <Boton form={f} variante="peligro" name="operacion" value="quitar">
                      Quitar
                    </Boton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      <form
        action={anadirLineaPlantilla}
        className="flex flex-wrap items-end gap-2 pt-3 border-t border-linea"
      >
        <input type="hidden" name="plantilla_id" value={plantillaId} />
        <BuscadorArticulo etiqueta="Añadir del catálogo" tipo="equipo" requerido />
        <Campo etiqueta="Cantidad">
          <input name="cantidad" type="number" min="1" defaultValue="1" className="w-20 num" />
        </Campo>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" name="opcional" />
          <span className="text-tinta-tenue">No en todas</span>
        </label>
        <Boton>Añadir</Boton>
      </form>
    </div>
  );
}
