'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { salir } from '@/app/acciones-sesion';
import { RUTA_ENTRADA } from '@/lib/sesion';

const SECCIONES = [
  { href: '/', etiqueta: 'Panel' },
  { href: '/salas', etiqueta: 'Salas' },
  { href: '/plantillas', etiqueta: 'Plantillas' },
  { href: '/checkin', etiqueta: 'Check-in' },
  { href: '/catalogo', etiqueta: 'Catálogo' },
  { href: '/almacen', etiqueta: 'Almacén' },
  { href: '/compras', etiqueta: 'Compras' },
  { href: '/carga', etiqueta: 'Carga' },
  { href: '/parametros', etiqueta: 'Parámetros' },
];

export function Navegacion() {
  const ruta = usePathname();

  // En la puerta no hay barra: desde ahí no se llega a ningún sitio, y una
  // barra con nueve enlaces que redirigen a la propia puerta solo confunde.
  if (ruta === RUTA_ENTRADA) return null;

  return (
    <header className="border-b border-linea">
      <div className="w-full max-w-[100rem] mx-auto px-4 sm:px-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 py-4">
        <Link href="/" className="t-subtitulo shrink-0">
          AV<span className="text-tinta-tenue">_design</span>
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          {SECCIONES.map((s) => {
            const activa = s.href === '/' ? ruta === '/' : ruta.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? 'page' : undefined}
                className={
                  activa
                    ? 'text-acento border-b border-acento pb-0.5'
                    : 'text-tinta-tenue hover:text-tinta pb-0.5 border-b border-transparent'
                }
              >
                {s.etiqueta}
              </Link>
            );
          })}
        </nav>

        {/*
          Salir va al final y sin destacar: se usa una vez al día y compite en
          la misma barra con las nueve secciones que se usan todo el rato.
        */}
        <form action={salir} className="ml-auto">
          <button type="submit" className="text-tinta-tenue hover:text-tinta">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
