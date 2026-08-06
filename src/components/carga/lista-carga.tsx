import { Aviso, Boton, Campo, Tarjeta, Vacio } from '@/components/ui';
import {
  confirmarCarga,
  marcarLineaCarga,
  marcarTodaLaCarga,
} from '@/app/acciones-almacen';
import { resumenCarga } from '@/lib/carga';
import { ETIQUETA_CARGA, type Carga, type LineaCarga, type Ubicacion } from '@/lib/tipos';

/**
 * La lista de carga de la furgoneta.
 *
 * Esto se usa de pie en un almacén, con el móvil en una mano y una caja en la
 * otra. Por eso no es una tabla: es una lista de filas grandes, cada una un
 * botón entero de al menos 56 px de alto, sin nada más que tocar. Marcar y
 * desmarcar es la única interacción.
 */
export function ListaDeCarga({
  carga,
  lineas,
  ubicaciones,
}: {
  carga: Carga;
  lineas: LineaCarga[];
  ubicaciones: Ubicacion[];
}) {
  const resumen = resumenCarga(lineas);
  const editable = carga.estado === 'preparacion';
  // De dónde se saca el material. Es el estante, no la furgoneta: cargar la
  // furgoneta es sacar del almacén, no meter en él. Apuntar la salida contra
  // la furgoneta dejaría esa ubicación en negativo y el estante intacto.
  const nave = ubicaciones.find((u) => !u.es_furgoneta) ?? ubicaciones[0];

  if (lineas.length === 0) {
    return (
      <Tarjeta titulo="Lista de carga">
        <Vacio>
          Esta carga no tiene material. Se genera desde las reservas activas de la sala.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo="Lista de carga"
      pie={`${resumen.cargadas} de ${resumen.lineas} líneas · ${resumen.unidades} unidades · ${ETIQUETA_CARGA[carga.estado]}`}
    >
      {editable && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ['si', 'Marcar todo'],
              ['no', 'Desmarcar todo'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <form key={valor} action={marcarTodaLaCarga}>
              <input type="hidden" name="carga_id" value={carga.id} />
              <input type="hidden" name="valor" value={valor} />
              <Boton variante="secundario">{etiqueta}</Boton>
            </form>
          ))}
        </div>
      )}

      <ul className="border-t border-linea">
        {lineas.map((l) => (
          <li key={l.id} className="border-b border-linea">
            <form action={marcarLineaCarga}>
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="carga_id" value={carga.id} />
              <button
                type="submit"
                disabled={!editable}
                aria-pressed={l.cargado}
                className="w-full flex items-center gap-4 text-left py-4 px-1 min-h-[3.5rem] disabled:opacity-70 hover:bg-superficie-hundida transition-colors"
              >
                {/*
                  Cuadro de 2 rem: se ve y se acierta con el pulgar. Sin icono
                  ni emoji, que el sistema visual no los tiene: relleno cuando
                  está cargado, vacío cuando no.
                */}
                <span
                  aria-hidden
                  className={`shrink-0 w-8 h-8 border rounded-md ${
                    l.cargado ? 'bg-acento border-acento' : 'bg-superficie border-linea-fuerte'
                  }`}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{l.descripcion}</span>
                  <span className="block t-etiqueta">
                    {l.cargado ? 'Cargado' : 'Pendiente'}
                  </span>
                </span>
                <span className="shrink-0 t-subtitulo tabular-nums">
                  {l.cantidad}
                  <span className="text-tinta-tenue text-[0.75rem] ml-1">{l.unidad}</span>
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      {editable && (
        <div className="mt-4 pt-4 border-t border-linea space-y-3">
          {resumen.pendientes > 0 && (
            <Aviso>
              Quedan {resumen.pendientes}{' '}
              {resumen.pendientes === 1 ? 'línea' : 'líneas'} por marcar. Al confirmar
              solo sale del almacén lo marcado.
            </Aviso>
          )}
          <form action={confirmarCarga} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={carga.id} />
            <Campo etiqueta="Sale de">
              <select name="ubicacion_id" defaultValue={nave?.id ?? ''}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Quién carga">
              <input name="quien" className="w-32" defaultValue={carga.quien ?? ''} />
            </Campo>
            <Boton>Confirmar carga</Boton>
            <span className="text-tinta-tenue pb-1">
              Lo marcado sale del almacén y las reservas quedan servidas. Cargado ya no
              es existencia.
            </span>
          </form>
        </div>
      )}
    </Tarjeta>
  );
}
