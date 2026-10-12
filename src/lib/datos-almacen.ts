import 'server-only';
import type { Sql,TransactionSql } from 'postgres';
import { sql } from './db';
import { calcularDisponibilidad, type Disponibilidad } from './almacen';
import {
  agruparMaterialCable,
  calcularConexion,
  type ResultadoCable,
} from './calculo-cable';
import { agruparPorProveedor, calcularFaltante, necesidadDeSala } from './compras';
import { listarArticulos, obtenerParametros, obtenerSala, type SalaCompleta } from './datos';
import type {
  Carga,
  EstadoCarga,
  EstadoPedido,
  LineaCarga,
  LineaPedido,
  Movimiento,
  Pedido,
  Reserva,
  Ubicacion,
  UnidadMedida,
} from './tipos';

/**
 * Lectura del almacén, las reservas, los pedidos y las cargas.
 *
 * Va aparte de `datos.ts` por el mismo motivo que los componentes van en
 * carpetas: la Fase 2 es un bloque entero y meterlo en el módulo de la Fase 1
 * lo convertiría en un cajón de sastre.
 *
 * Las existencias se leen de la vista `existencias`, que suma los movimientos.
 * No hay ninguna columna de stock que escribir.
 */

type Fila = Record<string, unknown>;

const n = (v: unknown): number | null => (v == null ? null : Number(v));
const s = (v: unknown): string | null => (v == null ? null : String(v));
const fecha = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : s(v);
const dia = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : s(v);

// ------------------------------------------------------------- ubicaciones
function aUbicacion(f: Fila): Ubicacion {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    descripcion: s(f.descripcion),
    es_furgoneta: f.es_furgoneta === true,
    activa: f.activa !== false,
  };
}

export async function listarUbicaciones(cliente: Sql | TransactionSql = sql): Promise<Ubicacion[]> {
  const filas = await cliente<Fila[]>`
    select * from ubicaciones where activa order by es_furgoneta, nombre`;
  return filas.map(aUbicacion);
}

// --------------------------------------------------------------- existencias
export interface FilaAlmacen extends Disponibilidad {
  descripcion: string;
  referencia: string | null;
  categoria: string;
  unidad: UnidadMedida;
  proveedor: string | null;
  /** Dónde está, ya resuelto el nombre de la ubicación. */
  ubicaciones: Array<{ ubicacion: string; cantidad: number }>;
}

/**
 * El almacén entero: existencias, reservado y disponible por artículo.
 *
 * Solo sale lo que se ha movido o se ha reservado alguna vez. El catálogo son
 * 948 referencias y el almacén arranca de cero: listarlas todas a cero sería
 * enterrar lo poco que sí hay.
 */
export async function listarAlmacen(): Promise<FilaAlmacen[]> {
  const filas = await sql<Fila[]>`
    with existencia as (
      select articulo_id, sum(cantidad) as cantidad
      from existencias group by articulo_id
    ),
    reservado as (
      select articulo_id, sum(cantidad) as cantidad
      from reservas where estado = 'activa' group by articulo_id
    ),
    detalle as (
      select e.articulo_id,
             json_agg(
               json_build_object(
                 'ubicacion', coalesce(u.nombre, 'Sin ubicación'),
                 'cantidad', e.cantidad
               ) order by e.cantidad desc
             ) as ubicaciones
      from existencias e
      left join ubicaciones u on u.id = e.ubicacion_id
      group by e.articulo_id
    )
    select a.id, a.referencia, a.categoria, a.marca, a.modelo, a.unidad,
           a.stock_minimo, pv.nombre as proveedor,
           coalesce(ex.cantidad, 0) as existencias,
           coalesce(rs.cantidad, 0) as reservado,
           coalesce(d.ubicaciones, '[]') as ubicaciones
    from articulos a
    left join proveedores pv on pv.id = a.proveedor_id
    left join existencia ex on ex.articulo_id = a.id
    left join reservado  rs on rs.articulo_id = a.id
    left join detalle    d  on d.articulo_id  = a.id
    where ex.articulo_id is not null or rs.articulo_id is not null
    order by a.marca nulls last, a.modelo`;

  return filas.map((f) => ({
    ...calcularDisponibilidad(
      String(f.id),
      Number(f.existencias),
      Number(f.reservado),
      n(f.stock_minimo),
    ),
    descripcion: `${s(f.marca) ?? ''} ${String(f.modelo)}`.trim(),
    referencia: s(f.referencia),
    categoria: String(f.categoria),
    unidad: (f.unidad as UnidadMedida) ?? 'ud',
    proveedor: s(f.proveedor),
    ubicaciones: (f.ubicaciones as Array<{ ubicacion: string; cantidad: string }>).map(
      (u) => ({ ubicacion: u.ubicacion, cantidad: Number(u.cantidad) }),
    ),
  }));
}

