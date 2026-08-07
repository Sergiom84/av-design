import { Boton, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import { borrarConexion, guardarConexion } from '@/app/acciones';
import { avisosDeConexion } from '@/lib/cable-schedule';
import {
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  ETIQUETA_SENTIDO,
  type Articulo,
  type Conexion,
  type EquipoEnSala,
  type Puerto,
  type Sala,
} from '@/lib/tipos';
import { FormularioConexion } from './formulario-conexion';

/**
 * Qué conecta con qué, y por qué puerto exactamente.
 *
 * Las filas ya dadas de alta se pueden detallar sin volver a crearlas: crear
 * una conexión nueva le cambiaría el identificador de cable, y ese
 * identificador puede estar ya escrito en una brida.
 */
export function Conexiones({
  sala,
  conexiones,
  equipos,
  puertos,
  articulos,
}: {
  sala: Sala;
  conexiones: Conexion[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  articulos: Articulo[];
}) {
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const puertosPorId = new Map(puertos.map((p) => [p.id, p]));
  const articulosPorId = new Map(articulos.map((a) => [a.id, a]));
  const cables = articulos.filter((a) => a.tipo === 'cable');

  const puertosDeEquipo = (equipoId: string | undefined): Puerto[] => {
    const articulo = equipoId ? equiposPorId.get(equipoId)?.articulo_id : null;
    return articulo ? puertos.filter((p) => p.articulo_id === articulo) : [];
  };

  const selectorPuerto = (
    conexionId: string,
    lado: 'origen' | 'destino',
    equipoId: string,
    valor: string | null | undefined,
  ) => {
    const lista = puertosDeEquipo(equipoId);
    return (
      <select
        form={`conexion-${conexionId}`}
        name={`puerto_${lado}_id`}
        defaultValue={valor ?? ''}
        disabled={lista.length === 0}
        aria-label={`Puerto de ${lado}`}
        className="max-w-[11rem]"
      >
        <option value="">{lista.length === 0 ? '— sin puertos —' : '—'}</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} · {ETIQUETA_SENTIDO[p.sentido]}
          </option>
        ))}
      </select>
    );
  };

  return (
    <Tarjeta titulo="Conexiones">
      {conexiones.length === 0 ? (
        <Vacio>Sin conexiones definidas.</Vacio>
      ) : (
        <>
          {conexiones.map((c) => (
            <form key={`f-${c.id}`} id={`conexion-${c.id}`} action={guardarConexion} className="hidden">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="sala_id" value={sala.id} />
            </form>
          ))}
          {conexiones.map((c) => (
            <form key={`b-${c.id}`} id={`borrar-conexion-${c.id}`} action={borrarConexion} className="hidden">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="sala_id" value={sala.id} />
            </form>
          ))}

          <ContenedorTabla etiqueta="Conexiones">
          <table className="datos">
            <thead>
              <tr>
                <th>Origen</th>
                <th>Puerto</th>
                <th>Destino</th>
                <th>Puerto</th>
                <th>Señal</th>
                <th>Cable</th>
                <th>Ruta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conexiones.map((c) => {
                const avisos = avisosDeConexion(
                  c,
                  c.puerto_origen_id ? puertosPorId.get(c.puerto_origen_id) : undefined,
                  c.puerto_destino_id ? puertosPorId.get(c.puerto_destino_id) : undefined,
                  c.articulo_cable_id ? articulosPorId.get(c.articulo_cable_id) : undefined,
                );
                return (
                  <tr key={c.id}>
                    <td>{equiposPorId.get(c.origen_id)?.nombre ?? '—'}</td>
                    <td>{selectorPuerto(c.id, 'origen', c.origen_id, c.puerto_origen_id)}</td>
                    <td>{equiposPorId.get(c.destino_id)?.nombre ?? '—'}</td>
                    <td>{selectorPuerto(c.id, 'destino', c.destino_id, c.puerto_destino_id)}</td>
                    <td>
                      <select
                        form={`conexion-${c.id}`}
                        name="senal"
                        defaultValue={c.senal}
                        aria-label="Señal"
                      >
                        {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
                          <option key={v} value={v}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        form={`conexion-${c.id}`}
                        name="articulo_cable_id"
                        defaultValue={c.articulo_cable_id ?? ''}
                        aria-label="Cable"
                        className="max-w-[12rem]"
                      >
                        <option value="">— sin asignar —</option>
                        {cables.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.modelo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        form={`conexion-${c.id}`}
                        name="ruta"
                        defaultValue={c.ruta ?? ''}
                        aria-label="Ruta"
                      >
                        <option value="">{ETIQUETA_RUTA[sala.ruta_por_defecto]} (sala)</option>
                        {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
                          <option key={v} value={v}>
                            {e}
                          </option>
                        ))}
                      </select>
                      <input
                        form={`conexion-${c.id}`}
                        type="hidden"
                        name="longitud_manual_m"
                        value={c.longitud_manual_m ?? ''}
                      />
                      {avisos.length > 0 && (
                        <ul className="text-alerta mt-1 list-disc pl-4 max-w-[16rem]">
                          {avisos.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <Boton form={`conexion-${c.id}`} variante="secundario">
                          Guardar
                        </Boton>
                        <Boton form={`borrar-conexion-${c.id}`} variante="peligro">
                          Quitar
                        </Boton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ContenedorTabla>
        </>
      )}

      <FormularioConexion
        salaId={sala.id}
        equipos={equipos.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          articulo_id: e.articulo_id,
        }))}
        puertos={puertos}
        cables={cables.map((a) => ({
          id: a.id,
          etiqueta: `${a.marca ?? ''} ${a.modelo}`.trim(),
          senal: a.senal,
        }))}
      />
    </Tarjeta>
  );
}
