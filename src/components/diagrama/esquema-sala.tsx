import Link from 'next/link';
import {
  construirDiagrama,
  senalEnFiltro,
  ETIQUETA_FILTRO_SENAL,
  FILTROS_SENAL,
  type EntradaDiagrama,
  type FiltroSenalDiagrama,
} from '@/lib/diagrama';
import { ETIQUETA_SENAL } from '@/lib/tipos';
import { Tarjeta, Vacio } from '@/components/ui';
import { DibujoEsquema } from './dibujo-esquema';

/**
 * El esquema de conexiones dentro de la ficha de sala: el dibujo de bloques
 * que en XTEN-AV es el line schematic de xDraw, aquí derivado de las
 * conexiones que ya existen. No sabe consultar nada: recibe los datos
 * cargados, construye la escena con `construirDiagrama()` y la pinta.
 *
 * Las dos vistas van en la dirección, no en estado de cliente: el conmutador
 * "solo puertos con cable / todos" (`?puertos=todos`) y el filtro de señal
 * (`?senal=video|audio|red`). Se pueden enlazar, se vuelve con el botón del
 * navegador y funcionan sin JavaScript.
 *
 * El filtro es solo del dibujo. La tabla de cables, los metros, el material y
 * el alta de conexiones siguen viendo la sala entera: esconder un cable de la
 * vista no puede esconderlo del pedido.
 */

/**
 * Orden canónico de los parámetros: `senal` y luego `puertos`. Las dos vistas
 * son independientes, así que cada enlace conserva la otra.
 *
 * Devuelve texto montado en tiempo de ejecución, de ahí el `as never` en cada
 * `Link`: la ruta es siempre la misma y typedRoutes ya la valida en la propia
 * plantilla; lo que varía es la consulta. Es la misma salida que usa `Enlace`
 * (`src/components/ui.tsx`).
 */
function direccion(
  salaId: string,
  vista: { senal: FiltroSenalDiagrama | null; puertos: boolean },
): string {
  const partes: string[] = [];
  if (vista.senal) partes.push(`senal=${vista.senal}`);
  if (vista.puertos) partes.push('puertos=todos');
  return `/salas/${salaId}/cableado${partes.length ? `?${partes.join('&')}` : ''}`;
}

function FiltroDeSenal({
  salaId,
  filtroSenal,
  todosLosPuertos,
}: {
  salaId: string;
  filtroSenal: FiltroSenalDiagrama | null;
  todosLosPuertos: boolean;
}) {
  const opciones: { valor: FiltroSenalDiagrama | null; etiqueta: string }[] = [
    { valor: null, etiqueta: 'Todas las señales' },
    ...FILTROS_SENAL.map((f) => ({ valor: f, etiqueta: ETIQUETA_FILTRO_SENAL[f] })),
  ];

  return (
    <nav aria-label="Filtro de señal del esquema" className="flex flex-wrap gap-1">
      {opciones.map(({ valor, etiqueta }) => {
        const activa = valor === filtroSenal;
        return (
          <Link
            key={etiqueta}
            href={direccion(salaId, { senal: valor, puertos: todosLosPuertos }) as never}
            aria-current={activa ? 'page' : undefined}
            className={`inline-flex items-center min-h-11 px-3 rounded-md font-medium ${
              activa
                ? 'bg-acento-suave text-acento-fuerte'
                : 'text-tinta-tenue hover:text-tinta'
            }`}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

export function EsquemaSala({
  salaId,
  entrada,
  todosLosPuertos,
  filtroSenal = null,
}: {
  salaId: string;
  entrada: Omit<EntradaDiagrama, 'soloConectados' | 'filtroSenal'>;
  todosLosPuertos: boolean;
  filtroSenal?: FiltroSenalDiagrama | null;
}) {
  const escena = construirDiagrama({
    ...entrada,
    soloConectados: !todosLosPuertos,
    filtroSenal,
  });
  const sinConexiones = entrada.conexiones.length === 0;

  // Qué deja fuera el filtro. `conexiones.senal` tiene `default 'otro'` en la
  // base: lo que se dio de alta sin elegir señal cae ahí y no entra en ningún
  // filtro. Sin decirlo, un filtro vacío se lee como "faltan cables" en vez de
  // como "estos cables no están clasificados".
  const fuera = filtroSenal
    ? entrada.conexiones.filter((c) => !senalEnFiltro(c.senal, filtroSenal))
    : [];
  const senalesFuera = [...new Set(fuera.map((c) => c.senal))].map((s) => ETIQUETA_SENAL[s]);

  const vacioDelFiltro =
    filtroSenal !== null && !sinConexiones && escena.lineas.length === 0 && escena.omitidas === 0
      ? `Ningún cable de ${ETIQUETA_FILTRO_SENAL[filtroSenal].toLowerCase()} en esta sala.` +
        (fuera.length > 0
          ? ` Quedan fuera ${fuera.length} ${
              fuera.length === 1 ? 'conexión' : 'conexiones'
            }: ${senalesFuera.join(', ')}.`
          : '')
      : null;

  return (
    <Tarjeta
      titulo="Esquema de conexiones"
      acciones={
        <FiltroDeSenal
          salaId={salaId}
          filtroSenal={filtroSenal}
          todosLosPuertos={todosLosPuertos}
        />
      }
      pie={
        sinConexiones
          ? undefined
          : [
              `${escena.lineas.length} cables dibujados`,
              escena.omitidas > 0
                ? `${escena.omitidas} conexiones sin dibujar por faltarles un extremo`
                : null,
              'Identificadores y colores, los de la tabla de cables.',
            ]
              .filter(Boolean)
              .join(' · ')
      }
    >
      {sinConexiones ? (
        <Vacio>
          Sin conexiones. El esquema se dibuja solo cuando se da de alta qué
          conecta con qué.
        </Vacio>
      ) : vacioDelFiltro ? (
        <Vacio>{vacioDelFiltro}</Vacio>
      ) : (
        <>
          <div className="mb-3 text-tinta-tenue">
            {todosLosPuertos ? (
              <>
                Se enseñan todos los puertos del catálogo.{' '}
                <Link
                  href={direccion(salaId, { senal: filtroSenal, puertos: false }) as never}
                  className="enlace"
                >
                  Ver solo los conectados
                </Link>
              </>
            ) : (
              <>
                Solo puertos con cable.{' '}
                <Link
                  href={direccion(salaId, { senal: filtroSenal, puertos: true }) as never}
                  className="enlace"
                >
                  Ver todos los puertos
                </Link>
              </>
            )}
          </div>
          <DibujoEsquema escena={escena} />
        </>
      )}
    </Tarjeta>
  );
}
