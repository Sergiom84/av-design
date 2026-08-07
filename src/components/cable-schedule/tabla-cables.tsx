import { ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import type { FilaCable } from '@/lib/cable-schedule';
import { ETIQUETA_RUTA, ETIQUETA_SENAL } from '@/lib/tipos';
import { ExportarCsv } from './exportar-csv';

/**
 * La tabla de cables de la sala: el entregable.
 *
 * Es la misma tabla que genera XTEN-AV, con la diferencia que justifica todo
 * el proyecto: la columna de metros trae el cálculo sobre la geometría real de
 * esta sala, no una constante de plantilla de 6, 20 o 50 pies igual en todas
 * (docs/06, apartado 6). El desglose se enseña al lado para que el número se
 * pueda discutir con el instalador.
 */
export function TablaCables({
  filas,
  nombreSala,
}: {
  filas: FilaCable[];
  nombreSala: string;
}) {
  const conAvisos = filas.filter((f) => f.avisos.length > 0).length;

  return (
    <Tarjeta
      titulo="Tabla de cables"
      pie={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            El identificador se escribe en la brida de cada extremo. Es correlativo
            por señal y no cambia al dar de alta otra tirada.
            {conAvisos > 0 &&
              ` ${conAvisos} ${conAvisos === 1 ? 'tirada tiene avisos' : 'tiradas tienen avisos'}.`}
          </span>
          {filas.length > 0 && <ExportarCsv filas={filas} nombreSala={nombreSala} />}
        </div>
      }
    >
      {filas.length === 0 ? (
        <Vacio>
          Sin tiradas. Define qué puerto va a qué puerto en el bloque de conexiones.
        </Vacio>
      ) : (
        <ContenedorTabla etiqueta="Tabla de cables">
        <table className="datos">
          <thead>
            <tr>
              <th>Cable</th>
              <th>Origen</th>
              <th>Puerto</th>
              <th>Conector</th>
              <th>Destino</th>
              <th>Puerto</th>
              <th>Conector</th>
              <th>Toma</th>
              <th>Señal</th>
              <th>Ruta</th>
              <th className="num">Metros</th>
              <th>Desglose</th>
              <th>Cable asignado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.conexion_id}>
                <td className="whitespace-nowrap">
                  <strong>{f.identificador}</strong>
                </td>
                <td>{f.origen}</td>
                <td>{f.puerto_origen ?? '—'}</td>
                <td>{f.conector_origen ?? '—'}</td>
                <td>{f.destino}</td>
                <td>{f.puerto_destino ?? '—'}</td>
                <td>{f.conector_destino ?? '—'}</td>
                <td>{f.toma_red ?? '—'}</td>
                <td>{ETIQUETA_SENAL[f.senal]}</td>
                <td>{f.ruta ? ETIQUETA_RUTA[f.ruta] : '—'}</td>
                <td className="num whitespace-nowrap">
                  {f.metros != null ? <strong>{f.metros.toFixed(2)}</strong> : '—'}
                  {f.manual && <span className="text-tinta-tenue"> manual</span>}
                </td>
                <td className="text-tinta-tenue whitespace-nowrap">
                  {f.metros == null
                    ? 'Faltan las medidas de la sala'
                    : f.manual
                      ? 'Longitud metida a mano'
                      : `${f.recorrido_m?.toFixed(2)} recorrido + ` +
                        `${f.holgura_origen_m?.toFixed(2)} + ${f.holgura_destino_m?.toFixed(2)} holgura` +
                        (f.margen_m ? ` + ${f.margen_m.toFixed(2)} margen` : '')}
                </td>
                <td>
                  {f.articulo_cable ?? <span className="text-alerta">sin asignar</span>}
                  {f.longitud_comercial_m != null && (
                    <span className="text-tinta-tenue"> · {f.longitud_comercial_m} m</span>
                  )}
                  {f.avisos.length > 0 && (
                    <ul className="text-alerta mt-1 list-disc pl-4 max-w-[16rem]">
                      {f.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}
    </Tarjeta>
  );
}
