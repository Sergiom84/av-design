'use client';

import { useState, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { salir } from '@/app/acciones-sesion';
import { RUTA_ENTRADA } from '@/lib/sesion';
import {
  IconoPanel,
  IconoProyectos,
  IconoSalas,
  IconoPlantillas,
  IconoCheckin,
  IconoCatalogo,
  IconoAlmacen,
  IconoCompras,
  IconoCarga,
  IconoParametros,
  IconoSalir,
  IconoMenu,
  IconoCerrar,
} from './iconos';

const SECCIONES: {
  href: string;
  etiqueta: string;
  Icono: ComponentType<{ className?: string }>;
}[] = [
  { href: '/', etiqueta: 'Panel', Icono: IconoPanel },
  { href: '/proyectos', etiqueta: 'Proyectos', Icono: IconoProyectos },
  { href: '/salas', etiqueta: 'Salas', Icono: IconoSalas },
  { href: '/plantillas', etiqueta: 'Plantillas', Icono: IconoPlantillas },
  { href: '/checkin', etiqueta: 'Check-in', Icono: IconoCheckin },
  { href: '/catalogo', etiqueta: 'Catálogo', Icono: IconoCatalogo },
  { href: '/almacen', etiqueta: 'Almacén', Icono: IconoAlmacen },
  { href: '/compras', etiqueta: 'Compras', Icono: IconoCompras },
  { href: '/carga', etiqueta: 'Carga', Icono: IconoCarga },
  { href: '/parametros', etiqueta: 'Parámetros', Icono: IconoParametros },
];

function seccionActiva(ruta: string, href: string) {
  return href === '/' ? ruta === '/' : ruta.startsWith(href);
}

function Secciones({ ruta, alNavegar }: { ruta: string; alNavegar?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Secciones">
      {SECCIONES.map(({ href, etiqueta, Icono }) => {
        const activa = seccionActiva(ruta, href);
        return (
          <Link
            key={href}
            href={href as never}
            onClick={alNavegar}
            aria-current={activa ? 'page' : undefined}
            className={`flex items-center gap-3 min-h-11 rounded-md px-3 py-2 font-medium ${
              activa
                ? 'bg-acento text-rail-texto-activo'
                : 'text-rail-texto hover:bg-rail-hundido hover:text-rail-texto-activo'
            }`}
          >
            <Icono className="size-5 shrink-0" />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

function Marca() {
  return (
    <Link href="/" className="t-subtitulo block px-6 py-5 text-rail-texto-activo">
      AV<span className="text-rail-texto">_design</span>
    </Link>
  );
}

function BotonSalir() {
  /*
    Salir va abajo del todo y sin destacar: se usa una vez al día y no compite
    con las nueve secciones que se usan todo el rato.
  */
  return (
    <form action={salir} className="mt-auto px-3 pb-4">
      <button
        type="submit"
        className="flex w-full items-center gap-3 min-h-11 rounded-md px-3 py-2 text-rail-texto hover:bg-rail-hundido hover:text-rail-texto-activo"
      >
        <IconoSalir className="size-5 shrink-0" />
        Salir
      </button>
    </form>
  );
}

/*
  Marco de la aplicación: sidebar fija en escritorio, cajón en móvil y barra
  superior con el título de la sección. En la puerta no hay marco: desde ahí
  no se llega a ningún sitio.
*/
export function Marco({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  if (ruta === RUTA_ENTRADA) return <>{children}</>;

  const seccion = SECCIONES.find((s) => seccionActiva(ruta, s.href));
  /*
    Solo /salas/nueva lleva la barra de acción sticky móvil
    (components/sala/alta.tsx). Reservar aquí abajo del footer es cosa de
    esta ruta exacta, no un padding global ni un selector estructural: en
    cualquier otra pantalla no hay barra que tape nada.
  */
  const conBarraSticky = ruta === '/salas/nueva';

  return (
    <div className="min-h-full">
      {/* Sidebar de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-rail md:flex">
        <Marca />
        <Secciones ruta={ruta} />
        <BotonSalir />
      </aside>

      {/* Cajón móvil */}
      {abierto && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-tinta/40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-rail shadow-lg">
            <div className="flex items-center justify-between pr-3">
              <Marca />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                // 44 × 44: objetivo táctil, no un icono con padding.
                className="grid place-items-center min-h-11 min-w-11 rounded-md text-rail-texto hover:text-rail-texto-activo"
              >
                <IconoCerrar />
              </button>
            </div>
            <Secciones ruta={ruta} alNavegar={() => setAbierto(false)} />
            <BotonSalir />
          </aside>
        </div>
      )}

      <div
        className={`flex min-h-screen min-w-0 flex-col md:pl-64 ${
          conBarraSticky ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-4' : ''
        }`}
      >
        {/* Barra superior */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-linea-suave bg-superficie px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
            // 44 × 44: con  sobre un icono de 20 se quedaba en 36.
            className="grid place-items-center min-h-11 min-w-11 -ml-2 rounded-md text-tinta-tenue hover:text-tinta md:hidden"
          >
            <IconoMenu />
          </button>
          <span className="font-semibold">{seccion?.etiqueta ?? 'AV_design'}</span>
        </header>

        {/*
          min-w-0: sin esto un hijo con contenido ancho (tabla, texto sin
          cortar) estira `main` más allá del viewport y el documento entero
          gana scroll horizontal. `main` no lleva overflow propio: cualquier
          valor distinto de visible rompe el `sticky` de sus descendientes
          (el panel de "Se va a crear" en el alta de sala) y, con clip,
          esconde contenido sin avisar. La contención real es que cada tabla
          ancha vive en `ContenedorTabla`, no un corte a este nivel.
        */}
        <main className="w-full max-w-[100rem] min-w-0 flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-linea-suave px-4 py-4 text-[0.6875rem] text-tinta-tenue sm:px-6">
          Departamento de Audiovisuales · datos de partida: inventario de salas 2026
        </footer>
      </div>
    </div>
  );
}
