/**
 * Esquema de conexiones (line schematic): el dibujo de bloques que XTEN-AV
 * llama xDraw, hecho con los datos que ya existen.
 *
 * Es lógica pura, como `croquis.ts`: entran los equipos de la sala, los
 * puertos del catálogo y las conexiones, y sale una escena con coordenadas.
 * Pintarla es cosa de `src/components/diagrama/`. Aquí no se toca la base de
 * datos y no se calcula ni un metro.
 *
 * El bloque copia la anatomía del de XTEN-AV, que es la que el técnico ya
 * conoce: categoría encima, entradas a la izquierda, salidas a la derecha,
 * el nombre serigrafiado dentro y el conector fuera del borde, marca y modelo
 * al pie. La línea lleva el identificador de cable (`HD-1000`), que es el
 * mismo de la tabla de cables: `identificadoresDeCable()` es la única fuente.
 */

import { identificadoresDeCable, ordenarConexiones } from './cable-schedule';
import type { Conexion, EquipoEnSala, Puerto, Senal, SentidoPuerto } from './tipos';

// ---------------------------------------------------------------------
// Medidas del dibujo, en píxeles de SVG. Un solo sitio.
// ---------------------------------------------------------------------

export const MEDIDAS_DIAGRAMA = {
  /** Ancho del cuerpo del bloque. */
  ancho_bloque: 230,
  /** Alto de cada fila de puerto. */
  alto_fila: 20,
  /** Espacio sobre la primera fila: la etiqueta de categoría va fuera. */
  alto_cabecera: 26,
  /** Pie del bloque con marca y modelo. */
  alto_pie: 34,
  /** Largo del muñón de conector que asoma fuera del borde. */
  largo_conector: 26,
  /** Canal horizontal entre columnas, por donde discurren las líneas. */
  separacion_x: 150,
  /** Separación vertical entre bloques de la misma columna. */
  separacion_y: 48,
  /** Margen exterior del dibujo. */
  margen: 24,
} as const;

// ---------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------

/** En qué lado del bloque vive un puerto. Entradas y control reciben a la
 *  izquierda; salidas y bidireccionales sirven por la derecha. */
export function ladoDePuerto(sentido: SentidoPuerto): 'izquierda' | 'derecha' {
  return sentido === 'entrada' || sentido === 'control' ? 'izquierda' : 'derecha';
}

// ---------------------------------------------------------------------
// Filtro de señal
// ---------------------------------------------------------------------

/**
 * Las tres familias funcionales que el técnico mira por separado en obra:
 * el vídeo, el audio y la red. No son todas las señales del catálogo.
 *
 * `usb`, `control` y `alimentacion` quedan fuera por ahora. `otro` también,
 * y por un motivo distinto: en `data/puertos.csv` marca a la vez DVI,
 * DisplayPort y DTP, así que no es una familia, es un cajón de sastre. Las
 * cuatro siguen estando en la vista completa, que es la de siempre.
 */
export const FILTROS_SENAL = ['video', 'audio', 'red'] as const;

export type FiltroSenalDiagrama = (typeof FILTROS_SENAL)[number];

export const SENALES_POR_FILTRO: Record<FiltroSenalDiagrama, readonly Senal[]> = {
  video: ['hdmi'],
  audio: ['audio_linea', 'audio_altavoz', 'microfono'],
  red: ['red'],
};

export const ETIQUETA_FILTRO_SENAL: Record<FiltroSenalDiagrama, string> = {
  video: 'Vídeo',
  audio: 'Audio',
  red: 'Red',
};

/**
 * El valor que llega por la dirección, pasado por lista blanca.
 *
 * Cualquier cosa que no sea exactamente una de las tres cadenas —vacío,
 * desconocido, o repetido, que en Next llega como array— devuelve `null`, y
 * `null` es la vista completa de siempre. No se normaliza ni se adivina, y
 * este valor nunca llega a SQL.
 *
 * La comparación es contra la lista, no con `in`: `'toString' in objeto` es
 * cierto por herencia de `Object.prototype`, y eso convertiría la lista blanca
 * en un colador.
 */
