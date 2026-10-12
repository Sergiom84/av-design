import { randomUUID } from 'node:crypto';
import { ContenedorTabla, Enlace } from '@/components/ui';
import { FormularioReservaKit, type AccionReservaKit } from './formulario-reserva-kit';
import { FormularioCargaKit, type AccionCargaKit } from '@/components/carga/formulario-carga-kit';

import type { FilaReservaSuministro } from '@/lib/reservas-suministro-lectura';
export type { FilaReservaSuministro } from '@/lib/reservas-suministro-lectura';

/** Dentro de Material reservado: identidad comercial explícita de cada unidad. */
export function ReservasPorSuministro({ filas, editable, reservar, liberar, preparar, editableCarga = false }: {
  filas: FilaReservaSuministro[];
  editable: boolean;
  reservar: AccionReservaKit;
  liberar: AccionReservaKit;
  preparar?: AccionCargaKit;
  editableCarga?: boolean;
}) {
  if (!filas.length) return null;
  return <div className="mb-4">
    <ContenedorTabla etiqueta="Reservas por suministro">
      <table className="datos min-w-[40rem]">
        <thead><tr><th>Suministro</th><th className="num">Reservado</th><th className="num">Servido</th>
          <th className="num">Pendiente</th><th className="num">Disponible</th><th /></tr></thead>
        <tbody>{filas.map((fila, indice) => <tr key={fila.suministroId}>
          <td>{fila.referencia}<span className="block text-tinta-tenue">Unidad {indice + 1}</span></td>
          <td className="num">{fila.reservado}</td><td className="num">{fila.servido}</td>
          <td className="num">{fila.pendiente}</td><td className="num">{fila.disponible}</td>
          <td>
            <div className="flex flex-wrap items-center gap-2">
              {fila.reservaGestionadaId || (fila.pendiente > 0 && fila.reservado === 0)
                ? <FormularioReservaKit key={`${fila.suministroId}:${fila.reservaGestionadaId ?? 'reservar'}`}
                    accion={fila.reservaGestionadaId ? liberar : reservar} token={randomUUID()}
                    suministroId={fila.suministroId} reservaId={fila.reservaGestionadaId}
                    disabled={!editable || (!fila.reservaGestionadaId && fila.disponible < 1)} />
                : <span className="text-tinta-tenue">{fila.reservado > 0 ? 'Reserva histórica' : 'Cubierto'}</span>}
              {preparar && fila.reservaGestionadaId && (
                <FormularioCargaKit
                  key={`${fila.reservaGestionadaId}:preparar`}
                  accion={preparar}
                  token={randomUUID()}
                  disabled={!editableCarga}
                  etiqueta={fila.cargaId ? 'Abrir carga' : 'Preparar'}
                >
                  <input type="hidden" name="reserva_id" value={fila.reservaGestionadaId} />
                </FormularioCargaKit>
              )}
              {fila.cargaId && <Enlace href={`/carga/${fila.cargaId}`}>Ver carga</Enlace>}
            </div>
          </td>
        </tr>)}</tbody>
      </table>
    </ContenedorTabla>
  </div>;
}
