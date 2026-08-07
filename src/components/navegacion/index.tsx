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
            className={`flex items-center gap-3 rounded-md px-3 py-2 font-medium ${
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
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-rail-texto hover:bg-rail-hundido hover:text-rail-texto-activo"
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
                className="rounded-md p-2 text-rail-texto hover:text-rail-texto-activo"
              >
                <IconoCerrar />
              </button>
            </div>
            <Secciones ruta={ruta} alNavegar={() => setAbierto(false)} />
            <BotonSalir />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-linea-suave bg-superficie px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
            className="rounded-md p-2 text-tinta-tenue hover:text-tinta md:hidden"
          >
            <IconoMenu />
          </button>
          <span className="font-semibold">{seccion?.etiqueta ?? 'AV_design'}</span>
        </header>

        <main className="w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-linea-suave px-4 py-4 text-[0.6875rem] text-tinta-tenue sm:px-6">
          Departamento de Audiovisuales · datos de partida: inventario de salas 2026
        </footer>
      </div>
    </div>
  );
}