export function normalizarFiltroSenal(
  valor: string | string[] | undefined | null,
): FiltroSenalDiagrama | null {
  return typeof valor === 'string' && (FILTROS_SENAL as readonly string[]).includes(valor)
    ? (valor as FiltroSenalDiagrama)
    : null;
}

/** Si una conexión de esta señal se ve con el filtro puesto. Sin filtro, todas. */
export function senalEnFiltro(senal: Senal, filtro: FiltroSenalDiagrama | null): boolean {
  return filtro === null || SENALES_POR_FILTRO[filtro].includes(senal);
}

export interface FilaPuertoDiagrama {
  puerto_id: string;
  ordinal: number;
  /** El literal del fabricante: `HDMI IN 1`. */
  nombre: string;
  /** `RJ45`, `HDMI A`… Se pinta fuera del borde, como XTEN-AV. */
  conector: string | null;
  senal: Senal;
  /** `×4` cuando la fila representa varios puertos iguales. */
  total: number;
  conectado: boolean;
  /** Centro vertical de la fila, absoluto en el dibujo. */
  y: number;
}

export interface BloqueDiagrama {
  equipo_id: string;
  /** Nombre del equipo, con sufijo cuando hay repetidos: `Pantalla 2`. */
  etiqueta: string;
  /** Rótulo de categoría sobre el bloque: el `DISPLAY` de XTEN-AV. */
  categoria: string | null;
  /** Marca y modelo al pie, si el artículo se conoce. */
  marca_modelo: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  entradas: FilaPuertoDiagrama[];
  salidas: FilaPuertoDiagrama[];
}

export interface LineaDiagrama {
  conexion_id: string;
  /** `HD-1000`, el mismo de la tabla de cables y de la brida. */
  identificador: string;
  senal: Senal;
  /** Vértices de la polilínea ortogonal, de origen a destino. */
  puntos: { x: number; y: number }[];
  /** Dónde va la etiqueta del identificador. */
  etiqueta_x: number;
  etiqueta_y: number;
}

export interface EscenaDiagrama {
  bloques: BloqueDiagrama[];
  lineas: LineaDiagrama[];
  ancho: number;
  alto: number;
  /**
   * Conexiones que no se pudieron dibujar (extremo sin equipo en la sala).
   * Las que esconde el filtro de señal no cuentan: no son un problema del
   * dato, son la vista elegida.
   */
  omitidas: number;
}

export interface EntradaDiagrama {
  equipos: EquipoEnSala[];
  /** Puertos del catálogo de los artículos presentes, indexados por artículo. */
  puertosPorArticulo: Map<string, Puerto[]>;
  conexiones: Conexion[];
  /** Marca y modelo por artículo, para el pie del bloque. */
  descripcionArticulo?: Map<string, string>;
  /** Categoría por artículo, para el rótulo sobre el bloque. */
  categoriaArticulo?: Map<string, string>;
  /**
   * `true`: solo se pintan los puertos con cable, el "Hide Unused Connectors"
   * de XTEN-AV. Con una matriz de veinte puertos el esquema es ilegible sin
   * esto, así que es el modo por defecto de la interfaz.
   */
  soloConectados?: boolean;
  /**
   * Vista exclusiva de una familia de señal. `null` o ausente: vista completa.
   * Filtra las líneas, no el inventario: los bloques de todos los equipos de
   * la sala se conservan.
   */
  filtroSenal?: FiltroSenalDiagrama | null;
}

/**
 * Etiqueta única por equipo. Dos pantallas iguales necesitan distinguirse en
 * el plano (`Pantalla 1`, `Pantalla 2`); el sufijo se asigna por orden de id,
 * que es inmutable, y **no se renumera** al borrar: mismo criterio que el
 * identificador de cable, que puede estar ya escrito en una brida.
 */
