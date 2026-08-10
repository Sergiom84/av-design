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

import { normalizarGrados, type EntradaCroquis } from './croquis';
import type { Conexion, Extremo, Punto, Sala, EquipoEnSala, TomaRed } from './tipos';

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
  nombre: string;
  extremo: Extremo;
  cantidad: number;
  x_m: number;
  y_m: number;
  z_m: number;
  posicion_confirmada: boolean;
  toma_red_id: string | null;
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
  tomas: TomaBorrador[];
}

export type Seleccion =
  | { tipo: 'sala' }
  | { tipo: 'mesa' }
  | { tipo: 'equipo'; id: string }
  | { tipo: 'toma'; id: string }
  | null;

/** Lo que viene del servidor, convertido a borrador. */
export function borradorDesde(
  sala: Sala,
  equipos: EquipoEnSala[],
  tomas: TomaRed[],
): BorradorPlano {
  return {
    largo_m: sala.largo_m,
    ancho_m: sala.ancho_m,
    alto_m: sala.alto_m,
    aforo: sala.aforo,
    mesa_largo_m: sala.mesa_largo_m,
    mesa_ancho_m: sala.mesa_ancho_m,
    mesa_alto_cm: sala.mesa_alto_cm,
    mesa_x_m: sala.mesa_x_m,
    mesa_y_m: sala.mesa_y_m,
    mesa_rotacion_grados: normalizarGrados(sala.mesa_rotacion_grados),
    equipos: equipos.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      extremo: e.extremo,
      cantidad: e.cantidad,
      x_m: e.posicion.x_m,
      y_m: e.posicion.y_m,
      z_m: e.posicion.z_m,
      posicion_confirmada: e.posicion_confirmada,
      toma_red_id: e.toma_red_id ?? null,
    })),
    tomas: tomas.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      ubicacion: t.ubicacion,
      x_m: t.x_m,
      y_m: t.y_m,
      z_m: t.z_m,
      notas: t.notas,
    })),
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
    },
    equipos: borrador.equipos.map((e) => ({
      id: e.id,
      sala_id: sala.id,
      articulo_id: '',
      nombre: e.nombre,
      cantidad: e.cantidad,
      extremo: e.extremo,
      posicion: { x_m: e.x_m, y_m: e.y_m, z_m: e.z_m },
      posicion_confirmada: e.posicion_confirmada,
      toma_red_id: e.toma_red_id,
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
    if (combinado.x_m == null || combinado.y_m == null) {
      return { ...combinado, x_m: null, y_m: null };
    }
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
  equipos: PatchEquipoPlano[];
  tomas: PatchTomaPlano[];
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

  const antes = new Map(original.equipos.map((e) => [e.id, e]));
  const equipos = borrador.equipos
    .filter((e) => {
      const a = antes.get(e.id);
      return (
        !a ||
        a.x_m !== e.x_m ||
        a.y_m !== e.y_m ||
        a.z_m !== e.z_m ||
        a.posicion_confirmada !== e.posicion_confirmada
      );
    })
    .map((e) => ({
      id: e.id,
      x_m: e.x_m,
      y_m: e.y_m,
      z_m: e.z_m,
      posicion_confirmada: e.posicion_confirmada,
    }));

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
    tomas,
  };
}

/** ¿Hay algo que guardar? Es lo que enciende el botón y la advertencia al salir. */
export function hayCambios(patch: PatchPlano): boolean {
  return patch.sala !== null || patch.equipos.length > 0 || patch.tomas.length > 0;
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
