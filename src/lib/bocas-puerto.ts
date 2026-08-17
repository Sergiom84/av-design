import type { BocaPuerto, Puerto } from '@/lib/tipos';

export interface OpcionBocaPuerto extends BocaPuerto {
  etiqueta: string;
}

/** Expande una fila `OUTPUT × 4` sin seleccionar ni reservar ninguna boca. */
export function bocasDePuerto(puerto: Puerto, equipoId: string): OpcionBocaPuerto[] {
  if (!Number.isInteger(puerto.total) || puerto.total < 1) return [];
  return Array.from({ length: puerto.total }, (_, indice) => ({
    equipo_id: equipoId,
    puerto_id: puerto.id,
    ordinal: indice + 1,
    etiqueta: puerto.total === 1 ? puerto.nombre : `${puerto.nombre} ${indice + 1}`,
  }));
}

export function claveBoca(boca: BocaPuerto): string {
  return `${boca.equipo_id}:${boca.puerto_id}:${boca.ordinal}`;
}

export function ordinalValido(ordinal: number, total: number): boolean {
  return Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= total;
}
