'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

/**
 * La barra de pestañas de la ficha. Cada pestaña es una ruta, no un estado:
 * se puede enlazar, se vuelve con el botón del navegador y funciona sin
 * JavaScript. El segmento activo lo da el propio App Router.
 */
const PESTANAS: { segmento: string | null; etiqueta: string; sufijo: string }[] = [
  { segmento: null, etiqueta: 'Resumen', sufijo: '' },
  { segmento: 'equipamiento', etiqueta: 'Equipamiento', sufijo: '/equipamiento' },
  { segmento: 'cableado', etiqueta: 'Cableado', sufijo: '/cableado' },
  { segmento: 'logistica', etiqueta: 'Logística y ciclo de vida', sufijo: '/logistica' },
  { segmento: 'documentos', etiqueta: 'Documentos', sufijo: '/documentos' },
];

export function PestanasDeSala({ salaId }: { salaId: string }) {
  const activo = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="Secciones de la sala"
      className="flex gap-1 border-b-2 border-linea mb-6 overflow-x-auto"
    >
      {PESTANAS.map(({ segmento, etiqueta, sufijo }) => {
        const activa = activo === segmento || (activo === 'children' && segmento === null);
        return (
          <Link
            key={etiqueta}
            href={`/salas/${salaId}${sufijo}` as never}
            aria-current={activa ? 'page' : undefined}
            className={`whitespace-nowrap px-3.5 py-2 -mb-0.5 border-b-2 font-medium ${
              activa
                ? 'border-acento text-acento'
                : 'border-transparent text-tinta-tenue hover:text-tinta'
            }`}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
