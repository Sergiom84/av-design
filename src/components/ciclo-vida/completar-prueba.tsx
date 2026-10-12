'use client';

import { useState } from 'react';
import { Boton } from '@/components/ui';
import { PUNTOS_PRUEBA_FINAL } from '@/lib/ciclo-vida-seguimiento';

/** La guarda del servidor sigue mandando. Este control evita perder un formulario incompleto. */
export function CompletarPrueba() {
  const [error, setError] = useState('');
  return <>
    <Boton name="operacion" value="prueba_final" onClick={(evento) => {
      const formulario = evento.currentTarget.form;
      if (!formulario) return;
      const datos = new FormData(formulario);
      const pendientes = PUNTOS_PRUEBA_FINAL.filter(({ clave }) => !['conforme', 'no_aplica'].includes(String(datos.get(`resultado_${clave}`))));
      const sinJustificar = PUNTOS_PRUEBA_FINAL.find(({ clave }) => datos.get(`resultado_${clave}`) === 'no_aplica' && !String(datos.get(`nota_${clave}`) ?? '').trim());
      const algunoConforme = PUNTOS_PRUEBA_FINAL.some(({ clave }) => datos.get(`resultado_${clave}`) === 'conforme');
      if (pendientes.length || sinJustificar || !algunoConforme || !datos.get('fecha')) {
        evento.preventDefault();
        setError(pendientes.length ? 'Guarda el checklist para registrar los pendientes o incidencias. Resuélvelos antes de completar la prueba.' :
          sinJustificar ? 'Justifica los puntos que no aplican.' : !algunoConforme ? 'La prueba necesita al menos un punto conforme.' : 'Indica la fecha de prueba.');
        const nombre = pendientes[0] ? `resultado_${pendientes[0].clave}` : sinJustificar ? `nota_${sinJustificar.clave}` : 'fecha';
        const campo = formulario.elements.namedItem(nombre);
        if (campo instanceof HTMLElement) campo.focus();
      } else setError('');
    }}>Completar prueba final</Boton>
    {error && <p role="alert" className="text-alerta">{error}</p>}
  </>;
}
