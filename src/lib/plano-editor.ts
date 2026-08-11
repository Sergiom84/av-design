/**
 * La geometría del editor de plano: qué pasa cuando se arrastra un equipo.
 *
 * Se llama `plano-editor` y no `diagrama` a secas porque en esta aplicación ya
 * hay un diagrama: el esquema de conexiones de la pestaña Cableado
 * (`src/lib/diagrama.ts`). La pestaña que ve el técnico se llama Diagrama; el
 * código de aquí es el plano en planta y solo eso.
 *
 * Aquí no hay React ni consultas, por lo mismo que en `calculo-cable.ts` y en
 * `croquis.ts`: arrastrar, ajustar a rejilla y recortar contra la pared se
 * pueden probar sin navegador y sin base de datos, y son justo las tres cosas
 * que no se ven mirando el SVG.
 *
 * Mismo sistema de coordenadas que el cálculo y el croquis: x a lo largo, y a
 * lo ancho, z hacia arriba, origen en la esquina inferior izquierda vista en
 * planta. Todo lo que sale de aquí está en METROS.
 */

import {
  anclarSillasEnLaSala,
  normalizarGrados,
  type EntradaCroquis,
  type SillaCroquis,
} from './croquis';
import type {
  Conexion,
  Extremo,
  FormaMueble,
  MuebleCatalogo,
  MuebleEnSala,
  OrigenDiagrama,
  Punto,
  Sala,
  SillasModo,
  EquipoEnSala,
  TomaRed,
} from './tipos';

/**
 * El paso de la rejilla: 10 cm. Es la unidad con la que se mide una sala con
 * cinta métrica y la que el departamento escribe en el croquis de mano.
 */
export const PASO_REJILLA_M = 0.1;

/** Con modificador se afina al centímetro, que es la resolución del plano. */
export const PASO_FINO_M = 0.01;

/**
 * El ancla de un objeto tiene que caer DENTRO del rectángulo de la sala; su
 * símbolo puede sobresalir.
 *
 * Es deliberado y es el único margen del editor: una pantalla va colgada a ras
 * de pared, así que su punto está en x = 0 y su símbolo de 1,45 m se sale media
 * anchura. Recortar el símbolo dibujaría la pantalla despegada del testero, que
 * es la pared donde de verdad está. `plano-sala.tsx` ya recorta el DIBUJO
 * contra la pared; el dato no se toca.
 */
export const MARGEN_FUERA_M = 0;

// ---------------------------------------------------------------------
// El borrador
//
// El editor no escribe en cada píxel del arrastre: mantiene un borrador
// local, lo compara con lo que vino del servidor y manda un solo patch al
// pulsar Guardar. Todo lo de aquí es inmutable: devuelve borradores nuevos,
// nunca modifica el que recibe, que es lo que hace que deshacer y rehacer
// sean una pila de referencias y no una copia profunda.
// ---------------------------------------------------------------------

export interface EquipoBorrador {
  id: string;
  /** Del catálogo AV. El servidor relee el artículo por aquí y no se fía del resto. */
  articulo_id: string;
  nombre: string;
  extremo: Extremo;
  cantidad: number;
  x_m: number;
  y_m: number;
  z_m: number;
  posicion_confirmada: boolean;
  rotacion_grados: number;
  toma_red_id: string | null;
  /**
   * Alta que todavía no está en la base.
   *
   * Es un campo del dato y no un prefijo en el id a propósito: mirar el
   * principio de una cadena que controla el navegador para decidir si algo se
   * inserta o se actualiza es dejar que el navegador elija la sentencia SQL.
   */
  es_nuevo: boolean;
}

/**
 * Un mueble del borrador.
 *
 * Todo lo que puede faltar es nulo y se queda nulo: un mueble sin medir no
 * mide cero, y uno sin colocar no está en (0,0,0). Ese fue el error del
 * triple cero de los equipos y no se repite aquí.
 */
export interface MuebleBorrador {
  id: string;
  mobiliario_id: string | null;
  nombre: string;
  forma: FormaMueble;
  largo_m: number | null;
  ancho_m: number | null;
  alto_m: number | null;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
  rotacion_grados: number;
  posicion_confirmada: boolean;
  origen_plantilla_mobiliario_id: string | null;
  orden: number;
  es_nuevo: boolean;
}

/** Qué falta para dar un mueble por colocado. Vacío = está puesto. */
export function estadoDelMueble(
  m: MuebleBorrador,
): 'sin_medir' | 'sin_colocar' | 'colocado' {
  if (m.largo_m == null || m.ancho_m == null || m.largo_m <= 0 || m.ancho_m <= 0) {
    return 'sin_medir';
  }
  if (!m.posicion_confirmada || m.x_m == null || m.y_m == null) return 'sin_colocar';
  return 'colocado';
}

export interface TomaBorrador {
  id: string;
  codigo: string;
  ubicacion: string | null;
  /** Nula = la roseta está dada de alta pero nadie la ha situado en el plano. */
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
  notas: string | null;
}

export interface BorradorPlano {
  largo_m: number;
  ancho_m: number;
  alto_m: number;
  aforo: number | null;
  mesa_largo_m: number | null;
  mesa_ancho_m: number | null;
  mesa_alto_cm: number | null;
  /** Centro de la mesa. Nulo = centrada en la sala, que es el caso de casi todas. */
  mesa_x_m: number | null;
  mesa_y_m: number | null;
  mesa_rotacion_grados: number;
  equipos: EquipoBorrador[];
  mobiliario: MuebleBorrador[];
  tomas: TomaBorrador[];
  /** Quién manda sobre las sillas. Nunca las dos fuentes a la vez. */
  sillas_modo: SillasModo;
  /**
   * De dónde sale el plano, cuando se decide en esta sesión. Nulo = ya estaba
   * decidido y no se vuelve a preguntar.
   */
  inicio: { origen: OrigenDiagrama; plantilla_id: string | null } | null;
}

export type Seleccion =
  | { tipo: 'sala' }
  | { tipo: 'mesa' }
  | { tipo: 'equipo'; id: string }
  | { tipo: 'mueble'; id: string }
  | { tipo: 'toma'; id: string }
  | null;

/**
 * La selección, comprobada contra lo que hay en el borrador.
 *
 * Deshacer un alta, descartar o recargar hacen desaparecer la fila que estaba
 * seleccionada. Si la selección sobrevive al objeto, el inspector se queda
 * enseñando «Ese mueble ya no está en el plano»: un error donde debería haber
 * vuelto la ficha de la sala. La sala y la mesa siempre existen.
 */
export function seleccionVigente(
  seleccion: Seleccion,
  borrador: Pick<BorradorPlano, 'equipos' | 'mobiliario' | 'tomas'>,
): Seleccion {
  if (seleccion === null) return null;
  switch (seleccion.tipo) {
    case 'mueble':
      return borrador.mobiliario.some((m) => m.id === seleccion.id) ? seleccion : null;
    case 'equipo':
      return borrador.equipos.some((e) => e.id === seleccion.id) ? seleccion : null;
    case 'toma':
      return borrador.tomas.some((t) => t.id === seleccion.id) ? seleccion : null;
    default:
      return seleccion;
  }
}

/**
 * Los equipos partidos en lo que falta por situar y lo que ya está.
 *
 * Mismo criterio que el mobiliario, y por el mismo motivo: un equipo sin
 * confirmar se dibuja donde suele ir, pero eso es una suposición y no una
 * medida. Mezclados en una sola lista, los estimados se pierden entre los
 * colocados y nadie sabe cuáles quedan.
 *
 * Los grupos vacíos no salen: un rótulo «Por colocar (0)» es ruido.
 */
export function agruparEquipos(
  equipos: readonly EquipoBorrador[],
): Array<{ titulo: string; equipos: EquipoBorrador[] }> {
  return [
    { titulo: 'Por colocar', equipos: equipos.filter((e) => !e.posicion_confirmada) },
    { titulo: 'Colocados', equipos: equipos.filter((e) => e.posicion_confirmada) },
  ].filter((g) => g.equipos.length > 0);
}

