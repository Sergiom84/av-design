export type LineaCompraCiclo = { id: string; pedido_id: string; referencia: string; articulo: string; unidad: string;
  cantidad: number; cantidad_recibida: number; recibida_trazada: number; comprado_en: string | null };
export type EstadoCompraCiclo = 'sin_datos' | 'pendiente' | 'parcial' | 'total' | 'sin_acreditar';
export type ComprasCiclo = { disponible: boolean; lineas: LineaCompraCiclo[]; compra: EstadoCompraCiclo; recepcion: EstadoCompraCiclo };
/** No sumar metros y unidades ni atribuir pedidos de obra a una sala por intuición. */
export function resumirComprasCiclo(lineas: LineaCompraCiclo[], disponible = true): ComprasCiclo {
  if (!disponible || !lineas.length) return { disponible, lineas, compra: 'sin_datos', recepcion: 'sin_datos' };
  const compradas = lineas.filter((l) => l.comprado_en != null).length;
  const completa = (l: LineaCompraCiclo) => l.cantidad > 0 && l.cantidad_recibida >= l.cantidad && l.recibida_trazada >= l.cantidad;
  const alguna = lineas.some((l) => Math.min(l.cantidad_recibida, l.recibida_trazada) > 0);
  return { disponible, lineas, compra: compradas === lineas.length ? 'total' : compradas ? 'parcial' : 'pendiente',
    recepcion: lineas.every(completa) ? 'total' : alguna ? 'parcial' : lineas.some((l) => l.cantidad_recibida > 0) ? 'sin_acreditar' : 'pendiente' };
}