/**
 * Disponible por artículo, para una lista concreta. Es lo que necesita la sala
 * para saber qué le falta sin traerse el almacén entero.
 */
export async function disponibilidadDeArticulos(
  ids: string[],
  cliente:Sql|TransactionSql=sql,
): Promise<Map<string, Disponibilidad>> {
  if (ids.length === 0) return new Map();
  const filas = await cliente<Fila[]>`
    select a.id, a.stock_minimo,
           coalesce((select sum(cantidad) from existencias e where e.articulo_id = a.id), 0)
             as existencias,
           coalesce((select sum(cantidad) from reservas r
                     where r.articulo_id = a.id and r.estado = 'activa'), 0)
             as reservado
    from articulos a
    where a.id in ${cliente(ids)}`;
  return new Map(
    filas.map((f) => [
      String(f.id),
      calcularDisponibilidad(
        String(f.id),
        Number(f.existencias),
        Number(f.reservado),
        n(f.stock_minimo),
      ),
    ]),
  );
}

/** Existencias de un artículo en cada ubicación. Para elegir de dónde se saca. */
export async function existenciasPorUbicacion(
  articuloId: string,
): Promise<Array<{ ubicacion_id: string | null; ubicacion: string; cantidad: number }>> {
  const filas = await sql<Fila[]>`
    select e.ubicacion_id, coalesce(u.nombre, 'Sin ubicación') as ubicacion, e.cantidad
    from existencias e
    left join ubicaciones u on u.id = e.ubicacion_id
    where e.articulo_id = ${articuloId}
    order by e.cantidad desc`;
  return filas.map((f) => ({
    ubicacion_id: s(f.ubicacion_id),
    ubicacion: String(f.ubicacion),
    cantidad: Number(f.cantidad),
  }));
}

// --------------------------------------------------------------- movimientos
export interface FilaMovimiento extends Movimiento {
  descripcion: string;
  ubicacion: string | null;
  sala: string | null;
}

const aMovimiento = (f: Fila): FilaMovimiento => ({
  id: String(f.id),
  articulo_id: String(f.articulo_id),
  ubicacion_id: s(f.ubicacion_id),
  tipo: f.tipo as Movimiento['tipo'],
  cantidad: Number(f.cantidad),
  sala_id: s(f.sala_id),
  motivo: s(f.motivo),
  quien: s(f.quien),
  fecha: fecha(f.fecha) ?? '',
  descripcion: `${s(f.marca) ?? ''} ${String(f.modelo)}`.trim(),
  ubicacion: s(f.ubicacion),
  sala: s(f.sala),
});

/**
 * El tronco común de las tres consultas de movimientos. Es una función y no una
 * constante porque un fragmento construido al cargar el módulo abriría la
 * conexión durante `next build`, cuando todavía no hay DATABASE_URL.
 */
const selectMovimientos = () => sql`
  select m.*, a.marca, a.modelo, u.nombre as ubicacion, sa.nombre as sala
  from movimientos m
  join articulos a on a.id = m.articulo_id
  left join ubicaciones u on u.id = m.ubicacion_id
  left join salas sa on sa.id = m.sala_id`;

export async function listarMovimientos(limite = 100): Promise<FilaMovimiento[]> {
  const filas = await sql<Fila[]>`
    ${selectMovimientos()} order by m.fecha desc, m.creado_en desc limit ${limite}`;
  return filas.map(aMovimiento);
}

export async function movimientosDeArticulo(id: string): Promise<FilaMovimiento[]> {
  const filas = await sql<Fila[]>`
    ${selectMovimientos()} where m.articulo_id = ${id}
    order by m.fecha desc, m.creado_en desc`;
  return filas.map(aMovimiento);
}

/**
 * Material averiado y retirado. Es lo único que el departamento tenía apuntado
 * hasta ahora, y en texto libre: "ROTO", "POSIBLEMENTE NO PUEDA REPARARSE".
 */