export function etiquetasDeEquipos(equipos: EquipoEnSala[]): Map<string, string> {
  const porNombre = new Map<string, EquipoEnSala[]>();
  for (const e of [...equipos].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const lista = porNombre.get(e.nombre) ?? [];
    lista.push(e);
    porNombre.set(e.nombre, lista);
  }
  const etiquetas = new Map<string, string>();
  for (const [nombre, lista] of porNombre) {
    if (lista.length === 1) {
      etiquetas.set(lista[0].id, nombre);
    } else {
      lista.forEach((e, i) => etiquetas.set(e.id, `${nombre} ${i + 1}`));
    }
  }
  return etiquetas;
}

/**
 * Columna de cada equipo según su papel en el flujo de señal: quien solo
 * emite a la izquierda, quien emite y recibe en medio, quien solo recibe a la
 * derecha. Los equipos sin conexión van a la última columna, que es donde
 * menos estorban sin desaparecer: siguen siendo material de la sala.
 */
export function columnaDeEquipo(
  equipoId: string,
  conexiones: Conexion[],
): 0 | 1 | 2 | 3 {
  const emite = conexiones.some((c) => c.origen_id === equipoId);
  const recibe = conexiones.some((c) => c.destino_id === equipoId);
  if (emite && recibe) return 1;
  if (emite) return 0;
  if (recibe) return 2;
  return 3;
}

type BocaDiagrama = { puerto: Puerto; ordinal: number };

/** Une las caras reales: el sentido de una conexión no decide dónde está la boca. */
export function trazarLineaDiagrama(
  origen: BloqueDiagrama, destino: BloqueDiagrama,
  primero: { x: number; y: number }, ultimo: { x: number; y: number }, carril = 0,
): Pick<LineaDiagrama, 'puntos' | 'etiqueta_x' | 'etiqueta_y'> {
  const signoOrigen = primero.x < origen.x ? -1 : 1;
  const signoDestino = ultimo.x < destino.x ? -1 : 1;
  const salida = primero.x + signoOrigen * 18;
  const llegada = ultimo.x + signoDestino * 18;
  const enfrentados = signoOrigen !== signoDestino && (llegada - salida) * signoOrigen >= 0;
  if (enfrentados) {
    const centro = (salida + llegada) / 2;
    const canal = Math.max(Math.min(salida, llegada), Math.min(Math.max(salida, llegada), centro + ((carril % 5) - 2) * 12));
    return { puntos: primero.y === ultimo.y ? [primero, ultimo] : [primero, { x: canal, y: primero.y }, { x: canal, y: ultimo.y }, ultimo], etiqueta_x: canal, etiqueta_y: (primero.y + ultimo.y) / 2 };
  }
  // Rodear ambos cuerpos cuando las caras no se miran. Una recta hacia el
  // otro lado quedaría oculta al pintar encima el bloque del equipo.
  const inferior = Math.max(origen.y + origen.alto, destino.y + destino.alto) + 18 + carril * 16;
  return {
    puntos: [primero, { x: salida, y: primero.y }, { x: salida, y: inferior }, { x: llegada, y: inferior }, { x: llegada, y: ultimo.y }, ultimo],
    etiqueta_x: (salida + llegada) / 2, etiqueta_y: inferior,
  };
}

const claveBoca = (equipoId: string, puertoId: string, ordinal: number) =>
  `${equipoId}:${puertoId}:${ordinal}`;

function filasDeBloque(
  puertos: Puerto[],
  equipoId: string,
  usados: Set<string>,
  usadosLegacy: Set<string>,
  soloConectados: boolean,
): { izquierda: BocaDiagrama[]; derecha: BocaDiagrama[] } {
  const bocas = puertos.flatMap((puerto) =>
    Array.from({ length: Math.max(1, puerto.total) }, (_, i) => ({ puerto, ordinal: i + 1 })),
  );
  const visibles = soloConectados
    ? bocas.filter(({ puerto, ordinal }) =>
        usados.has(claveBoca(equipoId, puerto.id, ordinal)) || usadosLegacy.has(`${equipoId}:${puerto.id}`),
      )
    : bocas;
  const ordenados = [...visibles].sort(
    (a, b) => (a.puerto.orden ?? 999) - (b.puerto.orden ?? 999) ||
      (a.puerto.nombre < b.puerto.nombre ? -1 : a.puerto.nombre > b.puerto.nombre ? 1 : a.ordinal - b.ordinal),
  );
  return {
    izquierda: ordenados.filter(({ puerto }) => ladoDePuerto(puerto.sentido) === 'izquierda'),
    derecha: ordenados.filter(({ puerto }) => ladoDePuerto(puerto.sentido) === 'derecha'),
  };
}

