import Link from 'next/link';
import { ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import type { ProyectoResumen } from '@/lib/datos-proyectos';

/**
 * Las obras dadas de alta. El pie cuenta las salas de antes de la jerarquía:
 * siguen siendo válidas y se adoptan desde la portada del proyecto que toque.
 */
export function ListaDeProyectos({
  proyectos,
  salasSinProyecto,
}: {
  proyectos: ProyectoResumen[];
  salasSinProyecto: number;
}) {
  const pieSalasLegado =
    salasSinProyecto > 0
      ? `${salasSinProyecto} ${salasSinProyecto === 1 ? 'sala' : 'salas'} sin proyecto: legado válido, se adoptan desde la portada de cada obra.`
      : undefined;

  if (proyectos.length === 0) {
    return (
      <Tarjeta pie={pieSalasLegado}>
        <Vacio>
          Todavía no hay ninguna obra. Un proyecto agrupa las salas de una
          instalación por localización.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta pie={pieSalasLegado}>
      <ContenedorTabla etiqueta="Proyectos">
      <table className="datos">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Sede</th>
            <th>Estado</th>
            <th className="num">Localizaciones</th>
            <th className="num">Salas</th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/proyectos/${p.id}`} className="enlace">
                  {p.nombre}
                </Link>
                {p.codigo && <span className="text-tinta-tenue"> · {p.codigo}</span>}
              </td>
              <td>{p.sede ?? '—'}</td>
              <td>
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[0.75rem] ${
                    p.estado === 'en_curso'
                      ? 'bg-acento-suave text-acento-fuerte'
                      : p.estado === 'cerrado'
                        ? 'bg-superficie-hundida text-exito'
                        : 'bg-superficie-hundida text-tinta-tenue'
                  }`}
                >
                  {p.estado === 'en_curso'
                    ? 'En curso'
                    : p.estado === 'cerrado'
                      ? 'Cerrado'
                      : 'Sin iniciar'}
                </span>
              </td>
              <td className="num">{p.n_localizaciones}</td>
              <td className="num">
                {p.n_salas > 0 ? (
                  p.n_salas
                ) : (
                  <span className="text-tinta-tenue">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}
