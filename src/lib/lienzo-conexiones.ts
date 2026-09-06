import { bocasDePuerto, claveBoca } from './bocas-puerto';
import { ladoDePuerto } from './diagrama';
import type { BocaPuerto, Conexion, EquipoEnSala, Puerto } from './tipos';

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
    const puertoId = c[`puerto_${lado}_id`];
    if (!puertoId) continue;
    const ordinal = c[`puerto_${lado}_ordinal`];
    // Una conexión histórica sin ordinal reserva la fila completa hasta detallarla.
    const ordinales = ordinal ? [ordinal] : bocasDePuerto(puertos.find((p) => p.id === puertoId) ?? { total: 0 } as Puerto, c[`${lado}_id`]).map((b) => b.ordinal);
    for (const n of ordinales) ocupadas.set(claveBoca({ equipo_id: c[`${lado}_id`], puerto_id: puertoId, ordinal: n }), c.id);
  }
  return ocupadas;
}

export function puntoDeBoca(bloques: ReturnType<typeof bloquesDelLienzo>, boca: BocaPuerto): PosicionBloque | null {
  const bloque = bloques.find((b) => b.equipo.id === boca.equipo_id);
  const puerto = bloque?.bocas.find((b) => claveBoca(b) === claveBoca(boca));
  return bloque && puerto ? { x: bloque.x + (puerto.lado === 'derecha' ? ANCHO_BLOQUE : 0), y: bloque.y + ALTO_CABECERA + puerto.fila * ALTO_BOCA + ALTO_BOCA / 2 } : null;
}

export function ordenarExtremos(a: BocaPuerto, b: BocaPuerto, puertos: Puerto[]): [BocaPuerto, BocaPuerto] {
  const pa = puertos.find((p) => p.id === a.puerto_id);
  const pb = puertos.find((p) => p.id === b.puerto_id);
  const primero = { equipo_id: a.equipo_id, puerto_id: a.puerto_id, ordinal: a.ordinal };
  const segundo = { equipo_id: b.equipo_id, puerto_id: b.puerto_id, ordinal: b.ordinal };
  return pa?.sentido === 'entrada' || (pb?.sentido === 'salida' && pa?.sentido !== 'salida') ? [segundo, primero] : [primero, segundo];
}
