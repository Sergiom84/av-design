/**
 * Nombres y códigos de una serie de salas creadas de golpe.
 *
 * Dar de alta 144 salas iguales en un paso solo sirve si cada una sale con su
 * nombre. El patrón es el que escribe el usuario y `#` marca dónde va el
 * número: `África #` da `África 1`, `África ##` da `África 01`. Si no hay
 * ninguna almohadilla y hay más de una sala, el número se añade al final.
 *
 * Es lógica pura y la usan los dos lados: el formulario para enseñar qué se va
 * a crear antes de confirmar, y la acción de servidor para crearlo.
 */

/** Tope de salas por alta. 144 es la serie real más larga del inventario. */
export const MAXIMO_COPIAS = 200;

/** Cifras del número: 3 salas se numeran 01..03; 144, 001..144. */
function anchoDe(total: number): number {
  return Math.max(2, String(Math.max(1, total)).length);
}

/**
 * El nombre de la sala `indice` (empezando en 1) de una serie de `total`.
 * Con `total = 1` el patrón se respeta tal cual, almohadillas incluidas.
 */
export function expandirPatron(
  patron: string,
  indice: number,
  total: number,
): string {
  const almohadillas = patron.match(/#+/g);

  if (almohadillas) {
    return patron.replace(/#+/g, (run) =>
      String(indice).padStart(run.length, '0'),
    );
  }

  if (total <= 1) return patron;
  return `${patron} ${String(indice).padStart(anchoDe(total), '0')}`;
}

/** La serie entera, para enseñarla antes de crear nada. */
export function serieDeNombres(patron: string, total: number): string[] {
  const n = Math.min(MAXIMO_COPIAS, Math.max(1, Math.round(total) || 1));
  return Array.from({ length: n }, (_, i) => expandirPatron(patron, i + 1, n));
}

/**
 * Cómo se resume una serie larga: las dos primeras, las dos últimas y cuántas
 * quedan en medio. Con 144 salas la lista entera no se lee.
 */
export function resumirSerie(nombres: string[]): string {
  if (nombres.length <= 4) return nombres.join(', ');
  const [a, b] = nombres;
  const [y, z] = nombres.slice(-2);
  return `${a}, ${b} … ${y}, ${z}`;
}
