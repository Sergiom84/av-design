'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * La barra de pestañas de la ficha. Cada pestaña es una ruta, no un estado:
 * se puede enlazar, se vuelve con el botón del navegador y funciona sin
 * JavaScript. El segmento activo lo da el propio App Router.
 *
 * En móvil la barra desborda: la pestaña activa se lleva a la vista al
 * entrar, recargar, navegar o volver atrás, y un degradado discreto en cada
 * lado avisa de que hay más pestañas cuando el desbordamiento existe en esa
 * dirección — nunca los dos gratis por defecto. Todo esto es mejora
 * progresiva sobre enlaces que ya funcionan sin JavaScript.
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
  const contenedorRef = useRef<HTMLElement>(null);
  const activaRef = useRef<HTMLAnchorElement>(null);
  const [desborde, setDesborde] = useState({ izquierda: false, derecha: false });

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;

    const medir = () => {
      setDesborde({
        izquierda: el.scrollLeft > 1,
        derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };

    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, []);

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activaRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reducido ? 'auto' : 'smooth',
    });
  }, [activo]);

  return (
    <div className="relative mb-6">
      {desborde.izquierda && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-fondo to-transparent"
        />
      )}
      <nav
        ref={contenedorRef}
        aria-label="Secciones de la sala"
        className="flex gap-1 border-b-2 border-linea overflow-x-auto"
      >
        {PESTANAS.map(({ segmento, etiqueta }) => {
          const activa = activo === segmento || (activo === 'children' && segmento === null);
          return (
            <Link
              key={etiqueta}
              ref={activa ? activaRef : undefined}
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
      {desborde.derecha && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-fondo to-transparent"
        />
      )}
    </div>
  );
}
