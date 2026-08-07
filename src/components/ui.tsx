import Link from 'next/link';
import type { ReactNode } from 'react';

export function Cabecera({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="max-w-2xl min-w-0 [overflow-wrap:anywhere]">
        <h1 className="t-titulo">{titulo}</h1>
        {descripcion && <p className="text-tinta-tenue mt-1">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3 items-center">{acciones}</div>}
    </div>
  );
}

/**
 * La tarjeta base: cabecera, acciones opcionales, cuerpo y pie, con contrato
 * explícito de contención. El cuerpo ya no lleva scroll horizontal universal:
 * un formulario o un texto largo debe envolver, no convertirse en un panel
 * desplazable. El scroll técnico deliberado es de quien lo necesita
 * (`ContenedorTabla`, `table.datos`, un diagrama), no de la tarjeta entera.
 */
export function Tarjeta({
  titulo,
  acciones,
  children,
  pie,
}: {
  titulo?: string;
  acciones?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <section className="tarjeta">
      {(titulo || acciones) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-linea-suave">
          {titulo && (
            <h2 className="t-subtitulo min-w-0 max-w-full [overflow-wrap:anywhere]">{titulo}</h2>
          )}
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
      )}
      <div className="p-4 min-w-0 max-w-full">{children}</div>
      {pie && (
        <div className="px-4 py-3 border-t border-linea-suave text-tinta-tenue min-w-0 max-w-full">
          {pie}
        </div>
      )}
    </section>
  );
}

/**
 * Envuelve el scroll horizontal técnico: tabla de cables, inventario,
 * diagramas. Es la única forma admitida de desplazamiento lateral dentro de
 * una tarjeta; todo lo demás debe envolver.
 */
export function ContenedorTabla({
  children,
  etiqueta,
}: {
  children: ReactNode;
  etiqueta?: string;
}) {
  return (
    <div className="contenedor-tabla" role="group" aria-label={etiqueta}>
      {children}
    </div>
  );
}

/**
 * Fila de acciones que envuelve en vez de desbordar. La acción peligrosa se
 * pasa aparte: queda separada del resto, nunca compitiendo con la principal.
 */
export function GrupoAcciones({
  children,
  peligro,
}: {
  children?: ReactNode;
  peligro?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {peligro && (
        <div className="sm:ml-auto sm:border-l sm:border-linea-suave sm:pl-3">{peligro}</div>
      )}
    </div>
  );
}

export function Dato({
  etiqueta,
  valor,
  sufijo,
}: {
  etiqueta: string;
  valor: ReactNode;
  sufijo?: string;
}) {
  return (
    <div>
      <div className="t-etiqueta">{etiqueta}</div>
      <div className="t-subtitulo dato tabular-nums">
        {valor}
        {sufijo && <span className="text-tinta-tenue text-[0.75rem] ml-1">{sufijo}</span>}
      </div>
    </div>
  );
}

export function Aviso({
  tono = 'aviso',
  children,
}: {
  tono?: 'aviso' | 'alerta' | 'neutro';
  children: ReactNode;
}) {
  const estilo =
    tono === 'alerta'
      ? 'border-alerta bg-alerta-suave text-alerta'
      : tono === 'aviso'
        ? 'border-acento bg-superficie-hundida text-tinta'
        : 'border-linea bg-fondo text-tinta-tenue';
  return <div className={`border-l-2 rounded-r-md px-4 py-3 ${estilo}`}>{children}</div>;
}

export function Boton({
  children,
  tipo = 'submit',
  variante = 'principal',
  ...resto
}: {
  children: ReactNode;
  tipo?: 'submit' | 'button';
  variante?: 'principal' | 'secundario' | 'peligro';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // Las clases están en globals.css: el secundario es la base y las otras dos
  // son modificadores. Ver el comentario de `.boton`.
  const clases = ['boton'];
  if (variante !== 'secundario') clases.push(`boton-${variante}`);
  if (resto.className) clases.push(resto.className);

  return (
    <button {...resto} type={tipo} className={clases.join(' ')}>
      {children}
    </button>
  );
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  // El href llega como texto montado en tiempo de ejecución (ids, filtros);
  // las rutas estáticas ya las verifica typedRoutes en cada <Link> directo.
  return (
    <Link href={href as never} className="enlace">
      {children}
    </Link>
  );
}

export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className="t-etiqueta block mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-tinta-tenue mt-1 text-[0.6875rem]">{ayuda}</span>}
    </label>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-tinta-tenue py-6">{children}</p>;
}
