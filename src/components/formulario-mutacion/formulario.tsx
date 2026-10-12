'use client';

import { useActionState, useRef, type ComponentProps } from 'react';
import { ejecutarAccionConEstado } from '@/app/acciones-concurrencia';
import { Aviso } from '@/components/ui';
import type { AccionFormularioMutacion, EstadoFormularioMutacion } from './tipos';
import { useConservarFormulario } from './use-conservar-formulario';

type Props = Omit<ComponentProps<'form'>, 'action' | 'ref'> & {
  action: AccionFormularioMutacion;
  feedbackExterno?: boolean;
  onExito?: () => void;
};

/** Adapta formularios legacy sin cambiar sus acciones, permisos ni redirects. */
export function FormularioMutacion({ action, children, onReset, onSubmit, onExito, feedbackExterno = false, ...props }: Props) {
  const { conservar: conservarRef, formulario } = useConservarFormulario(false);
  const enCurso = useRef(false);
  const [estado, enviar, pendiente] = useActionState(async (anterior: EstadoFormularioMutacion, datos: FormData) => {
    try {
      const resultado = await ejecutarAccionConEstado(action, anterior, datos);
      conservarRef.current = resultado.error !== null;
      if (resultado.error === null) onExito?.();
      return resultado;
    } finally { enCurso.current = false; }
  }, { error: null });
  const aviso = estado.error && <div role="alert" className="w-full mt-2"><Aviso tono="alerta">{estado.error}</Aviso></div>;
  return <><form {...props} ref={formulario} action={enviar} aria-busy={pendiente} onSubmit={evento => {
    if (enCurso.current) { evento.preventDefault(); return; }
    onSubmit?.(evento);
    if (!evento.defaultPrevented) {
      conservarRef.current = true;
      enCurso.current = true;
    }
  }} onReset={evento => {
    if (conservarRef.current) evento.preventDefault();
    onReset?.(evento);
  }}>
    <fieldset disabled={pendiente} className="contents">{children}</fieldset>
    {!feedbackExterno && aviso}
  </form>{feedbackExterno && aviso}</>;
}