export async function listarBajas(limite = 200): Promise<FilaMovimiento[]> {
  const filas = await sql<Fila[]>`
    ${selectMovimientos()} where m.tipo = 'baja'
    order by m.fecha desc limit ${limite}`;
  return filas.map(aMovimiento);
}

// ------------------------------------------------------------------ reservas
export interface FilaReserva extends Reserva {
  descripcion: string;
  unidad: UnidadMedida;
  sala: string;
}

const aReserva = (f: Fila): FilaReserva => ({
  id: String(f.id),
  sala_id: String(f.sala_id),
  articulo_id: String(f.articulo_id),
  cantidad: Number(f.cantidad),
  estado: f.estado as Reserva['estado'],
  notas: s(f.notas),
  quien: s(f.quien),
  descripcion: `${s(f.marca) ?? ''} ${String(f.modelo)}`.trim(),
  unidad: (f.unidad as UnidadMedida) ?? 'ud',
  sala: String(f.sala),
});

export async function reservasDeSala(salaId: string,cliente:Sql|TransactionSql=sql): Promise<FilaReserva[]> {
  const filas = await cliente<Fila[]>`
    select r.*, a.marca, a.modelo, a.unidad, sa.nombre as sala
    from reservas r
    join articulos a on a.id = r.articulo_id
    join salas sa on sa.id = r.sala_id
    where r.sala_id = ${salaId}
    order by r.estado, a.marca nulls last, a.modelo`;
  return filas.map(aReserva);
}

export async function listarReservasActivas(): Promise<FilaReserva[]> {
  const filas = await sql<Fila[]>`
    select r.*, a.marca, a.modelo, a.unidad, sa.nombre as sala
    from reservas r
    join articulos a on a.id = r.articulo_id
    join salas sa on sa.id = r.sala_id
    where r.estado = 'activa'
    order by sa.nombre, a.marca nulls last, a.modelo`;
  return filas.map(aReserva);
}

// ------------------------------------------------------------------- pedidos
const aPedido = (f: Fila): Pedido => ({
  id: String(f.id),
  proveedor_id: s(f.proveedor_id),
  proveedor: s(f.proveedor),
  sala_id: s(f.sala_id),
  sala: s(f.sala),
  referencia: s(f.referencia),
  estado: f.estado as EstadoPedido,
  entrega_prevista: dia(f.entrega_prevista),
  ubicacion_prevista_id: s(f.ubicacion_prevista_id),
  fecha: dia(f.fecha),
  notas: s(f.notas),
});

export interface PedidoConTotales extends Pedido {
  lineas: number;
  total: number | null;
  orientativas: number;
}

export async function listarPedidos(): Promise<PedidoConTotales[]> {
  const filas = await sql<Fila[]>`
    select p.*, pv.nombre as proveedor, sa.nombre as sala,
           count(l.id) as lineas,
           sum(l.cantidad * coalesce(l.precio_unitario, 0)) as total,
           count(*) filter (where l.precio_orientativo) as orientativas,
           bool_or(l.precio_unitario is not null) as hay_precio
    from pedidos p
    left join proveedores pv on pv.id = p.proveedor_id
    left join salas sa on sa.id = p.sala_id
    left join pedido_lineas l on l.pedido_id = p.id
    group by p.id, pv.nombre, sa.nombre
    order by p.creado_en desc`;
  return filas.map((f) => ({
    ...aPedido(f),
    lineas: Number(f.lineas),
    total: f.hay_precio === true ? Number(f.total) : null,
    orientativas: Number(f.orientativas),
  }));
}

export interface PedidoCompleto {
  pedido: Pedido;
  lineas: LineaPedido[];
  proyecto: {id: string; nombre: string} | null;
  recepcion: {
    soloRecepcion: boolean;
    lineasKit: string[];
    filas: {suministroId: string; lineaId: string; referencia: string; sala: string; asignado: number; recibido: number}[];
    sinAtribuir: {lineaId: string; referencia: string; cantidad: number; unidad: string}[];
  };
}

export async function obtenerPedido(id: string): Promise<PedidoCompleto | null> {
  return await sql.begin('isolation level repeatable read read only',
    tx => leerPedidoEnInstantanea(tx, id)) as PedidoCompleto | null;
}

