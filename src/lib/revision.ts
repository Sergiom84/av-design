/**
 * Revisión de montaje: ¿está esta sala lista para montarse?
 *
 * Es lógica pura, como `calculo-cable.ts`, `cable-schedule.ts` y `almacen.ts`:
 * entra el diseño de la sala ya cargado, salen puntos con estado. No consulta
 * nada, no escribe nada y no crea ninguna tabla.
 *
 * El criterio: **un estado que se teclea a mano miente; uno que se deriva, no.**
 * Nadie marca la sala como "lista"; la sala está lista cuando lo están las
 * medidas, el equipamiento, las conexiones, el cable, el material y la carga.
 * Si mañana se borra un equipo, el semáforo se entera solo.
 *
 * `bloqueo` es lo que impide montar: sin medidas no hay un metro de cable, sin
 * equipamiento no hay nada que instalar, y con material faltando la furgoneta
 * sale incompleta. Todo lo demás avisa y deja seguir, igual que la validación
 * de conexiones: el técnico puede tener un motivo.
 */

import type { Disponibilidad } from './almacen';
import type { ResultadoCable } from './calculo-cable';
import type { FilaCable } from './cable-schedule';
import type { GrupoProveedor, LineaFaltante } from './compras';
import type {
  Carga,
  Conexion,
  EquipoEnSala,
  Reserva,
  Sala,
  TomaRed,
} from './tipos';

/**
 * Lo que devuelve `faltaParaSala()` reducido a lo que mira la revisión.
 *
 * Se declara aquí en vez de importarlo: `datos-almacen.ts` es `server-only` y
 * arrastra la conexión a Postgres, y este módulo tiene que poder probarse sin
 * base de datos. Es estructural, así que la salida real encaja tal cual.
 */
export interface FaltaDeSala {
  faltantes: LineaFaltante[];
  grupos: GrupoProveedor[];
  /** Nombres de los equipos de la sala sin referencia de catálogo. */
  sinCatalogar: string[];
  reservas: Array<Pick<Reserva, 'articulo_id' | 'cantidad' | 'estado'>>;
  disponibilidad: Map<string, Disponibilidad>;
}

export interface EntradaRevision {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
  tomas: TomaRed[];
  /** Lo que ha devuelto `calcularConexion()` para cada conexión que salió. */
  resultados: ResultadoCable[];
  /** La tabla de cables ya construida: de ahí salen los avisos de compatibilidad. */
  filasCable: FilaCable[];
  /** Nulo cuando la sala no existe o no se ha podido resolver el almacén. */
  falta: FaltaDeSala | null;
  cargas: Array<Pick<Carga, 'estado'>>;
}

/**
 * `no_aplica` no es un hueco: una sala sin conexiones no tiene tabla de cables
 * que revisar, y dejar ese punto en rojo para siempre haría que el semáforo no
 * sirviera para nada.
 */
export type Semaforo = 'listo' | 'aviso' | 'bloqueo' | 'no_aplica';

export interface PuntoMontaje {
  /** Estable: se puede enlazar y comparar entre revisiones. */
  clave: string;
  titulo: string;
  estado: Semaforo;
  /** Una frase con el número concreto. Sin número no se puede actuar. */
  detalle: string;
}

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  listo: 'Listo',
  aviso: 'Aviso',
  bloqueo: 'Bloqueo',
  no_aplica: 'No aplica',
};

export function revisarMontaje(entrada: EntradaRevision): PuntoMontaje[] {
  const { sala, equipos, conexiones, resultados, filasCable, falta, cargas } =
    entrada;

  return [
    puntoMedidas(sala),
    puntoMesa(sala),
    puntoEquipamiento(equipos),
    puntoCatalogo(equipos, falta),
    puntoConexiones(conexiones),
    puntoPuertos(conexiones),
    puntoCable(conexiones, resultados),
    puntoCableArticulo(conexiones),
    puntoCompatibilidad(filasCable),
    puntoMaterial(falta),
    puntoReservas(falta),
    puntoCarga(cargas),
  ];
}

// ------------------------------------------------------------------- geometría

function puntoMedidas(sala: Sala): PuntoMontaje {
  const faltan = (
    [
      ['largo', sala.largo_m],
      ['ancho', sala.ancho_m],
      ['alto', sala.alto_m],
    ] as const
  )
    .filter(([, v]) => !(v > 0))
    .map(([nombre]) => nombre);

  if (faltan.length > 0) {
    return {
      clave: 'medidas',
      titulo: 'Medidas de la sala',
      estado: 'bloqueo',
      // Sin las tres no hay recorrido que calcular: es el bloqueo de origen.
      detalle: `Faltan ${listar(faltan)}. Sin las tres no se calcula ni un metro de cable.`,
    };
  }

  return {
    clave: 'medidas',
    titulo: 'Medidas de la sala',
    estado: 'listo',
    detalle: `${numero(sala.largo_m)} × ${numero(sala.ancho_m)} × ${numero(sala.alto_m)} m.`,
  };
}

