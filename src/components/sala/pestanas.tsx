'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * La barra de pestañas de la ficha. Cada pestaña es una ruta, no un estado:
 * se puede enlazar, se vuelve con el botón del navegador y funciona sin
 * JavaScript. El segmento activo lo da el propio App Router.
 *
 * En móvil la barra desborda: la pestaña activa se lleva a la vista al
 * entrar, recargar, navegar o volver atrás, y una flecha discreta en cada
 * lado avisa de que hay más pestañas cuando el desbordamiento existe en esa
 * dirección — nunca las dos gratis por defecto. Es un icono SVG en línea
 * (`design-system/MASTER.md`: sin fuente de iconos, sin gradientes) con su
 * propio `aria-label`, no un icono suelto y `aria-hidden`: la misma regla
 * ("un icono nunca va solo: siempre con texto o aria-label") que ya siguen
 * los botones +/− de equipamiento. No es `aria-live`, así que desplazar no
 * genera anuncios: un lector de pantalla solo lo lee si navega hasta ahí,
 * igual que cualquier otro texto de la página. Todo esto es mejora
 * progresiva sobre enlaces que ya funcionan sin JavaScript.
 */
function Flecha({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={
        direccion === 'izquierda' ? 'Hay más pestañas hacia la izquierda' : 'Hay más pestañas hacia la derecha'
      }
    >
      <path d={direccion === 'izquierda' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
const PESTANAS = [
  { segmento: null, etiqueta: 'Resumen' },
  { segmento: 'diagrama', etiqueta: 'Diagrama' },
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

  const medir = useCallback(() => {
    const el = contenedorRef.current;
    if (!el) return;
    setDesborde({
      izquierda: el.scrollLeft > 1,
      derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, [medir]);

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activaRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reducido ? 'auto' : 'smooth',
    });
    // Un scroll instantáneo (`auto`, con `prefers-reduced-motion` o sin él
    // en salas ya visibles) puede no disparar el evento `scroll` con tiempo
    // para el próximo pintado: se remide aquí mismo en vez de fiarlo solo al
    // listener. Con `smooth` esta medida es la de partida; el listener de
    // 'scroll' recoge el resto mientras la animación sigue en marcha.
    medir();
  }, [activo, medir]);

  return (
    <div className="relative mb-6">
      {desborde.izquierda && (
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center bg-fondo pr-1 text-tinta-tenue">
          <Flecha direccion="izquierda" />
        </span>
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
        <span className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-fondo pl-1 text-tinta-tenue">
          <Flecha direccion="derecha" />
        </span>
      )}
    </div>
  );
}
