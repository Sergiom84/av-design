import { hayConfiguracion } from '@/lib/db';
import { listarArticulos } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, Tarjeta, Vacio } from '@/components/ui';
import { guardarPrecioArticulo } from '../acciones';
import { ETIQUETA_SENAL, Senal } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const PESTANAS = [
  { clave: 'equipo', etiqueta: 'Equipos' },
  { clave: 'cable', etiqueta: 'Cable' },
  { clave: 'consumible', etiqueta: 'Consumibles' },
] as const;

export default async function Catalogo({ searchParams }: PageProps<'/catalogo'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const p = await searchParams;
  const tipo = (Array.isArray(p.tipo) ? p.tipo[0] : p.tipo) ?? 'equipo';
  const buscar = ((Array.isArray(p.q) ? p.q[0] : p.q) ?? '').toLowerCase();

  const todos = await listarArticulos(tipo as 'equipo' | 'cable' | 'consumible');
  const articulos = buscar
    ? todos.filter((a) =>
        `${a.marca ?? ''} ${a.modelo} ${a.categoria}`.toLowerCase().includes(buscar),
      )
    : todos;

  return (
    <>
      <Cabecera
        titulo="Catálogo"
        descripcion="Los equipos salen de vuestro inventario real. El cable y los consumibles son un catálogo base: corrige modelos, proveedores y precios."
      />

      <div className="flex flex-wrap items-end gap-6 mb-6">
        <nav className="flex gap-4">
          {PESTANAS.map((t) => (
            <a
              key={t.clave}
              href={`/catalogo?tipo=${t.clave}`}
              aria-current={tipo === t.clave ? 'page' : undefined}
              className={
                tipo === t.clave
                  ? 'text-acento border-b border-acento pb-0.5'
                  : 'text-tinta-tenue hover:text-tinta pb-0.5 border-b border-transparent'
              }
            >
              {t.etiqueta}
            </a>
          ))}
        </nav>
        <form className="flex items-end gap-2">
          <input type="hidden" name="tipo" value={tipo} />
          <input
            name="q"
            defaultValue={buscar}
            placeholder="Buscar marca, modelo o categoría"
            className="min-w-[18rem]"
            aria-label="Buscar en el catálogo"
          />
          <Boton variante="secundario">Buscar</Boton>
        </form>
        <span className="text-tinta-tenue ml-auto">
          {articulos.length} de {todos.length}
        </span>
      </div>

      <Tarjeta>
        {articulos.length === 0 ? (
          <Vacio>Sin resultados.</Vacio>
        ) : tipo === 'equipo' ? (
          <table className="datos">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Categoría</th>
                <th className="num">Instalados</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map((a) => (
                <tr key={a.id}>
                  <td>{a.marca ?? '—'}</td>
                  <td>{a.modelo}</td>
                  <td className="text-tinta-tenue">{a.categoria}</td>
                  <td className="num">{a.unidades_instaladas ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="datos">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Categoría</th>
                <th>Señal</th>
                <th>Formato</th>
                <th className="num">Coste</th>
                <th className="num">Bobina</th>
                <th className="num">Ø mm</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {articulos.map((a) => (
                <tr key={a.id}>
                  <td colSpan={8} className="p-0">
                    <form
                      action={guardarPrecioArticulo}
                      className="grid grid-cols-[minmax(12rem,2fr)_minmax(8rem,1fr)_6rem_1fr_6rem_6rem_5rem_auto] items-center gap-2 px-3 py-2"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <span>
                        {a.modelo}
                        {a.descripcion && (
                          <span className="block text-tinta-tenue text-[0.6875rem]">
                            {a.descripcion}
                          </span>
                        )}
                      </span>
                      <span className="text-tinta-tenue">{a.categoria}</span>
                      <span className="text-tinta-tenue">
                        {a.senal ? ETIQUETA_SENAL[a.senal as Senal] : '—'}
                      </span>
                      <span className="text-tinta-tenue">
                        {a.longitudes_comerciales_m?.length
                          ? `latiguillo ${a.longitudes_comerciales_m.join('/')} m`
                          : a.unidad === 'm'
                            ? 'a metros'
                            : 'unidad'}
                      </span>
                      <input
                        name="coste"
                        type="number"
                        step="0.0001"
                        min="0"
                        defaultValue={a.coste ?? ''}
                        placeholder="€"
                        className="w-full num"
                        aria-label={`Coste de ${a.modelo}`}
                      />
                      <input
                        name="bobina_m"
                        type="number"
                        step="1"
                        min="0"
                        defaultValue={a.bobina_m ?? ''}
                        placeholder="m"
                        className="w-full num"
                        aria-label={`Metros por bobina de ${a.modelo}`}
                      />
                      <input
                        name="diametro_mm"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={a.diametro_mm ?? ''}
                        className="w-full num"
                        aria-label={`Diámetro de ${a.modelo}`}
                      />
                      <Boton variante="secundario">Guardar</Boton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </>
  );
}
