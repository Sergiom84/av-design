import { ContenedorTabla, Tarjeta } from '@/components/ui';

export interface FilaRepartoRecepcion {
  suministroId: string;
  lineaId: string;
  referencia: string;
  sala: string;
  asignado: number;
  recibido: number;
}
export interface RecepcionSinAtribuir {
  lineaId: string;
  referencia: string;
  cantidad: number;
  unidad: string;
}

/** Reparto comercial, sin afirmar reserva, servicio ni identificación física. */
export function RepartoRecepcion({ filas, sinAtribuir }: {
  filas: FilaRepartoRecepcion[];
  sinAtribuir: RecepcionSinAtribuir[];
}) {
  if (!filas.length) return null;
  return <Tarjeta titulo="Recepción por suministro">
    <ContenedorTabla etiqueta="Recepción por suministro">
      <table className="datos min-w-[32rem]">
        <thead><tr><th>Suministro</th><th>Sala</th><th className="num">Recibido</th><th className="num">Pendiente</th></tr></thead>
        <tbody>{filas.map((fila, indice) => <tr key={`${fila.lineaId}:${fila.suministroId}`}>
          <td>{fila.referencia}<span className="block text-tinta-tenue">Unidad {indice + 1}</span></td>
          <td>{fila.sala}</td><td className="num">{fila.recibido}</td><td className="num">{fila.asignado - fila.recibido}</td>
        </tr>)}</tbody>
      </table>
    </ContenedorTabla>
    {sinAtribuir.length > 0 && <div className="mt-3">
      <h3 className="font-semibold">Recibido sin atribuir</h3>
      <ul>{sinAtribuir.map(fila => <li key={fila.lineaId}>{fila.referencia}: {fila.cantidad} {fila.unidad}</li>)}</ul>
    </div>}
  </Tarjeta>;
}
