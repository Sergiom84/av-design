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
      <div className="max-w-2xl">
        <h1 className="t-titulo">{titulo}</h1>
        {descripcion && <p className="text-tinta-tenue mt-1">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-3 items-center">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({
  titulo,
  children,
  pie,
}: {
  titulo?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <section className="border border-linea bg-papel">
      {titulo && (
        <h2 className="t-subtitulo px-4 py-3 border-b border-linea">{titulo}</h2>
      )}
      <div className="p-4">{children}</div>
      {pie && <div className="px-4 py-3 border-t border-linea text-tinta-tenue">{pie}</div>}
    </section>
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
      <div className="t-subtitulo tabular-nums">
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
        ? 'border-linea-fuerte bg-papel-hundido text-tinta'
        : 'border-linea bg-papel text-tinta-tenue';
  return <div className={`border-l-2 px-4 py-3 ${estilo}`}>{children}</div>;
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
  const estilo =
    variante === 'principal'
      ? 'bg-acento text-papel border-acento hover:opacity-90'
      : variante === 'peligro'
        ? 'bg-papel text-alerta border-linea-fuerte hover:border-alerta'
        : 'bg-papel text-tinta border-linea-fuerte hover:border-tinta';
  return (
    <button
      {...resto}
      type={tipo}
      className={`border rounded-[2px] px-3 py-1.5 transition-colors ${estilo} ${resto.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-acento underline underline-offset-2 hover:opacity-80">
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
    <label className="block">
      <span className="t-etiqueta block mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-tinta-tenue mt-1 text-[0.6875rem]">{ayuda}</span>}
    </label>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-tinta-tenue py-6">{children}</p>;
}
