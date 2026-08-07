import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import { QuienTecnico } from '@/components/ciclo-vida/quien';
import { cerrarCarga, guardarCierreLinea } from '@/app/acciones-almacen';
import { avisosDeCierre } from '@/lib/carga';
import { ETIQUETA_CARGA, type Carga, type LineaCarga, type Ubicacion } from '@/lib/tipos';

/**
 * Cierre de obra: qué se quedó instalado, qué vuelve y qué se rompió.
 *
 * Lo que vuelve entra como devolución. Lo roto entra como devolución y sale
 * acto seguido como baja: neto cero en el stock —ya había salido— y la avería
 * queda registrada. Eso último es lo único que el departamento tenía apuntado
 * hasta ahora, y a mano.
 */
export function CierreDeObra({
  carga,
  lineas,
  ubicaciones,
}: {
  carga: Carga;
  lineas: LineaCarga[];
  ubicaciones: Ubicacion[];
}) {
  if (carga.estado === 'preparacion') return null;

  const cerrada = carga.estado === 'cerrada';
  const avisos = avisosDeCierre(lineas);
  const nave = ubicaciones.find((u) => !u.es_furgoneta) ?? ubicaciones[0];

  return (
    <Tarjeta
      titulo="Cierre de obra"
      pie="Lo instalado se queda puesto. Lo que sobra vuelve al almacén. Lo roto vuelve y se da de baja, para que quede constancia de la avería."
    >
      {avisos.length > 0 && !cerrada && (
        <div className="mb-4 space-y-2">
          {avisos.map((a) => (
            <Aviso key={a.descripcion}>
              <strong>{a.descripcion}</strong> · {a.aviso}
            </Aviso>
          ))}
        </div>
      )}

      <ul className="border-t border-linea">
        {lineas.map((l) => (
          <li key={l.id} className="border-b border-linea py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <span>{l.descripcion}</span>
              <span className="text-tinta-tenue tabular-nums">
                salieron {l.cantidad} {l.unidad}
              </span>
            </div>
            <form
              action={guardarCierreLinea}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="carga_id" value={carga.id} />
              {(
                [
                  ['instalado', 'Instalado', l.instalado],
                  ['devuelto', 'Vuelve', l.devuelto],
                  ['roto', 'Roto', l.roto],
                ] as const
              ).map(([campo, etiqueta, valor]) => (
                <Campo key={campo} etiqueta={etiqueta}>
                  <input
                    name={campo}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={valor}
                    disabled={cerrada}
                    className="w-24 h-11"
                  />
                </Campo>
              ))}
              <Campo etiqueta="Notas">
                <input
                  name="notas"
                  defaultValue={l.notas ?? ''}
                  disabled={cerrada}
                  className="min-w-[10rem] h-11"
                />
              </Campo>
              {!cerrada && <Boton variante="secundario">Guardar</Boton>}
            </form>
          </li>
        ))}
      </ul>

      {cerrada ? (
        <p className="text-tinta-tenue mt-4">
          Obra cerrada. Los movimientos de devolución y baja ya están en el almacén.
        </p>
      ) : (
        <form
          action={cerrarCarga}
          className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-linea"
        >
          <input type="hidden" name="id" value={carga.id} />
          <Campo etiqueta="Vuelve a">
            <select name="ubicacion_id" defaultValue={nave?.id ?? ''}>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Quién">
            <QuienTecnico valorInicial={carga.quien} />
          </Campo>
          <Boton>Cerrar obra</Boton>
          <span className="text-tinta-tenue pb-1">
            {ETIQUETA_CARGA[carga.estado]} · se generan los movimientos de vuelta.
          </span>
        </form>
      )}
    </Tarjeta>
  );
}
