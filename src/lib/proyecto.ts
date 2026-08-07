/**
 * La portada operativa de la obra: agrupar sus salas por localización y
 * resumir en qué estado está el conjunto. Lógica pura, sin base de datos.
 *
 * El estado de cada sala en la portada es deliberadamente ligero: sale de
 * sus medidas y sus hitos, no de rehacer `revisarMontaje()` sala a sala
 * (catorce consultas por sala × N salas es la trampa de rendimiento). El
 * semáforo completo se mira en la ficha de la sala.
 */

import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/nombres-proyecto';

export interface SalaDePortada {
  id: string;
  nombre: string;
  codigo: string | null;
  localizacion_id: string | null;
  largo_m: number;
  ancho_m: number;
  alto_m: number;
  /** Cuántas tiradas tiene: con cero no hay tabla de cables. */
  n_conexiones: number;
  instalada: boolean;
  entregada: boolean;
}

export type EstadoSalaPortada = 'sin_medidas' | 'en_diseno' | 'instalada' | 'entregada';

export const ETIQUETA_ESTADO_SALA: Record<EstadoSalaPortada, string> = {
  sin_medidas: 'sin medidas',
  en_diseno: 'en diseño',
  instalada: 'instalada',
  entregada: 'entregada',
};

/** El estado más avanzado manda: una sala entregada ya no está "en diseño". */
export function estadoDeSalaEnPortada(sala: SalaDePortada): EstadoSalaPortada {
  if (sala.entregada) return 'entregada';
  if (sala.instalada) return 'instalada';
  if (!sala.largo_m || !sala.ancho_m || !sala.alto_m) return 'sin_medidas';
  return 'en_diseno';
}

export interface GrupoLocalizacion {
  id: string;
  nombre: string;
  salas: SalaDePortada[];
}

/**
 * Todas las localizaciones, incluidas las vacías (una planta recién creada
 * sin salas es información, no ruido), con "Sin asignar" al final.
 */
export function agruparSalasPorLocalizacion(
  localizaciones: Array<{ id: string; nombre: string }>,
  salas: SalaDePortada[],
): GrupoLocalizacion[] {
  const grupos = localizaciones.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    salas: salas.filter((s) => s.localizacion_id === l.id),
  }));
  return grupos.sort((a, b) => {
    if (a.nombre === LOCALIZACION_SIN_ASIGNAR) return 1;
    if (b.nombre === LOCALIZACION_SIN_ASIGNAR) return -1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

export interface ResumenProyecto {
  salas: number;
  sin_medidas: number;
  en_diseno: number;
  instaladas: number;
  entregadas: number;
  /** Pedidos que no están en borrador ni recibidos del todo. */
  pedidos_en_curso: number;
}

export function resumenDeProyecto(entrada: {
  salas: SalaDePortada[];
  pedidos: Array<{ estado: string }>;
}): ResumenProyecto {
  const estados = entrada.salas.map(estadoDeSalaEnPortada);
  return {
    salas: entrada.salas.length,
    sin_medidas: estados.filter((e) => e === 'sin_medidas').length,
    en_diseno: estados.filter((e) => e === 'en_diseno').length,
    instaladas: estados.filter((e) => e === 'instalada').length,
    entregadas: estados.filter((e) => e === 'entregada').length,
    pedidos_en_curso: entrada.pedidos.filter(
      (p) => p.estado !== 'borrador' && p.estado !== 'recibido',
    ).length,
  };
}
