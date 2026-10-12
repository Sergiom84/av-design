import { ContenedorTabla, Dato, Tarjeta, Vacio } from '@/components/ui';
import type { ResultadoCable } from '@/lib/calculo-cable';
import type { FilaCable } from '@/lib/cable-schedule';
import { ETIQUETA_RUTA } from '@/lib/tipos';

/**
 * El desglose del cálculo, tirada a tirada. Enseña de dónde sale cada metro
 * —subida, horizontal, bajada, holguras— porque un número sin desglose no se
 * puede discutir con el instalador.
 */
export function ResultadoDelCable({
  resultados,
  sinMedidas,
  filas,
}: {
  resultados: ResultadoCable[];
  sinMedidas: boolean;
  filas: FilaCable[];
}) {
  const totalMetros = resultados.reduce((a, r) => a + r.longitud_m, 0);
  const pendientes = filas.filter((fila) => fila.metros == null);

  return (
    <Tarjeta titulo="Cable necesario">
      {pendientes.length > 0 && <div className="mb-6">
        <p>{pendientes.length} {pendientes.length === 1 ? 'tirada pendiente' : 'tiradas pendientes'} de cálculo.</p>
        <ul className="mt-2 space-y-2" aria-label="Tiradas pendientes de cálculo">
          {pendientes.map((fila) => <li key={fila.conexion_id}>
            <strong>{fila.identificador}</strong>: {fila.motivo_calculo_pendiente ??
              (sinMedidas ? 'Rellena las medidas de la sala.' : 'Revisa los extremos y los datos del cálculo.')}
          </li>)}
        </ul>
      </div>}
      {resultados.length === 0 && pendientes.length === 0 ? (
        <Vacio>
          {sinMedidas
            ? 'Rellena las medidas de la sala.'
            : 'Añade equipos y define qué conecta con qué.'}
        </Vacio>
      ) : resultados.length > 0 ? (
        <>
          <div className="grid sm:grid-cols-3 gap-6 mb-6">
            <Dato etiqueta={pendientes.length ? 'Tiradas calculadas' : 'Tiradas'} valor={resultados.length} />
            <Dato etiqueta={pendientes.length ? 'Metros calculados' : 'Metros totales'} valor={totalMetros.toFixed(2)} sufijo="m" />
            <Dato
              etiqueta="Tirada más larga"
              valor={Math.max(...resultados.map((r) => r.longitud_m)).toFixed(2)}
              sufijo="m"
            />
          </div>

          <ContenedorTabla etiqueta="Cable necesario">
          <table className="datos">
            <thead>
              <tr>
                <th>Tirada</th>
                <th>Ruta</th>
                <th className="num">Subida</th>
                <th className="num">Horizontal</th>
                <th className="num">Bajada</th>
                <th className="num">Holguras</th>
                <th className="num">Total</th>
                <th className="num">Se pide</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.conexion_id}>
                  <td>{r.etiqueta}</td>
                  <td>{ETIQUETA_RUTA[r.ruta]}</td>
                  <td className="num">{r.detalle.subida_m}</td>
                  <td className="num">{r.detalle.horizontal_m}</td>
                  <td className="num">{r.detalle.bajada_m}</td>
                  <td className="num">
                    {(r.holgura_origen_m + r.holgura_destino_m).toFixed(2)}
                  </td>
                  <td className="num">
                    <strong>{r.longitud_m.toFixed(2)}</strong>
                    {r.manual && <span className="text-tinta-tenue"> manual</span>}
                  </td>
                  <td className="num">
                    {r.longitud_comercial_m != null ? `${r.longitud_comercial_m} m` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ContenedorTabla>
        </>
      ) : null}
    </Tarjeta>
  );
}
