import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import { listarMarcas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta, Vacio } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ETIQUETA_TIPO: Record<string, string> = {
  equipo: 'Equipos',
  cable: 'Cable',
  consumible: 'Consumibles',
};

export default async function Catalogo({ searchParams }: PageProps<'/catalogo'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const p = await searchParams;
  const buscar = ((Array.isArray(p.q) ? p.q[0] : p.q) ?? '').toLowerCase();

  const todas = await listarMarcas();
  const marcas = buscar
    ? todas.filter((m) => m.marca.toLowerCase().includes(buscar))
    : todas;

  return (
    <>
      <Cabecera
        titulo="Catálogo"
        descripcion="Por marca. Dentro de cada marca, por tipo de equipo. Y dentro, cada modelo con su precio, características y observaciones."
        acciones={<Enlace href="/articulo/nuevo">Añadir referencia</Enlace>}
      />

      <form className="flex flex-wrap items-end gap-3 mb-6">
        <input
          name="q"
          defaultValue={buscar}
          placeholder="Buscar marca"
          className="w-full min-w-0 sm:w-auto sm:min-w-[16rem]"
          aria-label="Buscar marca"
        />
        <span className="text-tinta-tenue">
          {marcas.length} marca{marcas.length === 1 ? '' : 's'}
        </span>
      </form>

      {marcas.length === 0 ? (
        <Tarjeta>
          <Vacio>Sin resultados.</Vacio>
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {marcas.map((m) => (
            <Link
              key={m.marca}
              href={`/catalogo/${encodeURIComponent(m.marca)}`}
              className="tarjeta p-4 hover:bg-superficie-hundida block"
            >
              <div className="t-subtitulo">{m.marca}</div>
              <div className="text-tinta-tenue mt-1">
                {m.referencias} referencia{m.referencias === 1 ? '' : 's'} ·{' '}
                {m.categorias} secci{m.categorias === 1 ? 'ón' : 'ones'}
              </div>
              <div className="text-tinta-tenue mt-2 text-[0.6875rem]">
                {m.unidades_instaladas > 0
                  ? `${m.unidades_instaladas} unidades instaladas`
                  : m.tipos.map((t) => ETIQUETA_TIPO[t] ?? t).join(' · ')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
