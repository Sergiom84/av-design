/**
 * Croquis de sala: de los datos al dibujo.
 *
 * El departamento lleva años dibujando estas salas a mano en un plano con
 * cotas: el rectángulo de la sala, la mesa en medio, las sillas alrededor, la
 * pantalla en la pared, la caja de conexiones y las tiradas marcadas en rojo
 * con sus metros. Ese plano es el entregable que se lleva a la obra.
 *
 * Aquí no se dibuja nada: se construye la escena. Entra la sala con su mesa,
 * sus equipos y sus tiradas, y sale una lista de rectángulos, círculos, líneas
 * y cotas en METROS. Pintarla es cosa de `src/components/croquis/`.
 *
 * Se separa así por lo mismo que `calculo-cable.ts`: es lógica pura, se puede
 * probar sin navegador y sin base de datos, y el día que el dibujo se exporte a
 * PDF o a DXF la escena ya está hecha.
 *
 * Sistema de coordenadas, el mismo que usa el cálculo de cable:
 *   x va a lo largo (`largo_m`), y a lo ancho (`ancho_m`), z hacia arriba.
 *   El origen es la esquina inferior izquierda de la sala vista en planta.
 */

import type {
  Conexion,
  EquipoEnSala,
  Extremo,
  FormaMueble,
  MuebleEnSala,
  Sala,
  Senal,
  TomaRed,
} from './tipos';

/** Un rectángulo en planta, en metros, por su esquina inferior izquierda. */
export interface Rectangulo {
  x_m: number;
  y_m: number;
  largo_m: number;
  ancho_m: number;
}

/**
 * La mesa en planta. Es un rectángulo más su giro sobre el centro: una mesa de
 * junta puesta en travesía no está alineada con las paredes, y dibujarla
 * alineada convierte el plano en una mentira medible.
 *
 * El centro va aparte de la esquina a propósito: es lo que se gira, lo que se
 * arrastra en el editor y lo que se guarda en `salas.mesa_x_m`/`mesa_y_m`.
 */
export interface MesaCroquis extends Rectangulo {
  centro: { x_m: number; y_m: number };
  rotacion_grados: number;
}

export interface SillaCroquis {
  x_m: number;
  y_m: number;
  /** Radio del círculo que la representa. Una silla ocupa unos 50 cm. */
  radio_m: number;
}

/**
 * Un mueble en planta: la silla, la mesa auxiliar, el atril.
 *
 * Va por su ancla y su giro, igual que los equipos. Un mueble sin medir o sin
 * colocar no llega hasta aquí: el croquis dibuja lo que se sabe.
 */
export interface MuebleCroquis {
  id: string;
  nombre: string;
  forma: FormaMueble;
  x_m: number;
  y_m: number;
  largo_m: number;
  ancho_m: number;
  rotacion_grados: number;
}

export interface EquipoCroquis {
  id: string;
  nombre: string;
  x_m: number;
  y_m: number;
  z_m: number;
  extremo: Extremo;
  /** Ancho del símbolo en planta. Una pantalla se dibuja larga; una caja, cuadrada. */
  largo_m: number;
  ancho_m: number;
  /**
   * La posición no estaba puesta y se ha deducido del extremo. El dibujo la
   * marca distinto: sirve para orientarse, no para taladrar.
   */
  estimada: boolean;
  /** Giro del símbolo sobre su ancla. 0 = alineado con las paredes. */
  rotacion_grados: number;
}

export interface TiradaCroquis {
  id: string;
  etiqueta: string;
  senal: Senal;
  desde: { x_m: number; y_m: number };
  hasta: { x_m: number; y_m: number };
  /** Metros calculados por `calculo-cable.ts`. Nulo mientras no haya cálculo. */
  metros: number | null;
}

export interface TomaCroquis {
  id: string;
  codigo: string;
  x_m: number;
  y_m: number;
}

/** Una cota acotada entre dos puntos, con su texto ya formateado. */
export interface CotaCroquis {
  clave: string;
  desde: { x_m: number; y_m: number };
  hasta: { x_m: number; y_m: number };
  texto: string;
  /** Dónde se despega la línea de cota del objeto que mide. */
  lado: 'arriba' | 'abajo' | 'izquierda' | 'derecha';
}

