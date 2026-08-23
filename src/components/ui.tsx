import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

export function Cabecera({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="max-w-2xl min-w-0 [overflow-wrap:anywhere]">
        <h1 className="t-titulo">{titulo}</h1>
        {descripcion && <p className="text-tinta-tenue mt-1">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3 items-center">{acciones}</div>}
    </div>
  );
}

/**
 * Cuatro variantes que comparten radio, sombra y espaciado de `.tarjeta`:
 * estándar (sin marca), resumen/KPI (columna que se estira a la altura de
 * sus vecinas en una rejilla, para que una etiqueta de dos líneas no
 * desalinee el resto), operativa (borde de acento: pide una acción) y
 * peligrosa (borde de alerta: agrupa una operación destructiva). No son
 * cinco estilos nuevos, es un modificador sobre la misma superficie.
 */
const VARIANTE_TARJETA = {
  estandar: '',
  resumen: 'h-full flex flex-col',
  operativa: 'border-l-2 border-acento',
  peligrosa: 'border-l-2 border-alerta',
} as const;

export type VarianteTarjeta = keyof typeof VARIANTE_TARJETA;

/**
 * La tarjeta base: cabecera, acciones opcionales, cuerpo y pie, con contrato
 * explícito de contención. El cuerpo ya no lleva scroll horizontal universal:
 * un formulario o un texto largo debe envolver, no convertirse en un panel
 * desplazable. El scroll técnico deliberado es de quien lo necesita
 * (`ContenedorTabla`, `table.datos`, un diagrama), no de la tarjeta entera.
 */
export function Tarjeta({
  id,
  titulo,
  acciones,
  children,
  pie,
  variante = 'estandar',
}: {
  /** Ancla para enlazar la tarjeta desde la misma página (`#nueva-localizacion`). */
  id?: string;
  titulo?: string;
  acciones?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  variante?: VarianteTarjeta;
}) {
  const cuerpo =
    variante === 'resumen'
      ? 'p-4 min-w-0 max-w-full flex-1 flex flex-col justify-between'
      : 'p-4 min-w-0 max-w-full';

  return (
    <section id={id} className={`tarjeta ${VARIANTE_TARJETA[variante]}`.trim()}>
      {(titulo || acciones) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-linea-suave">
          {titulo && (
            <h2 className="t-subtitulo min-w-0 max-w-full [overflow-wrap:anywhere]">{titulo}</h2>
          )}
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
      )}
      <div className={cuerpo}>{children}</div>
      {pie && (
        <div className="px-4 py-3 border-t border-linea-suave text-tinta-tenue min-w-0 max-w-full">
          {pie}
        </div>
      )}
    </section>
  );
}

/**
 * Envuelve el scroll horizontal técnico: tabla de cables, inventario,
 * diagramas. Es la única forma admitida de desplazamiento lateral dentro de
 * una tarjeta; todo lo demás debe envolver.
 */
export function ContenedorTabla({
  children,
  etiqueta,
}: {
  children: ReactNode;
  etiqueta?: string;
}) {
  return (
    <div className="contenedor-tabla" role="group" aria-label={etiqueta}>
      {children}
    </div>
  );
}

/**
 * Fila de acciones que envuelve en vez de desbordar. La acción peligrosa se
 * pasa aparte: queda separada del resto, nunca compitiendo con la principal.
 */
export function GrupoAcciones({
  children,
  peligro,
}: {
  children?: ReactNode;
  peligro?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {peligro && (
        <div className="sm:ml-auto sm:border-l sm:border-linea-suave sm:pl-3">{peligro}</div>
      )}
    </div>
  );
}

export function Dato({
  etiqueta,
  valor,
  sufijo,
  reservarEtiqueta = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  sufijo?: string;
  /** Reserva dos líneas de etiqueta (0.75rem × 1.35 × 2): solo tiene sentido
   *  dentro de una rejilla de KPI (`Tarjeta variante="resumen"`), donde una
   *  etiqueta larga en una tarjeta desalinearía el valor frente a las
   *  vecinas. Fuera de ese contexto añadiría hueco vacío sin motivo, así
   *  que por defecto está desactivada. */
  reservarEtiqueta?: boolean;
}) {
  return (
    <div>
      <div
        className={`t-etiqueta${reservarEtiqueta ? ' leading-[1.35] min-h-[2.025rem]' : ''}`}
      >
        {etiqueta}
      </div>
      <div className="t-subtitulo dato tabular-nums">
        {valor}
        {sufijo && <span className="text-tinta-tenue text-[0.75rem] ml-1">{sufijo}</span>}
      </div>
    </div>
  );
}