async function leerPedidoEnInstantanea(sql: TransactionSql, id: string): Promise<PedidoCompleto | null> {
  const [f] = await sql<Fila[]>`
    select p.*, pv.nombre as proveedor, sa.nombre as sala, pr.nombre as proyecto,
           pedido_tiene_kits(p.id) as solo_recepcion
    from pedidos p
    left join proveedores pv on pv.id = p.proveedor_id
    left join salas sa on sa.id = p.sala_id
    left join proyectos pr on pr.id = p.proyecto_id
    where p.id = ${id}`;
  if (!f) return null;

  const filas = await sql<Fila[]>`
    select l.*, a.marca, a.modelo, a.unidad,
           exists(select 1 from articulo_composiciones where articulo_kit_id=a.id) as es_kit
    from pedido_lineas l
    join articulos a on a.id = l.articulo_id
    where l.pedido_id = ${id}
    order by a.marca nulls last, a.modelo`;

  const asignaciones = await sql<Fila[]>`
    select a.*, s.nombre as sala
    from suministro_pedido_asignaciones a
    join pedido_lineas l on l.id=a.pedido_linea_id
    join sala_suministros k on k.id=a.suministro_id
    join salas s on s.id=k.sala_id
    where l.pedido_id=${id}
    order by a.creado_en,a.suministro_id`;
  const referencia = (l: Fila) => `${s(l.marca) ?? ''} ${String(l.modelo)}`.trim();
  const porLinea = new Map(filas.map(l => [String(l.id), l]));
  return {
    pedido: aPedido(f),
    proyecto: f.proyecto_id && f.proyecto ? {id: String(f.proyecto_id), nombre: String(f.proyecto)} : null,
    recepcion: {
      soloRecepcion: f.solo_recepcion === true,
      lineasKit: filas.filter(l => l.es_kit === true).map(l => String(l.id)),
      filas: asignaciones.map(a => ({
        suministroId: String(a.suministro_id), lineaId: String(a.pedido_linea_id),
        referencia: referencia(porLinea.get(String(a.pedido_linea_id))!), sala: String(a.sala),
        asignado: Number(a.cantidad), recibido: Number(a.cantidad_recibida_atribuida),
      })),
      sinAtribuir: filas.filter(l => l.es_kit === true).flatMap(l => {
        const cantidad = Number(l.cantidad_recibida) - asignaciones
          .filter(a => a.pedido_linea_id === l.id).reduce((total, a) => total + Number(a.cantidad_recibida_atribuida), 0);
        return cantidad > 0 ? [{lineaId: String(l.id), referencia: referencia(l), cantidad, unidad: String(l.unidad)}] : [];
      }),
    },
    lineas: filas.map((l) => ({
      id: String(l.id),
      pedido_id: String(l.pedido_id),
      articulo_id: String(l.articulo_id),
      descripcion: `${s(l.marca) ?? ''} ${String(l.modelo)}`.trim(),
      unidad: (l.unidad as UnidadMedida) ?? 'ud',
      cantidad: Number(l.cantidad),
      cantidad_recibida: Number(l.cantidad_recibida),
      precio_unitario: n(l.precio_unitario),
      precio_orientativo: l.precio_orientativo === true,
      comprado_en: dia(l.comprado_en),
      comprado_por: s(l.comprado_por),
      notas: s(l.notas),
    })),
  };
}

/** Los pedidos que afectan a una sala, para enseñarlos en su ficha. */
export async function pedidosDeSala(salaId: string): Promise<PedidoConTotales[]> {
  const todos = await listarPedidos();
  return todos.filter((p) => p.sala_id === salaId);
}

// -------------------------------------------------------------------- cargas
const aCarga = (f: Fila): Carga => ({
  id: String(f.id),
  sala_id: String(f.sala_id),
  sala: s(f.sala),
  nombre: String(f.nombre),
  estado: f.estado as EstadoCarga,
  quien: s(f.quien),
  notas: s(f.notas),
  cerrado_en: fecha(f.cerrado_en),
});

export interface CargaConResumen extends Carga {
  lineas: number;
  cargadas: number;
}

