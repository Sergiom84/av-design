'use client';

import { useActionState } from 'react';
import { Boton } from '@/components/ui';

/** Un rechazo por historial vinculado se explica en la misma confirmación. */
export function FormularioBorrado({ id, accion }: {
  id: string;
  accion: (datos: FormData) => Promise<void | { error: string }>;
}) {
  const [error, enviar, pendiente] = useActionState(async (_anterior: string | null, datos: FormData) => {
    const resultado = await accion(datos);
    return resultado ? resultado.error : null;
  }, null);

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Boton variante="peligro" disabled={pendiente}>Borrar definitivamente</Boton>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
