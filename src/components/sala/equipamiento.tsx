import { Boton, Campo, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import {
  ajustarCantidadEquipo,
  anadirEquipo,
  borrarEquipo,
  guardarEquipo,
} from '@/app/acciones';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { ETIQUETA_EXTREMO, type EquipoEnSala, type TomaRed } from '@/lib/tipos';

/**
 * Los equipos puestos en la sala, con su posición y en qué roseta pinchan.
 *
 * La posición es lo que alimenta el cálculo de metros; el extremo, la holgura.
 * La toma de red es informativa: dice dónde pincha el equipo, no es un extremo
 * de tirada (ver el comentario de `tomas-red.tsx`).
 */
export function Equipamiento({
  salaId,
  equipos,
  tomas,
}: {
  salaId: string;
  equipos: EquipoEnSala[];
  tomas: TomaRed[];
}) {
  const opcionesToma = (
    <>
      <option value="">— sin toma —</option>
      {tomas.map((t) => (
        <option key={t.id} value={t.id}>
          {t.codigo}
          {t.ubicacion ? ` · ${t.ubicacion}` : ''}
        </option>
      ))}
    </>
  );

  return (
    <Tarjeta titulo="Equipos en la sala">
      {equipos.length === 0 ? (
        <Vacio>Sin equipos. Añade el primero abajo.</Vacio>
      ) : (
        <ContenedorTabla etiqueta="Equipos en la sala">
        <table className="datos">
          <thead>
            <tr>
              <th className="num">Cantidad</th>
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
                <td className="num whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <form action={ajustarCantidadEquipo} className="inline">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="sala_id" value={salaId} />
                      <input type="hidden" name="paso" value="-1" />
                      <Boton variante="secundario" aria-label="Quitar una unidad">
                        −
                      </Boton>
                    </form>
                    <span className="w-8 text-center tabular-nums">{e.cantidad}</span>
                    <form action={ajustarCantidadEquipo} className="inline">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="sala_id" value={salaId} />
                      <input type="hidden" name="paso" value="1" />
                      <Boton variante="secundario" aria-label="Añadir una unidad">
                        +
                      </Boton>
                    </form>
                  </span>
                </td>
                <td colSpan={5} className="p-0">
                  <form
                    action={guardarEquipo}
                    className="flex flex-wrap items-end gap-2 px-3 py-2"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="sala_id" value={salaId} />
                    <input type="hidden" name="cantidad" value={e.cantidad} />
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
                    <select
                      name="toma_red_id"
                      defaultValue={e.toma_red_id ?? ''}
                      aria-label="Toma de red donde pincha"
                    >
                      {opcionesToma}
                    </select>
                    <Boton variante="secundario">Guardar</Boton>
                  </form>
                </td>
                <td>
                  <form action={borrarEquipo}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="sala_id" value={salaId} />
                    <Boton variante="peligro">Quitar</Boton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      <form
        action={anadirEquipo}
        className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-linea"
      >
        <input type="hidden" name="sala_id" value={salaId} />
        {/* Sin `requerido`: hoy se puede añadir un equipo suelto que no está en
            el catálogo, y `anadirEquipo` lo admite. */}
        <BuscadorArticulo etiqueta="Del catálogo" tipo="equipo" />
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
        {tomas.length > 0 && (
          <Campo etiqueta="Toma de red">
            <select name="toma_red_id" defaultValue="">
              {opcionesToma}
            </select>
          </Campo>
        )}
        <Boton>Añadir equipo</Boton>
      </form>
    </Tarjeta>
  );
}
