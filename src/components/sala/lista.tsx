import Link from 'next/link';
import { Estado, Tarjeta, Vacio } from '@/components/ui';
import type { Sala } from '@/lib/tipos';

/**
 * Las salas dadas de alta, como rejilla de tarjeta (design-system/MASTER.md,
 * Disposición): nombre, tipología, aforo y estado de un vistazo. Una sala
 * sin medir está creada pero no calcula nada, y eso tiene que verse aquí
 * mismo, no solo al entrar en su ficha.
 */
export function ListaDeSalas({
  salas,
  conProyecto = true,
}: {
  salas: Sala[];
  /** Filtrando ya por un proyecto, repetir su nombre en cada tarjeta sobra. */
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
  const pie =
    sinMedir > 0
      ? `${sinMedir} de ${salas.length} salas sin medidas: no calculan metros hasta que se rellenen.`
      : `${salas.length} salas, todas con medidas.`;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {salas.map((s) => {
          const sinMedidas = !s.largo_m || !s.ancho_m;
          return (
            <Link
              key={s.id}
              href={`/salas/${s.id}`}
              className="tarjeta p-4 min-w-0 block hover:bg-superficie-hundida transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="t-subtitulo min-w-0 [overflow-wrap:anywhere]">{s.nombre}</h3>
                {sinMedidas && <Estado tono="bloqueo">Sin medidas</Estado>}
              </div>
              {s.codigo && <div className="text-tinta-tenue text-[0.8125rem]">{s.codigo}</div>}
              <div className="text-tinta-tenue mt-1 min-w-0 [overflow-wrap:anywhere]">
                {[s.sede, s.localizacion, s.edificio, s.nivel].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[0.8125rem] text-tinta-tenue">
                {s.tipologia && <span>{s.tipologia}</span>}
                {s.aforo != null && <span className="dato tabular-nums">{s.aforo} pers.</span>}
                {!sinMedidas && (
                  <span className="dato tabular-nums">
                    {s.largo_m} × {s.ancho_m} × {s.alto_m} m
                  </span>
                )}
              </div>
              {conProyecto && (
                <div className="text-tinta-tenue text-[0.75rem] mt-2">{s.proyecto ?? '—'}</div>
              )}
            </Link>
          );
        })}
      </div>
      <p className="text-tinta-tenue mt-4">{pie}</p>
    </div>
  );
}