function puntoMesa(sala: Sala): PuntoMontaje {
  if (sala.mesa_largo_m && sala.mesa_ancho_m) {
    const alto = sala.mesa_alto_cm
      ? `, a ${numero(sala.mesa_alto_cm)} cm del suelo`
      : '';
    return {
      clave: 'mesa',
      titulo: 'Mesa',
      estado: 'listo',
      detalle: `${numero(sala.mesa_largo_m)} × ${numero(sala.mesa_ancho_m)} m${alto}.`,
    };
  }

  // Avisa y no bloquea: la mesa solo la necesita el croquis, no el cálculo.
  return {
    clave: 'mesa',
    titulo: 'Mesa',
    estado: 'aviso',
    detalle: 'Sin medidas de mesa: el croquis sale incompleto.',
  };
}

// ---------------------------------------------------------------- equipamiento

function puntoEquipamiento(equipos: EquipoEnSala[]): PuntoMontaje {
  if (equipos.length === 0) {
    return {
      clave: 'equipamiento',
      titulo: 'Equipamiento',
      estado: 'bloqueo',
      detalle: 'La sala no tiene ningún equipo: no hay nada que montar.',
    };
  }

  const unidades = redondear(equipos.reduce((t, e) => t + e.cantidad, 0));
  return {
    clave: 'equipamiento',
    titulo: 'Equipamiento',
    estado: 'listo',
    detalle: `${equipos.length} ${plural(equipos.length, 'equipo', 'equipos')}, ` +
      `${numero(unidades)} ${plural(unidades, 'unidad', 'unidades')}.`,
  };
}

/**
 * Un equipo escrito a mano y sin referencia no se puede pedir ni contar contra
 * el almacén, así que el nombre concreto importa: es lo que hay que catalogar.
 *
 * Se cuenta sobre `equipos` y no sobre `falta.sinCatalogar`, que es la misma
 * lista, para que el punto siga saliendo aunque el almacén no se haya podido
 * resolver. Los nombres se toman de `falta` cuando los hay.
 */
function puntoCatalogo(
  equipos: EquipoEnSala[],
  falta: FaltaDeSala | null,
): PuntoMontaje {
  if (equipos.length === 0) {
    return {
      clave: 'catalogo',
      titulo: 'Referencias de catálogo',
      estado: 'no_aplica',
      detalle: 'Sin equipamiento no hay nada que catalogar.',
    };
  }

  const sinCatalogar = equipos.filter((e) => !e.articulo_id);
  if (sinCatalogar.length === 0) {
    return {
      clave: 'catalogo',
      titulo: 'Referencias de catálogo',
      estado: 'listo',
      detalle:
        equipos.length === 1
          ? '1 equipo, con referencia de catálogo.'
          : `${equipos.length} equipos, todos con referencia de catálogo.`,
    };
  }

  const nombres = falta?.sinCatalogar.length
    ? falta.sinCatalogar
    : sinCatalogar.map((e) => e.nombre);
  return {
    clave: 'catalogo',
    titulo: 'Referencias de catálogo',
    estado: 'aviso',
    detalle: `${sinCatalogar.length} de ${equipos.length} ${plural(equipos.length, 'equipo', 'equipos')} ` +
      `sin referencia de catálogo: ${nombres.join(', ')}. No se pueden pedir.`,
  };
}

// ------------------------------------------------------------------ conexiones

function puntoConexiones(conexiones: Conexion[]): PuntoMontaje {
  if (conexiones.length === 0) {
    return {
      clave: 'conexiones',
      titulo: 'Conexiones',
      estado: 'bloqueo',
      detalle: 'La sala no tiene ninguna conexión: no hay tirada que calcular.',
    };
  }
  return {
    clave: 'conexiones',
    titulo: 'Conexiones',
    estado: 'listo',
    detalle: `${conexiones.length} ${plural(conexiones.length, 'tirada', 'tiradas')}.`,
  };
}

/**
 * En obra el técnico busca el conector que lee en la trasera del aparato. Una
 * conexión sin puerto dice que hay que tirar un cable, pero no dónde pincharlo.
 */
