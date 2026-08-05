/**
 * Qué falta para una obra y qué hay que pedir a cada proveedor.
 *
 * Lógica pura, sin base de datos, como `calculo-cable.ts`. La cadena completa:
 *
 *   necesidad de la sala  =  equipamiento  +  material de cable calculado
 *   falta                 =  necesidad     −  disponible en almacén
 *   pedido                =  falta agrupada por proveedor
 *
 * El material de cable lo da `agruparMaterialCable()` (calculo-cable.ts), que
 * está congelado: aquí solo se lee su salida.
 *
 * Un precio orientativo sirve para dimensionar el pedido y no para mandarlo.
 * Se puede presupuestar con él; pedir material con un precio que no es una
 * oferta escrita es cómo se acaba pagando otra cosa.
 */

import type { LineaMaterialCable } from './calculo-cable';
import type { Articulo, EquipoEnSala, EstadoPedido, UnidadMedida } from './tipos';

/** De dónde sale una línea: del equipamiento de la sala o del cálculo de cable. */
export type OrigenNecesidad = 'equipo' | 'cable';

export interface LineaNecesidad {
  articulo_id: string;
  descripcion: string;
  unidad: UnidadMedida;
  cantidad: number;
  origenes: OrigenNecesidad[];
  /** Lo que hay detrás de la cantidad: "2 latiguillos de 3 m", "48,5 m". */
  detalle: string[];
}

/**
 * Lo que hace falta para dejar la sala montada.
 *
 * Los equipos sin artículo de catálogo se quedan fuera: no se puede pedir algo
 * que no tiene referencia. La página los enseña aparte, porque saber que hay
 * dos equipos escritos a mano y sin catalogar es justo lo que hay que resolver
 * antes de comprar.
 */
export function necesidadDeSala(
  equipos: Array<Pick<EquipoEnSala, 'articulo_id' | 'nombre' | 'cantidad'>>,
  materialCable: LineaMaterialCable[],
  articulos: Map<string, Pick<Articulo, 'marca' | 'modelo' | 'unidad'>>,
): LineaNecesidad[] {
  const lineas = new Map<string, LineaNecesidad>();

  const acumular = (
    articuloId: string,
    descripcion: string,
    unidad: UnidadMedida,
    cantidad: number,
    origen: OrigenNecesidad,
    detalle: string,
  ) => {
    const actual = lineas.get(articuloId);
    if (!actual) {
      lineas.set(articuloId, {
        articulo_id: articuloId,
        descripcion,
        unidad,
        cantidad: redondear(cantidad),
        origenes: [origen],
        detalle: [detalle],
      });
      return;
    }
    actual.cantidad = redondear(actual.cantidad + cantidad);
    if (!actual.origenes.includes(origen)) actual.origenes.push(origen);
    actual.detalle.push(detalle);
  };

  for (const e of equipos) {
    if (!e.articulo_id) continue;
    const a = articulos.get(e.articulo_id);
    const descripcion = a ? `${a.marca ?? ''} ${a.modelo}`.trim() : e.nombre;
    acumular(
      e.articulo_id,
      descripcion,
      a?.unidad ?? 'ud',
      e.cantidad,
      'equipo',
      `${e.cantidad} × ${e.nombre}`,
    );
  }

  for (const l of materialCable) {
    if (!l.articulo_id) continue;
    acumular(l.articulo_id, l.descripcion, l.unidad, l.cantidad, 'cable', l.a_pedir);
  }

  return [...lineas.values()].sort((a, b) =>
    a.descripcion.localeCompare(b.descripcion, 'es'),
  );
}

export interface LineaFaltante extends LineaNecesidad {
  /** Existencias menos reservado para otras obras, en el momento de mirar. */
  disponible: number;
  /** Lo que hay que comprar. Nunca negativo: sobrar no es faltar. */
  falta: number;
}

/**
 * Necesario − disponible = lo que hay que comprar.
 *
 * `reservadoParaEstaSala` se suma al disponible porque ya está apartado para
 * esta obra: si no, el material que uno mismo ha reservado saldría como
 * faltante y se compraría dos veces, que es el fallo original.
 */
export function calcularFaltante(
  necesidad: LineaNecesidad[],
  disponible: Map<string, number>,
  reservadoParaEstaSala: Map<string, number> = new Map(),
): LineaFaltante[] {
  return necesidad.map((l) => {
    const enAlmacen = redondear(
      (disponible.get(l.articulo_id) ?? 0) + (reservadoParaEstaSala.get(l.articulo_id) ?? 0),
    );
    return {
      ...l,
      disponible: enAlmacen,
      falta: redondear(Math.max(0, l.cantidad - enAlmacen)),
    };
  });
}

