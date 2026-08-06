/**
 * Check-in de sala: la visita física previa al montaje.
 *
 * Lógica pura, sin base de datos. Aquí vive la plantilla de puntos que se
 * comprueban en la sala y las cuentas que resumen cómo va la visita; quien las
 * escribe es `src/lib/datos-checkin.ts`.
 *
 * Es lo contrario de la revisión de montaje, que se deriva sola de lo que ya
 * hay en la base de datos. Esto no se puede derivar de nada: que la roseta dé
 * enlace, que la pared aguante el soporte o que haya llave de la sala se ve con
 * los ojos, de pie en la sala, y se marca con el móvil.
 *
 * La plantilla se escribe una vez y no se toca a la ligera: la `clave` de cada
 * punto queda guardada en `revision_puntos` y es lo que permite comparar la
 * misma visita entre dos salas. Cambiar un título es inocuo; cambiar una clave
 * deja huérfanas las visitas ya hechas.
 */

import type { EstadoPunto, PuntoRevision } from './tipos';

export interface PuntoPlantilla {
  /** Clave estable. Es lo que se guarda; el título es presentación. */
  clave: string;
  bloque: string;
  titulo: string;
  orden: number;
  /**
   * El punto pide además un dato escrito: una medida, un código de roseta, la
   * franja horaria. Se guarda en `revision_puntos.valor`, que es texto: en la
   * sala se apunta «4,68» pero también «no llega la cinta».
   */
  pide_valor: boolean;
  /** Qué se espera en ese campo. Se enseña bajo el hueco. */
  ayuda_valor?: string;
}

/**
 * Los puntos de una visita, en el orden en que se recorren.
 *
 * El orden no es alfabético ni caprichoso: es el recorrido físico de la sala.
 * Primero se mide el hueco, luego la mesa, luego la pared de la pantalla, y al
 * final lo que hay que preguntar a otro (red, corriente, llaves). Sube y baja
 * el metro una sola vez.
 *
 * La lista es corta a propósito. Se rellena de pie, con una mano ocupada.
 */
