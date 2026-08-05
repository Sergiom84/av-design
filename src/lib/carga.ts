/**
 * Lista de carga de la furgoneta y cierre de obra.
 *
 * Lógica pura, sin base de datos. Aquí se decide qué movimientos de almacén
 * genera cada paso; quien los escribe es `src/app/acciones-almacen.ts`.
 *
 * El ciclo completo de una unidad de material:
 *
 *   reserva      · sigue en el estante, pero comprometida. No mueve stock.
 *   carga        · sale del almacén. Un movimiento de `salida`.
 *   cierre       · lo que sobra vuelve como `devolucion`.
 *                  lo roto vuelve como `devolucion` y sale como `baja`.
 *                  lo instalado se queda donde está y no genera nada.
 *
 * Lo roto pasa por devolución antes de la baja a propósito: el neto sobre el
 * stock es cero —ya había salido— y el material averiado queda registrado en
 * `movimientos`, que es exactamente lo que el departamento venía apuntando a
 * mano en la hoja "Almacén" del inventario ("ROTO", "POSIBLEMENTE NO PUEDA
 * REPARARSE"). Sin ese paso, un cierre de obra no dejaría rastro de la avería.
 */

import type { LineaCarga, TipoMovimiento } from './tipos';

/** Lo que la línea de carga aporta al almacén. Sin ids: los pone quien escribe. */
export interface MovimientoDerivado {
  articulo_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string;
}

export interface ResumenCarga {
  lineas: number;
  cargadas: number;
  pendientes: number;
  /** Unidades totales, sumando las de todas las líneas. */
  unidades: number;
  completa: boolean;
}

/**
 * Cuánto queda por marcar. Es lo que se lee de un vistazo, de pie en el
 * almacén, antes de cerrar la furgoneta.
 */
export function resumenCarga(
  lineas: Array<Pick<LineaCarga, 'cantidad' | 'cargado'>>,
): ResumenCarga {
  const cargadas = lineas.filter((l) => l.cargado).length;
  return {
    lineas: lineas.length,
    cargadas,
    pendientes: lineas.length - cargadas,
    unidades: redondear(lineas.reduce((t, l) => t + l.cantidad, 0)),
    completa: lineas.length > 0 && cargadas === lineas.length,
  };
}

/**
 * Los movimientos de salida al dar la carga por cargada.
 *
 * Solo sale lo marcado. Lo que no se ha metido en la furgoneta no puede
 * descontarse del almacén, aunque figure en la lista.
 */
export function movimientosDeSalida(
  lineas: Array<Pick<LineaCarga, 'articulo_id' | 'cantidad' | 'cargado' | 'descripcion'>>,
  nombreCarga: string,
): MovimientoDerivado[] {
  return lineas
    .filter((l) => l.cargado && l.cantidad > 0)
    .map((l) => ({
      articulo_id: l.articulo_id,
      tipo: 'salida' as const,
      cantidad: redondear(l.cantidad),
      motivo: `Carga a obra · ${nombreCarga}`,
    }));
}

/**
 * Los movimientos que deja el cierre de obra.
 *
 * Instalado no genera nada: ya salió del almacén y se ha quedado puesto.
 */
export function movimientosDeCierre(
  lineas: Array<Pick<LineaCarga, 'articulo_id' | 'devuelto' | 'roto' | 'descripcion'>>,
  nombreCarga: string,
): MovimientoDerivado[] {
  const movimientos: MovimientoDerivado[] = [];

  for (const l of lineas) {
    if (l.devuelto > 0) {
      movimientos.push({
        articulo_id: l.articulo_id,
        tipo: 'devolucion',
        cantidad: redondear(l.devuelto),
        motivo: `Sobrante de obra · ${nombreCarga}`,
      });
    }
    if (l.roto > 0) {
      // Entra y sale: neto cero en stock y la avería queda registrada.
      movimientos.push({
        articulo_id: l.articulo_id,
        tipo: 'devolucion',
        cantidad: redondear(l.roto),
        motivo: `Vuelve averiado de obra · ${nombreCarga}`,
      });
      movimientos.push({
        articulo_id: l.articulo_id,
        tipo: 'baja',
        cantidad: redondear(l.roto),
        motivo: `Material averiado en obra · ${nombreCarga}`,
      });
    }
  }

  return movimientos;
}

/**
 * Avisa cuando el reparto del cierre no cuadra con lo que salió.
 *
 * Avisa y no bloquea, igual que la validación de conexiones: en una obra
 * aparece material que nadie había apuntado y desaparece otro. Lo que no puede
 * es pasar desapercibido.
 */
export function avisoDeCierre(
  linea: Pick<LineaCarga, 'cantidad' | 'instalado' | 'devuelto' | 'roto' | 'descripcion'>,
): string | null {
  const repartido = redondear(linea.instalado + linea.devuelto + linea.roto);
  if (repartido === redondear(linea.cantidad)) return null;
  if (repartido < linea.cantidad) {
    return `Salieron ${linea.cantidad} y solo se han repartido ${repartido}: ` +
      `faltan ${redondear(linea.cantidad - repartido)} por decir qué pasó con ellos.`;
  }
  return `Salieron ${linea.cantidad} y se reparten ${repartido}: ` +
    'vuelve o se instala más de lo que se cargó.';
}

/** Todos los avisos de un cierre, con la línea a la que corresponden. */
export function avisosDeCierre(
  lineas: Array<Pick<LineaCarga, 'cantidad' | 'instalado' | 'devuelto' | 'roto' | 'descripcion'>>,
): Array<{ descripcion: string; aviso: string }> {
  return lineas
    .map((l) => ({ descripcion: l.descripcion, aviso: avisoDeCierre(l) }))
    .filter((x): x is { descripcion: string; aviso: string } => x.aviso != null);
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