export interface EscenaCroquis {
  titulo: string;
  sala: Rectangulo;
  mesa: MesaCroquis | null;
  /**
   * Las sillas derivadas del aforo. Vacío cuando la sala tiene sillas
   * explícitas: las dos fuentes a la vez dibujarían cada silla dos veces.
   */
  sillas: SillaCroquis[];
  muebles: MuebleCroquis[];
  equipos: EquipoCroquis[];
  tomas: TomaCroquis[];
  tiradas: TiradaCroquis[];
  cotas: CotaCroquis[];
  /** Notas al pie: alturas y todo lo que no cabe en una planta. */
  anotaciones: string[];
  /** Lo que falta por medir. Se enseña, no se inventa. */
  avisos: string[];
}

/** Una silla ocupa medio metro largo. Es el círculo del plano de siempre. */
const RADIO_SILLA_M = 0.25;

/** Separación entre el borde de la mesa y el centro de la silla. */
const SEPARACION_SILLA_M = 0.42;

const TAMANO_SIMBOLO: Partial<Record<Extremo, { largo_m: number; ancho_m: number }>> = {
  pantalla: { largo_m: 1.45, ancho_m: 0.1 },
  proyector: { largo_m: 0.4, ancho_m: 0.35 },
  rack: { largo_m: 0.6, ancho_m: 0.6 },
  caja_conexiones: { largo_m: 0.3, ancho_m: 0.24 },
  mesa: { largo_m: 0.24, ancho_m: 0.18 },
  techo: { largo_m: 0.3, ancho_m: 0.3 },
  pared: { largo_m: 0.3, ancho_m: 0.15 },
};

const SIMBOLO_POR_DEFECTO = { largo_m: 0.3, ancho_m: 0.2 };

/**
 * Dónde va un equipo del que nadie ha escrito las coordenadas.
 *
 * Sin esto el croquis de una sala recién creada sale con todo amontonado en la
 * esquina, que es peor que no dibujar nada. Con esto sale la sala típica: la
 * pantalla en el testero, la caja en la mesa, el rack en una esquina. Se marca
 * como estimada para que nadie mida sobre ella.
 */
function posicionPorDefecto(
  extremo: Extremo,
  sala: Sala,
  mesa: MesaCroquis | null,
): { x_m: number; y_m: number; z_m: number } {
  const centroMesa = mesa
    ? { x: mesa.centro.x_m, y: mesa.centro.y_m }
    : { x: sala.largo_m / 2, y: sala.ancho_m / 2 };

  switch (extremo) {
    // El testero: pared corta de la izquierda, a media altura de la sala.
    case 'pantalla':
      return { x_m: 0, y_m: sala.ancho_m / 2, z_m: 0.74 };
    case 'proyector':
      return { x_m: sala.largo_m / 2, y_m: sala.ancho_m / 2, z_m: sala.alto_m || 2.7 };
    case 'rack':
      return { x_m: sala.largo_m, y_m: 0, z_m: 0 };
    case 'caja_conexiones':
      return { x_m: centroMesa.x, y_m: centroMesa.y, z_m: 0.73 };
    case 'mesa':
      return { x_m: centroMesa.x, y_m: centroMesa.y, z_m: 0.73 };
    case 'techo':
      return { x_m: sala.largo_m / 2, y_m: sala.ancho_m / 2, z_m: sala.alto_m || 2.7 };
    case 'pared':
      return { x_m: sala.largo_m, y_m: sala.ancho_m / 2, z_m: 1.2 };
  }
}

/**
 * Una posición que nadie ha puesto.
 *
 * Antes se deducía del triple cero, que significaba a la vez "sin colocar" y la
 * esquina de la sala. Ahora lo dice la fila: `posicion_confirmada`. El relleno
 * de la migración marcó como confirmado justo lo que no era triple cero, así
 * que el croquis de todo lo que ya existía sale idéntico.
 */
const sinColocar = (e: EquipoEnSala): boolean => !e.posicion_confirmada;

