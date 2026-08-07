import Link from 'next/link';
import { Tarjeta, Vacio } from '@/components/ui';
import type { Sala } from '@/lib/tipos';

/**
 * Las salas dadas de alta. La columna de medidas es la que importa: una sala
 * sin medir está creada pero no calcula nada, y eso tiene que verse de un
 * vistazo desde la lista.
 */
export function ListaDeSalas({
  salas,
  conProyecto = true,
}: {
  salas: Sala[];
  /** Filtrando ya por un proyecto, repetir la columna en cada fila sobra. */
  conProyecto?: boolean;
}) {
  if (salas.length === 0) {
    return (
      <Tarjeta>
        <Vacio>
          Todavía no hay ninguna sala. Créala desde una plantilla o en blanco.
        </Vacio>
      </Tarjeta>
    );
  }

  const sinMedir = salas.filter((s) => !s.largo_m || !s.ancho_m).length;

  return (
    <Tarjeta
      pie={
        sinMedir > 0
          ? `${sinMedir} de ${salas.length} salas sin medidas: no calculan metros hasta que se rellenen.`
          : `${salas.length} salas, todas con medidas.`
      }
    >
      <table className="datos">
        <thead>
          <tr>
            <th>Sala</th>
            {conProyecto && <th>Proyecto</th>}
            <th>Ubicación</th>
            <th>Tipología</th>
            <th className="num">Aforo</th>
            <th className="num">Medidas (m)</th>
          </tr>
        </thead>
        <tbody>
          {salas.map((s) => {
            const sinMedidas = !s.largo_m || !s.ancho_m;
            return (
              <tr key={s.id}>
                <td>
                  <Link
                    href={`/salas/${s.id}`}
                    className="enlace"
                  >
                    {s.nombre}
                  </Link>
                  {s.codigo && <span className="text-tinta-tenue"> · {s.codigo}</span>}
                </td>
                {conProyecto && (
                  <td>
                    {s.proyecto_id ? (
                      <Link href={`/salas?proyecto=${s.proyecto_id}`} className="enlace">
                        {s.proyecto}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                <td>
                  {[s.sede, s.edificio, s.nivel].filter(Boolean).join(' · ') || '—'}
                </td>
                <td>{s.tipologia ?? '—'}</td>
                <td className="num">{s.aforo ?? '—'}</td>
                <td className="num">
                  {sinMedidas ? (
                    <span className="text-alerta">sin medidas</span>
                  ) : (
                    `${s.largo_m} × ${s.ancho_m} × ${s.alto_m}`
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tarjeta>
  );
}
