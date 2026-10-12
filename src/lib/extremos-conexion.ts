import type { Conexion, EquipoEnSala, ExtremoConexion, ParametrosCable, Punto, Puerto, Senal, SentidoPuerto, TomaRed } from './tipos';

export interface ContextoExtremos {
  tomas: Map<string, TomaRed>;
  puertos: Map<string, Puerto>;
}

export type PosicionExtremo =
  | { estado: 'conocida' | 'estimada'; punto: Punto }
  | { estado: 'desconocida'; punto: null };

export interface ExtremoResuelto {
  nombre: string;
  boca: string | null;
  conector: string | null;
  senal: Senal | null;
  sentido: SentidoPuerto | null;
  posicion: PosicionExtremo;
  holgura_m: number | null;
  toma: TomaRed | null;
}

export function claveExtremo(extremo: ExtremoConexion): string {
  return extremo.tipo === 'roseta' ? `roseta:${extremo.toma_boca_id}`
    : `${extremo.equipo_id}:${extremo.puerto_id}:${extremo.ordinal}`;
}

export function resolverExtremoConexion(
  extremo: ExtremoConexion,
  salaId: string,
  equipos: Map<string, EquipoEnSala>,
  contexto: ContextoExtremos,
  parametros: ParametrosCable,
): ExtremoResuelto | null {
  if (extremo.tipo === 'equipo') {
    const equipo = equipos.get(extremo.equipo_id);
    const puerto = contexto.puertos.get(extremo.puerto_id);
    if (!equipo || equipo.sala_id !== salaId || equipo.cantidad !== 1 || !puerto ||
      puerto.articulo_id !== equipo.articulo_id || !Number.isInteger(extremo.ordinal) ||
      extremo.ordinal < 1 || extremo.ordinal > puerto.total) return null;
    return {
      nombre: equipo.nombre,
      boca: `${puerto.nombre}${puerto.total > 1 ? ` ${extremo.ordinal}` : ''}`,
      conector: puerto.conector, senal: puerto.senal, sentido: puerto.sentido,
      posicion: posicionEquipo(equipo), holgura_m: parametros.holguras[equipo.extremo], toma: null,
    };
  }
  const coincidencias = [...contexto.tomas.values()].flatMap((toma) =>
    toma.bocas.filter((boca) => boca.id === extremo.toma_boca_id).map((boca) => ({ toma, boca })));
  if (coincidencias.length !== 1) return null;
  const { toma, boca } = coincidencias[0];
  if (toma.sala_id !== salaId || boca.toma_red_id !== toma.id || toma.capacidad_documentada === null ||
    !Number.isInteger(boca.ordinal) || boca.ordinal < 1 || boca.ordinal > toma.capacidad_documentada) return null;
  const { x_m, y_m, z_m } = toma;
  const posicion: PosicionExtremo = x_m !== null && y_m !== null && z_m !== null &&
    [x_m, y_m, z_m].every(Number.isFinite)
    ? { estado: 'conocida', punto: { x_m, y_m, z_m } }
    : { estado: 'desconocida', punto: null };
  return {
    nombre: toma.codigo, boca: boca.etiqueta ?? `Boca ${boca.ordinal}`,
    conector: boca.conector, senal: boca.senal, sentido: 'bidireccional',
    posicion, holgura_m: parametros.holgura_roseta, toma,
  };
}

function posicionEquipo(equipo: EquipoEnSala): PosicionExtremo {
  return Object.values(equipo.posicion).every(Number.isFinite)
    ? { estado: equipo.posicion_confirmada ? 'conocida' : 'estimada', punto: equipo.posicion }
    : { estado: 'desconocida', punto: null };
}

/** El legado conserva su cálculo por equipo; nunca se inventa una boca. */
export function resolverLadoConexion(
  conexion: Conexion, lado: 'origen' | 'destino', equipos: Map<string, EquipoEnSala>,
  contexto: ContextoExtremos, parametros: ParametrosCable,
): ExtremoResuelto | null {
  if (conexion.detalle.estado === 'completo') {
    return resolverExtremoConexion(conexion.detalle[lado], conexion.sala_id, equipos, contexto, parametros);
  }
  const id = conexion[`${lado}_id`];
  const equipo = id === null ? undefined : equipos.get(id);
  if (!equipo || equipo.sala_id !== conexion.sala_id) return null;
  const puertoId = conexion[`puerto_${lado}_id`];
  const puerto = puertoId ? contexto.puertos.get(puertoId) : undefined;
  const ordinal = conexion[`puerto_${lado}_ordinal`];
  return {
    nombre: equipo.nombre,
    boca: puerto ? `${puerto.nombre}${ordinal != null && puerto.total > 1 ? ` ${ordinal}` : ''}` : null,
    conector: puerto?.conector ?? null, senal: puerto?.senal ?? null, sentido: puerto?.sentido ?? null,
    posicion: posicionEquipo(equipo), holgura_m: parametros.holguras[equipo.extremo],
    toma: equipo.toma_red_id ? contexto.tomas.get(equipo.toma_red_id) ?? null : null,
  };
}
