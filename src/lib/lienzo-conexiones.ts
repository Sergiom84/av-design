import { bocasDePuerto, claveBoca } from './bocas-puerto';
import { ladoDePuerto } from './diagrama';
import type { BocaPuerto, Conexion, EquipoEnSala, Puerto, ExtremoConexion, TomaRed } from './tipos';
import { claveExtremo } from './extremos-conexion';

export type PosicionBloque = { x: number; y: number };
export const ANCHO_BLOQUE = 360;
export const ALTO_CABECERA = 72;
export const ALTO_BOCA = 44;

export function bloquesDelLienzo(equipos: EquipoEnSala[], puertos: Puerto[], posiciones: Record<string, PosicionBloque>) {
  const maxFilas = Math.max(1, ...equipos.map((equipo) => puertos.filter((p) => p.articulo_id === equipo.articulo_id).reduce((n, p) => n + p.total, 0)));
  return equipos.map((equipo, indice) => {
    const repetidos = equipos.filter((e) => e.nombre === equipo.nombre);
    const etiqueta = repetidos.length > 1 ? `${equipo.nombre} · ${repetidos.findIndex((e) => e.id === equipo.id) + 1}` : equipo.nombre;
    const bocas = puertos.filter((p) => p.articulo_id === equipo.articulo_id)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
      .flatMap((puerto) => bocasDePuerto(puerto, equipo.id).map((boca) => ({ ...boca, puerto, lado: ladoDePuerto(puerto.sentido) })));
    const posicion = posiciones[equipo.id] ?? { x: 40 + (indice % 3) * 500, y: 40 + Math.floor(indice / 3) * (maxFilas * ALTO_BOCA + 160) };
    const izquierda = bocas.filter((b) => b.lado === 'izquierda');
    const derecha = bocas.filter((b) => b.lado === 'derecha');
    return { equipo, etiqueta, ...posicion, alto: ALTO_CABECERA + Math.max(1, izquierda.length, derecha.length) * ALTO_BOCA + 12,
      bocas: [...izquierda.map((b, i) => ({ ...b, fila: i })), ...derecha.map((b, i) => ({ ...b, fila: i }))] };
  });
}

export function ocupacionDeBocas(conexiones: Conexion[], puertos: Puerto[]) {
  const ocupadas = new Map<string, string>();
  for (const c of conexiones) for (const lado of ['origen', 'destino'] as const) {
    if (c.detalle.estado === 'completo') {
      ocupadas.set(claveExtremo(c.detalle[lado]), c.id);
      continue;
    }
    const equipoId = c[`${lado}_id`];
    if (equipoId === null) continue;
    const puertoId = c[`puerto_${lado}_id`];
    if (!puertoId) continue;
    const ordinal = c[`puerto_${lado}_ordinal`];
    // Una conexión histórica sin ordinal reserva la fila completa hasta detallarla.
    const ordinales = ordinal ? [ordinal] : bocasDePuerto(puertos.find((p) => p.id === puertoId) ?? { total: 0 } as Puerto, equipoId).map((b) => b.ordinal);
    for (const n of ordinales) ocupadas.set(claveBoca({ equipo_id: equipoId, puerto_id: puertoId, ordinal: n }), c.id);
  }
  return ocupadas;
}

export function puntoDeBoca(bloques: ReturnType<typeof bloquesDelLienzo>, boca: BocaPuerto): PosicionBloque | null {
  const bloque = bloques.find((b) => b.equipo.id === boca.equipo_id);
  const puerto = bloque?.bocas.find((b) => claveBoca(b) === claveBoca(boca));
  return bloque && puerto ? { x: bloque.x + (puerto.lado === 'derecha' ? ANCHO_BLOQUE : 0), y: bloque.y + ALTO_CABECERA + puerto.fila * ALTO_BOCA + ALTO_BOCA / 2 } : null;
}

/**
 * Los extremos de una conexión que el lienzo no puede dibujar: una conexión
 * histórica sin bocas no tiene dónde empezar ni dónde acabar, así que se cuenta
 * y se enseña. Un cable que no se ve y no se dice es un cable olvidado.
 */
export function conexionesSinDibujar(bloques: ReturnType<typeof bloquesDelLienzo>, conexiones: Conexion[], rosetas: ReturnType<typeof bloquesRosetasDelLienzo> = []): string[] {
  return conexiones.filter((c) => c.detalle.estado === 'legacy' ||
    !puntoDeExtremo(bloques, rosetas, c.detalle.origen) ||
    !puntoDeExtremo(bloques, rosetas, c.detalle.destino)).map((c) => c.id);
}

export function bloquesRosetasDelLienzo(tomas: TomaRed[], posiciones: Record<string, PosicionBloque>) {
  let siguienteY = 40;
  return tomas.map((toma) => {
    const alto = ALTO_CABECERA + Math.max(1, toma.bocas.length) * ALTO_BOCA + 12;
    const y = siguienteY;
    siguienteY += alto + 48;
    return {
    toma, etiqueta: toma.codigo,
    ...(posiciones[toma.id] ?? (toma.esquema_x !== null && toma.esquema_y !== null
      ? { x: toma.esquema_x, y: toma.esquema_y }
      : { x: 1540, y })),
    alto,
    bocas: [...toma.bocas].sort((a, b) => a.ordinal - b.ordinal).map((boca, fila) => ({ boca, fila })),
    };
  });
}

export function puntoDeExtremo(
  equipos: ReturnType<typeof bloquesDelLienzo>, rosetas: ReturnType<typeof bloquesRosetasDelLienzo>, extremo: ExtremoConexion,
): PosicionBloque | null {
  if (extremo.tipo === 'equipo') return puntoDeBoca(equipos, extremo);
  const bloque = rosetas.find((b) => b.bocas.some((f) => f.boca.id === extremo.toma_boca_id));
  const fila = bloque?.bocas.find((f) => f.boca.id === extremo.toma_boca_id);
  return bloque && fila ? { x: bloque.x, y: bloque.y + ALTO_CABECERA + fila.fila * ALTO_BOCA + ALTO_BOCA / 2 } : null;
}

export function ordenarExtremos(a: BocaPuerto, b: BocaPuerto, puertos: Puerto[]): [BocaPuerto, BocaPuerto] {
  const pa = puertos.find((p) => p.id === a.puerto_id);
  const pb = puertos.find((p) => p.id === b.puerto_id);
  const primero = { equipo_id: a.equipo_id, puerto_id: a.puerto_id, ordinal: a.ordinal };
  const segundo = { equipo_id: b.equipo_id, puerto_id: b.puerto_id, ordinal: b.ordinal };
  return pa?.sentido === 'entrada' || (pb?.sentido === 'salida' && pa?.sentido !== 'salida') ? [segundo, primero] : [primero, segundo];
}
