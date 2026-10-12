import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import { Boton, Campo, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import Link from 'next/link';
import { anadirToma, borrarToma, guardarToma } from '@/app/acciones';
import { UBICACIONES_TOMA, type EquipoEnSala, type TomaRed, type Puerto, type Conexion } from '@/lib/tipos';
import { ConvertirAsignacionToma } from './convertir-asignacion-toma';

/**
 * Las rosetas de red del edificio en esta sala: "este Room Navigator pincha en
 * la toma 12". El código es el número que hay escrito en la placa, no un
 * identificador nuestro.
 *
 * Las bocas se documentan en Plano y se conectan desde Diagrama. La placa
 * sigue siendo infraestructura de la sala, sin convertirse en equipo AV.
 */
export function TomasDeRed({
  salaId,
  tomas,
  equipos,
  puertos,
  conexiones,
  version,
  cerrado,
}: {
  salaId: string;
  tomas: TomaRed[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  conexiones: Conexion[];
  version: number;
  cerrado: boolean;
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
      pie="El código debe coincidir con la placa. Documenta sus bocas en Plano para conectarlas en Diagrama."
    >
      {tomas.length > 0 && <p className="mb-3"><Link href={`/salas/${salaId}/plano`}>Documentar bocas en Plano</Link></p>}
      {tomas.length === 0 ? (
        <Vacio>Sin tomas de red. Añade la primera abajo.</Vacio>
      ) : (
        <>
          {tomas.map((t) => (
            <FormularioMutacion feedbackExterno={true}
              key={`b-${t.id}`}
              id={`borrar-toma-${t.id}`}
              action={borrarToma}
              className="hidden"
            >
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="sala_id" value={salaId} />
            </FormularioMutacion>
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
                    <FormularioMutacion
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
                    </FormularioMutacion>
                  </td>
                  <td className="text-tinta-tenue">
                    {equiposPorToma.has(t.id) ? <div className="space-y-3">
                      {equipos.filter((e) => e.toma_red_id === t.id).map((e) =>
                        <ConvertirAsignacionToma key={e.id} equipo={e} toma={t} puertos={puertos} conexiones={conexiones}
                          version={version} cerrado={cerrado} />)}
                    </div> : '—'}
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

      <FormularioMutacion
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
      </FormularioMutacion>
    </Tarjeta>
  );
}