export const PUNTOS_CHECKIN: readonly PuntoPlantilla[] = [
  // --------------------------------------------------------------- sala
  {
    clave: 'sala_largo',
    bloque: 'Sala',
    titulo: 'Largo real medido',
    pide_valor: true,
    ayuda_valor: 'Metros',
    orden: 10,
  },
  {
    clave: 'sala_ancho',
    bloque: 'Sala',
    titulo: 'Ancho real medido',
    pide_valor: true,
    ayuda_valor: 'Metros',
    orden: 20,
  },
  {
    clave: 'sala_alto',
    bloque: 'Sala',
    titulo: 'Alto real medido',
    pide_valor: true,
    ayuda_valor: 'Metros',
    orden: 30,
  },
  {
    clave: 'sala_falso_techo',
    bloque: 'Sala',
    titulo: 'Altura del falso techo',
    // Pide valor porque es una altura, y de ella sale la tirada por techo. Si
    // la sala no lleva falso techo, el punto se marca «no aplica».
    pide_valor: true,
    ayuda_valor: 'Metros desde el suelo',
    orden: 40,
  },
  {
    clave: 'sala_suelo_tecnico',
    bloque: 'Sala',
    titulo: 'Hay suelo técnico',
    pide_valor: false,
    orden: 50,
  },
  {
    clave: 'sala_canaleta',
    bloque: 'Sala',
    titulo: 'Hay canaleta, y por dónde va',
    pide_valor: true,
    ayuda_valor: 'Recorrido: «pared de la TV hasta la puerta»',
    orden: 60,
  },

  // --------------------------------------------------------------- mesa
  {
    clave: 'mesa_largo',
    bloque: 'Mesa',
    titulo: 'Largo de la mesa',
    pide_valor: true,
    ayuda_valor: 'Metros',
    orden: 70,
  },
  {
    clave: 'mesa_ancho',
    bloque: 'Mesa',
    titulo: 'Ancho de la mesa',
    pide_valor: true,
    ayuda_valor: 'Metros',
    orden: 80,
  },
  {
    clave: 'mesa_alto',
    bloque: 'Mesa',
    titulo: 'Altura de la mesa',
    pide_valor: true,
    ayuda_valor: 'Centímetros desde el suelo',
    orden: 90,
  },
  {
    clave: 'mesa_caja_conexiones',
    bloque: 'Mesa',
    titulo: 'Tiene caja de conexiones, y en qué punto',
    // El punto de la caja es el extremo de la tirada de mesa: sin él no hay
    // metros que calcular.
    pide_valor: true,
    ayuda_valor: 'Distancia a la pared de la pantalla, en metros',
    orden: 100,
  },

  // ------------------------------------------------------------ pantalla
  {
    clave: 'pantalla_pared',
    bloque: 'Pantalla',
    titulo: 'Dónde va la pantalla',
    pide_valor: true,
    ayuda_valor: 'Pared: «frente a la puerta»',
    orden: 110,
  },
  {
    clave: 'pantalla_altura',
    bloque: 'Pantalla',
    titulo: 'Altura de la pantalla sobre el suelo',
    pide_valor: true,
    ayuda_valor: 'Centímetros al borde inferior',
    orden: 120,
  },
  {
    clave: 'pantalla_soporte',
    bloque: 'Pantalla',
    titulo: 'La pared aguanta el soporte',
    pide_valor: false,
    orden: 130,
  },
  {
    clave: 'pantalla_corriente',
    bloque: 'Pantalla',
    titulo: 'Hay toma de corriente detrás de la pantalla',
    pide_valor: false,
    orden: 140,
  },

  // ----------------------------------------------------------------- red
  {
    clave: 'red_roseta',
    bloque: 'Red',
    titulo: 'Roseta identificada, con su código',
    pide_valor: true,
    ayuda_valor: 'Lo que pone en la roseta: «2B-14»',
    orden: 150,
  },
  {
    clave: 'red_enlace',
    bloque: 'Red',
    titulo: 'La roseta da enlace',
    pide_valor: false,
    orden: 160,
  },
  {
    clave: 'red_tomas',
    bloque: 'Red',
    titulo: 'Hay tomas de red suficientes',
    pide_valor: false,
    orden: 170,
  },

  // ----------------------------------------------------------- corriente
  {
    clave: 'corriente_equipo',
    bloque: 'Corriente',
    titulo: 'Hay enchufes donde va el equipo',
    pide_valor: false,
    orden: 180,
  },
  {
    clave: 'corriente_tomas',
    bloque: 'Corriente',
    titulo: 'Cuántas tomas libres hay',
    pide_valor: true,
    ayuda_valor: 'Número de tomas',
    orden: 190,
  },

  // -------------------------------------------------------------- acceso
  {
    clave: 'acceso_furgoneta',
    bloque: 'Acceso',
    titulo: 'Se puede entrar con la furgoneta',
    pide_valor: false,
    orden: 200,
  },
  {
    clave: 'acceso_llave',
    bloque: 'Acceso',
    titulo: 'Hay llave de la sala',
    pide_valor: false,
    orden: 210,
  },
  {
    clave: 'acceso_horario',
    bloque: 'Acceso',
    titulo: 'Hay horario de trabajo acordado',
    pide_valor: true,
    ayuda_valor: 'Franja: «de 8 a 10, antes de la primera reunión»',
    orden: 220,
  },
];

/** Los bloques en el orden del recorrido, sin repetir. */
export const BLOQUES_CHECKIN: readonly string[] = [
  ...new Set(PUNTOS_CHECKIN.map((p) => p.bloque)),
];

const POR_CLAVE = new Map(PUNTOS_CHECKIN.map((p) => [p.clave, p]));

