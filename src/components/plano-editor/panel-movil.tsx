'use client';

import { useState, type ReactNode } from 'react';

/**
 * En móvil el inspector no es una columna estrecha: es un panel que se abre
 * por debajo, con el lienzo entero encima. Una columna de 320 px comprimida a
 * 320 px de pantalla no es un inspector, es un formulario ilegible.
 *
 * Cerrado deja una barra con lo que hay seleccionado, para no perder de vista
 * sobre qué se va a escribir. Es un `<details>` de verdad: funciona sin
 * JavaScript, se puede abrir con teclado y el navegador ya sabe anunciarlo.
 */
export function PanelMovil({
  resumen,
  children,
}: {
  resumen: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <details
      open={abierto}
      onToggle={(ev) => setAbierto((ev.currentTarget as HTMLDetailsElement).open)}
      className="lg:hidden border-t border-linea"
    >
      {/* El foco visible se pone aquí y no en `globals.css`: la regla global
          cubre input, select, textarea, a y button, y `summary` no es
          ninguno de los cinco. Sin esto, quien navega con teclado en móvil
          abre el panel a ciegas. */}
      <summary className="flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento">
        <span className="min-w-0 [overflow-wrap:anywhere]">{resumen}</span>
        <span className="text-acento font-medium whitespace-nowrap">
          {abierto ? 'Cerrar' : 'Editar'}
        </span>
      </summary>
      <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">{children}</div>
    </details>
  );
}
