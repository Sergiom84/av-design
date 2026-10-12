'use client';

import { useEffect, useRef } from 'react';

/** React reinicia durante el commit, cuando sus eventos sintéticos están suspendidos. */
export function useConservarFormulario(inicial = true) {
  const conservar = useRef(inicial);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formulario.current;
    const antesDeReset = (evento: Event) => {
      if (conservar.current) evento.preventDefault();
    };
    form?.addEventListener('reset', antesDeReset);
    return () => form?.removeEventListener('reset', antesDeReset);
  }, []);
  return { conservar, formulario };
}