export async function listarCargas(): Promise<CargaConResumen[]> {
  const filas = await sql<Fila[]>`
    select c.*, sa.nombre as sala,
           count(l.id) as lineas,
           count(*) filter (where l.cargado) as cargadas
    from cargas c
    join salas sa on sa.id = c.sala_id
    left join carga_lineas l on l.carga_id = c.id
    group by c.id, sa.nombre
    order by c.creado_en desc`;
  return filas.map((f) => ({
    ...aCarga(f),
    lineas: Number(f.lineas),
    cargadas: Number(f.cargadas),
  }));
}

export interface CargaCompleta {
  carga: Carga;
  lineas: LineaCarga[];
  ubicaciones: Ubicacion[];
  gestionada: IdentidadCargaGestionada | null;
}

export interface IdentidadCargaGestionada {
  reservaId: string;
  suministroId: string;
  articuloId: string;
  reservaEstado: string;
  suministroActivo: boolean;
  obraCerrada: boolean;
  operable: boolean;
  motivoNoOperable: string | null;
  cobertura: {reservado: number; servido: number; coberturaFisica: number; pendiente: number};
  saldos: Array<{ubicacionId: string; ubicacion: string; cantidad: number}>;
  salida: {movimientoId: string; ubicacionId: string} | null;
}

export async function obtenerCarga(id: string): Promise<CargaCompleta | null> {
  return sql.begin('isolation level repeatable read read only', tx => leerCargaEnInstantanea(tx, id));
}

export async function leerCargaEnInstantanea(tx: TransactionSql, id: string): Promise<CargaCompleta | null> {
  const [f] = await tx<Fila[]>`
    select c.*, sa.nombre as sala
    from cargas c join salas sa on sa.id = c.sala_id
    where c.id = ${id}`;
  if (!f) return null;

  const filas = await tx<Fila[]>`
    select l.*, a.marca, a.modelo, a.unidad
    from carga_lineas l
    join articulos a on a.id = l.articulo_id
    where l.carga_id = ${id}
    order by a.marca nulls last, a.modelo`;
  const lineas = filas.map((l) => ({
    id: String(l.id),
    carga_id: String(l.carga_id),
    articulo_id: String(l.articulo_id),
    descripcion: `${s(l.marca) ?? ''} ${String(l.modelo)}`.trim(),
    unidad: (l.unidad as UnidadMedida) ?? 'ud',
    reserva_id: s(l.reserva_id),
    cantidad: Number(l.cantidad),
    cargado: l.cargado === true,
    instalado: Number(l.instalado),
    devuelto: Number(l.devuelto),
    roto: Number(l.roto),
    notas: s(l.notas),
  }));
  const ubicaciones = await listarUbicaciones(tx);
  return {
    carga: aCarga(f),
    lineas,
    ubicaciones,
    gestionada: await leerIdentidadCargaGestionada(tx, id, String(f.sala_id)),
  };
}

