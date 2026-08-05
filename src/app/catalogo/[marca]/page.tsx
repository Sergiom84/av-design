import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarCategoriasDeMarca, listarArticulosDeMarca } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Marca({ params }: PageProps<'/catalogo/[marca]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { marca } = await params;
  const nombre = decodeURIComponent(marca);

  const [categorias, articulos] = await Promise.all([
    listarCategoriasDeMarca(nombre),
    listarArticulosDeMarca(nombre),
  ]);
  if (categorias.length === 0) notFound();

  const conPrecio = articulos.filter((a) => a.coste != null).length;

  return (
    <>
      <div className="text-tinta-tenue mb-2">
        <Enlace href="/catalogo">Catálogo</Enlace> / {nombre}
      </div>
      <Cabecera
        titulo={nombre}
        descripcion={`${articulos.length} referencias en ${categorias.length} secciones · ${conPrecio} con precio`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {categorias.map((c) => {
          const suyos = articulos.filter((a) => a.categoria === c.categoria);
          return (
            <Tarjeta
              key={c.categoria}
              titulo={c.categoria}
              pie={
                <Enlace
                  href={`/catalogo/${encodeURIComponent(nombre)}/${encodeURIComponent(c.categoria)}`}
                >
                  Ver la sección completa ({c.referencias})
                </Enlace>
              }
            >
              <ul className="space-y-1">
                {suyos.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <Link
                      href={`/articulo/${a.id}`}
                      className="text-acento underline underline-offset-2"
                    >
                      {a.modelo}
                    </Link>
                    <span className="text-tinta-tenue tabular-nums shrink-0">
                      {a.coste != null
                        ? `${a.coste.toFixed(2)} €`
                        : a.unidades_instaladas
                          ? `${a.unidades_instaladas} ud instaladas`
                          : 'sin precio'}
                    </span>
                  </li>
                ))}
                {suyos.length > 8 && (
                  <li className="text-tinta-tenue">y {suyos.length - 8} más</li>
                )}
              </ul>
            </Tarjeta>
          );
        })}
      </div>
    </>
  );
}