export interface LineaCompra {
  articulo_id: string;
  descripcion: string;
  unidad: UnidadMedida;
  cantidad: number;
  precio_unitario: number | null;
  /** El precio no es una oferta cerrada: vale para presupuestar, no para pedir. */
  precio_orientativo: boolean;
  importe: number | null;
}

export interface GrupoProveedor {
  /** Nulo cuando el artículo no tiene proveedor asignado en el catálogo. */
  proveedor: string | null;
  lineas: LineaCompra[];
  /** Suma de los importes conocidos. Nulo si no se sabe el precio de ninguno. */
  total: number | null;
  /** Cuántas líneas se valoran con un precio orientativo. */
  lineas_orientativas: number;
  /** Cuántas líneas no tienen precio de ninguna clase. */
  lineas_sin_precio: number;
}

/**
 * Lo que falta, agrupado por proveedor, que es como se manda un pedido.
 *
 * Los grupos con precio orientativo o sin precio quedan marcados, y salen los
 * últimos: son los que hay que resolver antes de poder pedir de verdad.
 */
export function agruparPorProveedor(
  faltantes: LineaFaltante[],
  articulos: Map<string, Pick<Articulo, 'proveedor' | 'coste' | 'coste_orientativo'>>,
): GrupoProveedor[] {
  const grupos = new Map<string, GrupoProveedor>();

  for (const f of faltantes) {
    if (f.falta <= 0) continue;
    const a = articulos.get(f.articulo_id);
    const proveedor = a?.proveedor ?? null;
    const clave = proveedor ?? '';
    const grupo = grupos.get(clave) ?? {
      proveedor,
      lineas: [],
      total: null,
      lineas_orientativas: 0,
      lineas_sin_precio: 0,
    };

    const precio = a?.coste ?? null;
    const orientativo = precio != null && a?.coste_orientativo === true;
    grupo.lineas.push({
      articulo_id: f.articulo_id,
      descripcion: f.descripcion,
      unidad: f.unidad,
      cantidad: f.falta,
      precio_unitario: precio,
      precio_orientativo: orientativo,
      importe: precio != null ? redondear(precio * f.falta) : null,
    });
    if (orientativo) grupo.lineas_orientativas += 1;
    if (precio == null) grupo.lineas_sin_precio += 1;

    grupos.set(clave, grupo);
  }

  for (const g of grupos.values()) {
    const conocidos = g.lineas
      .map((l) => l.importe)
      .filter((i): i is number => i != null);
    g.total = conocidos.length ? redondear(conocidos.reduce((t, i) => t + i, 0)) : null;
    g.lineas.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
  }

  return [...grupos.values()].sort((a, b) => {
    // Primero lo que se puede pedir tal cual; al final lo que hay que resolver.
    const problemaA = a.lineas_sin_precio + a.lineas_orientativas > 0 ? 1 : 0;
    const problemaB = b.lineas_sin_precio + b.lineas_orientativas > 0 ? 1 : 0;
    if (problemaA !== problemaB) return problemaA - problemaB;
    return (a.proveedor ?? 'ZZZ').localeCompare(b.proveedor ?? 'ZZZ', 'es');
  });
}

/**
 * En qué estado deja un pedido lo que se ha recibido.
 *
 * Un pedido en borrador no cambia por recibir material: primero se manda. Del
 * resto lo dice la recepción, no quien teclea, para que no haya un pedido
 * marcado como recibido con líneas a medias.
 */
export function estadoPorRecepcion(
  estadoActual: EstadoPedido,
  lineas: Array<{ cantidad: number; cantidad_recibida: number }>,
): EstadoPedido {
  if (estadoActual === 'borrador') return 'borrador';
  if (lineas.length === 0) return estadoActual;
  const completas = lineas.every((l) => l.cantidad_recibida >= l.cantidad);
  if (completas) return 'recibido';
  const alguna = lineas.some((l) => l.cantidad_recibida > 0);
  return alguna ? 'recibido_parcial' : 'pedido';
}

/** Lo que queda por llegar de una línea. Nunca negativo: recibir de más es cerrar. */
export function pendienteDeRecibir(linea: {
  cantidad: number;
  cantidad_recibida: number;
}): number {
  return redondear(Math.max(0, linea.cantidad - linea.cantidad_recibida));
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
