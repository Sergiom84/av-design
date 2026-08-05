'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECCIONES = [
  { href: '/', etiqueta: 'Panel' },
  { href: '/salas', etiqueta: 'Salas' },
  { href: '/plantillas', etiqueta: 'Plantillas' },
  { href: '/catalogo', etiqueta: 'Catálogo' },
  { href: '/almacen', etiqueta: 'Almacén' },
  { href: '/compras', etiqueta: 'Compras' },
  { href: '/carga', etiqueta: 'Carga' },
  { href: '/parametros', etiqueta: 'Parámetros' },
];

export function Navegacion() {
  const ruta = usePathname();

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
      </div>
    </header>
  );
}