export function construirDiagrama(entrada: EntradaDiagrama): EscenaDiagrama {
  const m = MEDIDAS_DIAGRAMA;
  const {
    equipos,
    puertosPorArticulo,
    conexiones,
    descripcionArticulo,
    categoriaArticulo,
    soloConectados = false,
    filtroSenal = null,
  } = entrada;

  // El identificador se calcula sobre TODAS las conexiones y solo después se
  // filtra la escena. Al revés, el cable `HD-1002` pasaría a llamarse
  // `HD-1000` en la vista de vídeo, y esa etiqueta puede estar ya escrita en
  // una brida de la sala.
  const identificadores = identificadoresDeCable(conexiones);
  const visibles = filtroSenal
    ? conexiones.filter((c) => senalEnFiltro(c.senal, filtroSenal))
    : conexiones;

  const etiquetas = etiquetasDeEquipos(equipos);
  const puertosUsados = new Set<string>();
  const puertosUsadosLegacy = new Set<string>();
  for (const c of visibles) {
    if (c.puerto_origen_id && c.puerto_origen_ordinal) puertosUsados.add(claveBoca(c.origen_id, c.puerto_origen_id, c.puerto_origen_ordinal));
    else if (c.puerto_origen_id) puertosUsadosLegacy.add(`${c.origen_id}:${c.puerto_origen_id}`);
    if (c.puerto_destino_id && c.puerto_destino_ordinal) puertosUsados.add(claveBoca(c.destino_id, c.puerto_destino_id, c.puerto_destino_ordinal));
    else if (c.puerto_destino_id) puertosUsadosLegacy.add(`${c.destino_id}:${c.puerto_destino_id}`);
  }

  // --- bloques por columna, en orden estable -------------------------------
  const columnas: EquipoEnSala[][] = [[], [], [], []];
  for (const e of [...equipos].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    columnas[columnaDeEquipo(e.id, visibles)].push(e);
  }
  // Sin equipos desconectados no se reserva su columna.
  const columnasOcupadas = columnas
    .map((lista, i) => ({ lista, i }))
    .filter((c) => c.lista.length > 0);

  const bloques: BloqueDiagrama[] = [];
  const filaPorBoca = new Map<string, { bloque: BloqueDiagrama; fila: FilaPuertoDiagrama }>();
  const bloquePorEquipo = new Map<string, BloqueDiagrama>();

  let x = m.margen;
  let altoTotal = 0;

  for (const { lista } of columnasOcupadas) {
    let y = m.margen;
    for (const equipo of lista) {
      const puertos = puertosPorArticulo.get(equipo.articulo_id) ?? [];
      const { izquierda, derecha } = filasDeBloque(puertos, equipo.id, puertosUsados, puertosUsadosLegacy, soloConectados);
      const nFilas = Math.max(izquierda.length, derecha.length, 1);
      const alto = m.alto_cabecera + nFilas * m.alto_fila + m.alto_pie;

      const bloque: BloqueDiagrama = {
        equipo_id: equipo.id,
        etiqueta: etiquetas.get(equipo.id) ?? equipo.nombre,
        categoria: categoriaArticulo?.get(equipo.articulo_id) ?? null,
        marca_modelo: descripcionArticulo?.get(equipo.articulo_id) ?? null,
        x,
        y,
        ancho: m.ancho_bloque,
        alto,
        entradas: [],
        salidas: [],
      };

      const filar = ({ puerto: p, ordinal }: BocaDiagrama, i: number): FilaPuertoDiagrama => ({
        puerto_id: p.id,
        ordinal,
        nombre: p.total > 1 ? `${p.nombre} ${ordinal}` : p.nombre,
        conector: p.conector,
        senal: p.senal,
        total: 1,
        conectado: puertosUsados.has(claveBoca(equipo.id, p.id, ordinal)) || puertosUsadosLegacy.has(`${equipo.id}:${p.id}`),
        y: y + m.alto_cabecera + i * m.alto_fila + m.alto_fila / 2,
      });
      bloque.entradas = izquierda.map(filar);
      bloque.salidas = derecha.map(filar);
      for (const f of [...bloque.entradas, ...bloque.salidas]) {
        filaPorBoca.set(claveBoca(equipo.id, f.puerto_id, f.ordinal), { bloque, fila: f });
      }
      bloquePorEquipo.set(equipo.id, bloque);
      bloques.push(bloque);

      y += alto + m.separacion_y;
    }
    altoTotal = Math.max(altoTotal, y - m.separacion_y + m.margen);
    x += m.ancho_bloque + m.separacion_x;
  }

  // --- líneas ---------------------------------------------------------------
  const lineas: LineaDiagrama[] = [];
  let omitidas = 0;

  // Cada línea discurre por un carril vertical propio del canal entre
  // columnas: dos cables que comparten canal no se superponen.
  let carril = 0;

  for (const c of ordenarConexiones(visibles)) {
    const bOrigen = bloquePorEquipo.get(c.origen_id);
    const bDestino = bloquePorEquipo.get(c.destino_id);
    if (!bOrigen || !bDestino) {
      omitidas += 1;
      continue;
    }

    // Un puerto conocido manda su cara y su fila. Sólo el legado sin boca
    // conserva el anclaje genérico derecha → izquierda a media cabecera.
    const fOrigen = c.puerto_origen_id
      ? filaPorBoca.get(claveBoca(c.origen_id, c.puerto_origen_id, c.puerto_origen_ordinal ?? 1))
      : undefined;
    const fDestino = c.puerto_destino_id
      ? filaPorBoca.get(claveBoca(c.destino_id, c.puerto_destino_id, c.puerto_destino_ordinal ?? 1))
      : undefined;

    const origenIzquierda = fOrigen && bOrigen.entradas.includes(fOrigen.fila);
    const destinoDerecha = fDestino && bDestino.salidas.includes(fDestino.fila);
    const x1 = origenIzquierda ? bOrigen.x - m.largo_conector : bOrigen.x + bOrigen.ancho + m.largo_conector;
    const y1 = fOrigen?.fila.y ?? bOrigen.y + m.alto_cabecera / 2;
    const x2 = destinoDerecha ? bDestino.x + bDestino.ancho + m.largo_conector : bDestino.x - m.largo_conector;
    const y2 = fDestino?.fila.y ?? bDestino.y + m.alto_cabecera / 2;

    carril += 1;
    lineas.push({
      conexion_id: c.id,
      identificador: identificadores.get(c.id) ?? '—',
      senal: c.senal,
      ...trazarLineaDiagrama(bOrigen, bDestino, { x: x1, y: y1 }, { x: x2, y: y2 }, carril),
    });
  }

  const anchoTotal =
    columnasOcupadas.length > 0
      ? m.margen * 2 +
        columnasOcupadas.length * m.ancho_bloque +
        (columnasOcupadas.length - 1) * m.separacion_x
      : m.margen * 2;

  const desplazamientoX = Math.max(0, m.margen - Math.min(m.margen, ...lineas.flatMap(l => l.puntos.map(p => p.x)), ...bloques.map(b => b.x - m.largo_conector)));
  return {
    bloques: bloques.map(b => ({ ...b, x: b.x + desplazamientoX })),
    lineas: lineas.map(l => ({ ...l, puntos: l.puntos.map(p => ({ ...p, x: p.x + desplazamientoX })), etiqueta_x: l.etiqueta_x + desplazamientoX })),
    ancho: Math.max(anchoTotal, ...lineas.flatMap(l => l.puntos.map(p => p.x + m.margen))) + desplazamientoX,
    alto: Math.max(altoTotal, m.margen * 2, ...lineas.flatMap(l => l.puntos.map(p => p.y + m.margen))),
    omitidas,
  };
}
