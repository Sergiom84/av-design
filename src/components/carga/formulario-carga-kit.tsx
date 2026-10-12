'use client';

import { useActionState, useRef, useState, type ReactNode } from 'react';
import { Aviso, Boton } from '@/components/ui';
import { useConservarFormulario } from '@/components/formulario-mutacion/use-conservar-formulario';
import type { EstadoCargaKit } from '@/lib/operaciones-carga';

export type AccionCargaKit = (estado: EstadoCargaKit, datos: FormData) => Promise<EstadoCargaKit>;

/** Token estable durante el intento; el valor de marcado y la ubicación viajan en el formulario. */
export function FormularioCargaKit({
  accion,
  token,
  disabled,
  etiqueta,
  variante = 'secundario',
  children,
}: {
  accion: AccionCargaKit;
  token: string;
  disabled: boolean;
  etiqueta: string;
  variante?: 'principal' | 'secundario';
  children?: ReactNode;
}) {
  const [operacionId] = useState(token);
  const { conservar: conservarRef, formulario } = useConservarFormulario(false);
  const enCurso = useRef(false);
  const [estado, enviar, pendiente] = useActionState(async (anterior: EstadoCargaKit, datos: FormData) => {
    try {
      const resultado = await accion(anterior, datos);
      conservarRef.current = resultado.error !== null;
      return resultado;
    } finally { enCurso.current = false; }
  }, { error: null });
  return (
    <form
      ref={formulario}
      action={enviar}
      aria-busy={pendiente}
      className="min-w-0"
      onSubmit={(evento) => {
        if (enCurso.current) {
          evento.preventDefault();
          return;
        }
        if (!evento.defaultPrevented) {
          conservarRef.current = true;
          enCurso.current = true;
        }
      }}
      onReset={(evento) => {
        if (conservarRef.current) evento.preventDefault();
      }}
    >
      <fieldset disabled={disabled || pendiente} className="flex flex-wrap items-end gap-3 min-w-0">
        <input type="hidden" name="operacion_id" value={operacionId} />
        {children}
        <Boton variante={variante} disabled={disabled || pendiente}>
          {etiqueta}
        </Boton>
      </fieldset>
      {estado.error && (
        <div role="alert" className="mt-2">
          <Aviso tono="alerta">{estado.error}</Aviso>
        </div>
      )}
    </form>
  );
}
