'use client';

import { useActionState, type ReactNode } from 'react';
import { guardarPruebaConEstado } from '@/app/acciones-ciclo';
import { useConservarFormulario } from '@/components/formulario-mutacion/use-conservar-formulario';

/** Los errores de validación y concurrencia se muestran sin navegar ni vaciar el trabajo. */
export function FormularioPrueba({ children }: { children: ReactNode }) {
  const { formulario } = useConservarFormulario();
  const [estado, accion, pendiente] = useActionState(guardarPruebaConEstado, { error: null });
  return <form ref={formulario} action={accion} onReset={(evento) => evento.preventDefault()} className="space-y-3" aria-busy={pendiente}>
    {estado.error && <p role="alert" className="text-alerta">{estado.error}</p>}
    <fieldset disabled={pendiente} className="min-w-0 space-y-3">{children}</fieldset>
  </form>;
}
