import { Tarjeta, Vacio } from '@/components/ui';
import { marcarPuntoVisita } from '@/app/acciones-checkin';
import { agruparPorBloque, ayudaDeValor, pideValor, resumirVisita } from '@/lib/checkin';
import { ETIQUETA_PUNTO, type EstadoPunto, type PuntoRevision } from '@/lib/tipos';

/**
 * Los puntos de la visita, marcables.
 *
 * Esto se usa de pie en una sala, con el móvil en una mano y el metro en la
 * otra. Por eso no es una tabla: es una columna de bloques, y cada punto tiene
 * tres botones de al menos 3 rem de alto, uno por estado, que además guardan lo
 * escrito en la misma pulsación. Un solo toque por punto.
 *
 * Volver a pulsar el estado que ya tenía lo devuelve a «sin mirar»: es el
 * deshacer de quien acierta el botón de al lado.
 *
 * Una visita cerrada se lee, no se toca. Ahí desaparecen los botones y los
 * huecos de escribir en vez de deshabilitarse: un formulario apagado invita a
 * pulsarlo, y lo que hay que ver de una visita cerrada es lo que se encontró.
 */
export function PuntosVisita({
  puntos,
  cerrada,
}: {
  puntos: PuntoRevision[];
  cerrada: boolean;
}) {
  const resumen = resumirVisita(puntos);

  if (puntos.length === 0) {
    return (
      <Tarjeta titulo="Puntos">
        <Vacio>Esta visita no tiene puntos que comprobar.</Vacio>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      {agruparPorBloque(puntos).map(({ bloque, puntos: delBloque }) => (
        <Tarjeta
          key={bloque}
          titulo={bloque}
          pie={`${delBloque.filter((p) => p.estado !== 'pendiente').length} de ${delBloque.length} mirados`}
        >
          <ul className="border-t border-linea">
            {delBloque.map((punto) => (
              <li key={punto.id} className="border-b border-linea py-4">
                {cerrada ? (
                  <PuntoLeido punto={punto} />
                ) : (
                  <PuntoMarcable punto={punto} />
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ))}

      <p className="text-tinta-tenue">
        {resumen.total - resumen.pendientes} de {resumen.total} puntos mirados
        {resumen.incidencias > 0 && ` · ${resumen.incidencias} con incidencia`}
        {resumen.no_aplica > 0 && ` · ${resumen.no_aplica} no aplican`}
      </p>
    </div>
  );
}

const OPCIONES: readonly Exclude<EstadoPunto, 'pendiente'>[] = [
  'conforme',
  'incidencia',
  'no_aplica',
];

function PuntoMarcable({ punto }: { punto: PuntoRevision }) {
  const conValor = pideValor(punto.clave);

  return (
    <form action={marcarPuntoVisita} className="space-y-3">
      <input type="hidden" name="id" value={punto.id} />
      <input type="hidden" name="revision_id" value={punto.revision_id} />
      {/* Para saber si la pulsación repite el estado y toca deshacer. */}
      <input type="hidden" name="estado_actual" value={punto.estado} />
      {/* Sin este aviso, marcar un punto sin hueco de medida borraría la medida. */}
      {conValor && <input type="hidden" name="pide_valor" value="si" />}

      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="t-subtitulo">{punto.titulo}</span>
        <span className="t-etiqueta">{ETIQUETA_PUNTO[punto.estado]}</span>
      </div>

      <div className="space-y-2">
        {conValor && (
          <label className="block">
            <span className="t-etiqueta block mb-1">
              {ayudaDeValor(punto.clave) ?? 'Lo medido'}
            </span>
            <input
              name="valor"
              defaultValue={punto.valor ?? ''}
              className="w-full min-h-[2.75rem]"
            />
          </label>
        )}
        <label className="block">
          <span className="t-etiqueta block mb-1">Nota</span>
          <input
            name="notas"
            defaultValue={punto.notas ?? ''}
            className="w-full min-h-[2.75rem]"
          />
        </label>
      </div>

      {/*
        Tres botones a lo ancho, sin envolver. A 375 px cada uno pasa de los
        100 px de ancho y de los 48 de alto: se acierta con el pulgar sin mirar.
      */}
      <div className="grid grid-cols-3 gap-2">
        {OPCIONES.map((estado) => {
          const puesto = punto.estado === estado;
          return (
            <button
              key={estado}
              type="submit"
              name="estado"
              value={estado}
              aria-pressed={puesto}
              className={`boton w-full min-h-[3rem] ${clases(estado, puesto)}`}
            >
              {ETIQUETA_PUNTO[estado]}
            </button>
          );
        })}
      </div>
    </form>
  );
}

/** Cómo se ve cada botón según el estado que representa y si está puesto. */
function clases(estado: Exclude<EstadoPunto, 'pendiente'>, puesto: boolean): string {
  if (!puesto) return 'text-tinta-tenue';
  if (estado === 'conforme') return 'boton-principal';
  if (estado === 'incidencia') return 'border-alerta bg-alerta-suave text-alerta';
  return 'border-linea-fuerte bg-superficie-hundida text-tinta-tenue';
}

function PuntoLeido({ punto }: { punto: PuntoRevision }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="t-subtitulo">{punto.titulo}</span>
        <span
          className={`t-etiqueta ${punto.estado === 'incidencia' ? 'text-alerta' : ''}`}
        >
          {ETIQUETA_PUNTO[punto.estado]}
        </span>
      </div>
      {punto.valor && <div className="tabular-nums">{punto.valor}</div>}
      {punto.notas && <div className="text-tinta-tenue">{punto.notas}</div>}
    </div>
  );
}
