/** Proyección de atribuciones explícitas de unidades comerciales; no lee stock. */
export interface SuministroParaCobertura {
  id: string;
  articulo_id: string;
}

export interface AsignacionPedidoParaCobertura {
  suministro_id: string;
  cantidad: number;
  cantidad_recibida: number;
}

export interface ReservaParaCobertura {
  suministro_id: string;
  cantidad: number;
  estado: 'activa' | 'liberada' | 'servida';
}

export type TipoMovimientoCobertura = 'entrada' | 'salida' | 'devolucion' | 'baja';

export interface MovimientoParaCobertura {
  suministro_id: string;
  movimiento_id: string;
  tipo: TipoMovimientoCobertura;
  cantidad: number;
  salida_movimiento_id: string | null;
}

export interface MovimientoSinAtribuir {
  movimiento_id: string;
  articulo_id: string;
  tipo: TipoMovimientoCobertura;
  cantidad: number;
}

export interface AvisoMovimientoSinAtribuir extends MovimientoSinAtribuir {
  aviso: string;
}

export interface CoberturaSuministro {
  suministro_id: string;
  articulo_id: string;
  pedido: number;
  recibido: number;
  pendienteRecibir: number;
  reservado: number;
  servido: number;
  coberturaFisica: number;
  /** Demanda física pendiente, no pendiente de recepción. */
  pendiente: number;
}

export interface EntradaCoberturaSuministros {
  /** Unidades demandadas activas; cada suministro representa una unidad. */
  suministros: readonly SuministroParaCobertura[];
  asignacionesPedido: readonly AsignacionPedidoParaCobertura[];
  reservas: readonly ReservaParaCobertura[];
  movimientos: readonly MovimientoParaCobertura[];
  /** Cantidad todavía sin atribuir; no se vuelve a deducir desde el artículo. */
  movimientosSinAtribuir?: readonly MovimientoSinAtribuir[];
}

export class ErrorCoberturaSuministro extends Error {}

function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorCoberturaSuministro(mensaje);
}

function identidad(valor: string, campo: string) {
  exigir(typeof valor === 'string' && valor.trim().length > 0, `${campo}: identificador vacío.`);
}

function cantidad(valor: number, campo: string, permiteCero = false) {
  exigir(Number.isSafeInteger(valor) && valor >= (permiteCero ? 0 : 1),
    `${campo}: se requiere una cantidad entera ${permiteCero ? 'no negativa' : 'positiva'}.`);
}

function tipoMovimiento(tipo: TipoMovimientoCobertura) {
  exigir(['entrada', 'salida', 'devolucion', 'baja'].includes(tipo), 'Tipo de movimiento desconocido.');
}

/**
 * Pedido/recepción acreditan procedencia comercial, nunca cobertura física.
 * Las devoluciones descuentan exclusivamente la salida enlazada del suministro.
 * La coherencia con cantidades de registros canónicos corresponde a la BD:
 * esta entrada solo contiene sus atribuciones, no esos registros completos.
 */