/** Gira un punto alrededor de un centro. Grados antihorarios, como el editor. */
function rotar(
  punto: { x_m: number; y_m: number },
  centro: { x_m: number; y_m: number },
  grados: number,
): { x_m: number; y_m: number } {
  if (!grados) return punto;
  const rad = (grados * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  const dx = punto.x_m - centro.x_m;
  const dy = punto.y_m - centro.y_m;
  return {
    x_m: redondear(centro.x_m + dx * cos - dy * sen),
    y_m: redondear(centro.y_m + dx * sen + dy * cos),
  };
}

/**
 * La mesa del plano. Si no tiene centro escrito va centrada en la sala, que es
 * el caso de casi todas: una mesa de reuniones se pone en medio.
 */
export function mesaDeLaSala(sala: Sala): MesaCroquis | null {
  const largo = sala.mesa_largo_m;
  const ancho = sala.mesa_ancho_m;
  if (!largo || !ancho) return null;

  const cx = redondear(sala.mesa_x_m ?? sala.largo_m / 2);
  const cy = redondear(sala.mesa_y_m ?? sala.ancho_m / 2);

  return {
    x_m: redondear(cx - largo / 2),
    y_m: redondear(cy - ancho / 2),
    largo_m: largo,
    ancho_m: ancho,
    centro: { x_m: cx, y_m: cy },
    rotacion_grados: normalizarGrados(sala.mesa_rotacion_grados),
  };
}

/** Un giro se guarda siempre en [0, 360): −90 y 270 son la misma mesa. */
export function normalizarGrados(grados: number | null | undefined): number {
  if (grados == null || !Number.isFinite(grados)) return 0;
  const g = grados % 360;
  return redondear(g < 0 ? g + 360 : g);
}

/**
 * Reparte el aforo alrededor de la mesa como se sienta la gente: uno en cada
 * cabecera y el resto repartido a partes iguales por los dos lados largos. Con
 * aforo 8 salen los 3 + 3 + 1 + 1 del croquis de la Sala de Batería.
 *
 * Con aforo 2 o 3 no hay cabeceras: se sienta uno enfrente de otro, que es como
 * se usa una sala de dos.
 */
export function sillasAlrededor(mesa: MesaCroquis, aforo: number): SillaCroquis[] {
  if (aforo <= 0) return [];

  const cabeceras = aforo >= 4 ? Math.min(2, aforo) : 0;
  const porLados = aforo - cabeceras;
  const arriba = Math.ceil(porLados / 2);
  const abajo = porLados - arriba;

  const sillas: SillaCroquis[] = [];
  const enLado = (cuantas: number, y: number) => {
    for (let i = 0; i < cuantas; i += 1) {
      sillas.push({
        x_m: redondear(mesa.x_m + (mesa.largo_m * (i + 1)) / (cuantas + 1)),
        y_m: redondear(y),
        radio_m: RADIO_SILLA_M,
      });
    }
  };

  enLado(arriba, mesa.y_m + mesa.ancho_m + SEPARACION_SILLA_M);
  enLado(abajo, mesa.y_m - SEPARACION_SILLA_M);

  if (cabeceras >= 1) {
    sillas.push({
      x_m: redondear(mesa.x_m - SEPARACION_SILLA_M),
      y_m: redondear(mesa.y_m + mesa.ancho_m / 2),
      radio_m: RADIO_SILLA_M,
    });
  }
  if (cabeceras >= 2) {
    sillas.push({
      x_m: redondear(mesa.x_m + mesa.largo_m + SEPARACION_SILLA_M),
      y_m: redondear(mesa.y_m + mesa.ancho_m / 2),
      radio_m: RADIO_SILLA_M,
    });
  }

  // Las sillas se reparten sobre la mesa sin girar y se giran con ella: quien
  // se sienta en la cabecera sigue en la cabecera cuando la mesa se pone en
  // travesía. Con giro 0 `rotar` devuelve el mismo punto y no toca nada.
  if (!mesa.rotacion_grados) return sillas;
  return sillas.map((s) => ({ ...rotar(s, mesa.centro, mesa.rotacion_grados), radio_m: s.radio_m }));
}

/**
 * El ancla cae dentro de la sala, con un margen de redondeo.
 *
 * `plano-editor.ts` tiene su propia versión con el margen del editor: aquella
 * decide si un guardado se acepta, esta decide si se dibuja. Se parecen y no
 * son la misma pregunta.
 */
export function anclaDentroDeLaSala(
  punto: { x_m: number; y_m: number },
  sala: { largo_m: number; ancho_m: number },
): boolean {
  const holgura = 0.005;
  return (
    punto.x_m >= -holgura &&
    punto.x_m <= sala.largo_m + holgura &&
    punto.y_m >= -holgura &&
    punto.y_m <= sala.ancho_m + holgura
  );
}

interface Segmento {
  a: { x_m: number; y_m: number };
  b: { x_m: number; y_m: number };
}

/**
 * Recorta un segmento contra el rectángulo de la sala (Liang–Barsky).
 *
 * Devuelve el trozo que queda dentro, o `null` si el segmento entero está
 * fuera. La mesa puede estar girada cualquier ángulo, así que la línea de
 * asientos no es paralela a las paredes y no vale con comparar coordenadas.
 */
function recortarSegmento(
  seg: Segmento,
  sala: { largo_m: number; ancho_m: number },
): Segmento | null {
  const dx = seg.b.x_m - seg.a.x_m;
  const dy = seg.b.y_m - seg.a.y_m;
  let t0 = 0;
  let t1 = 1;
  const bordes: Array<[number, number]> = [
    [-dx, seg.a.x_m],
    [dx, sala.largo_m - seg.a.x_m],
    [-dy, seg.a.y_m],
    [dy, sala.ancho_m - seg.a.y_m],
  ];
  for (const [p, q] of bordes) {
    if (p === 0) {
      // Paralelo a este borde: si ya está fuera, no hay nada que recortar.
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return {
    a: { x_m: seg.a.x_m + t0 * dx, y_m: seg.a.y_m + t0 * dy },
    b: { x_m: seg.a.x_m + t1 * dx, y_m: seg.a.y_m + t1 * dy },
  };
}

/** Lo que sale de repartir el aforo alrededor de la mesa dentro de la sala. */
export interface RepartoSillas {
  sillas: SillaCroquis[];
  /**
   * Cuántas no caben en ningún lado libre. Cero es lo normal. Cuando no es
   * cero se dice en un aviso: dibujar una silla donde no hay sitio es peor que
   * decir que no cabe.
   */
  sinSitio: number;
}

/**
 * Reparte el aforo alrededor de la mesa SIN salirse de la sala.
 *
 * El reparto de `sillasAlrededor()` sienta a la cabecera 42 cm más allá del
 * borde de la mesa. Con la mesa arrimada a una pared —que es como está en
 * media sala pequeña— esa posición cae fuera de la sala, y ahí no se sienta
 * nadie.
 *
 * La primera versión de esto metía cada ancla a la fuerza dentro del
 * rectángulo. Eso dejaba las sillas dentro, sí, pero apiladas: los tres
 * asientos de un lado que se salía acababan los tres contra la misma
 * coordenada, y una sala de nueve sillas dibujaba seis círculos con tres
 * escondidos debajo. Recortar cada punto por su cuenta no es repartir.
 *
 * Lo que se hace ahora es elegir POR DÓNDE se sienta la gente: se miran los
 * cuatro lados de la mesa —los dos largos y las dos cabeceras—, se recorta
 * cada uno contra la sala y los que quedan sin sitio no reciben a nadie. Los
 * asientos que iban ahí se reparten entre los lados que sí quedan, que es lo
 * que se hace de verdad cuando una mesa está contra la pared.
 *
 * Si no queda ningún lado libre, no se inventa nada: se devuelven las que
 * caben y `sinSitio` cuenta el resto, para que el croquis lo diga.
 *
 * El ajuste vive aquí, en la geometría compartida, y no en el guardado:
 * corregir al guardar dibujaría una cosa y grabaría otra. Se ajusta el ANCLA;
 * el círculo de la silla puede sobresalir, igual que una pantalla pegada a la
 * pared. Una sala sin medir no recorta nada: no hay contra qué.
 */
export function repartirSillasEnLaSala(
  mesa: MesaCroquis,
  aforo: number,
  sala: { largo_m: number; ancho_m: number },
): RepartoSillas {
  if (aforo <= 0) return { sillas: [], sinSitio: 0 };

  // El reparto de siempre. Si cabe entero, se queda tal cual: ajustar contra
  // la pared no puede recolocar lo que ya cabía.
  const base = sillasAlrededor(mesa, aforo);
  if (!(sala.largo_m > 0) || !(sala.ancho_m > 0)) return { sillas: base, sinSitio: 0 };
  if (base.every((s) => anclaDentroDeLaSala(s, sala))) return { sillas: base, sinSitio: 0 };

  const local = (x: number, y: number) =>
    rotar({ x_m: x, y_m: y }, mesa.centro, mesa.rotacion_grados);

  // Los dos lados largos, como segmentos en coordenadas de la sala. El orden
  // —arriba y luego abajo— es el mismo que el del reparto de siempre.
  const largos = (
    [
      {
        a: local(mesa.x_m, mesa.y_m + mesa.ancho_m + SEPARACION_SILLA_M),
        b: local(mesa.x_m + mesa.largo_m, mesa.y_m + mesa.ancho_m + SEPARACION_SILLA_M),
      },
      {
        a: local(mesa.x_m, mesa.y_m - SEPARACION_SILLA_M),
        b: local(mesa.x_m + mesa.largo_m, mesa.y_m - SEPARACION_SILLA_M),
      },
    ] as Segmento[]
  )
    .map((s) => recortarSegmento(s, sala))
    .filter((s): s is Segmento => s !== null);

  // Las cabeceras son un sitio cada una: o cabe o no cabe.
  const cabeceras = [
    local(mesa.x_m - SEPARACION_SILLA_M, mesa.y_m + mesa.ancho_m / 2),
    local(mesa.x_m + mesa.largo_m + SEPARACION_SILLA_M, mesa.y_m + mesa.ancho_m / 2),
  ].filter((p) => anclaDentroDeLaSala(p, sala));

  const silla = (p: { x_m: number; y_m: number }): SillaCroquis => ({
    x_m: redondear(p.x_m),
    y_m: redondear(p.y_m),
    radio_m: RADIO_SILLA_M,
  });

  // Sin ningún lado largo libre solo quedan las cabeceras, y son dos como
  // mucho. Lo que no cabe se cuenta, no se apila.
  if (largos.length === 0) {
    const caben = Math.min(aforo, cabeceras.length);
    return {
      sillas: cabeceras.slice(0, caben).map(silla),
      sinSitio: aforo - caben,
    };
  }

  // Con cuatro o más se ocupan las cabeceras que hayan quedado libres; con dos
  // o tres se sienta uno enfrente de otro, igual que en el reparto de siempre.
  const nCabeceras = aforo >= 4 ? Math.min(cabeceras.length, 2, aforo) : 0;
  const porLados = aforo - nCabeceras;
  const reparto =
    largos.length === 2
      ? [Math.ceil(porLados / 2), Math.floor(porLados / 2)]
      : [porLados];

  const sillas: SillaCroquis[] = [];
  largos.forEach((lado, i) => {
    const cuantas = reparto[i];
    for (let j = 0; j < cuantas; j += 1) {
      const t = (j + 1) / (cuantas + 1);
      sillas.push(
        silla({
          x_m: lado.a.x_m + (lado.b.x_m - lado.a.x_m) * t,
          y_m: lado.a.y_m + (lado.b.y_m - lado.a.y_m) * t,
        }),
      );
    }
  });
  for (let i = 0; i < nCabeceras; i += 1) sillas.push(silla(cabeceras[i]));

  return { sillas, sinSitio: 0 };
}

export interface EntradaCroquis {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
  tomas: TomaRed[];
  muebles?: MuebleEnSala[];
  /** Metros por conexión, ya calculados. Lo que devuelve `calcularConexion()`. */
  metrosPorConexion?: Map<string, number>;
}

/**
 * Construye la escena completa. Nunca lanza: una sala a medio medir devuelve
 * una escena con avisos, porque el croquis a medias sigue sirviendo para hablar
 * con el instalador y el error en pantalla no.
 */
export function construirEscena({
  sala,
  equipos,
  conexiones,
  tomas,
  muebles = [],
  metrosPorConexion,
}: EntradaCroquis): EscenaCroquis {
  const avisos: string[] = [];

  if (!sala.largo_m || !sala.ancho_m) {
    avisos.push('Faltan el largo o el ancho de la sala: el croquis no está a escala.');
  }

  const rectSala: Rectangulo = {
    x_m: 0,
    y_m: 0,
    largo_m: sala.largo_m || 0,
    ancho_m: sala.ancho_m || 0,
  };

  const mesa = mesaDeLaSala(sala);
  if (!mesa) {
    avisos.push('Sin las medidas de la mesa no se dibujan ni la mesa ni las sillas.');
  }

  // Una sola fuente de sillas. Con `manuales` mandan las filas de mobiliario
  // y el aforo vuelve a ser solo la capacidad: dibujar las dos daría dos
  // sillas por cada sitio.
  const derivadas = sala.sillas_modo !== 'manuales';
  // Ajustadas a la sala aquí y no al materializarlas: el editor materializa
  // lo que el croquis dibuja, así que la única forma de que el dibujo de
  // antes y el de después sean el mismo es que salgan ya bien de aquí.
  const reparto =
    derivadas && mesa && sala.aforo
      ? repartirSillasEnLaSala(mesa, sala.aforo, rectSala)
      : { sillas: [], sinSitio: 0 };
  const sillas = reparto.sillas;
  if (derivadas && mesa && !sala.aforo) {
    avisos.push('Sin aforo no se colocan las sillas.');
  }
  // Lo que no cabe se dice. Dibujarlas amontonadas donde sí hay hueco sería
  // enseñar un plano con posiciones que nadie puede usar.
  if (reparto.sinSitio > 0) {
    avisos.push(
      reparto.sinSitio === 1
        ? 'Una silla del aforo no cabe alrededor de la mesa dentro de la sala: no se dibuja.'
        : `${reparto.sinSitio} sillas del aforo no caben alrededor de la mesa dentro de la sala: no se dibujan.`,
    );
  }

  // Un mueble sin medir o sin colocar no se dibuja: se enseña en el lateral
  // del editor, que es donde se completa, y no se inventa un rectángulo.
  const mueblesDibujados: MuebleCroquis[] = muebles
    .filter(
      (m) =>
        m.posicion_confirmada &&
        m.x_m != null &&
        m.y_m != null &&
        m.largo_m != null &&
        m.ancho_m != null &&
        m.largo_m > 0 &&
        m.ancho_m > 0,
    )
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      forma: m.forma,
      x_m: redondear(m.x_m as number),
      y_m: redondear(m.y_m as number),
      largo_m: m.largo_m as number,
      ancho_m: m.ancho_m as number,
      rotacion_grados: normalizarGrados(m.rotacion_grados),
    }));

  const sinDibujar = muebles.length - mueblesDibujados.length;
  if (sinDibujar > 0) {
    avisos.push(
      sinDibujar === 1
        ? 'Un mueble no está medido o colocado y no se dibuja.'
        : `${sinDibujar} muebles no están medidos o colocados y no se dibujan.`,
    );
  }

  const dibujados: EquipoCroquis[] = equipos.map((e) => {
    const estimada = sinColocar(e);
    const pos = estimada ? posicionPorDefecto(e.extremo, sala, mesa) : e.posicion;
    const tamano = TAMANO_SIMBOLO[e.extremo] ?? SIMBOLO_POR_DEFECTO;
    return {
      id: e.id,
      nombre: e.nombre,
      // La posición deducida sale de dividir medidas y arrastra la basura del
      // coma flotante. Se redondea al centímetro: es la unidad del plano.
      x_m: redondear(pos.x_m),
      y_m: redondear(pos.y_m),
      z_m: redondear(pos.z_m),
      extremo: e.extremo,
      largo_m: tamano.largo_m,
      ancho_m: tamano.ancho_m,
      estimada,
      rotacion_grados: normalizarGrados(e.rotacion_grados),
    };
  });

  separarAmontonados(dibujados);

  const estimados = dibujados.filter((e) => e.estimada).length;
  if (estimados > 0) {
    avisos.push(
      estimados === 1
        ? 'Un equipo no tiene posición y se ha colocado donde suele ir.'
        : `${estimados} equipos no tienen posición y se han colocado donde suelen ir.`,
    );
  }

  const porId = new Map(dibujados.map((e) => [e.id, e]));

  const tiradas: TiradaCroquis[] = conexiones.flatMap((c) => {
    const origen = porId.get(c.origen_id);
    const destino = porId.get(c.destino_id);
    if (!origen || !destino) return [];
    return [
      {
        id: c.id,
        etiqueta: `${origen.nombre} → ${destino.nombre}`,
        senal: c.senal,
        desde: { x_m: origen.x_m, y_m: origen.y_m },
        hasta: { x_m: destino.x_m, y_m: destino.y_m },
        metros: metrosPorConexion?.get(c.id) ?? null,
      },
    ];
  });

  const tomasDibujadas: TomaCroquis[] = tomas
    .filter((t) => t.x_m != null && t.y_m != null)
    .map((t) => ({ id: t.id, codigo: t.codigo, x_m: t.x_m!, y_m: t.y_m! }));

  return {
    titulo: sala.nombre,
    sala: rectSala,
    mesa,
    sillas,
    muebles: mueblesDibujados,
    equipos: dibujados,
    tomas: tomasDibujadas,
    tiradas,
    cotas: cotasDeLaEscena(sala, rectSala, mesa, dibujados),
    anotaciones: anotacionesDeLaEscena(sala, mesa, dibujados),
    avisos,
  };
}