async function leerIdentidadCargaGestionada(
  tx: TransactionSql,
  cargaId: string,
  salaId: string,
): Promise<IdentidadCargaGestionada | null> {
  const [base] = await tx<Fila[]>`
    select o.reserva_id, o.suministro_id, o.articulo_id, o.linea_id,
           r.estado as reserva_estado, s.estado as suministro_estado,
           exists(select 1 from hitos_proyecto h
             join localizaciones loc on loc.proyecto_id=h.proyecto_id
             join salas sa on sa.localizacion_id=loc.id
             where sa.id=${salaId} and h.tipo='cierre') as obra_cerrada,
           (select x.movimiento_id from operaciones_carga_kit x
             where x.operacion='servir' and x.carga_id=o.carga_id) as movimiento_id,
           (select x.ubicacion_id from operaciones_carga_kit x
             where x.operacion='servir' and x.carga_id=o.carga_id) as salida_ubicacion_id
    from operaciones_carga_kit o
    join reservas r on r.id=o.reserva_id
    join sala_suministros s on s.id=o.suministro_id
    where o.operacion='preparar' and not o.reutilizada and o.carga_id=${cargaId}`;
  if (!base) return null;
  const {leerAtribucionesSuministro} = await import('./atribuciones-suministro-db');
  const cobertura = await leerAtribucionesSuministro(tx, salaId);
  const unidad = cobertura.porSuministro.get(String(base.suministro_id));
  if (!unidad) throw new Error('La lectura de la carga gestionada está incompleta.');
  const saldosFila = await tx<Fila[]>`
    select e.ubicacion_id, coalesce(u.nombre, 'Sin ubicación') as ubicacion, e.cantidad
    from existencias e
    left join ubicaciones u on u.id = e.ubicacion_id
    where e.articulo_id = ${String(base.articulo_id)} and e.cantidad > 0
    order by e.cantidad desc, u.nombre`;
  const reservaActiva = base.reserva_estado === 'activa';
  const suministroActivo = base.suministro_estado === 'activo';
  const obraCerrada = base.obra_cerrada === true;
  const servida = base.movimiento_id != null;
  let motivoNoOperable: string | null = null;
  if (servida) motivoNoOperable = 'La carga ya salió del almacén.';
  else if (obraCerrada) motivoNoOperable = 'Proyecto cerrado';
  else if (!suministroActivo) motivoNoOperable = 'Suministro activo requerido';
  else if (!reservaActiva) motivoNoOperable = 'La reserva ya no está activa. Esta preparación no se puede confirmar.';
  return {
    reservaId: String(base.reserva_id),
    suministroId: String(base.suministro_id),
    articuloId: String(base.articulo_id),
    reservaEstado: String(base.reserva_estado),
    suministroActivo,
    obraCerrada,
    operable: motivoNoOperable == null,
    motivoNoOperable,
    cobertura: {
      reservado: unidad.reservado,
      servido: unidad.servido,
      coberturaFisica: unidad.coberturaFisica,
      pendiente: unidad.pendiente,
    },
    saldos: saldosFila.filter((fila) => fila.ubicacion_id != null).map((fila) => ({
      ubicacionId: String(fila.ubicacion_id),
      ubicacion: String(fila.ubicacion),
      cantidad: Number(fila.cantidad),
    })),
    salida: base.movimiento_id == null || base.salida_ubicacion_id == null ? null : {
      movimientoId: String(base.movimiento_id),
      ubicacionId: String(base.salida_ubicacion_id),
    },
  };
}

export async function cargasDeSala(salaId: string): Promise<CargaConResumen[]> {
  const todas = await listarCargas();
  return todas.filter((c) => c.sala_id === salaId);
}

// ------------------------------------------------- qué falta para una sala
/**
 * La cadena completa de una obra, resuelta de una vez:
 *
 *   equipamiento + cable calculado  →  necesidad
 *   necesidad − disponible          →  falta
 *   falta agrupada por proveedor    →  pedidos
 *
 * Vive aquí y no en la página porque la usan las dos: la ficha de la sala para
 * enseñarlo y las acciones para generar reservas y pedidos. Que el botón y la
 * pantalla calculen lo mismo con el mismo código es justamente el punto.
 */
export async function faltaParaSala(salaId: string, salaLeida?: SalaCompleta,tx?:TransactionSql) {
  if (!tx) {
    return sql.begin('isolation level repeatable read read only',
      inner => leerFaltaParaSala(salaId, salaLeida, inner));
  }
  return leerFaltaParaSala(salaId, salaLeida, tx);
}

