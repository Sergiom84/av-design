/**
 * Almacén: existencias, reservas y disponibilidad.
 *
 * Es lógica pura, como `calculo-cable.ts` y `cable-schedule.ts`: entran
 * movimientos y reservas, salen números. No toca la base de datos, así que se
 * puede probar entera sin Postgres.
 *
 * El criterio del departamento (docs/01, apartado 6):
 *  - La existencia **se deriva de los movimientos**. No hay una columna
 *    `stock` que se pueda sobrescribir: eso vuelve a ser un Excel, que es el
 *    problema del que se viene.
 *  - **Disponible = existencias − reservado.** Reservado no es salido: el
 *    material sigue en el estante, pero está comprometido para una obra.
 *    Pedir dos veces lo mismo porque estaba reservado y no se veía es el fallo
 *    que la aplicación viene a evitar.
 *  - Las **bajas** tienen sitio desde el primer día. Lo único que el
 *    departamento tenía apuntado hasta ahora era material retirado y roto.
 */

import type { Articulo, Movimiento, Reserva, TipoMovimiento } from './tipos';

/**
 * Qué signo tiene cada tipo de movimiento sobre la existencia.
 *
 * `ajuste` vale +1 porque su cantidad ya viene con signo: un recuento corrige
 * en los dos sentidos y es el único movimiento que admite negativo.
 *
 * La vista `existencias` de `db/schema.sql` repite esta tabla en SQL. Si se
 * toca una hay que tocar la otra, y la prueba `signo de cada tipo` obliga a
 * que el cambio sea deliberado.
 */
export const SIGNO_MOVIMIENTO: Record<TipoMovimiento, 1 | -1> = {
  entrada: 1,
  devolucion: 1,
  ajuste: 1,
  salida: -1,
  baja: -1,
};

/** Lo que suma o resta un movimiento a la existencia. */
export function efectoMovimiento(m: Pick<Movimiento, 'tipo' | 'cantidad'>): number {
  return SIGNO_MOVIMIENTO[m.tipo] * m.cantidad;
}

export interface ExistenciaPorUbicacion {
  ubicacion_id: string | null;
  cantidad: number;
}

export interface ExistenciaArticulo {
  articulo_id: string;
  /** Suma de todas las ubicaciones. */
  cantidad: number;
  /** Desglose, ordenado de más a menos. Un artículo está en varios sitios. */
  ubicaciones: ExistenciaPorUbicacion[];
}

/**
 * Existencias por artículo y ubicación a partir de los movimientos.
 *
 * Las ubicaciones que quedan a cero se conservan en el desglose: saber que en
 * la furgoneta no queda nada es información, no ruido.
 */