/** Lo que viene del servidor, convertido a borrador. */
export function borradorDesde(
  sala: Sala,
  equipos: EquipoEnSala[],
  tomas: TomaRed[],
  muebles: MuebleEnSala[] = [],
): BorradorPlano {
  return {
    largo_m: sala.largo_m,
    ancho_m: sala.ancho_m,
    alto_m: sala.alto_m,
    aforo: sala.aforo,
    mesa_largo_m: sala.mesa_largo_m,
    mesa_ancho_m: sala.mesa_ancho_m,
    mesa_alto_cm: sala.mesa_alto_cm,
    // El centro de la mesa es un par: media coordenada guardada en la base no
    // sitúa nada y el servidor la rechaza, así que se lee como «centrada».
    mesa_x_m: sala.mesa_x_m != null && sala.mesa_y_m != null ? sala.mesa_x_m : null,
    mesa_y_m: sala.mesa_x_m != null && sala.mesa_y_m != null ? sala.mesa_y_m : null,
    mesa_rotacion_grados: normalizarGrados(sala.mesa_rotacion_grados),
    sillas_modo: sala.sillas_modo,
    inicio: null,
    equipos: equipos.map((e) => ({
      id: e.id,
      articulo_id: e.articulo_id,
      nombre: e.nombre,
      extremo: e.extremo,
      cantidad: e.cantidad,
      x_m: e.posicion.x_m,
      y_m: e.posicion.y_m,
      z_m: e.posicion.z_m,
      posicion_confirmada: e.posicion_confirmada,
      rotacion_grados: normalizarGrados(e.rotacion_grados),
      toma_red_id: e.toma_red_id ?? null,
      es_nuevo: false,
    })),
    mobiliario: muebles.map((m) => ({
      id: m.id,
      mobiliario_id: m.mobiliario_id,
      nombre: m.nombre,
      forma: m.forma,
      largo_m: m.largo_m,
      ancho_m: m.ancho_m,
      alto_m: m.alto_m,
      x_m: m.x_m,
      y_m: m.y_m,
      z_m: m.z_m,
      rotacion_grados: normalizarGrados(m.rotacion_grados),
      posicion_confirmada: m.posicion_confirmada,
      origen_plantilla_mobiliario_id: m.origen_plantilla_mobiliario_id ?? null,
      orden: m.orden,
      es_nuevo: false,
    })),
    tomas: tomas.map((t) => {
      // Situada o no situada, sin estados intermedios: una x sin y no dibuja
      // ninguna roseta y no puede guardarse.
      const situada = t.x_m != null && t.y_m != null;
      return {
        id: t.id,
        codigo: t.codigo,
        ubicacion: t.ubicacion,
        x_m: situada ? t.x_m : null,
        y_m: situada ? t.y_m : null,
        z_m: situada ? (t.z_m ?? 0) : null,
        notas: t.notas,
      };
    }),
  };
}

/**
 * El borrador visto como escena de croquis.
 *
 * El editor no dibuja con sus propias reglas: pinta lo que pintaría el croquis
 * de Resumen, con la misma `construirEscena()`. Así una posición confirmada da
 * el mismo dibujo en el editor, en el resumen y después de recargar, que es el
 * criterio de aceptación del que cuelga todo lo demás.
 */
export function entradaCroquisDe(
  borrador: BorradorPlano,
  sala: Sala,
  conexiones: Conexion[],
): EntradaCroquis {
  return {
    sala: {
      ...sala,
      largo_m: borrador.largo_m,
      ancho_m: borrador.ancho_m,
      alto_m: borrador.alto_m,
      aforo: borrador.aforo,
      mesa_largo_m: borrador.mesa_largo_m,
      mesa_ancho_m: borrador.mesa_ancho_m,
      mesa_alto_cm: borrador.mesa_alto_cm,
      mesa_x_m: borrador.mesa_x_m,
      mesa_y_m: borrador.mesa_y_m,
      mesa_rotacion_grados: borrador.mesa_rotacion_grados,
      sillas_modo: borrador.sillas_modo,
    },
    equipos: borrador.equipos.map((e) => ({
      id: e.id,
      sala_id: sala.id,
      articulo_id: e.articulo_id,
      nombre: e.nombre,
      cantidad: e.cantidad,
      extremo: e.extremo,
      posicion: { x_m: e.x_m, y_m: e.y_m, z_m: e.z_m },
      posicion_confirmada: e.posicion_confirmada,
      rotacion_grados: e.rotacion_grados,
      toma_red_id: e.toma_red_id,
    })),
    muebles: borrador.mobiliario.map((m) => ({
      id: m.id,
      sala_id: sala.id,
      mobiliario_id: m.mobiliario_id,
      nombre: m.nombre,
      forma: m.forma,
      largo_m: m.largo_m,
      ancho_m: m.ancho_m,
      alto_m: m.alto_m,
      x_m: m.x_m,
      y_m: m.y_m,
      z_m: m.z_m,
      rotacion_grados: m.rotacion_grados,
      posicion_confirmada: m.posicion_confirmada,
      orden: m.orden,
    })),
    conexiones,
    tomas: borrador.tomas.map((t) => ({
      id: t.id,
      sala_id: sala.id,
      codigo: t.codigo,
      ubicacion: t.ubicacion,
      x_m: t.x_m,
      y_m: t.y_m,
      z_m: t.z_m,
      notas: t.notas,
    })),
  };
}

// ---------------------------------------------------------------------
// Rejilla y límites
// ---------------------------------------------------------------------

/**
 * Redondeo al centímetro: es la unidad del plano y la que evita el
 * 2,4000000004. El cero negativo se normaliza a cero: recortar −0,004 contra la
 * pared devolvía `-0`, que se guarda igual pero rompe cualquier comparación y
 * acabaría mandando al servidor un cambio que no cambia nada.
 */
export const alCentimetro = (m: number): number => {
  const r = Math.round(m * 100) / 100;
  return r === 0 ? 0 : r;
};

/**
 * Ajusta al múltiplo de paso más cercano. Un paso no finito o no positivo
 * devuelve el valor tal cual: un ajuste con paso 0 sería una división por cero
 * y un `NaN` guardado en la base de datos.
 */
export function ajustarARejilla(m: number, paso: number = PASO_REJILLA_M): number {
  if (!Number.isFinite(m)) return 0;
  if (!Number.isFinite(paso) || paso <= 0) return alCentimetro(m);
  return alCentimetro(Math.round(m / paso) * paso);
}

/** Recorta un número al intervalo. `NaN` cae al mínimo, no se propaga. */
export function limitar(valor: number, minimo: number, maximo: number): number {
  if (!Number.isFinite(valor)) return minimo;
  if (maximo < minimo) return minimo;
  return Math.min(Math.max(valor, minimo), maximo);
}

/**
 * Mete el ancla dentro de la sala. Una sala sin medir (largo o ancho a cero) no
 * recorta nada: recortarlo todo a cero amontonaría los equipos en la esquina
 * justo cuando aún no se sabe cuánto mide la sala.
 */
export function limitarALaSala(
  punto: { x_m: number; y_m: number; z_m?: number },
  sala: { largo_m: number; ancho_m: number; alto_m?: number },
): Punto {
  const largo = sala.largo_m > 0 ? sala.largo_m : Number.POSITIVE_INFINITY;
  const ancho = sala.ancho_m > 0 ? sala.ancho_m : Number.POSITIVE_INFINITY;
  const alto = sala.alto_m && sala.alto_m > 0 ? sala.alto_m : Number.POSITIVE_INFINITY;

  return {
    x_m: alCentimetro(limitar(punto.x_m, -MARGEN_FUERA_M, largo + MARGEN_FUERA_M)),
    y_m: alCentimetro(limitar(punto.y_m, -MARGEN_FUERA_M, ancho + MARGEN_FUERA_M)),
    z_m: alCentimetro(limitar(punto.z_m ?? 0, 0, alto)),
  };
}

/** ¿El ancla cae dentro del rectángulo? Tocar el borde cuenta como dentro. */
export function dentroDeLaSala(
  punto: { x_m: number; y_m: number },
  sala: { largo_m: number; ancho_m: number },
): boolean {
  if (!Number.isFinite(punto.x_m) || !Number.isFinite(punto.y_m)) return false;
  if (sala.largo_m <= 0 || sala.ancho_m <= 0) return true;
  return (
    punto.x_m >= -MARGEN_FUERA_M &&
    punto.x_m <= sala.largo_m + MARGEN_FUERA_M &&
    punto.y_m >= -MARGEN_FUERA_M &&
    punto.y_m <= sala.ancho_m + MARGEN_FUERA_M
  );
}

// ---------------------------------------------------------------------
// Teclado
// ---------------------------------------------------------------------

/**
 * Cuánto mueve cada flecha. Arriba suma en y: en el plano la y crece hacia el
 * fondo de la sala y el dibujo se pinta con el eje invertido, así que la flecha
 * de arriba lleva el objeto hacia arriba en pantalla, que es lo que espera
 * quien la pulsa.
 *
 * Devuelve nulo si la tecla no es una flecha, para que el componente pueda
 * decidir si consume el evento o lo deja pasar.
 */
