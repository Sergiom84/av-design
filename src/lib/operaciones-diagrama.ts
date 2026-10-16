import { ANCHO_BLOQUE, bloquesDelLienzo, type PosicionBloque } from './lienzo-conexiones';
import { columnaDeEquipo } from './diagrama';
import type { Conexion, EquipoEnSala, Puerto } from './tipos';

export type PosicionesDiagrama = Record<string, PosicionBloque>;
export type OperacionDiagrama = 'alinear_izquierda' | 'alinear_arriba' | 'distribuir_horizontal' | 'distribuir_vertical' | 'ordenar';
export const ETIQUETA_OPERACION: Record<OperacionDiagrama, string> = { alinear_izquierda: 'Alinear izquierda', alinear_arriba: 'Alinear arriba', distribuir_horizontal: 'Distribuir horizontal', distribuir_vertical: 'Distribuir vertical', ordenar: 'Ordenar por flujo' };
const SEPARACION = 64;

/** Sólo devuelve posiciones visuales. No recibe ni modifica metros/rutas. */
export function reorganizarDiagrama(equipos: EquipoEnSala[], puertos: Puerto[], conexiones: Conexion[], posiciones: PosicionesDiagrama, seleccion: string[], operacion: OperacionDiagrama): PosicionesDiagrama {
  const todos = bloquesDelLienzo(equipos, puertos, posiciones);
  const elegidos = todos.filter(b => seleccion.includes(b.equipo.id));
  const resultado = Object.fromEntries(todos.map(b => [b.equipo.id, { x: b.x, y: b.y }]));
  if (elegidos.length < 2) return resultado;
  const minX = Math.min(...elegidos.map(b => b.x)); const minY = Math.min(...elegidos.map(b => b.y));
  if (operacion === 'ordenar') {
    const columnas = [0, 1, 2, 3].map(c => elegidos.filter(b => columnaDeEquipo(b.equipo.id, conexiones) === c).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es') || a.equipo.id.localeCompare(b.equipo.id))).filter(l => l.length);
    columnas.forEach((lista, i) => { let y = minY; for (const b of lista) { resultado[b.equipo.id] = { x: minX + i * (ANCHO_BLOQUE + 160), y }; y += b.alto + SEPARACION; } });
  } else {
    const horizontal = operacion === 'alinear_arriba' || operacion === 'distribuir_horizontal';
    const orden = [...elegidos].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y) || a.equipo.id.localeCompare(b.equipo.id));
    const total = orden.reduce((n, b) => n + (horizontal ? ANCHO_BLOQUE : b.alto), 0);
    const extremo = Math.max(...orden.map(b => horizontal ? b.x + ANCHO_BLOQUE : b.y + b.alto));
    const hueco = Math.max(SEPARACION, (extremo - (horizontal ? minX : minY) - total) / (orden.length - 1));
    let eje = horizontal ? minX : minY;
    for (const b of orden) {
      resultado[b.equipo.id] = { x: horizontal ? eje : operacion === 'alinear_izquierda' ? minX : b.x, y: horizontal ? operacion === 'alinear_arriba' ? minY : b.y : eje };
      eje += (horizontal ? ANCHO_BLOQUE : b.alto) + hueco;
    }
  }
  return resultado;
}