export function calcularExistencias(
  movimientos: Array<Pick<Movimiento, 'articulo_id' | 'ubicacion_id' | 'tipo' | 'cantidad'>>,
): Map<string, ExistenciaArticulo> {
  const porArticulo = new Map<string, Map<string, number>>();

  for (const m of movimientos) {
    const clave = m.ubicacion_id ?? '';
    const ubicaciones = porArticulo.get(m.articulo_id) ?? new Map<string, number>();
    ubicaciones.set(clave, redondear((ubicaciones.get(clave) ?? 0) + efectoMovimiento(m)));
    porArticulo.set(m.articulo_id, ubicaciones);
  }

  const salida = new Map<string, ExistenciaArticulo>();
  for (const [articuloId, ubicaciones] of porArticulo) {
    const desglose = [...ubicaciones.entries()]
      .map(([id, cantidad]) => ({ ubicacion_id: id === '' ? null : id, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
    salida.set(articuloId, {
      articulo_id: articuloId,
      cantidad: redondear(desglose.reduce((t, u) => t + u.cantidad, 0)),
      ubicaciones: desglose,
    });
  }
  return salida;
}

/** Cuánto hay comprometido de cada artículo. Solo cuentan las reservas activas. */
export function calcularReservado(
  reservas: Array<Pick<Reserva, 'articulo_id' | 'cantidad' | 'estado'>>,
): Map<string, number> {
  const total = new Map<string, number>();
  for (const r of reservas) {
    if (r.estado !== 'activa') continue;
    total.set(r.articulo_id, redondear((total.get(r.articulo_id) ?? 0) + r.cantidad));
  }
  return total;
}

export interface Disponibilidad {
  articulo_id: string;
  existencias: number;
  reservado: number;
  /** Existencias menos reservado. Puede ser negativo si se ha sobre-reservado. */
  disponible: number;
  stock_minimo: number | null;
  /** El disponible no llega al mínimo del catálogo. */
  bajo_minimo: boolean;
  /** Hay más reservado que existencias: alguien ha comprometido lo que no hay. */
  sobre_reservado: boolean;
}

/**
 * Lo que se enseña en todas partes: existencias, reservado y disponible juntos.
 *
 * Los tres a la vez y no solo el disponible, a propósito: "quedan 4 pero 4
 * están reservados" y "no queda ninguno" son dos situaciones distintas y se
 * resuelven de forma distinta.
 */
export function calcularDisponibilidad(
  articuloId: string,
  existencias: number,
  reservado: number,
  stockMinimo: number | null,
): Disponibilidad {
  const disponible = redondear(existencias - reservado);
  return {
    articulo_id: articuloId,
    existencias: redondear(existencias),
    reservado: redondear(reservado),
    disponible,
    stock_minimo: stockMinimo,
    bajo_minimo: stockMinimo != null && stockMinimo > 0 && disponible < stockMinimo,
    sobre_reservado: reservado > existencias,
  };
}

/**
 * La disponibilidad de todo el almacén, artículo a artículo.
 *
 * Solo aparece lo que tiene movimientos o reservas: el catálogo son 948
 * referencias y el almacén arranca vacío, así que listar las 948 a cero sería
 * enterrar lo que sí hay.
 */
export function construirDisponibilidad(
  existencias: Map<string, ExistenciaArticulo>,
  reservado: Map<string, number>,
  articulos: Map<string, Pick<Articulo, 'stock_minimo'>>,
): Map<string, Disponibilidad> {
  const ids = new Set([...existencias.keys(), ...reservado.keys()]);
  const salida = new Map<string, Disponibilidad>();
  for (const id of ids) {
    salida.set(
      id,
      calcularDisponibilidad(
        id,
        existencias.get(id)?.cantidad ?? 0,
        reservado.get(id) ?? 0,
        articulos.get(id)?.stock_minimo ?? null,
      ),
    );
  }
  return salida;
}

/**
 * Cuánto se puede reservar todavía de un artículo.
 *
 * Avisa, no bloquea, igual que la validación de conexiones: el técnico puede
 * reservar material que aún no ha llegado porque ya está pedido. Lo que no
 * puede es hacerlo sin enterarse.
 */
export function avisoDeReserva(
  disponibilidad: Disponibilidad | undefined,
  cantidad: number,
): string | null {
  const disponible = disponibilidad?.disponible ?? 0;
  if (cantidad <= disponible) return null;
  if (disponible <= 0) {
    return `No hay disponible: ${disponibilidad?.existencias ?? 0} en almacén y ` +
      `${disponibilidad?.reservado ?? 0} ya reservados.`;
  }
  return `Solo hay ${disponible} disponibles de los ${cantidad} que se reservan.`;
}

/**
 * Cuánto se puede sacar de verdad de una ubicación. Sacar más de lo que hay
 * deja existencia negativa, que no es un error del programa sino un almacén
 * mal contado, y se avisa para que se corrija con un ajuste.
 */
export function avisoDeSalida(
  existencias: number,
  cantidad: number,
): string | null {
  if (cantidad <= existencias) return null;
  return `Se sacan ${cantidad} y en esa ubicación solo constan ${existencias}. ` +
    'La existencia quedará en negativo: hace falta un ajuste de inventario.';
}

/** Solo lo que está por debajo del mínimo del catálogo, de lo más urgente a lo menos. */
export function avisosDeMinimo(
  disponibilidad: Iterable<Disponibilidad>,
): Disponibilidad[] {
  return [...disponibilidad]
    .filter((d) => d.bajo_minimo)
    .sort((a, b) => a.disponible - b.disponible);
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