export function desplazamientoDeTecla(
  tecla: string,
  fino = false,
): { dx_m: number; dy_m: number } | null {
  const paso = fino ? PASO_FINO_M : PASO_REJILLA_M;
  switch (tecla) {
    case 'ArrowLeft':
      return { dx_m: -paso, dy_m: 0 };
    case 'ArrowRight':
      return { dx_m: paso, dy_m: 0 };
    case 'ArrowUp':
      return { dx_m: 0, dy_m: paso };
    case 'ArrowDown':
      return { dx_m: 0, dy_m: -paso };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------
// Movimientos sobre el borrador
// ---------------------------------------------------------------------

/**
 * Coloca un equipo. Mover un equipo lo da por colocado: quien lo arrastra ha
 * decidido dónde va, y dejarlo como estimado obligaría a confirmarlo aparte
 * para que dejara de salir con trazo discontinuo.
 */
export function moverEquipo(
  borrador: BorradorPlano,
  id: string,
  punto: { x_m: number; y_m: number; z_m?: number },
  { ajustar = true, paso = PASO_REJILLA_M }: { ajustar?: boolean; paso?: number } = {},
): BorradorPlano {
  let tocado = false;
  const equipos = borrador.equipos.map((e) => {
    if (e.id !== id) return e;
    tocado = true;
    const bruto = {
      x_m: ajustar ? ajustarARejilla(punto.x_m, paso) : punto.x_m,
      y_m: ajustar ? ajustarARejilla(punto.y_m, paso) : punto.y_m,
      z_m: punto.z_m ?? e.z_m,
    };
    const dentro = limitarALaSala(bruto, borrador);
    return { ...e, ...dentro, posicion_confirmada: true };
  });
  // Un id que no existe devuelve el mismo borrador, no una copia: la pila de
  // deshacer compara referencias y una copia por movimiento fallido metería un
  // paso en blanco en el historial.
  return tocado ? { ...borrador, equipos } : borrador;
}

/**
 * Dónde acaba un punto al desplazarlo, ajustando SOLO el eje que se mueve.
 *
 * La flecha derecha mueve en x y no puede tocar la y. Ajustar los dos ejes
 * parecía lo natural, pero corría 5 cm la altura de una pantalla medida a
 * 1,25 m cada vez que se pulsaba una flecha horizontal: un movimiento que
 * nadie pidió sobre un dato que alguien midió.
 */
function desplazado(
  desde: { x_m: number; y_m: number },
  { dx_m, dy_m }: { dx_m: number; dy_m: number },
  { ajustar = true, paso = PASO_REJILLA_M }: { ajustar?: boolean; paso?: number } = {},
): { x_m: number; y_m: number } {
  const eje = (valor: number, delta: number) =>
    delta === 0 ? valor : ajustar ? ajustarARejilla(valor + delta, paso) : valor + delta;
  return { x_m: eje(desde.x_m, dx_m), y_m: eje(desde.y_m, dy_m) };
}

/** Desplaza un equipo, que es lo que hacen las flechas del teclado. */
export function desplazarEquipo(
  borrador: BorradorPlano,
  id: string,
  paso: { dx_m: number; dy_m: number },
  opciones?: { ajustar?: boolean; paso?: number },
): BorradorPlano {
  const e = borrador.equipos.find((x) => x.id === id);
  if (!e) return borrador;
  return moverEquipo(borrador, id, { ...desplazado(e, paso, opciones), z_m: e.z_m }, {
    ajustar: false,
  });
}

/** Desplaza una roseta situada. Una sin situar no se mueve: no está en ningún sitio. */
export function desplazarToma(
  borrador: BorradorPlano,
  id: string,
  paso: { dx_m: number; dy_m: number },
  opciones?: { ajustar?: boolean; paso?: number },
): BorradorPlano {
  const t = borrador.tomas.find((x) => x.id === id);
  if (!t || t.x_m == null || t.y_m == null) return borrador;
  return moverToma(
    borrador,
    id,
    { ...desplazado({ x_m: t.x_m, y_m: t.y_m }, paso, opciones), z_m: t.z_m ?? 0 },
    { ajustar: false },
  );
}

/** Desplaza la mesa por su centro. */
export function desplazarMesa(
  borrador: BorradorPlano,
  paso: { dx_m: number; dy_m: number },
  opciones?: { ajustar?: boolean; paso?: number },
): BorradorPlano {
  if (!borrador.mesa_largo_m || !borrador.mesa_ancho_m) return borrador;
  const centro = {
    x_m: borrador.mesa_x_m ?? borrador.largo_m / 2,
    y_m: borrador.mesa_y_m ?? borrador.ancho_m / 2,
  };
  return moverMesa(borrador, desplazado(centro, paso, opciones), { ajustar: false });
}

/** Edita los campos numéricos de un equipo desde el inspector. */
export function editarEquipo(
  borrador: BorradorPlano,
  id: string,
  cambios: Partial<Pick<EquipoBorrador, 'x_m' | 'y_m' | 'z_m' | 'extremo' | 'toma_red_id' | 'posicion_confirmada'>>,
): BorradorPlano {
  const equipos = borrador.equipos.map((e) => {
    if (e.id !== id) return e;
    const combinado = { ...e, ...cambios };
    const dentro = limitarALaSala(combinado, borrador);
    return {
      ...combinado,
      ...dentro,
      // Escribir una coordenada a mano es colocarlo, igual que arrastrarlo.
      posicion_confirmada:
        cambios.posicion_confirmada ??
        (cambios.x_m != null || cambios.y_m != null || cambios.z_m != null
          ? true
          : e.posicion_confirmada),
    };
  });
  return { ...borrador, equipos };
}

/**
 * Da por buenas las posiciones que hoy son deducidas.
 *
 * Es la acción única de la primera apertura: una sala recién creada desde
 * plantilla trae los equipos en su sitio típico y el técnico que ya sabe que
 * están bien no tiene que arrastrar los cuatro uno a uno. Se necesitan las
 * posiciones que dibuja el croquis, porque lo que se confirma es lo que se ve.
 */
export function confirmarEstimadas(
  borrador: BorradorPlano,
  posiciones: Map<string, { x_m: number; y_m: number; z_m: number }>,
): BorradorPlano {
  const equipos = borrador.equipos.map((e) => {
    if (e.posicion_confirmada) return e;
    const p = posiciones.get(e.id);
    if (!p) return e;
    return { ...e, ...limitarALaSala(p, borrador), posicion_confirmada: true };
  });
  return { ...borrador, equipos };
}

/** Coloca una roseta. A diferencia de un equipo, puede quedarse sin situar. */
export function moverToma(
  borrador: BorradorPlano,
  id: string,
  punto: { x_m: number; y_m: number; z_m?: number },
  { ajustar = true, paso = PASO_REJILLA_M }: { ajustar?: boolean; paso?: number } = {},
): BorradorPlano {
  const tomas = borrador.tomas.map((t) => {
    if (t.id !== id) return t;
    const dentro = limitarALaSala(
      {
        x_m: ajustar ? ajustarARejilla(punto.x_m, paso) : punto.x_m,
        y_m: ajustar ? ajustarARejilla(punto.y_m, paso) : punto.y_m,
        z_m: punto.z_m ?? t.z_m ?? 0,
      },
      borrador,
    );
    return { ...t, ...dentro };
  });
  return { ...borrador, tomas };
}

export function editarToma(
  borrador: BorradorPlano,
  id: string,
  cambios: Partial<Pick<TomaBorrador, 'x_m' | 'y_m' | 'z_m'>>,
): BorradorPlano {
  const tomas = borrador.tomas.map((t) => {
    if (t.id !== id) return t;
    const combinado = { ...t, ...cambios };
    // Una roseta puede volver a quedarse sin situar: borrar la casilla la
    // saca del plano sin borrar la roseta, que sigue existiendo en la sala.
    // Se van las tres coordenadas juntas: una z suelta sin x ni y no es una
    // altura medida, es el resto de una posición borrada, y el servidor
    // rechaza las coordenadas a medias.
    if (combinado.x_m == null || combinado.y_m == null) {
      return { ...combinado, x_m: null, y_m: null, z_m: null };
    }
    combinado.z_m = combinado.z_m ?? 0;
    const dentro = limitarALaSala(
      { x_m: combinado.x_m, y_m: combinado.y_m, z_m: combinado.z_m ?? 0 },
      borrador,
    );
    return { ...combinado, ...dentro };
  });
  return { ...borrador, tomas };
}

/** Mueve el centro de la mesa. Sin medidas de mesa no hay nada que mover. */
export function moverMesa(
  borrador: BorradorPlano,
  centro: { x_m: number; y_m: number },
  { ajustar = true, paso = PASO_REJILLA_M }: { ajustar?: boolean; paso?: number } = {},
): BorradorPlano {
  if (!borrador.mesa_largo_m || !borrador.mesa_ancho_m) return borrador;
  const dentro = limitarALaSala(
    {
      x_m: ajustar ? ajustarARejilla(centro.x_m, paso) : centro.x_m,
      y_m: ajustar ? ajustarARejilla(centro.y_m, paso) : centro.y_m,
    },
    borrador,
  );
  return { ...borrador, mesa_x_m: dentro.x_m, mesa_y_m: dentro.y_m };
}

export function girarMesa(borrador: BorradorPlano, grados: number): BorradorPlano {
  return { ...borrador, mesa_rotacion_grados: normalizarGrados(grados) };
}

// ---------------------------------------------------------------------
// Altas, bajas y giro
//
// Añadir no escribe en la base: entra en el borrador con un id temporal y
// se guarda en la misma transacción que el resto. Hasta entonces se puede
// deshacer, que es lo que espera quien acaba de teclear «silla» y ve que no
// era esa.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Los tres límites del mobiliario, en un solo sitio
//
// Estaban repartidos entre el componente (50), el esquema del servidor (200)
// y ningún sitio (el aforo, que llegaba a 10.000). Con los números sueltos,
// la interfaz podía construir un borrador que el servidor rechazaba solo por
// cantidad: aforo 300 + una silla = 301 altas contra un tope de 200, y el
// técnico se enteraba al pulsar Guardar, con el trabajo ya hecho.
//
// Los valores salen de los datos reales, no de una intuición: el aforo más
// alto del inventario es 8 en las salas y 24 en las plantillas
// (`data/plantillas-salas.csv`). Ninguna sala real se acerca al tope, así que
// no se trunca nada; una sala de más de 150 sitios es un auditorio, y un
// auditorio no se amuebla silla a silla desde este editor.
// ---------------------------------------------------------------------

/**
 * Máximo de muebles que se dan de alta de una vez.
 *
 * Es un tope de teclazo: un 500 escrito de más en la casilla de cantidad no
 * puede convertirse en 500 filas arrastrables.
 */
export const MAXIMO_ALTA_MOBILIARIO = 50;

/**
 * Hasta qué aforo se convierten las sillas derivadas en filas editables.
 *
 * Por encima, añadir una silla no materializa nada y se explica por qué: es
 * preferible decir que no se puede a dejar el editor generando ciento de
 * filas que después no caben en un guardado.
 */
export const MAXIMO_AFORO_MATERIALIZABLE = 150;

/**
 * Máximo de altas de mobiliario que admite un guardado.
 *
 * Se DERIVA de los otros dos en vez de escribirse a mano, que es lo que
 * garantiza que el peor caso de la interfaz —materializar el aforo entero y
 * añadir un alta completa en el mismo borrador— siga cabiendo. Cambiar uno de
 * los dos ajusta este solo.
 */
export const MAXIMO_MOBILIARIO_POR_PATCH =
  MAXIMO_AFORO_MATERIALIZABLE + MAXIMO_ALTA_MOBILIARIO;

/**
 * Da de alta uno o varios muebles.
 *
 * Cada unidad es una fila: ocho sillas son ocho instancias arrastrables y
 * rotables, no una línea con `cantidad = 8`. Las medidas se copian del
 * catálogo y se quedan como snapshot; el catálogo puede corregirse mañana sin
 * deformar los planos ya dibujados.
 *
 * Los ids los pone quien llama (`crypto.randomUUID()` en el navegador): esta
 * función es pura y no puede inventar identificadores.
 */
export function anadirMuebles(
  borrador: BorradorPlano,
  catalogo: MuebleCatalogo,
  ids: string[],
): BorradorPlano {
  const nuevos = ids.slice(0, MAXIMO_ALTA_MOBILIARIO).map((id, i) => ({
    id,
    mobiliario_id: catalogo.id,
    nombre: catalogo.nombre,
    forma: catalogo.forma,
    largo_m: catalogo.largo_m_defecto,
    ancho_m: catalogo.ancho_m_defecto,
    alto_m: catalogo.alto_m_defecto,
    x_m: null,
    y_m: null,
    z_m: null,
    rotacion_grados: 0,
    posicion_confirmada: false,
    origen_plantilla_mobiliario_id: null,
    orden: borrador.mobiliario.length + i,
    es_nuevo: true,
  }));
  if (nuevos.length === 0) return borrador;
  return { ...borrador, mobiliario: [...borrador.mobiliario, ...nuevos] };
}

/**
 * Lo que hay que hacer con un mueble elegido en el buscador.
 *
 * Devuelve la selección además del borrador porque el alta no siempre crea
 * una fila: elegir `Mesa principal` selecciona la mesa que la sala ya tiene.
 * El aviso es el texto que se enseña; nulo cuando no hay nada que explicar
 * más allá de que la fila apareció en la lista.
 */
export interface ResultadoAlta {
  borrador: BorradorPlano;
  seleccion: Seleccion;
  aviso: string;
}

/**
 * Añadir un mueble del catálogo al plano, con las tres reglas que no se ven
 * mirando el SVG:
 *
 * 1. `Mesa principal` no se instancia. La mesa de la sala vive en
 *    `salas.mesa_*` y es el elemento canónico: crear una fila más daría dos
 *    mesas principales editables, las dos dibujadas, y ninguna de las dos
 *    sería la que usa el croquis para repartir las sillas. Se selecciona la
 *    que hay y se abre su inspector.
 * 2. Un asiento apaga las sillas derivadas del aforo, pero antes las
 *    MATERIALIZA en su sitio. Sin esto, añadir una silla a una sala de aforo
 *    ocho dibujaba nueve: las ocho del aforo más la nueva. Y apagarlas sin
 *    materializarlas las habría hecho desaparecer.
 * 3. La cantidad se recorta ANTES de inventar identificadores. Un 5000
 *    pegado en la casilla no puede convertirse en cinco mil `randomUUID()`
 *    antes de quedarse en cincuenta.
 *
 * Las sillas derivadas que se materializan se quedan con la referencia de
 * asiento que se acaba de elegir, que es la única que hay a mano y la que el
 * técnico está usando. El nombre se edita después como el de cualquier fila.
 *
 * El generador de identificadores se inyecta porque esto es lógica pura y no
 * puede llamar a `crypto.randomUUID()`: el navegador lo pasa, la prueba pasa
 * un contador.
 */
export function anadirDelCatalogo(
  borrador: BorradorPlano,
  catalogo: MuebleCatalogo,
  cantidad: number,
  opciones: { nuevoId: () => string; sillasDerivadas?: readonly SillaCroquis[] },
): ResultadoAlta {
  if (catalogo.rol === 'mesa_principal') {
    return {
      borrador,
      seleccion: { tipo: 'mesa' },
      aviso:
        'La sala ya tiene su mesa principal: se abre para editarla. Para una segunda mesa, elige Mesa rectangular o Mesa redonda.',
    };
  }

  const cuantos = Math.min(
    MAXIMO_ALTA_MOBILIARIO,
    Math.max(1, Math.floor(Number.isFinite(cantidad) ? cantidad : 1)),
  );

  // Cuántas sillas del aforo habría que convertir en filas para que el alta no
  // deje dos fuentes vivas. Se cuenta ANTES de generar nada.
  const materializa = catalogo.rol === 'asiento' && borrador.sillas_modo === 'derivadas';
  const derivadas = materializa ? (opciones.sillasDerivadas ?? []) : [];

  if (derivadas.length > MAXIMO_AFORO_MATERIALIZABLE) {
    return {
      borrador,
      seleccion: null,
      aviso: `Esta sala tiene ${derivadas.length} sillas repartidas por el aforo y el editor convierte como mucho ${MAXIMO_AFORO_MATERIALIZABLE}. Baja el aforo o coloca las sillas desde una plantilla.`,
    };
  }

  // El borrador puede traer altas de guardados anteriores todavía sin guardar:
  // el tope es del patch entero, no de cada pulsación. Sin esta cuenta, añadir
  // cincuenta cuatro veces seguidas construía un borrador de doscientas altas
  // que el servidor rechazaba al guardar, con el trabajo ya hecho.
  const altasPendientes = borrador.mobiliario.filter((m) => m.es_nuevo).length;
  const totalAltas = altasPendientes + derivadas.length + cuantos;
  if (totalAltas > MAXIMO_MOBILIARIO_POR_PATCH) {
    return {
      borrador,
      seleccion: null,
      aviso: `Un guardado admite ${MAXIMO_MOBILIARIO_POR_PATCH} altas de mobiliario y con esto serían ${totalAltas}. Guarda lo que ya has añadido y sigue después.`,
    };
  }

  // El asiento manda sobre el aforo, así que primero se convierten en filas
  // las sillas que el croquis está dibujando ahora mismo: el dibujo de antes
  // y el de después son el mismo, más la que se acaba de añadir.
  let base = borrador;
  let materializadas = 0;
  if (materializa) {
    base = materializarSillas(
      borrador,
      [...derivadas],
      catalogo,
      derivadas.map(() => opciones.nuevoId()),
    );
    materializadas = derivadas.length;
  }

  const ids = Array.from({ length: cuantos }, () => opciones.nuevoId());
  const siguiente = anadirMuebles(base, catalogo, ids);

  // «Silla en la lista» y no «Silla añadida»: el catálogo crece con armarios y
  // atriles, y una plantilla de texto con género acaba diciendo «Armario
  // añadida». El estado se cuenta sin concordar.
  const alta = cuantos === 1 ? catalogo.nombre : `${cuantos} × ${catalogo.nombre}`;

  return {
    borrador: siguiente,
    seleccion: { tipo: 'mueble', id: ids[0] },
    aviso:
      materializadas > 0
        ? `${alta} en la lista. Las ${materializadas} sillas del aforo pasan a ser filas editables: a partir de ahora manda la lista, no el aforo. Sin guardar todavía.`
        : `${alta} en la lista. Sin guardar todavía.`,
  };
}

/**
 * Da de alta un equipo del catálogo AV.
 *
 * Se guardan el `articulo_id` y lo que hace falta para pintarlo, pero el
 * servidor no se fía de nada de esto: relee el artículo por su id y exige que
 * esté activo y sea de tipo equipo. Lo de aquí es para que el técnico lo vea
 * en el lateral antes de guardar.
 */
export function anadirEquipo(
  borrador: BorradorPlano,
  equipo: { id: string; articulo_id: string; nombre: string; extremo: Extremo },
): BorradorPlano {
  return {
    ...borrador,
    equipos: [
      ...borrador.equipos,
      {
        ...equipo,
        cantidad: 1,
        x_m: 0,
        y_m: 0,
        z_m: 0,
        // Sin confirmar: el croquis lo deduce del extremo y lo dibuja
        // discontinuo hasta que alguien lo coloque.
        posicion_confirmada: false,
        rotacion_grados: 0,
        toma_red_id: null,
        es_nuevo: true,
      },
    ],
  };
}

/**
 * Quita un alta que todavía no está guardada.
 *
 * Solo alcanza a lo temporal. Un equipo persistido no se borra desde el plano:
 * puede tener conexiones colgando, y sus bajas viven en la pestaña
 * Equipamiento con sus avisos. Un mueble persistido sí se puede quitar, porque
 * no es extremo de ninguna tirada.
 */
export function quitarAlta(borrador: BorradorPlano, seleccion: Seleccion): BorradorPlano {
  if (seleccion?.tipo === 'equipo') {
    const e = borrador.equipos.find((x) => x.id === seleccion.id);
    if (!e?.es_nuevo) return borrador;
    return { ...borrador, equipos: borrador.equipos.filter((x) => x.id !== seleccion.id) };
  }
  if (seleccion?.tipo === 'mueble') {
    if (!borrador.mobiliario.some((x) => x.id === seleccion.id)) return borrador;
    return {
      ...borrador,
      mobiliario: borrador.mobiliario.filter((x) => x.id !== seleccion.id),
    };
  }
  return borrador;
}

/** Coloca un mueble. La primera colocación es la que lo confirma. */
export function moverMueble(
  borrador: BorradorPlano,
  id: string,
  punto: { x_m: number; y_m: number; z_m?: number },
  { ajustar = true, paso = PASO_REJILLA_M }: { ajustar?: boolean; paso?: number } = {},
): BorradorPlano {
  let tocado = false;
  const mobiliario = borrador.mobiliario.map((m) => {
    if (m.id !== id) return m;
    tocado = true;
    const dentro = limitarALaSala(
      {
        x_m: ajustar ? ajustarARejilla(punto.x_m, paso) : punto.x_m,
        y_m: ajustar ? ajustarARejilla(punto.y_m, paso) : punto.y_m,
        z_m: punto.z_m ?? m.z_m ?? 0,
      },
      borrador,
    );
    return { ...m, ...dentro, posicion_confirmada: true };
  });
  return tocado ? { ...borrador, mobiliario } : borrador;
}

/** Desplaza un mueble ya colocado. Uno sin colocar no está en ningún sitio. */
export function desplazarMueble(
  borrador: BorradorPlano,
  id: string,
  paso: { dx_m: number; dy_m: number },
  opciones?: { ajustar?: boolean; paso?: number },
): BorradorPlano {
  const m = borrador.mobiliario.find((x) => x.id === id);
  if (!m || m.x_m == null || m.y_m == null) return borrador;
  return moverMueble(
    borrador,
    id,
    { ...desplazado({ x_m: m.x_m, y_m: m.y_m }, paso, opciones), z_m: m.z_m ?? 0 },
    { ajustar: false },
  );
}

/** Edita los campos de un mueble desde el inspector. */
export function editarMueble(
  borrador: BorradorPlano,
  id: string,
  cambios: Partial<
    Pick<
      MuebleBorrador,
      'nombre' | 'largo_m' | 'ancho_m' | 'alto_m' | 'x_m' | 'y_m' | 'z_m' | 'posicion_confirmada'
    >
  >,
): BorradorPlano {
  const mobiliario = borrador.mobiliario.map((m) => {
    if (m.id !== id) return m;
    const combinado = { ...m, ...cambios };
    // Igual que en las rosetas: quitar la coordenada lo devuelve a «sin
    // colocar» en vez de dejarlo medio situado.
    if (combinado.x_m == null || combinado.y_m == null) {
      return { ...combinado, x_m: null, y_m: null, z_m: null, posicion_confirmada: false };
    }
    const dentro = limitarALaSala(
      { x_m: combinado.x_m, y_m: combinado.y_m, z_m: combinado.z_m ?? 0 },
      borrador,
    );
    return {
      ...combinado,
      ...dentro,
      posicion_confirmada:
        cambios.posicion_confirmada ??
        (cambios.x_m != null || cambios.y_m != null ? true : combinado.posicion_confirmada),
    };
  });
  return { ...borrador, mobiliario };
}

/**
 * Gira un elemento sobre su ancla.
 *
 * Girar no mueve nada: x, y y z se quedan como estaban y solo cambia hacia
 * dónde mira el símbolo. El ancla sigue dentro de la sala aunque el dibujo
 * sobresalga, que es el mismo criterio que con la pantalla pegada a la pared.
 */
export function girar(
  borrador: BorradorPlano,
  seleccion: Seleccion,
  grados: number,
): BorradorPlano {
  const g = normalizarGrados(grados);
  if (seleccion?.tipo === 'mesa') return girarMesa(borrador, g);
  if (seleccion?.tipo === 'equipo') {
    return {
      ...borrador,
      equipos: borrador.equipos.map((e) =>
        e.id === seleccion.id ? { ...e, rotacion_grados: g } : e,
      ),
    };
  }
  if (seleccion?.tipo === 'mueble') {
    return {
      ...borrador,
      mobiliario: borrador.mobiliario.map((m) =>
        m.id === seleccion.id ? { ...m, rotacion_grados: g } : m,
      ),
    };
  }
  // La sala no gira y una roseta sin símbolo orientado tampoco: un control
  // que no produce ningún cambio visible es un control falso.
  return borrador;
}

/**
 * Coloca en el centro de la sala lo que esté seleccionado.
 *
 * Es la alternativa accesible al arrastre: con teclado o desde el móvil se
 * selecciona en el lateral, se coloca en el centro y desde ahí se ajusta con
 * las flechas o escribiendo la coordenada.
 */
export function colocarEnElCentro(
  borrador: BorradorPlano,
  seleccion: Seleccion,
): BorradorPlano {
  const centro = { x_m: borrador.largo_m / 2, y_m: borrador.ancho_m / 2 };
  if (seleccion?.tipo === 'equipo') return moverEquipo(borrador, seleccion.id, centro);
  if (seleccion?.tipo === 'mueble') return moverMueble(borrador, seleccion.id, centro);
  if (seleccion?.tipo === 'toma') return moverToma(borrador, seleccion.id, centro);
  if (seleccion?.tipo === 'mesa') return moverMesa(borrador, centro);
  return borrador;
}

/**
 * Convierte las sillas derivadas del aforo en muebles editables.
 *
 * Las posiciones NO se recalculan aquí: entran las que ya dibuja
 * `sillasAlrededor()` en `croquis.ts`, que es la geometría con pruebas. Por
 * eso la silla materializada cae exactamente donde estaba antes de tocarla:
 * el croquis de antes y el de después son el mismo dibujo.
 *
 * Al terminar, el modo pasa a `manuales` y el aforo vuelve a ser solo la
 * capacidad de la sala: cambiarlo ya no añade, borra ni recoloca sillas
 * reales.
 */
export function materializarSillas(
  borrador: BorradorPlano,
  sillas: SillaCroquis[],
  catalogo: MuebleCatalogo,
  ids: string[],
): BorradorPlano {
  if (borrador.sillas_modo === 'manuales') return borrador;
  // Se vuelven a anclar aquí aunque el croquis ya las entregue ancladas: esta
  // función es pública y quien la llame con posiciones crudas no puede acabar
  // escribiendo una silla fuera de la sala. Sobre lo ya ajustado no hace nada.
  const nuevas = anclarSillasEnLaSala(sillas, borrador)
    .slice(0, ids.length)
    .map((s, i) => ({
      id: ids[i],
      mobiliario_id: catalogo.id,
      nombre: catalogo.nombre,
      forma: catalogo.forma,
      // El diámetro del círculo que ya dibuja el croquis, no una medida
      // inventada: es la misma silla, ahora editable.
      largo_m: alCentimetro(s.radio_m * 2),
      ancho_m: alCentimetro(s.radio_m * 2),
      alto_m: catalogo.alto_m_defecto,
      x_m: alCentimetro(s.x_m),
      y_m: alCentimetro(s.y_m),
      z_m: 0,
      rotacion_grados: 0,
      posicion_confirmada: true,
      origen_plantilla_mobiliario_id: null,
      orden: borrador.mobiliario.length + i,
      es_nuevo: true,
    }));
  return {
    ...borrador,
    sillas_modo: 'manuales',
    mobiliario: [...borrador.mobiliario, ...nuevas],
  };
}

/**
 * Cambia los ids temporales por los que puso Postgres.
 *
 * Se aplica al volver de un guardado correcto. Sin esto, seguir arrastrando
 * la silla recién creada mandaría otra vez su id temporal y el servidor la
 * daría de alta por segunda vez: dos sillas donde el técnico ve una.
 */
export function aplicarIdsReales(
  borrador: BorradorPlano,
  ids: Record<string, string>,
): BorradorPlano {
  if (Object.keys(ids).length === 0) return borrador;
  return {
    ...borrador,
    equipos: borrador.equipos.map((e) =>
      ids[e.id] ? { ...e, id: ids[e.id], es_nuevo: false } : e,
    ),
    mobiliario: borrador.mobiliario.map((m) =>
      ids[m.id] ? { ...m, id: ids[m.id], es_nuevo: false } : m,
    ),
    // El inicio ya está escrito: mandarlo otra vez no lo cambiaría, pero
    // dejaría el botón de guardar encendido para siempre.
    inicio: null,
  };
}

/** Deja constancia de cómo se preparó el plano. Se decide una sola vez. */
export function iniciarDiagrama(
  borrador: BorradorPlano,
  origen: OrigenDiagrama,
  plantilla_id: string | null = null,
): BorradorPlano {
  return { ...borrador, inicio: { origen, plantilla_id } };
}

/**
 * Cambia las medidas de la sala y arrastra lo que se quede fuera.
 *
 * Encoger una sala de 6 a 4 metros dejaría equipos flotando en la calle. Se
 * recortan, y como el recorte cambia coordenadas que alimentan el cálculo de
 * cable, el editor lo avisa con `avisosDelBorrador`.
 */
export function cambiarMedidasSala(
  borrador: BorradorPlano,
  medidas: Partial<Pick<BorradorPlano, 'largo_m' | 'ancho_m' | 'alto_m' | 'aforo'>>,
): BorradorPlano {
  const base: BorradorPlano = {
    ...borrador,
    largo_m: medidaValida(medidas.largo_m ?? borrador.largo_m),
    ancho_m: medidaValida(medidas.ancho_m ?? borrador.ancho_m),
    alto_m: medidaValida(medidas.alto_m ?? borrador.alto_m),
    aforo: medidas.aforo === undefined ? borrador.aforo : medidas.aforo,
  };

  return {
    ...base,
    equipos: base.equipos.map((e) => ({ ...e, ...limitarALaSala(e, base) })),
    mobiliario: base.mobiliario.map((m) =>
      m.x_m == null || m.y_m == null
        ? m
        : { ...m, ...limitarALaSala({ x_m: m.x_m, y_m: m.y_m, z_m: m.z_m ?? 0 }, base) },
    ),
    tomas: base.tomas.map((t) =>
      t.x_m == null || t.y_m == null
        ? t
        : { ...t, ...limitarALaSala({ x_m: t.x_m, y_m: t.y_m, z_m: t.z_m ?? 0 }, base) },
    ),
    mesa_x_m:
      base.mesa_x_m == null
        ? null
        : limitarALaSala({ x_m: base.mesa_x_m, y_m: base.mesa_y_m ?? 0 }, base).x_m,
    mesa_y_m:
      base.mesa_y_m == null
        ? null
        : limitarALaSala({ x_m: base.mesa_x_m ?? 0, y_m: base.mesa_y_m }, base).y_m,
  };
}

export function cambiarMesa(
  borrador: BorradorPlano,
  cambios: Partial<Pick<BorradorPlano, 'mesa_largo_m' | 'mesa_ancho_m' | 'mesa_alto_cm'>>,
): BorradorPlano {
  return { ...borrador, ...cambios };
}

/** Una medida es un número finito y no negativa. Lo demás es cero, no `NaN`. */
function medidaValida(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  return alCentimetro(n);
}

// ---------------------------------------------------------------------
// Avisos
//
// Avisan, no bloquean, por el mismo criterio que la validación de conexiones:
// el técnico puede estar a medio medir y la sala a medio definir.
// ---------------------------------------------------------------------

export function avisosDelBorrador(borrador: BorradorPlano): string[] {
  const avisos: string[] = [];

  if (!borrador.largo_m || !borrador.ancho_m) {
    avisos.push('Faltan el largo o el ancho de la sala: el plano no está a escala.');
  }
  if (!borrador.alto_m) {
    avisos.push('Sin el alto de la sala no se calculan las subidas del cable.');
  }

  const fuera = borrador.equipos.filter((e) => !dentroDeLaSala(e, borrador));
  if (fuera.length > 0) {
    avisos.push(
      fuera.length === 1
        ? `${fuera[0].nombre} queda fuera de la sala.`
        : `${fuera.length} equipos quedan fuera de la sala.`,
    );
  }

  const sinMedirMuebles = borrador.mobiliario.filter(
    (m) => estadoDelMueble(m) === 'sin_medir',
  ).length;
  if (sinMedirMuebles > 0) {
    avisos.push(
      sinMedirMuebles === 1
        ? 'Un mueble no tiene largo y ancho: no se puede dar por colocado.'
        : `${sinMedirMuebles} muebles no tienen largo y ancho: no se pueden dar por colocados.`,
    );
  }

  const estimados = borrador.equipos.filter((e) => !e.posicion_confirmada).length;
  if (estimados > 0) {
    avisos.push(
      estimados === 1
        ? 'Un equipo sigue con la posición estimada.'
        : `${estimados} equipos siguen con la posición estimada.`,
    );
  }

  return avisos;
}

// ---------------------------------------------------------------------
// El patch que viaja al servidor
// ---------------------------------------------------------------------

export interface PatchEquipoPlano {
  id: string;
  x_m: number;
  y_m: number;
  z_m: number;
  posicion_confirmada: boolean;
  rotacion_grados: number;
}

/**
 * Un equipo que todavía no existe. Viaja el `articulo_id` y el id temporal, y
 * nada más: el nombre, la categoría y el extremo los vuelve a sacar el
 * servidor del catálogo. Un nombre que manda el navegador es un nombre que
 * puede no corresponder con la referencia que se va a pedir.
 */
export interface PatchEquipoAlta extends PatchEquipoPlano {
  articulo_id: string;
  extremo: Extremo;
}

export interface PatchMueblePlano {
  id: string;
  nombre: string;
  largo_m: number | null;
  ancho_m: number | null;
  alto_m: number | null;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
  rotacion_grados: number;
  posicion_confirmada: boolean;
  orden: number;
}

/** Un mueble nuevo. `mobiliario_id` es lo único que el servidor relee. */
export interface PatchMuebleAlta extends PatchMueblePlano {
  /**
   * Nulo no es un alta válida y el servidor la rechaza entera: sin referencia
   * del catálogo no hay de dónde releer el nombre ni la forma, y quedarse con
   * los que manda el navegador sería confiar en el navegador. Se tipa nulable
   * porque un mueble legado puede no tenerla, pero uno legado nunca es alta.
   */
  mobiliario_id: string | null;
  forma: FormaMueble;
}

export interface PatchTomaPlano {
  id: string;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
}

export interface PatchPlano {
  sala_id: string;
  versionEsperada: number;
  sala: {
    largo_m: number;
    ancho_m: number;
    alto_m: number;
    aforo: number | null;
    mesa_largo_m: number | null;
    mesa_ancho_m: number | null;
    mesa_alto_cm: number | null;
    mesa_x_m: number | null;
    mesa_y_m: number | null;
    mesa_rotacion_grados: number;
  } | null;
  /**
   * Altas y cambios van en listas distintas y no se distinguen por un prefijo
   * en el id. Mirar cómo empieza una cadena que controla el navegador para
   * decidir si algo se inserta o se actualiza es dejar que el navegador elija
   * la sentencia SQL: mandar `nuevo-<uuid de otra sala>` convertiría un
   * `update` ajeno en un `insert` propio, o al revés.
   */
  equipos: PatchEquipoPlano[];
  equipos_alta: PatchEquipoAlta[];
  mobiliario_cambio: PatchMueblePlano[];
  mobiliario_alta: PatchMuebleAlta[];
  /** Solo ids: para borrar no hace falta nada más, y así no se puede colar otra cosa. */
  mobiliario_baja: string[];
  tomas: PatchTomaPlano[];
  /** Se decide una vez. Nulo = el diagrama ya estaba iniciado. */
  inicio_diagrama: { origen: OrigenDiagrama; plantilla_id: string | null } | null;
  /** Nulo = las sillas siguen como estaban. Solo se manda al materializarlas. */
  sillas_modo: SillasModo | null;
}

/**
 * Lo que ha cambiado, y solo eso.
 *
 * Se manda el delta y no el borrador entero porque el borrador entero
 * reescribiría filas que otro pudo tocar entre la carga y el guardado, y
 * porque el `update` de una sala de veinte equipos que solo movió uno no
 * tiene por qué ser de veinte filas. La versión optimista sigue siendo la
 * guarda de verdad; esto reduce la superficie.
 */
export function construirPatch(
  salaId: string,
  versionEsperada: number,
  original: BorradorPlano,
  borrador: BorradorPlano,
): PatchPlano {
  const salaCambia =
    original.largo_m !== borrador.largo_m ||
    original.ancho_m !== borrador.ancho_m ||
    original.alto_m !== borrador.alto_m ||
    original.aforo !== borrador.aforo ||
    original.mesa_largo_m !== borrador.mesa_largo_m ||
    original.mesa_ancho_m !== borrador.mesa_ancho_m ||
    original.mesa_alto_cm !== borrador.mesa_alto_cm ||
    original.mesa_x_m !== borrador.mesa_x_m ||
    original.mesa_y_m !== borrador.mesa_y_m ||
    original.mesa_rotacion_grados !== borrador.mesa_rotacion_grados;

  const geometriaEquipo = (e: EquipoBorrador): PatchEquipoPlano => ({
    id: e.id,
    x_m: e.x_m,
    y_m: e.y_m,
    z_m: e.z_m,
    posicion_confirmada: e.posicion_confirmada,
    rotacion_grados: e.rotacion_grados,
  });

  const antes = new Map(original.equipos.map((e) => [e.id, e]));
  const equipos_alta = borrador.equipos
    .filter((e) => e.es_nuevo)
    .map((e) => ({ ...geometriaEquipo(e), articulo_id: e.articulo_id, extremo: e.extremo }));

  const equipos = borrador.equipos
    .filter((e) => {
      if (e.es_nuevo) return false;
      const a = antes.get(e.id);
      return (
        !a ||
        a.x_m !== e.x_m ||
        a.y_m !== e.y_m ||
        a.z_m !== e.z_m ||
        a.posicion_confirmada !== e.posicion_confirmada ||
        a.rotacion_grados !== e.rotacion_grados
      );
    })
    .map(geometriaEquipo);

  const geometriaMueble = (m: MuebleBorrador): PatchMueblePlano => ({
    id: m.id,
    nombre: m.nombre,
    largo_m: m.largo_m,
    ancho_m: m.ancho_m,
    alto_m: m.alto_m,
    x_m: m.x_m,
    y_m: m.y_m,
    z_m: m.z_m,
    rotacion_grados: m.rotacion_grados,
    posicion_confirmada: m.posicion_confirmada,
    orden: m.orden,
  });

  const mueblesAntes = new Map(original.mobiliario.map((m) => [m.id, m]));
  const mobiliario_alta = borrador.mobiliario
    .filter((m) => m.es_nuevo)
    .map((m) => ({
      ...geometriaMueble(m),
      mobiliario_id: m.mobiliario_id,
      forma: m.forma,
    }));

  const mobiliario_cambio = borrador.mobiliario
    .filter((m) => {
      if (m.es_nuevo) return false;
      const a = mueblesAntes.get(m.id);
      if (!a) return true;
      return (
        a.nombre !== m.nombre ||
        a.largo_m !== m.largo_m ||
        a.ancho_m !== m.ancho_m ||
        a.alto_m !== m.alto_m ||
        a.x_m !== m.x_m ||
        a.y_m !== m.y_m ||
        a.z_m !== m.z_m ||
        a.rotacion_grados !== m.rotacion_grados ||
        a.posicion_confirmada !== m.posicion_confirmada ||
        a.orden !== m.orden
      );
    })
    .map(geometriaMueble);

  const vivos = new Set(borrador.mobiliario.map((m) => m.id));
  const mobiliario_baja = original.mobiliario
    .filter((m) => !vivos.has(m.id))
    .map((m) => m.id);

  const tomasAntes = new Map(original.tomas.map((t) => [t.id, t]));
  const tomas = borrador.tomas
    .filter((t) => {
      const a = tomasAntes.get(t.id);
      return !a || a.x_m !== t.x_m || a.y_m !== t.y_m || a.z_m !== t.z_m;
    })
    .map((t) => ({ id: t.id, x_m: t.x_m, y_m: t.y_m, z_m: t.z_m }));

  return {
    sala_id: salaId,
    versionEsperada,
    sala: salaCambia
      ? {
          largo_m: borrador.largo_m,
          ancho_m: borrador.ancho_m,
          alto_m: borrador.alto_m,
          aforo: borrador.aforo,
          mesa_largo_m: borrador.mesa_largo_m,
          mesa_ancho_m: borrador.mesa_ancho_m,
          mesa_alto_cm: borrador.mesa_alto_cm,
          mesa_x_m: borrador.mesa_x_m,
          mesa_y_m: borrador.mesa_y_m,
          mesa_rotacion_grados: borrador.mesa_rotacion_grados,
        }
      : null,
    equipos,
    equipos_alta,
    mobiliario_alta,
    mobiliario_cambio,
    mobiliario_baja,
    tomas,
    inicio_diagrama: borrador.inicio,
    sillas_modo: original.sillas_modo !== borrador.sillas_modo ? borrador.sillas_modo : null,
  };
}

// ---------------------------------------------------------------------
// La validación de límites, que también corre en el servidor
//
// El cliente recorta con `limitarALaSala()`: eso es comodidad, no una
// guarda. Una petición hecha a mano no pasa por el editor, y hasta aquí el
// servidor solo comprobaba que los números fueran finitos, así que un equipo
// a 400 m de la pared entraba en la base y salía en el cálculo de cable.
//
// Está en lógica pura y no en la acción por lo mismo que el cálculo: los
// límites exactos y el centímetro de fuera se prueban sin base de datos, y
// la acción se limita a leer las medidas efectivas y llamar aquí.
// ---------------------------------------------------------------------

/**
 * Las medidas contra las que se valida.
 *
 * Son las EFECTIVAS: si el mismo patch ensancha la sala, las coordenadas se
 * comprueban contra la sala nueva. Validar contra la vieja rechazaría el
 * caso normal de medir la sala y colocar el equipo en el mismo guardado.
 */
export interface MedidasSala {
  largo_m: number;
  ancho_m: number;
  alto_m: number;
}

/**
 * Margen contra el ruido del coma flotante. Tiene que ser mucho menor que el
 * centímetro: 5,20 exacto entra, 5,21 en una sala de 5,20 no.
 */
const EPSILON_M = 1e-6;

/**
 * Lo mínimo que hace falta para juzgar una posición. Se escribe así y no como
 * `Pick<PatchPlano, ...>` para que la acción pueda pasar lo que le devuelve
 * zod sin adaptarlo: la validación de límites solo mira geometría.
 */
interface ColocableFijo {
  id: string;
  x_m: number;
  y_m: number;
  z_m: number;
  posicion_confirmada: boolean;
}

interface Colocable {
  id: string;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
  posicion_confirmada: boolean;
}

interface Situable {
  id: string;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
}

const fueraDe = (valor: number, maximo: number): boolean =>
  !Number.isFinite(valor) || valor < -EPSILON_M || valor > maximo + EPSILON_M;

/** Una sala sin medir no admite ninguna colocación confirmada: no hay dónde. */
const sinMedir = (m: MedidasSala): boolean => !(m.largo_m > 0) || !(m.ancho_m > 0);

/**
 * Qué coordenadas del patch no se pueden guardar. Lista vacía = todo entra.
 *
 * Devuelve motivos legibles y no un booleano porque el servidor los registra
 * y porque una prueba que afirma «rechaza» sin saber por qué pasa igual
 * cuando el rechazo llega por otro sitio.
 */
export function coordenadasFueraDeSala(
  patch: {
    sala: { mesa_x_m: number | null; mesa_y_m: number | null } | null;
    equipos: readonly ColocableFijo[];
    equipos_alta?: readonly ColocableFijo[];
    tomas: readonly Situable[];
    mobiliario_alta?: readonly Colocable[];
    mobiliario_cambio?: readonly Colocable[];
  },
  medidas: MedidasSala,
): string[] {
  const problemas: string[] = [];
  const { largo_m, ancho_m, alto_m } = medidas;

  for (const e of [...patch.equipos, ...(patch.equipos_alta ?? [])]) {
    // Un equipo sin confirmar no dice dónde está: el croquis lo deduce del
    // extremo y sus coordenadas son un resto. Solo se exige el rectángulo a
    // lo que alguien colocó, que es lo que de verdad alimenta los metros.
    if (!e.posicion_confirmada) continue;
    if (sinMedir(medidas)) {
      problemas.push(`El equipo ${e.id} se coloca en una sala sin medir.`);
      continue;
    }
    if (fueraDe(e.x_m, largo_m) || fueraDe(e.y_m, ancho_m) || fueraDe(e.z_m, alto_m)) {
      problemas.push(`El equipo ${e.id} queda fuera de la sala.`);
    }
  }

  for (const t of patch.tomas) {
    const ausentes = [t.x_m, t.y_m, t.z_m].filter((v) => v == null).length;
    if (ausentes === 3) continue; // Roseta dada de alta y sin situar: válido.
    if (ausentes > 0) {
      problemas.push(`La roseta ${t.id} tiene coordenadas a medias.`);
      continue;
    }
    if (sinMedir(medidas)) {
      problemas.push(`La roseta ${t.id} se sitúa en una sala sin medir.`);
      continue;
    }
    if (
      fueraDe(t.x_m as number, largo_m) ||
      fueraDe(t.y_m as number, ancho_m) ||
      fueraDe(t.z_m as number, alto_m)
    ) {
      problemas.push(`La roseta ${t.id} queda fuera de la sala.`);
    }
  }

  // El mueble se juzga por su ANCLA, igual que el equipo: el símbolo puede
  // sobresalir —una mesa arrimada a la pared— pero el punto que lo sitúa no.
  for (const m of [...(patch.mobiliario_alta ?? []), ...(patch.mobiliario_cambio ?? [])]) {
    const sinSituar = m.x_m == null || m.y_m == null;
    if (sinSituar) {
      if (m.posicion_confirmada) {
        problemas.push(`El mueble ${m.id} se da por colocado sin coordenadas.`);
      }
      continue;
    }
    if (sinMedir(medidas)) {
      problemas.push(`El mueble ${m.id} se coloca en una sala sin medir.`);
      continue;
    }
    if (
      fueraDe(m.x_m as number, largo_m) ||
      fueraDe(m.y_m as number, ancho_m) ||
      fueraDe(m.z_m ?? 0, alto_m)
    ) {
      problemas.push(`El mueble ${m.id} queda fuera de la sala.`);
    }
  }

  if (patch.sala) {
    const { mesa_x_m, mesa_y_m } = patch.sala;
    if ((mesa_x_m == null) !== (mesa_y_m == null)) {
      problemas.push('El centro de la mesa tiene una coordenada y no la otra.');
    } else if (mesa_x_m != null && mesa_y_m != null) {
      if (sinMedir(medidas)) {
        problemas.push('La mesa se sitúa en una sala sin medir.');
      } else if (fueraDe(mesa_x_m, largo_m) || fueraDe(mesa_y_m, ancho_m)) {
        problemas.push('El centro de la mesa queda fuera de la sala.');
      }
    }
  }

  return problemas;
}

/** ¿Hay algo que guardar? Es lo que enciende el botón y la advertencia al salir. */
export function hayCambios(patch: PatchPlano): boolean {
  return (
    patch.sala !== null ||
    patch.equipos.length > 0 ||
    patch.equipos_alta.length > 0 ||
    patch.mobiliario_alta.length > 0 ||
    patch.mobiliario_cambio.length > 0 ||
    patch.mobiliario_baja.length > 0 ||
    patch.tomas.length > 0 ||
    patch.inicio_diagrama !== null ||
    patch.sillas_modo !== null
  );
}

/**
 * ¿El cambio mueve metros de cable?
 *
 * Mover un equipo no es un retoque estético: cambia la tirada, los metros y la
 * lista de material. El editor lo dice antes de guardar en vez de dejar que el
 * técnico lo descubra en el pedido.
 */
export function afectaAlCalculo(original: BorradorPlano, borrador: BorradorPlano): boolean {
  // Mover un equipo cambia la tirada. Cambiar el alto de la sala cambia las
  // subidas al falso techo. El aforo, la mesa y las rosetas no entran en la
  // fórmula: mover la mesa no cambia ni un metro de cable.
  if (original.alto_m !== borrador.alto_m) return true;
  const antes = new Map(original.equipos.map((e) => [e.id, e]));
  return borrador.equipos.some((e) => {
    const a = antes.get(e.id);
    return !a || a.x_m !== e.x_m || a.y_m !== e.y_m || a.z_m !== e.z_m;
  });
}

// ---------------------------------------------------------------------
// La vista: zoom, panorámica y encajar
//
// El lienzo hace zoom moviendo su propio `viewBox`, no escalando la página:
// el editor nunca puede ensanchar el documento. Todo en píxeles de la
// proyección, que es el sistema del SVG.
// ---------------------------------------------------------------------

export interface Vista {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export const ZOOM_MINIMO = 0.25;
export const ZOOM_MAXIMO = 8;

export const vistaCompleta = (ancho_px: number, alto_px: number): Vista => ({
  x: 0,
  y: 0,
  ancho: ancho_px,
  alto: alto_px,
});

/** El zoom actual respecto a "encajado": 1 = la sala entera a la vista. */
export function zoomDe(vista: Vista, ancho_px: number): number {
  return vista.ancho > 0 ? ancho_px / vista.ancho : 1;
}

/**
 * Acerca o aleja manteniendo quieto un punto del lienzo: con la rueda, el que
 * está bajo el puntero; con los botones, el centro de la vista.
 */
export function acercar(
  vista: Vista,
  factor: number,
  base: { ancho_px: number; alto_px: number },
  centro?: { x: number; y: number },
): Vista {
  const actual = zoomDe(vista, base.ancho_px);
  const objetivo = limitar(actual * factor, ZOOM_MINIMO, ZOOM_MAXIMO);
  if (objetivo === actual) return vista;

  const ancho = base.ancho_px / objetivo;
  const alto = base.alto_px / objetivo;
  const punto = centro ?? { x: vista.x + vista.ancho / 2, y: vista.y + vista.alto / 2 };
  const rx = vista.ancho === 0 ? 0.5 : (punto.x - vista.x) / vista.ancho;
  const ry = vista.alto === 0 ? 0.5 : (punto.y - vista.y) / vista.alto;

  return { x: punto.x - rx * ancho, y: punto.y - ry * alto, ancho, alto };
}

export function desplazarVista(vista: Vista, dx: number, dy: number): Vista {
  return { ...vista, x: vista.x + dx, y: vista.y + dy };
}

export const comoViewBox = (v: Vista): string =>
  `${redondearPx(v.x)} ${redondearPx(v.y)} ${redondearPx(v.ancho)} ${redondearPx(v.alto)}`;

const redondearPx = (n: number): number => Math.round(n * 100) / 100;