function puntoPuertos(conexiones: Conexion[]): PuntoMontaje {
  if (conexiones.length === 0) {
    return {
      clave: 'puertos',
      titulo: 'Puertos de la conexión',
      estado: 'no_aplica',
      detalle: 'Sin conexiones no hay puertos que asignar.',
    };
  }

  const sinPuerto = conexiones.filter(
    (c) => !c.puerto_origen_id || !c.puerto_destino_id,
  ).length;
  if (sinPuerto === 0) {
    return {
      clave: 'puertos',
      titulo: 'Puertos de la conexión',
      estado: 'listo',
      detalle:
        conexiones.length === 1
          ? '1 tirada, con puerto de origen y de destino.'
          : `${conexiones.length} tiradas, todas con puerto de origen y de destino.`,
    };
  }

  return {
    clave: 'puertos',
    titulo: 'Puertos de la conexión',
    estado: 'aviso',
    detalle: `${sinPuerto} de ${conexiones.length} ${plural(conexiones.length, 'tirada', 'tiradas')} ` +
      'sin puerto en algún extremo: en obra no se sabe en qué conector va.',
  };
}

// ----------------------------------------------------------------------- cable

function puntoCable(
  conexiones: Conexion[],
  resultados: ResultadoCable[],
): PuntoMontaje {
  if (conexiones.length === 0) {
    return {
      clave: 'cable',
      titulo: 'Metros calculados',
      estado: 'no_aplica',
      detalle: 'Sin conexiones no hay metros que calcular.',
    };
  }

  const calculadas = resultados.filter((r) => r.longitud_m > 0).length;
  if (calculadas < conexiones.length) {
    return {
      clave: 'cable',
      titulo: 'Metros calculados',
      estado: 'aviso',
      detalle: `${conexiones.length - calculadas} de ${conexiones.length} ` +
        `${plural(conexiones.length, 'tirada', 'tiradas')} sin metros: revisa medidas y posiciones.`,
    };
  }

  const metros = redondear(resultados.reduce((t, r) => t + r.longitud_m, 0));
  return {
    clave: 'cable',
    titulo: 'Metros calculados',
    estado: 'listo',
    detalle: `${conexiones.length} ${plural(conexiones.length, 'tirada', 'tiradas')}, ` +
      `${numero(metros)} m en total.`,
  };
}

function puntoCableArticulo(conexiones: Conexion[]): PuntoMontaje {
  if (conexiones.length === 0) {
    return {
      clave: 'cable_articulo',
      titulo: 'Cable elegido',
      estado: 'no_aplica',
      detalle: 'Sin conexiones no hay cable que elegir.',
    };
  }

  const sinCable = conexiones.filter((c) => !c.articulo_cable_id).length;
  if (sinCable === 0) {
    return {
      clave: 'cable_articulo',
      titulo: 'Cable elegido',
      estado: 'listo',
      detalle:
        conexiones.length === 1
          ? '1 tirada, con cable del catálogo.'
          : `${conexiones.length} tiradas, todas con cable del catálogo.`,
    };
  }

  return {
    clave: 'cable_articulo',
    titulo: 'Cable elegido',
    estado: 'aviso',
    detalle: `${sinCable} de ${conexiones.length} ${plural(conexiones.length, 'tirada', 'tiradas')} ` +
      'sin cable del catálogo: esos metros no entran en la lista de material.',
  };
}

/** Los avisos de compatibilidad de la tabla de cables. Avisan, no bloquean. */
function puntoCompatibilidad(filas: FilaCable[]): PuntoMontaje {
  if (filas.length === 0) {
    return {
      clave: 'compatibilidad',
      titulo: 'Compatibilidad de la tirada',
      estado: 'no_aplica',
      detalle: 'Sin tabla de cables no hay nada que comprobar.',
    };
  }

  const conAviso = filas.filter((f) => f.avisos.length > 0);
  if (conAviso.length === 0) {
    return {
      clave: 'compatibilidad',
      titulo: 'Compatibilidad de la tirada',
      estado: 'listo',
      detalle:
        filas.length === 1
          ? '1 tirada, casa en señal y sentido.'
          : `${filas.length} tiradas, todas casan en señal y sentido.`,
    };
  }

  const avisos = conAviso.reduce((t, f) => t + f.avisos.length, 0);
  return {
    clave: 'compatibilidad',
    titulo: 'Compatibilidad de la tirada',
    estado: 'aviso',
    detalle: `${conAviso.length} de ${filas.length} ${plural(filas.length, 'tirada', 'tiradas')} ` +
      `con ${avisos} ${plural(avisos, 'aviso', 'avisos')}: ${conAviso
        .map((f) => f.identificador)
        .join(', ')}.`,
  };
}

// -------------------------------------------------------------------- material

