import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { articulosConPuertos, listarArticulosDeMarca } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, ContenedorTabla, Enlace, Tarjeta } from '@/components/ui';
import { ETIQUETA_SENAL, Senal } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function Seccion({
  params,
}: PageProps<'/catalogo/[marca]/[categoria]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { marca, categoria } = await params;
  const nombreMarca = decodeURIComponent(marca);
  const nombreCategoria = decodeURIComponent(categoria);

  const articulos = await listarArticulosDeMarca(nombreMarca, nombreCategoria);
  if (articulos.length === 0) notFound();

  const hayCable = articulos.some((a) => a.tipo !== 'equipo');

  // Saber qué está listo para conectar antes de ponerse a diseñar: sin puertos
  // no hay esquema de conexiones ni tabla de cables.
  const conPuertos = await articulosConPuertos(articulos.map((a) => a.id));

  return (
    <>
      <div className="text-tinta-tenue mb-2">
        <Enlace href="/catalogo">Catálogo</Enlace> /{' '}
        <Enlace href={`/catalogo/${encodeURIComponent(nombreMarca)}`}>{nombreMarca}</Enlace>{' '}
        / {nombreCategoria}
      </div>
      <Cabecera
        titulo={nombreCategoria}
        descripcion={[
          nombreMarca,
          `${articulos.length} referencias`,
          `${conPuertos.size} con puertos`,
        ].join(' · ')}
      />

      <Tarjeta>
        <ContenedorTabla etiqueta={nombreCategoria}>
        <table className="datos">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Descripción</th>
              {hayCable && <th>Señal</th>}
              <th>Puertos</th>
              <th className="num">Coste</th>
              <th className="num">PVP</th>
              <th>Proveedor</th>
              <th className="num">Instalados</th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link
                    href={`/articulo/${a.id}`}
                    className="enlace"
                  >
                    {a.modelo}
                  </Link>
                </td>
                <td className="text-tinta-tenue">{a.descripcion ?? '—'}</td>
                {hayCable && (
                  <td className="text-tinta-tenue">
                    {a.senal ? ETIQUETA_SENAL[a.senal as Senal] : '—'}
                  </td>
                )}
                <td className={conPuertos.has(a.id) ? undefined : 'text-tinta-tenue'}>
                  {conPuertos.has(a.id) ? 'Definidos' : 'Sin definir'}
                </td>
                <td className="num">
                  {a.coste != null ? `${a.coste.toFixed(2)} €` : '—'}
                  {a.coste != null && a.coste_orientativo && (
                    <span className="text-tinta-tenue"> orient.</span>
                  )}
                </td>
                <td className="num">{a.pvp != null ? `${a.pvp.toFixed(2)} €` : '—'}</td>
                <td className="text-tinta-tenue">{a.proveedor ?? '—'}</td>
                <td className="num">{a.unidades_instaladas ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      </Tarjeta>
    </>
  );
}