/** Hueco entre dos equipos que se han tenido que separar. */
const SEPARACION_EQUIPOS_M = 0.12;

/**
 * Reparte los equipos que han caído en el mismo punto.
 *
 * La caja de conexiones y el panel táctil son extremos distintos que se colocan
 * los dos en el centro de la mesa, así que sin esto se dibujan uno encima de
 * otro y sus dos rótulos se pisan: el croquis deja de leerse justo en la sala
 * más repetida del inventario, que lleva los dos.
 *
 * Solo mueve lo que se dedujo. Una posición escrita es una medida y no se toca.
 * Modifica la lista en el sitio: se llama una vez, justo después de colocar.
 */
function separarAmontonados(equipos: EquipoCroquis[]): void {
  const grupos = new Map<string, EquipoCroquis[]>();
  for (const e of equipos) {
    if (!e.estimada) continue;
    const clave = `${e.x_m}|${e.y_m}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(e);
    else grupos.set(clave, [e]);
  }

  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;

    // Se separan por el eje corto y no por el largo a propósito: la distancia
    // en x de la pantalla a la caja de conexiones es la cota de la tirada, y
    // moverla por un motivo de dibujo falsearía el número que se lee en el
    // plano. El orden es el de la lista, ya ordenada por nombre, para que el
    // mismo croquis salga igual dos veces.
    const paso = Math.max(...grupo.map((e) => e.ancho_m)) + SEPARACION_EQUIPOS_M;
    const centro = (grupo.length - 1) / 2;
    grupo.forEach((e, i) => {
      e.y_m = redondear(e.y_m + (i - centro) * paso);
    });
  }
}

/**
 * Las cotas que lleva el plano de siempre: el largo y el ancho de la sala, la
 * mesa, y la distancia de la pared de la pantalla a la caja de conexiones, que
 * es la que decide los metros de la tirada y la que el instalador pregunta.
 */
function cotasDeLaEscena(
  sala: Sala,
  rect: Rectangulo,
  mesa: MesaCroquis | null,
  equipos: EquipoCroquis[],
): CotaCroquis[] {
  const cotas: CotaCroquis[] = [];

  if (rect.largo_m > 0) {
    cotas.push({
      clave: 'sala_largo',
      desde: { x_m: 0, y_m: rect.ancho_m },
      hasta: { x_m: rect.largo_m, y_m: rect.ancho_m },
      texto: `${metros(rect.largo_m)} m`,
      lado: 'arriba',
    });
  }
  if (rect.ancho_m > 0) {
    cotas.push({
      clave: 'sala_ancho',
      desde: { x_m: rect.largo_m, y_m: 0 },
      hasta: { x_m: rect.largo_m, y_m: rect.ancho_m },
      texto: `${metros(rect.ancho_m)} m`,
      lado: 'derecha',
    });
  }

  // Con la mesa girada, una cota horizontal sobre su borde mediría la
  // proyección y no la mesa: se pondría 2,08 donde la mesa mide 2,40. Se
  // omiten las dos y las medidas se leen en las anotaciones, que no engañan.
  if (mesa && !mesa.rotacion_grados) {
    cotas.push({
      clave: 'mesa_largo',
      desde: { x_m: mesa.x_m, y_m: mesa.y_m + mesa.ancho_m },
      hasta: { x_m: mesa.x_m + mesa.largo_m, y_m: mesa.y_m + mesa.ancho_m },
      texto: `${metros(mesa.largo_m)} m`,
      lado: 'arriba',
    });
    cotas.push({
      clave: 'mesa_ancho',
      desde: { x_m: mesa.x_m, y_m: mesa.y_m },
      hasta: { x_m: mesa.x_m, y_m: mesa.y_m + mesa.ancho_m },
      texto: `${metros(mesa.ancho_m)} m`,
      lado: 'izquierda',
    });
  }

  // De la pared de la pantalla a la caja de conexiones. Es la cota que el
  // croquis de mano lleva escrita en rojo, porque es la tirada larga.
  const pantalla = equipos.find((e) => e.extremo === 'pantalla');
  const caja = equipos.find((e) => e.extremo === 'caja_conexiones');
  if (pantalla && caja) {
    // Solo la distancia en x, que es lo que el croquis de mano escribe: "de la
    // pared de la TV a la caja de conexiones, 2,40 m". Sumarle el desvío lateral
    // mezclaría la cota con el recorrido del cable, y el recorrido con sus
    // subidas y su holgura ya lo da `calculo-cable.ts` en la tabla de cables.
    const recorrido = Math.abs(caja.x_m - pantalla.x_m);
    if (recorrido > 0) {
      cotas.push({
        clave: 'pantalla_caja',
        desde: { x_m: pantalla.x_m, y_m: caja.y_m },
        hasta: { x_m: caja.x_m, y_m: caja.y_m },
        texto: `${metros(recorrido)} m`,
        lado: 'abajo',
      });
    }
  }

  return cotas;
}

/**
 * Lo que no cabe en una planta: alturas. El plano es en dos dimensiones y la
 * altura de la pantalla y de la mesa son datos de montaje que hay que llevar.
 */
function anotacionesDeLaEscena(
  sala: Sala,
  mesa: MesaCroquis | null,
  equipos: EquipoCroquis[],
): string[] {
  const notas: string[] = [];

  if (sala.alto_m) notas.push(`Alto de la sala ${metros(sala.alto_m)} m`);
  if (sala.alto_falso_techo_m) {
    notas.push(`Falso techo a ${metros(sala.alto_falso_techo_m)} m`);
  }
  if (sala.mesa_alto_cm) notas.push(`Altura de la mesa ${entero(sala.mesa_alto_cm)} cm`);
  // Las cotas de la mesa girada no se dibujan; sus medidas se leen aquí.
  if (mesa && mesa.rotacion_grados) {
    notas.push(
      `Mesa ${metros(mesa.largo_m)} × ${metros(mesa.ancho_m)} m girada ${entero(mesa.rotacion_grados)}°`,
    );
  }

  for (const e of equipos) {
    if (e.extremo === 'pantalla' && e.z_m > 0) {
      notas.push(`${e.nombre} a ${entero(e.z_m * 100)} cm del suelo`);
    }
  }

  return notas;
}

// ---------------------------------------------------------------------
// Proyección a píxeles
//
// Vive aquí y no en el componente para poder probarla: que el dibujo salga
// a escala y quepa en la caja es justo lo que no se ve mirando el SVG.
// ---------------------------------------------------------------------

export interface Proyeccion {
  /** Atributo `viewBox` del SVG. */
  viewBox: string;
  ancho_px: number;
  alto_px: number;
  /** Píxeles por metro. */
  escala: number;
  x: (m: number) => number;
  /** Invierte el eje: en la sala la y crece hacia el fondo, en el SVG hacia abajo. */
  y: (m: number) => number;
  /** Una longitud en metros pasada a píxeles, sin desplazar. */
  d: (m: number) => number;
  /**
   * La vuelta: de píxeles del dibujo a metros de la sala. Vive aquí y no en el
   * editor a propósito, para que no acaben conviviendo dos fórmulas de
   * proyección que se puedan separar. El editor arrastra en píxeles y guarda
   * metros; sin la inversa tendría que reimplementar la escala.
   */
  aMetrosX: (px: number) => number;
  aMetrosY: (px: number) => number;
}

export function proyectar(
  escena: EscenaCroquis,
  { ancho_px = 900, margen_px = 64 }: { ancho_px?: number; margen_px?: number } = {},
): Proyeccion {
  const largo = escena.sala.largo_m || 1;
  const ancho = escena.sala.ancho_m || 1;
  const escala = (ancho_px - 2 * margen_px) / largo;
  const alto_px = Math.round(ancho * escala + 2 * margen_px);

  return {
    viewBox: `0 0 ${ancho_px} ${alto_px}`,
    ancho_px,
    alto_px,
    escala,
    x: (m) => redondear(margen_px + m * escala),
    // Se mide desde arriba y no desde `alto_px`: el alto está redondeado a
    // píxel entero y restarlo desplazaría el dibujo medio píxel hacia fuera.
    y: (m) => redondear(margen_px + (ancho - m) * escala),
    d: (m) => redondear(m * escala),
    aMetrosX: (px) => (px - margen_px) / escala,
    aMetrosY: (px) => ancho - (px - margen_px) / escala,
  };
}

const redondear = (n: number): number => Math.round(n * 100) / 100;

/** 4,7 se escribe 4,70: en un plano las cotas llevan dos decimales. */
const metros = (n: number): string => n.toFixed(2).replace('.', ',');

const entero = (n: number): string => String(Math.round(n));