function puntoMaterial(falta: FaltaDeSala | null): PuntoMontaje {
  if (!falta) {
    return {
      clave: 'material',
      titulo: 'Material contra almacén',
      estado: 'no_aplica',
      detalle: 'No se ha podido leer el almacén.',
    };
  }

  const faltantes = falta.faltantes.filter((l) => l.falta > 0);
  if (faltantes.length === 0) {
    return {
      clave: 'material',
      titulo: 'Material contra almacén',
      estado: 'listo',
      detalle: `Las ${falta.faltantes.length} ${plural(falta.faltantes.length, 'referencia', 'referencias')} ` +
        'de la sala están cubiertas por el almacén.',
    };
  }

  // Bloquea: la furgoneta que sale sin material vuelve, y ese es el fallo que
  // esta aplicación viene a evitar.
  const unidades = redondear(faltantes.reduce((t, l) => t + l.falta, 0));
  return {
    clave: 'material',
    titulo: 'Material contra almacén',
    estado: 'bloqueo',
    detalle: `Faltan ${faltantes.length} de ${falta.faltantes.length} ` +
      `${plural(falta.faltantes.length, 'referencia', 'referencias')}, ` +
      `${numero(unidades)} ${plural(unidades, 'unidad', 'unidades')} por comprar.`,
  };
}

/**
 * Reservado no es salido: el material sigue en el estante, comprometido para
 * esta obra. Sin reserva, otra obra se lo lleva antes de montar.
 */
function puntoReservas(falta: FaltaDeSala | null): PuntoMontaje {
  if (!falta || falta.faltantes.length === 0) {
    return {
      clave: 'reservas',
      titulo: 'Material reservado',
      estado: 'no_aplica',
      detalle: 'La sala no tiene material asignado todavía.',
    };
  }

  const activas = falta.reservas.filter((r) => r.estado === 'activa');
  const reservado = new Map<string, number>();
  for (const r of activas) {
    reservado.set(r.articulo_id, redondear((reservado.get(r.articulo_id) ?? 0) + r.cantidad));
  }

  const total = falta.faltantes.length;
  const cubiertas = falta.faltantes.filter(
    (l) => (reservado.get(l.articulo_id) ?? 0) >= l.cantidad,
  ).length;

  if (activas.length === 0) {
    return {
      clave: 'reservas',
      titulo: 'Material reservado',
      estado: 'aviso',
      detalle: `Nada reservado de las ${total} ${plural(total, 'referencia', 'referencias')} ` +
        'que necesita la sala.',
    };
  }

  if (cubiertas < total) {
    return {
      clave: 'reservas',
      titulo: 'Material reservado',
      estado: 'aviso',
      detalle: `${cubiertas} de ${total} ${plural(total, 'referencia', 'referencias')} ` +
        `reservadas por completo, en ${activas.length} ${plural(activas.length, 'reserva', 'reservas')} activas.`,
    };
  }

  return {
    clave: 'reservas',
    titulo: 'Material reservado',
    estado: 'listo',
    detalle: `Las ${total} ${plural(total, 'referencia', 'referencias')} están reservadas, ` +
      `en ${activas.length} ${plural(activas.length, 'reserva', 'reservas')} activas.`,
  };
}

// ----------------------------------------------------------------------- carga

function puntoCarga(cargas: Array<Pick<Carga, 'estado'>>): PuntoMontaje {
  const abiertas = cargas.filter(
    (c) => c.estado === 'preparacion' || c.estado === 'cargada',
  ).length;

  if (abiertas > 0) {
    return {
      clave: 'carga',
      titulo: 'Carga de obra',
      estado: 'listo',
      detalle: `${abiertas} ${plural(abiertas, 'carga abierta', 'cargas abiertas')}.`,
    };
  }

  if (cargas.length > 0) {
    return {
      clave: 'carga',
      titulo: 'Carga de obra',
      estado: 'aviso',
      detalle: `${cargas.length} ${plural(cargas.length, 'carga', 'cargas')}, todas cerradas: ` +
        'no hay ninguna preparada para esta obra.',
    };
  }

  return {
    clave: 'carga',
    titulo: 'Carga de obra',
    estado: 'aviso',
    detalle: 'Sin lista de carga: nadie ha preparado la furgoneta.',
  };
}

// --------------------------------------------------------------------- resumen

export interface ResumenMontaje {
  estado: Semaforo;
  bloqueos: number;
  avisos: number;
  listos: number;
}

/**
 * El estado global es el del peor punto. Los `no_aplica` no cuentan: una sala
 * sin conexiones no está peor por no tener tabla de cables, está antes.
 */
export function resumirMontaje(puntos: PuntoMontaje[]): ResumenMontaje {
  const cuenta = (estado: Semaforo) => puntos.filter((p) => p.estado === estado).length;
  const bloqueos = cuenta('bloqueo');
  const avisos = cuenta('aviso');
  const listos = cuenta('listo');

  return {
    estado: bloqueos > 0 ? 'bloqueo' : avisos > 0 ? 'aviso' : 'listo',
    bloqueos,
    avisos,
    listos,
  };
}

// -------------------------------------------------------------------- utilidad

/** Decimales con coma, y sin decimales cuando el número es entero. */
function numero(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/** "largo, ancho y alto": la lista se lee, no se enumera con comas hasta el final. */
function listar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
