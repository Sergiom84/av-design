import { randomUUID } from 'node:crypto';
import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import { Aviso, Boton, Campo, Tarjeta, Vacio } from '@/components/ui';
import { QuienTecnico } from '@/components/ciclo-vida/quien';
import {
  confirmarCarga,
  marcarLineaCarga,
  marcarTodaLaCarga,
  marcarCargaKitConEstado,
  confirmarCargaKitConEstado,
} from '@/app/acciones-almacen';
import { FormularioCargaKit } from '@/components/carga/formulario-carga-kit';
import { resumenCarga } from '@/lib/carga';
import type { IdentidadCargaGestionada } from '@/lib/datos-almacen';
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
  gestionada = null,
  editableCarga = false,
}: {
  carga: Carga;
  lineas: LineaCarga[];
  ubicaciones: Ubicacion[];
  gestionada?: IdentidadCargaGestionada | null;
  editableCarga?: boolean;
}) {
  const resumen = resumenCarga(lineas);
  const editable = carga.estado === 'preparacion';
  const nave = ubicaciones.find((u) => !u.es_furgoneta) ?? ubicaciones[0];
  const saldos = gestionada?.saldos ?? [];

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
      {gestionada && (
        <p className="text-tinta-tenue mb-4">
          Unidad {gestionada.cobertura.reservado}/{gestionada.cobertura.servido} · cobertura {gestionada.cobertura.coberturaFisica}.
          {gestionada.motivoNoOperable ? ` ${gestionada.motivoNoOperable}` : ''}
        </p>
      )}
      {editable && !gestionada && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ['si', 'Marcar todo'],
              ['no', 'Desmarcar todo'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <FormularioMutacion key={valor} action={marcarTodaLaCarga}>
              <input type="hidden" name="carga_id" value={carga.id} />
              <input type="hidden" name="valor" value={valor} />
              <Boton variante="secundario">{etiqueta}</Boton>
            </FormularioMutacion>
          ))}
        </div>
      )}

      <ul className="border-t border-linea">
        {lineas.map((l) => (
          <li key={l.id} className="border-b border-linea">
            {gestionada ? (
              <div className="w-full flex items-center gap-4 text-left py-4 px-1 min-h-[3.5rem]">
                <span
                  aria-hidden
                  className={`shrink-0 w-8 h-8 border rounded-md ${
                    l.cargado ? 'bg-acento border-acento' : 'bg-superficie border-linea-fuerte'
                  }`}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{l.descripcion}</span>
                  <span className="block t-etiqueta">
                    {l.cargado ? 'Listo para cargar' : 'Pendiente'}
                  </span>
                </span>
                <span className="shrink-0 t-subtitulo tabular-nums">
                  {l.cantidad}
                  <span className="text-tinta-tenue text-[0.75rem] ml-1">{l.unidad}</span>
                </span>
                {editable && (
                  <FormularioCargaKit
                    key={`${l.id}:${l.cargado}`}
                    accion={marcarCargaKitConEstado}
                    token={randomUUID()}
                    disabled={!editableCarga || !gestionada.operable}
                    etiqueta={l.cargado ? 'Desmarcar' : 'Marcar'}
                  >
                    <input type="hidden" name="carga_id" value={carga.id} />
                    <input type="hidden" name="linea_id" value={l.id} />
                    <input type="hidden" name="valor" value={l.cargado ? 'false' : 'true'} />
                  </FormularioCargaKit>
                )}
              </div>
            ) : (
              <FormularioMutacion action={marcarLineaCarga}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="carga_id" value={carga.id} />
                <button
                  type="submit"
                  disabled={!editable}
                  aria-pressed={l.cargado}
                  className="w-full flex items-center gap-4 text-left py-4 px-1 min-h-[3.5rem] disabled:opacity-70 hover:bg-superficie-hundida transition-colors"
                >
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
              </FormularioMutacion>
            )}
          </li>
        ))}
      </ul>

      {editable && gestionada && (
        <div className="mt-4 pt-4 border-t border-linea space-y-3">
          {resumen.pendientes > 0 && (
            <Aviso>
              Marca la unidad antes de confirmar la salida. El marcado no saca material.
            </Aviso>
          )}
          <FormularioCargaKit
            accion={confirmarCargaKitConEstado}
            token={randomUUID()}
            disabled={!editableCarga || !gestionada.operable}
            etiqueta="Confirmar salida"
            variante="principal"
          >
            <input type="hidden" name="carga_id" value={carga.id} />
            <Campo etiqueta="Sale de">
              <select name="ubicacion_id" required defaultValue="">
                <option value="" disabled>
                  Elige la ubicación
                </option>
                {saldos.map((u) => (
                  <option key={u.ubicacionId} value={u.ubicacionId}>
                    {u.ubicacion} · {u.cantidad}
                  </option>
                ))}
              </select>
            </Campo>
          </FormularioCargaKit>
        </div>
      )}

      {editable && !gestionada && (
        <div className="mt-4 pt-4 border-t border-linea space-y-3">
          {resumen.pendientes > 0 && (
            <Aviso>
              Quedan {resumen.pendientes}{' '}
              {resumen.pendientes === 1 ? 'línea' : 'líneas'} por marcar. Al confirmar
              solo sale del almacén lo marcado.
            </Aviso>
          )}
          <FormularioMutacion action={confirmarCarga} className="flex flex-wrap items-end gap-3">
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
              <QuienTecnico valorInicial={carga.quien} />
            </Campo>
            <Boton>Confirmar carga</Boton>
            <span className="text-tinta-tenue pb-1">
              Lo marcado sale del almacén y las reservas quedan servidas. Cargado ya no
              es existencia.
            </span>
          </FormularioMutacion>
        </div>
      )}
    </Tarjeta>
  );
}
