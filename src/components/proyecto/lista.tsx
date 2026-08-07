import Link from 'next/link';
import { Estado, Tarjeta, Vacio, type TonoEstado } from '@/components/ui';
import { ETIQUETA_ESTADO_PROYECTO, type EstadoProyecto } from '@/lib/ciclo-vida';
import type { ProyectoResumen } from '@/lib/datos-proyectos';

const TONO_ESTADO_PROYECTO: Record<EstadoProyecto, TonoEstado> = {
  sin_iniciar: 'neutro',
  en_curso: 'informacion',
  cerrado: 'listo',
};

/**
 * Las obras dadas de alta, como rejilla de tarjeta (design-system/MASTER.md,
 * Disposición): nombre y estado de un vistazo, no una tabla para navegar
 * entre entidades. El pie cuenta las salas de antes de la jerarquía: siguen
 * siendo válidas y se adoptan desde la portada del proyecto que toque.
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
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {proyectos.map((p) => (
          <Link
            key={p.id}
            href={`/proyectos/${p.id}`}
            className="tarjeta p-4 min-w-0 block hover:bg-superficie-hundida transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="t-subtitulo min-w-0 [overflow-wrap:anywhere]">{p.nombre}</h3>
              <Estado tono={TONO_ESTADO_PROYECTO[p.estado]}>
                {ETIQUETA_ESTADO_PROYECTO[p.estado]}
              </Estado>
            </div>
            <div className="text-tinta-tenue mt-1 min-w-0 [overflow-wrap:anywhere]">
              {[p.codigo, p.sede].filter(Boolean).join(' · ') || '—'}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[0.8125rem] text-tinta-tenue">
              <span>
                <span className="dato tabular-nums">{p.n_localizaciones}</span> localizaciones
              </span>
              <span>
                <span className="dato tabular-nums">{p.n_salas}</span> salas
              </span>
            </div>
          </Link>
        ))}
      </div>
      {pieSalasLegado && <p className="text-tinta-tenue mt-4">{pieSalasLegado}</p>}
    </div>
  );
}