/**
 * Los cinco estados que aparecen en la aplicación (montaje, obra, recepción,
 * conexión...) comparten un único vocabulario visual: neutro, información,
 * listo, aviso y bloqueo. Antes de esta primitiva cada pantalla dibujaba su
 * propio mapa de colores para el mismo significado. El texto de 12 px
 * necesita 4.5:1 de contraste (no cuenta como texto grande):
 * `--tinta-tenue`, `--exito` y `--aviso` se quedan cortos sobre su propio
 * fondo suave (4.31:1, 3.50:1 y 4.22:1), de ahí `--tinta` (13.3:1, ya es el
 * texto normal de la aplicación) y las variantes `-fuerte` de éxito y aviso,
 * con el mismo patrón que `--acento-fuerte`.
 */
const TONO_ESTADO = {
  neutro: 'bg-linea-suave text-tinta',
  informacion: 'bg-acento-suave text-acento-fuerte',
  listo: 'bg-exito-suave text-exito-fuerte',
  aviso: 'bg-aviso-suave text-aviso-fuerte',
  bloqueo: 'bg-alerta-suave text-alerta',
} as const;

export type TonoEstado = keyof typeof TONO_ESTADO;

export function Estado({
  tono = 'neutro',
  children,
}: {
  tono?: TonoEstado;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.75rem] font-medium ${TONO_ESTADO[tono]}`}
    >
      {children}
    </span>
  );
}

export function Aviso({
  tono = 'aviso',
  children,
}: {
  tono?: 'aviso' | 'alerta' | 'neutro';
  children: ReactNode;
}) {
  const estilo =
    tono === 'alerta'
      ? 'border-alerta bg-alerta-suave text-alerta'
      : tono === 'aviso'
        ? 'border-acento bg-superficie-hundida text-tinta'
        : 'border-linea bg-fondo text-tinta-tenue';
  return <div className={`border-l-2 rounded-r-md px-4 py-3 ${estilo}`}>{children}</div>;
}

export function Boton({
  children,
  tipo = 'submit',
  variante = 'principal',
  ...resto
}: {
  children: ReactNode;
  tipo?: 'submit' | 'button';
  variante?: 'principal' | 'secundario' | 'peligro';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // Las clases están en globals.css: el secundario es la base y las otras dos
  // son modificadores. Ver el comentario de `.boton`.
  const clases = ['boton'];
  if (variante !== 'secundario') clases.push(`boton-${variante}`);
  if (resto.className) clases.push(resto.className);

  return (
    <button {...resto} type={tipo} className={clases.join(' ')}>
      {children}
    </button>
  );
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  // El href llega como texto montado en tiempo de ejecución (ids, filtros);
  // las rutas estáticas ya las verifica typedRoutes en cada <Link> directo.
  return (
    <Link href={href as never} className="enlace">
      {children}
    </Link>
  );
}

/**
 * Un checkbox o radio no llega a 44px él solo, y su objetivo táctil real es
 * la etiqueta que lo envuelve. `.campo-casilla` (`globals.css`) es una clase
 * explícita, no una coincidencia estructural: un selector que buscara
 * "cualquier `label` con un checkbox dentro" coincidía tanto con checkboxes
 * sin `label` (quedaban en 13 × 13 px) como con un `Campo` cuya etiqueta
 * exterior contenía la de un checkbox más abajo (ganaba 44px sin ser un
 * campo de casilla). Esta es la única fuente del alto mínimo.
 */
export function CampoCasilla({
  children,
  ...resto
}: {
  children: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="campo-casilla">
      <input {...resto} />
      <span>{children}</span>
    </label>
  );
}

export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className="t-etiqueta block mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-tinta-tenue mt-1 text-[0.6875rem]">{ayuda}</span>}
    </label>
  );
}

/**
 * Pares clave/valor cortos que no justifican una tabla: cabecera de sala,
 * ficha de pedido, resumen de conexión. `dt`/`dd` en rejilla de dos columnas
 * en vez de reimplementar `Dato` a mano en cada pantalla.
 */
export function ListaClaveValor({
  items,
}: {
  items: { clave: string; valor: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
      {items.map((item, indice) => (
        <Fragment key={indice}>
          <dt className="t-etiqueta self-start whitespace-nowrap">{item.clave}</dt>
          <dd className="dato tabular-nums min-w-0 [overflow-wrap:anywhere]">{item.valor}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Qué falta y, si existe, la siguiente acción con enlace real — nunca un
 * párrafo explicativo de relleno apuntando en prosa a un formulario de más
 * abajo.
 */
export function Vacio({
  children,
  accion,
}: {
  children: ReactNode;
  accion?: { texto: string; href: string };
}) {
  return (
    <div className="py-6 text-tinta-tenue">
      <p>{children}</p>
      {accion && (
        <p className="mt-1">
          <Enlace href={accion.href}>{accion.texto}</Enlace>
        </p>
      )}
    </div>
  );
}
