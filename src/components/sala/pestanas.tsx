'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

/**
 * La barra de pestañas de la ficha. Cada pestaña es una ruta, no un estado:
 * se puede enlazar, se vuelve con el botón del navegador y funciona sin
 * JavaScript. El segmento activo lo da el propio App Router.
 */
const PESTANAS = [
  { segmento: null, etiqueta: 'Resumen' },
  { segmento: 'equipamiento', etiqueta: 'Equipamiento' },
  { segmento: 'cableado', etiqueta: 'Cableado' },
  { segmento: 'logistica', etiqueta: 'Logística y ciclo de vida' },
  { segmento: 'documentos', etiqueta: 'Documentos' },
] as const;

export function PestanasDeSala({ salaId }: { salaId: string }) {
  const activo = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="Secciones de la sala"
      className="flex gap-1 border-b-2 border-linea mb-6 overflow-x-auto"
    >
      {PESTANAS.map(({ segmento, etiqueta }) => {
        const activa = activo === segmento || (activo === 'children' && segmento === null);
        return (
          <Link
            key={etiqueta}
            // Literal de plantilla sin cast: typedRoutes valida el segmento y
            // un typo en PESTANAS deja de compilar.
            href={segmento === null ? `/salas/${salaId}` : `/salas/${salaId}/${segmento}`}
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
