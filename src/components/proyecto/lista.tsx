import Link from 'next/link';
import { Tarjeta, Vacio } from '@/components/ui';
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
      <table className="datos">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Sede</th>
            <th className="num">Localizaciones</th>
            <th className="num">Salas</th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/salas?proyecto=${p.id}`} className="enlace">
                  {p.nombre}
                </Link>
                {p.codigo && <span className="text-tinta-tenue"> · {p.codigo}</span>}
              </td>
              <td>{p.sede ?? '—'}</td>
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
    </Tarjeta>
  );
}