/**
 * Si el punto pide un dato escrito. Se pregunta por la clave y no por el
 * título porque lo guardado es la clave: una visita de hace un año se sigue
 * pintando bien aunque el título haya cambiado.
 *
 * Un punto que ya no está en la plantilla no pide valor, pero se sigue viendo.
 */
export function pideValor(clave: string): boolean {
  return POR_CLAVE.get(clave)?.pide_valor ?? false;
}

export function ayudaDeValor(clave: string): string | undefined {
  return POR_CLAVE.get(clave)?.ayuda_valor;
}

/** Las filas a insertar al abrir una visita, ya en orden. */
export function puntosDeUnaVisita(): Array<{
  clave: string;
  bloque: string;
  titulo: string;
  orden: number;
}> {
  return [...PUNTOS_CHECKIN]
    .sort((a, b) => a.orden - b.orden)
    .map(({ clave, bloque, titulo, orden }) => ({ clave, bloque, titulo, orden }));
}

export interface ResumenVisita {
  total: number;
  pendientes: number;
  conformes: number;
  incidencias: number;
  no_aplica: number;
  /** No queda ningún punto sin mirar. */
  completa: boolean;
}

/**
 * Cómo va la visita. Es lo que se lee de un vistazo antes de irse de la sala:
 * cuánto queda por mirar y cuántas cosas están mal.
 *
 * Una visita sin puntos no está completa: no se ha mirado nada.
 */
export function resumirVisita(
  puntos: Array<Pick<PuntoRevision, 'estado'>>,
): ResumenVisita {
  const cuenta = (estado: EstadoPunto) =>
    puntos.filter((p) => p.estado === estado).length;

  const pendientes = cuenta('pendiente');
  return {
    total: puntos.length,
    pendientes,
    conformes: cuenta('conforme'),
    incidencias: cuenta('incidencia'),
    no_aplica: cuenta('no_aplica'),
    completa: puntos.length > 0 && pendientes === 0,
  };
}

/**
 * Una visita se cierra cuando se ha mirado todo.
 *
 * No basta con que no haya incidencias: una visita con incidencias se cierra
 * igual, porque el problema encontrado es justamente el resultado útil de ir a
 * la sala. Lo que no se puede es cerrar con puntos sin mirar, que sería firmar
 * en blanco.
 */
export function puedeCerrarse(puntos: Array<Pick<PuntoRevision, 'estado'>>): boolean {
  return resumirVisita(puntos).completa;
}

/** Por qué no se puede cerrar todavía. `null` cuando sí se puede. */
export function motivoParaNoCerrar(
  puntos: Array<Pick<PuntoRevision, 'estado'>>,
): string | null {
  const resumen = resumirVisita(puntos);
  if (resumen.total === 0) return 'Esta visita no tiene puntos que comprobar.';
  if (resumen.pendientes === 0) return null;
  return resumen.pendientes === 1
    ? 'Queda 1 punto sin mirar. Cerrar con puntos sin mirar es firmar en blanco.'
    : `Quedan ${resumen.pendientes} puntos sin mirar. Cerrar con puntos sin mirar es firmar en blanco.`;
}

/**
 * Los puntos por bloque, en el orden del recorrido.
 *
 * Manda el orden guardado en la fila, no el de la plantilla de hoy: si mañana
 * se reordena la plantilla, una visita de ayer se sigue leyendo como se hizo.
 */
export function agruparPorBloque<T extends Pick<PuntoRevision, 'bloque' | 'orden'>>(
  puntos: T[],
): Array<{ bloque: string; puntos: T[] }> {
  const grupos = new Map<string, T[]>();
  for (const punto of [...puntos].sort((a, b) => a.orden - b.orden)) {
    const grupo = grupos.get(punto.bloque);
    if (grupo) grupo.push(punto);
    else grupos.set(punto.bloque, [punto]);
  }
  return [...grupos].map(([bloque, puntos]) => ({ bloque, puntos }));
}