async function leerFaltaParaSala(salaId: string, salaLeida: SalaCompleta | undefined, tx: TransactionSql) {
  const cliente=tx;
  const completa = salaLeida ?? await obtenerSala(salaId,tx);
  if (!completa) return null;
  if (completa.sala.id !== salaId) throw new Error('La lectura no pertenece a esta sala.');

  const { sala, equipos, conexiones } = completa;
  const [articulos, parametros] = await Promise.all([
    listarArticulos(undefined,cliente),
    obtenerParametros(cliente),
  ]);
  const porId = new Map(articulos.map((a) => [a.id, a]));
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;
  const resultados = (conexiones
        .filter((c) => !sinMedidas || c.longitud_manual_m != null)
        .map((c) => calcularConexion(c, sala, equiposPorId, porId, parametros, {
          tomas: new Map(completa.tomas.map((t) => [t.id, t])),
          puertos: new Map(completa.puertos.map((p) => [p.id, p])),
        }))
        .filter(Boolean) as ResultadoCable[]);

  const suministro = (await import('./suministros')).proyectarSuministros(equipos, completa.suministros);
  const necesidad = necesidadDeSala(
    suministro.necesidades,
    agruparMaterialCable(resultados, conexiones, porId),
    porId,
  );

  const reservas = await reservasDeSala(salaId,cliente);
  const reservadoAqui = new Map<string, number>();
  for (const r of reservas) {
    if (r.estado !== 'activa') continue;
    reservadoAqui.set(
      r.articulo_id,
      (reservadoAqui.get(r.articulo_id) ?? 0) + r.cantidad,
    );
  }

  const disponibilidad = await disponibilidadDeArticulos(
    necesidad.map((l) => l.articulo_id),
    cliente,
  );
  const disponible = new Map(
    [...disponibilidad.entries()].map(([id, d]) => [id, d.disponible]),
  );

  const salidas = await cliente<Fila[]>`select articulo_id,
    greatest(0, sum(case when tipo = 'salida' then cantidad else -cantidad end)) as servido
    from movimientos where sala_id = ${salaId} and tipo in ('salida', 'devolucion') group by articulo_id`;
  const servidoAqui = new Map(salidas.map((m) => [String(m.articulo_id), Number(m.servido)]));
  // Hasta L3B ninguna cobertura por artículo acredita estas instancias.
  for (const l of necesidad.filter((l) => l.suministros?.length)) {
    reservadoAqui.delete(l.articulo_id);
    servidoAqui.delete(l.articulo_id);
    disponible.delete(l.articulo_id);
  }
  const faltantes = calcularFaltante(necesidad, disponible, reservadoAqui, servidoAqui);

  // Un pedido pendiente ya cubre la compra, aunque todavía no sea existencia.
  const pendientesPedido = await cliente<Fila[]>`select l.articulo_id,
      sum(greatest(0, l.cantidad - l.cantidad_recibida)) as pendiente
    from pedido_lineas l join pedidos p on p.id = l.pedido_id
    where p.sala_id = ${salaId} group by l.articulo_id`;
  const enPedido = new Map(pendientesPedido.map((p) => [String(p.articulo_id), Number(p.pendiente)]));
  for (const l of necesidad.filter((l) => l.suministros?.length)) enPedido.delete(l.articulo_id);
  const porPedir = faltantes.map((l) => ({ ...l, falta: Math.max(0, l.falta - (enPedido.get(l.articulo_id) ?? 0)) }));
  const {leerReservasSuministro} = await import('./reservas-suministro-lectura');
  const reservasSuministro = await leerReservasSuministro(tx, salaId);

  return {
    sala,
    necesidad,
    bloqueoComercial: suministro.bloqueoComercial,
    pendientesSuministro: suministro.pendientes,
    faltantes,
    grupos: agruparPorProveedor(porPedir, porId),
    enPedido,
    reservas,
    reservasSuministro,
    reservadoAqui,
    servidoAqui,
    disponibilidad,
    /** Equipos de la sala sin referencia de catálogo: no se pueden pedir. */
    sinCatalogar: equipos.filter((e) => !e.articulo_id).map((e) => e.nombre),
    articulos: porId,
  };
}

// -------------------------------------------------------------------- panel
export async function contarAlmacen() {
  const [f] = await sql<Fila[]>`
    select
      (select count(*) from (select articulo_id from existencias group by articulo_id) x)
        as referencias_en_almacen,
      (select count(*) from reservas where estado = 'activa') as reservas_activas,
      (select count(*) from pedidos where estado in ('borrador'))          as pedidos_borrador,
      (select count(*) from pedidos where estado in ('pedido','recibido_parcial'))
        as pedidos_en_curso,
      (select count(*) from cargas where estado <> 'cerrada')  as cargas_abiertas,
      (select count(*) from movimientos where tipo = 'baja')   as bajas,
      (select count(*) from articulos a
        where a.stock_minimo > 0
          and coalesce((select sum(cantidad) from existencias e where e.articulo_id = a.id), 0)
            - coalesce((select sum(cantidad) from reservas r
                        where r.articulo_id = a.id and r.estado = 'activa'), 0)
            < a.stock_minimo
          and (exists (select 1 from existencias e where e.articulo_id = a.id)
               or exists (select 1 from reservas r where r.articulo_id = a.id))
      ) as bajo_minimo`;
  return {
    referenciasEnAlmacen: Number(f.referencias_en_almacen),
    reservasActivas: Number(f.reservas_activas),
    pedidosBorrador: Number(f.pedidos_borrador),
    pedidosEnCurso: Number(f.pedidos_en_curso),
    cargasAbiertas: Number(f.cargas_abiertas),
    bajas: Number(f.bajas),
    bajoMinimo: Number(f.bajo_minimo),
  };
}
