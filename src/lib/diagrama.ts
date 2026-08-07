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

export interface FilaPuertoDiagrama {
  puerto_id: string;
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
  /** Conexiones que no se pudieron dibujar (extremo sin equipo en la sala). */
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

function filasDeBloque(
  puertos: Puerto[],
  usados: Set<string>,
  soloConectados: boolean,
): { izquierda: Puerto[]; derecha: Puerto[] } {
  const visibles = soloConectados ? puertos.filter((p) => usados.has(p.id)) : puertos;
  const ordenados = [...visibles].sort(
    (a, b) => (a.orden ?? 999) - (b.orden ?? 999) || (a.nombre < b.nombre ? -1 : 1),
  );
  return {
    izquierda: ordenados.filter((p) => ladoDePuerto(p.sentido) === 'izquierda'),
    derecha: ordenados.filter((p) => ladoDePuerto(p.sentido) === 'derecha'),
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
  } = entrada;

  const identificadores = identificadoresDeCable(conexiones);
  const etiquetas = etiquetasDeEquipos(equipos);
  const puertosUsados = new Set<string>();
  for (const c of conexiones) {
    if (c.puerto_origen_id) puertosUsados.add(c.puerto_origen_id);
    if (c.puerto_destino_id) puertosUsados.add(c.puerto_destino_id);
  }

  // --- bloques por columna, en orden estable -------------------------------
  const columnas: EquipoEnSala[][] = [[], [], [], []];
  for (const e of [...equipos].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    columnas[columnaDeEquipo(e.id, conexiones)].push(e);
  }
  // Sin equipos desconectados no se reserva su columna.
  const columnasOcupadas = columnas
    .map((lista, i) => ({ lista, i }))
    .filter((c) => c.lista.length > 0);

  const bloques: BloqueDiagrama[] = [];
  const filaPorPuerto = new Map<string, { bloque: BloqueDiagrama; fila: FilaPuertoDiagrama }>();
  const bloquePorEquipo = new Map<string, BloqueDiagrama>();

  let x = m.margen;
  let altoTotal = 0;

  for (const { lista } of columnasOcupadas) {
    let y = m.margen;
    for (const equipo of lista) {
      const puertos = puertosPorArticulo.get(equipo.articulo_id) ?? [];
      const { izquierda, derecha } = filasDeBloque(puertos, puertosUsados, soloConectados);
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

      const filar = (p: Puerto, i: number): FilaPuertoDiagrama => ({
        puerto_id: p.id,
        nombre: p.nombre,
        conector: p.conector,
        senal: p.senal,
        total: p.total,
        conectado: puertosUsados.has(p.id),
        y: y + m.alto_cabecera + i * m.alto_fila + m.alto_fila / 2,
      });
      bloque.entradas = izquierda.map(filar);
      bloque.salidas = derecha.map(filar);
      for (const f of [...bloque.entradas, ...bloque.salidas]) {
        filaPorPuerto.set(f.puerto_id, { bloque, fila: f });
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

  for (const c of ordenarConexiones(conexiones)) {
    const bOrigen = bloquePorEquipo.get(c.origen_id);
    const bDestino = bloquePorEquipo.get(c.destino_id);
    if (!bOrigen || !bDestino) {
      omitidas += 1;
      continue;
    }

    // El cable sale del lado derecho del origen y entra por el izquierdo del
    // destino. Si el puerto se conoce, a la altura de su fila; si no, a media
    // cabecera, que se lee como "del equipo en general".
    const fOrigen = c.puerto_origen_id ? filaPorPuerto.get(c.puerto_origen_id) : undefined;
    const fDestino = c.puerto_destino_id ? filaPorPuerto.get(c.puerto_destino_id) : undefined;

    const x1 = bOrigen.x + bOrigen.ancho + m.largo_conector;
    const y1 = fOrigen?.fila.y ?? bOrigen.y + m.alto_cabecera / 2;
    const x2 = bDestino.x - m.largo_conector;
    const y2 = fDestino?.fila.y ?? bDestino.y + m.alto_cabecera / 2;

    carril += 1;
    const carrilX =
      Math.min(x1, x2) +
      Math.abs(x2 - x1) / 2 +
      ((carril % 5) - 2) * 12; // cinco carriles repartidos alrededor del centro

    const puntos =
      y1 === y2
        ? [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ]
        : [
            { x: x1, y: y1 },
            { x: carrilX, y: y1 },
            { x: carrilX, y: y2 },
            { x: x2, y: y2 },
          ];

    lineas.push({
      conexion_id: c.id,
      identificador: identificadores.get(c.id) ?? '—',
      senal: c.senal,
      puntos,
      etiqueta_x: carrilX,
      etiqueta_y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2,
    });
  }

  const anchoTotal =
    columnasOcupadas.length > 0
      ? m.margen * 2 +
        columnasOcupadas.length * m.ancho_bloque +
        (columnasOcupadas.length - 1) * m.separacion_x
      : m.margen * 2;

  return {
    bloques,
    lineas,
    ancho: anchoTotal,
    alto: Math.max(altoTotal, m.margen * 2),
    omitidas,
  };
}
