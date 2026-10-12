'use client';

import { useActionState, useState } from 'react';
import { Aviso, Boton } from '@/components/ui';

export type EstadoReservaKit = { error: string | null };
export type AccionReservaKit = (estado: EstadoReservaKit, datos: FormData) => Promise<EstadoReservaKit>;

/** El token permanece durante errores/reintentos; cambia al cambiar de operación. */
export function FormularioReservaKit({ accion, token, suministroId, reservaId, disabled }: {
  accion: AccionReservaKit;
  token: string;
  suministroId: string;
  reservaId: string | null;
  disabled: boolean;
}) {
  const [operacionId] = useState(token);
  const [estado, enviar, pendiente] = useActionState(accion, { error: null });
  return <form action={enviar} aria-busy={pendiente}>
    <input type="hidden" name="operacion_id" value={operacionId} />
    {reservaId
      ? <input type="hidden" name="reserva_id" value={reservaId} />
      : <input type="hidden" name="suministro_id" value={suministroId} />}
    <Boton variante="secundario" disabled={disabled || pendiente}>{reservaId ? 'Liberar' : 'Reservar'}</Boton>
    {estado.error && <div role="alert" className="mt-2"><Aviso tono="alerta">{estado.error}</Aviso></div>}
  </form>;
}