export function proyectarCoberturaSuministros(entrada: EntradaCoberturaSuministros): {
  porSuministro: Map<string, CoberturaSuministro>;
  avisosSinAtribuir: AvisoMovimientoSinAtribuir[];
} {
  const porSuministro = new Map<string, CoberturaSuministro>();
  for (const suministro of entrada.suministros) {
    identidad(suministro.id, 'Suministro');
    identidad(suministro.articulo_id, 'Artículo');
    exigir(!porSuministro.has(suministro.id), `Suministro duplicado: ${suministro.id}.`);
    porSuministro.set(suministro.id, {
      suministro_id: suministro.id, articulo_id: suministro.articulo_id,
      pedido: 0, recibido: 0, pendienteRecibir: 0, reservado: 0, servido: 0,
      coberturaFisica: 0, pendiente: 1,
    });
  }
  const obtener = (id: string) => {
    const suministro = porSuministro.get(id);
    exigir(suministro !== undefined, `Atribución a suministro desconocido: ${id}.`);
    return suministro;
  };

  for (const asignacion of entrada.asignacionesPedido) {
    const suministro = obtener(asignacion.suministro_id);
    cantidad(asignacion.cantidad, 'Pedido');
    cantidad(asignacion.cantidad_recibida, 'Recepción', true);
    exigir(asignacion.cantidad_recibida <= asignacion.cantidad, 'Recepción superior al pedido atribuido.');
    suministro.pedido += asignacion.cantidad;
    suministro.recibido += asignacion.cantidad_recibida;
    exigir(suministro.pedido <= 1, 'El pedido atribuido supera la demanda de una unidad.');
  }
  for (const reserva of entrada.reservas) {
    const suministro = obtener(reserva.suministro_id);
    cantidad(reserva.cantidad, 'Reserva');
    exigir(['activa', 'liberada', 'servida'].includes(reserva.estado), 'Estado de reserva desconocido.');
    exigir(reserva.cantidad <= 1, 'La reserva atribuida supera una unidad.');
    if (reserva.estado === 'activa') suministro.reservado += reserva.cantidad;
  }

  const porMovimiento = new Map<string, Map<string, MovimientoParaCobertura>>();
  const identidadMovimientos = new Map<string, TipoMovimientoCobertura>();
  for (const movimiento of entrada.movimientos) {
    obtener(movimiento.suministro_id);
    identidad(movimiento.movimiento_id, 'Movimiento');
    cantidad(movimiento.cantidad, 'Movimiento');
    tipoMovimiento(movimiento.tipo);
    exigir(movimiento.cantidad <= 1, 'El movimiento atribuido supera una unidad.');
    if (movimiento.salida_movimiento_id !== null) identidad(movimiento.salida_movimiento_id, 'Salida original');
    if (movimiento.tipo === 'entrada' || movimiento.tipo === 'salida') {
      exigir(movimiento.salida_movimiento_id === null, 'Una entrada o salida no puede ser un retorno de otra salida.');
    }
    const identidadAnterior = identidadMovimientos.get(movimiento.movimiento_id);
    exigir(!identidadAnterior || identidadAnterior === movimiento.tipo, 'Un movimiento tiene identidades contradictorias.');
    identidadMovimientos.set(movimiento.movimiento_id, movimiento.tipo);
    // El tipo es del movimiento; la salida original es de cada atribución.
    const atribuciones = porMovimiento.get(movimiento.movimiento_id) ?? new Map<string, MovimientoParaCobertura>();
    exigir(!atribuciones.has(movimiento.suministro_id), 'Atribución de movimiento duplicada.');
    atribuciones.set(movimiento.suministro_id, movimiento);
    porMovimiento.set(movimiento.movimiento_id, atribuciones);
  }

  const devueltoPorSalida = new Map<string, Map<string, number>>();
  for (const movimiento of entrada.movimientos) {
    const suministro = obtener(movimiento.suministro_id);
    if (movimiento.tipo === 'salida') suministro.servido += movimiento.cantidad;
    if (movimiento.tipo === 'devolucion' || movimiento.salida_movimiento_id !== null) {
      const salida = porMovimiento.get(movimiento.salida_movimiento_id ?? '')?.get(movimiento.suministro_id);
      exigir(salida?.tipo === 'salida', 'El retorno exige una salida del mismo suministro.');
      if (movimiento.tipo === 'devolucion') {
        const devueltos = devueltoPorSalida.get(salida.movimiento_id) ?? new Map<string, number>();
        const total = (devueltos.get(movimiento.suministro_id) ?? 0) + movimiento.cantidad;
        exigir(total <= salida.cantidad, 'Las devoluciones superan la salida atribuida.');
        devueltos.set(movimiento.suministro_id, total);
        devueltoPorSalida.set(salida.movimiento_id, devueltos);
        suministro.servido -= movimiento.cantidad;
      }
    }
  }

  for (const suministro of porSuministro.values()) {
    exigir(suministro.servido >= 0 && suministro.servido <= 1, 'La salida neta atribuida queda fuera de la demanda.');
    suministro.coberturaFisica = suministro.reservado + suministro.servido;
    exigir(suministro.coberturaFisica <= 1, 'Reserva y salida neta exceden la demanda de una unidad.');
    suministro.pendiente = 1 - suministro.coberturaFisica;
    suministro.pendienteRecibir = suministro.pedido - suministro.recibido;
  }

  const legacyVistos = new Set<string>();
  const avisosSinAtribuir = (entrada.movimientosSinAtribuir ?? []).map((movimiento) => {
    identidad(movimiento.movimiento_id, 'Movimiento sin atribuir');
    identidad(movimiento.articulo_id, 'Artículo sin atribuir');
    cantidad(movimiento.cantidad, 'Cantidad sin atribuir');
    tipoMovimiento(movimiento.tipo);
    exigir(!legacyVistos.has(movimiento.movimiento_id), 'Movimiento sin atribuir duplicado.');
    legacyVistos.add(movimiento.movimiento_id);
    return { ...movimiento, aviso: `${movimiento.cantidad} unidades sin atribuir; no acreditan cobertura de ningún suministro.` };
  });
  return { porSuministro, avisosSinAtribuir };
}
