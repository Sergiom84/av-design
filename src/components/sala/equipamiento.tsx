import { Aviso, Boton, Campo, Estado, Tarjeta, Vacio } from '@/components/ui';
import {
  ajustarCantidadEquipo,
  anadirEquipo,
  borrarEquipo,
  guardarEquipo,
} from '@/app/acciones';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { ETIQUETA_EXTREMO, type EquipoEnSala, type TomaRed } from '@/lib/tipos';

type Catalogo = Map<string, { marca: string | null; modelo: string; categoria: string }>;

/**
 * El estado de catálogo del equipo, en texto explícito ("En catálogo" /
 * "Fuera de catálogo"): no puede depender solo del color del badge. La
 * referencia real va aparte, junto al estado.
 */
function Referencia({ equipo, catalogo }: { equipo: EquipoEnSala; catalogo: Catalogo }) {
  const articulo = equipo.articulo_id ? catalogo.get(equipo.articulo_id) : undefined;
  if (!articulo) return <Estado tono="aviso">Fuera de catálogo</Estado>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Estado tono="listo">En catálogo</Estado>
      <span className="text-tinta-tenue">
        {[articulo.marca, articulo.modelo].filter(Boolean).join(' ')}
      </span>
    </span>
  );
}

/**
 * Los equipos puestos en la sala, con su posición y en qué roseta pinchan.
 *
 * La posición es lo que alimenta el cálculo de metros; el extremo, la holgura.
 * La toma de red es informativa: dice dónde pincha el equipo, no es un extremo
 * de tirada (ver el comentario de `tomas-red.tsx`).
 *
 * No es una tabla técnica como el cable schedule: cada equipo es una fila que
 * envuelve, no una columna fija con scroll lateral, así que en móvil se apila
 * en vez de obligar a desplazar.
 *
 * Con la obra cerrada no se añaden ni tocan equipos: se enseña una lectura
 * sin formularios. Las acciones (`anadirEquipo`, `guardarEquipo`,
 * `ajustarCantidadEquipo`, `borrarEquipo`) también rechazan el envío en el
 * servidor; esto evita mostrar controles que no harían nada.
 */
export function Equipamiento({
  salaId,
  equipos,
  tomas,
  cerrado = false,
  catalogo,
}: {
  salaId: string;
  equipos: EquipoEnSala[];
  tomas: TomaRed[];
  cerrado?: boolean;
  catalogo: Catalogo;
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

  if (cerrado) {
    return (
      <Tarjeta titulo="Equipos en la sala">
        <div className="mb-4">
          <Aviso tono="neutro">
            El proyecto está cerrado: el equipamiento no se toca. Para corregir algo se
            reabre la obra borrando el cierre desde su portada.
          </Aviso>
        </div>
        {equipos.length === 0 ? (
          <Vacio>Sin equipos.</Vacio>
        ) : (
          <div className="divide-y divide-linea-suave">
            {equipos.map((e) => (
              <div key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span className="font-medium">
                  {e.cantidad}× {e.nombre}
                </span>
                <Referencia equipo={e} catalogo={catalogo} />
                <span className="text-tinta-tenue">{ETIQUETA_EXTREMO[e.extremo]}</span>
                <span className="text-tinta-tenue tabular-nums">
                  X {e.posicion.x_m} · Y {e.posicion.y_m} · Z {e.posicion.z_m}
                </span>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Equipos en la sala">
      <form
        action={anadirEquipo}
        className="flex flex-wrap items-end gap-2 pb-4 mb-4 border-b border-linea"
      >
        <input type="hidden" name="sala_id" value={salaId} />
        {/* Sin `requerido`: hoy se puede añadir un equipo suelto que no está en
            el catálogo, y `anadirEquipo` lo admite. */}
        <BuscadorArticulo etiqueta="Añadir del catálogo" tipo="equipo" />
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

      {equipos.length === 0 ? (
        <Vacio>Sin equipos. Añade el primero arriba.</Vacio>
      ) : (
        <div className="divide-y divide-linea-suave">
          {equipos.map((e) => (
            <div key={e.id} className="flex flex-wrap items-end gap-3 py-3">
              <span className="self-center min-w-0 max-w-full">
                <Referencia equipo={e} catalogo={catalogo} />
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
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

              <form
                action={guardarEquipo}
                className="flex flex-wrap items-end gap-2 flex-1 min-w-[16rem]"
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
                <select name="extremo" defaultValue={e.extremo} aria-label="Tipo de extremo">
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

              <form action={borrarEquipo} className="shrink-0">
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="sala_id" value={salaId} />
                <Boton variante="peligro">Quitar</Boton>
              </form>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}
