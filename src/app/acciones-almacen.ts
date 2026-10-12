'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { faltaParaSala } from '@/lib/datos-almacen';
import { comprarLineas, recibirCompra, ErrorCompra, exigirAutorCompra, bloquearObraCompra, bloquearPedidoCompra } from '@/lib/operaciones-compras';
import { movimientosDeCierre, movimientosDeSalida } from '@/lib/carga';
import type { LineaCarga } from '@/lib/tipos';
import { exigirEdicion } from '@/lib/sesion-servidor';
import { operarReservaKit, ErrorReservaKit, type EstadoReservaKit } from '@/lib/operaciones-reserva';
import { operarCargaKit, ErrorCargaKit, type EstadoCargaKit } from '@/lib/operaciones-carga';
import { esErrorConcurrencia, mensajeErrorSqlNegocio, transaccionConControl } from '@/lib/control-escritura';

export async function reservarKitConEstado(_previo:EstadoReservaKit,datos:FormData):Promise<EstadoReservaKit>{
  const autor=await exigirEdicion('almacen');
  try{
    await operarReservaKit(sql,{operacionId:String(datos.get('operacion_id')),operacion:'reservar',suministroId:String(datos.get('suministro_id')),autor});
  }catch(error){
    if(esErrorConcurrencia(error)||error instanceof ErrorReservaKit||error instanceof ErrorCompra)return {error:error.message};
    if(error instanceof Error && (error.message==='El identificador ya se usó con otros datos.'||('code'in error&&error.code==='23514')))return {error:error.message};
    throw error;
  }
  refrescarAlmacen();revalidatePath('/salas/[id]','layout');return {error:null};
}
export async function liberarKitConEstado(_previo:EstadoReservaKit,datos:FormData):Promise<EstadoReservaKit>{
  const autor=await exigirEdicion('almacen');
  try{
    await operarReservaKit(sql,{operacionId:String(datos.get('operacion_id')),operacion:'liberar',reservaId:String(datos.get('reserva_id')),autor});
  }catch(error){
    if(esErrorConcurrencia(error)||error instanceof ErrorReservaKit||error instanceof ErrorCompra)return {error:error.message};
    if(error instanceof Error && (error.message==='El identificador ya se usó con otros datos.'||('code'in error&&error.code==='23514')))return {error:error.message};
    throw error;
  }
  refrescarAlmacen();revalidatePath('/salas/[id]','layout');return {error:null};
}

function errorCarga(error: unknown): EstadoCargaKit | null {
  if (esErrorConcurrencia(error) || error instanceof ErrorCargaKit || error instanceof ErrorReservaKit || error instanceof ErrorCompra)
    return {error: error.message};
  if (error instanceof Error && (error.message === 'El identificador ya se usó con otros datos.' || ('code' in error && error.code === '23514')))
    return {error: error.message};
  return null;
}

export async function prepararCargaKitConEstado(_previo: EstadoCargaKit, datos: FormData): Promise<EstadoCargaKit> {
  const autor = await exigirEdicion('carga');
  try {
    const resultado = await operarCargaKit(sql, {
      operacionId: String(datos.get('operacion_id')),
      operacion: 'preparar',
      reservaId: String(datos.get('reserva_id')),
      autor,
    });
    refrescarAlmacen();
    revalidatePath('/carga');
    revalidatePath('/salas/[id]', 'layout');
    redirect(`/carga/${resultado.cargaId}`);
  } catch (error) {
    const visible = errorCarga(error);
    if (visible) return visible;
    throw error;
  }
}

export async function marcarCargaKitConEstado(_previo: EstadoCargaKit, datos: FormData): Promise<EstadoCargaKit> {
  const autor = await exigirEdicion('carga');
  const cargaId = String(datos.get('carga_id'));
  const crudo = datos.get('valor');
  if (crudo !== 'true' && crudo !== 'false') return {error: 'Marcar exige un valor explícito.'};
  try {
    await operarCargaKit(sql, {
      operacionId: String(datos.get('operacion_id')),
      operacion: 'marcar',
      lineaId: String(datos.get('linea_id')),
      valor: crudo === 'true',
      autor,
    });
  } catch (error) {
    const visible = errorCarga(error);
    if (visible) return visible;
    throw error;
  }
  revalidatePath(`/carga/${cargaId}`);
  revalidatePath('/carga');
  revalidatePath('/salas/[id]', 'layout');
  return {error: null};
}

export async function confirmarCargaKitConEstado(_previo: EstadoCargaKit, datos: FormData): Promise<EstadoCargaKit> {
  const autor = await exigirEdicion('carga');
  const cargaId = String(datos.get('carga_id'));
  try {
    await operarCargaKit(sql, {
      operacionId: String(datos.get('operacion_id')),
      operacion: 'servir',
      cargaId,
      ubicacionId: String(datos.get('ubicacion_id')),
      autor,
    });
  } catch (error) {
    const visible = errorCarga(error);
    if (visible) return visible;
    throw error;
  }
  revalidatePath(`/carga/${cargaId}`);
  revalidatePath('/carga');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
  revalidatePath('/salas/[id]', 'layout');
  return {error: null};
}

/**
 * Escritura del almacén, las reservas, los pedidos y las cargas.
 *
 * Va aparte de `acciones.ts` porque la Fase 2 es un bloque entero, igual que
 * sus componentes tienen carpeta propia.
 *
 * Regla de la que cuelga todo lo demás: **la existencia no se escribe**. Aquí
 * solo se insertan movimientos, y la vista `existencias` los suma. Si algún
 * día aparece un `update` sobre una cantidad de stock, el almacén ha vuelto a
 * ser un Excel.
 */

const numero = (v: FormDataEntryValue | null): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

function refrescarAlmacen() {
  revalidatePath('/almacen');
  revalidatePath('/');
}

// ------------------------------------------------------------- ubicaciones
export async function crearUbicacion(datos: FormData) {
  await exigirEdicion('almacen');
  const nombre = texto(datos.get('nombre'));
  if (!nombre) return;
  await sql`
    insert into ubicaciones (nombre, descripcion, es_furgoneta)
    values (${nombre}, ${texto(datos.get('descripcion'))},
            ${datos.get('es_furgoneta') != null})
    on conflict (nombre) do nothing`;
  refrescarAlmacen();
}

// --------------------------------------------------------------- movimientos
/**
 * El único camino por el que cambia una existencia.
 *
 * La cantidad se guarda positiva salvo en el ajuste de inventario, que es el
 * único movimiento que corrige en los dos sentidos. El signo lo pone el tipo,
 * no quien teclea: ver SIGNO_MOVIMIENTO en `src/lib/almacen.ts`.
 */
export async function registrarMovimiento(datos: FormData) {
  await exigirEdicion('almacen');
  const articuloId = texto(datos.get('articulo_id'));
  const tipo = texto(datos.get('tipo')) ?? 'entrada';
  const cantidad = numero(datos.get('cantidad'));
  if (!articuloId || cantidad == null || cantidad === 0) return;

  const valor = tipo === 'ajuste' ? cantidad : Math.abs(cantidad);

  await sql`
    insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien)
    values (${articuloId}, ${texto(datos.get('ubicacion_id'))},
            ${tipo}::tipo_movimiento, ${valor},
            ${texto(datos.get('sala_id'))},
            ${texto(datos.get('motivo'))},
            ${texto(datos.get('quien'))})`;

  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
  revalidatePath('/almacen/bajas');
  const salaId = texto(datos.get('sala_id'));
  if (salaId) revalidatePath('/salas/[id]', 'layout');
}

// Un movimiento no se borra: se corrige con otro movimiento. Por eso no hay
// aquí ninguna acción de borrado, y un error de tecleo se arregla con un
// ajuste de inventario, que deja rastro de quién lo corrigió y por qué.

// ------------------------------------------------------------------ reservas
export async function crearReserva(datos: FormData) {
  await exigirEdicion('almacen');
  const salaId = texto(datos.get('sala_id'));
  const articuloId = texto(datos.get('articulo_id'));
  const cantidad = numero(datos.get('cantidad'));
  if (!salaId || !articuloId || cantidad == null || cantidad <= 0) return;

  await sql`
    insert into reservas (sala_id, articulo_id, cantidad, notas, quien)
    values (${salaId}, ${articuloId}, ${cantidad},
            ${texto(datos.get('notas'))}, ${texto(datos.get('quien'))})`;
  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

/**
 * Aparta de golpe todo lo que la obra necesita y el almacén puede dar.
 *
 * Reserva por línea el mínimo entre lo que falta por apartar y lo disponible.
 * Nunca reserva de más: lo que no hay se compra, y para eso está el pedido.
 */
export async function reservarLoDisponible(datos: FormData) {
  await exigirEdicion('almacen');
  const salaId = String(datos.get('sala_id'));
  const quien = texto(datos.get('quien'));
  await transaccionConControl(sql, async tx=>{
  const falta = await faltaParaSala(salaId,undefined,tx);
  if (!falta) return;

  for (const linea of falta.necesidad) {
    const yaReservado = falta.reservadoAqui.get(linea.articulo_id) ?? 0;
    const porApartar = linea.cantidad - yaReservado - (falta.servidoAqui.get(linea.articulo_id) ?? 0);
    if (porApartar <= 0) continue;
    const disponible = falta.disponibilidad.get(linea.articulo_id)?.disponible ?? 0;
    const cantidad = Math.min(porApartar, disponible);
    if (cantidad <= 0) continue;

    await tx`
      insert into reservas (sala_id, articulo_id, cantidad, notas, quien)
      values (${salaId}, ${linea.articulo_id}, ${cantidad},
              'Reserva automática de lo disponible', ${quien})`;
  }
  });

  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

/** Soltar la reserva: el material vuelve a estar disponible para otra obra. */
export async function liberarReserva(datos: FormData) {
  await exigirEdicion('almacen');
  await sql`
    update reservas set estado = 'liberada'
    where id = ${String(datos.get('id'))} and estado = 'activa'`;
  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarReserva(datos: FormData) {
  await exigirEdicion('almacen');
  try {
    await sql`delete from reservas where id = ${String(datos.get('id'))}`;
  } catch (error) {
    const mensaje = mensajeErrorSqlNegocio(error);
    if (mensaje) return { error: mensaje };
    throw error;
  }
  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

// ------------------------------------------------------------------- pedidos
/**
 * Un pedido por proveedor con lo que falta de esta sala.
 *
 * El precio se congela al crear la línea: el catálogo cambia y un pedido de
 * hace tres meses tiene que seguir contando lo que costó entonces.
 */
export async function crearPedidoDesdeFalta(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const salaId = String(datos.get('sala_id'));
  const proveedorPedido = texto(datos.get('proveedor'));
  const creados = await transaccionConControl(sql, async (tx) => {
    await bloquearObraCompra(tx, salaId);
    const falta = await faltaParaSala(salaId);
    if (!falta) return [];
    const grupos = proveedorPedido ? falta.grupos.filter((g) => g.proveedor === (proveedorPedido === '__sin_proveedor__' ? null : proveedorPedido)) : falta.grupos;
    // El pedido hereda la obra de la sala que lo origina. Con la sala suelta
    // (legado) el pedido queda sin proyecto, que sigue siendo válido.
    const [obra] = await tx<Array<{ proyecto_id: string | null }>>`
      select l.proyecto_id
      from salas s
      left join localizaciones l on l.id = s.localizacion_id
      where s.id = ${salaId}`;
    const proyectoId = obra?.proyecto_id ?? null;

    const ids: string[] = [];
    for (const grupo of grupos) {
      if (grupo.lineas.length === 0) continue;

      const [proveedor] = grupo.proveedor
        ? await tx<Array<{ id: string }>>`
            insert into proveedores (nombre) values (${grupo.proveedor})
            on conflict (nombre) do update set nombre = excluded.nombre
            returning id`
        : [{ id: null as unknown as string }];

      const [pedido] = await tx<Array<{ id: string }>>`
        insert into pedidos (proveedor_id, sala_id, proyecto_id, referencia, notas)
        values (${proveedor.id ?? null}, ${salaId}, ${proyectoId},
                ${`${falta.sala.nombre} · ${grupo.proveedor ?? 'sin proveedor'}`},
                'Generado desde lo que falta para la sala.')
        returning id`;

      for (const l of grupo.lineas) {
        await tx`
          insert into pedido_lineas
            (pedido_id, articulo_id, cantidad, precio_unitario, precio_orientativo, notas)
          values (${pedido.id}, ${l.articulo_id}, ${l.cantidad},
                  ${l.precio_unitario}, ${l.precio_orientativo},
                  ${falta.necesidad.find((n) => n.articulo_id === l.articulo_id)?.detalle.join('\n') ?? null})`;
      }
      ids.push(pedido.id);
    }
    return ids;
  });

  revalidatePath('/compras');
  revalidatePath('/salas/[id]', 'layout');
  refrescarAlmacen();
  if (creados.length === 1) redirect(`/compras/${creados[0]}`);
  redirect('/compras');
}

export async function cambiarEstadoPedido(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const id = String(datos.get('id'));
  // Recibido se deriva exclusivamente de las entradas, nunca de un botón.
  if (datos.get('estado') !== 'pedido') return;
  try {
    await comprarLineas(sql, id, usuario, texto(datos.get('linea_id')) ?? undefined);
  } catch (e) {
    if (e instanceof ErrorCompra) redirect(`/compras/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath('/compras');
  revalidatePath(`/compras/${id}`);
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas/[id]', 'layout');
}

export async function guardarPedido(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const id = String(datos.get('id'));
  await transaccionConControl(sql, async (tx) => {
    await bloquearPedidoCompra(tx, id);
    const nombre = texto(datos.get('proveedor'));
    const [proveedor] = nombre ? await tx`insert into proveedores (nombre) values (${nombre})
      on conflict (nombre) do update set nombre = excluded.nombre returning id` : [];
    await tx`update pedidos set referencia = ${texto(datos.get('referencia'))},
      proveedor_id = ${proveedor?.id ?? null},
      fecha = ${texto(datos.get('fecha'))}::date,
      notas = ${texto(datos.get('notas'))},
      entrega_prevista = ${texto(datos.get('entrega_prevista'))}::date,
      ubicacion_prevista_id = ${texto(datos.get('ubicacion_prevista_id'))}::uuid
      where id = ${id}`;
  });
  revalidatePath(`/compras/${id}`);
  revalidatePath('/compras');
}

/**
 * Recibir material: sube la línea del pedido **y** entra en almacén.
 *
 * Las dos cosas en la misma transacción y con un solo formulario. Si hubiera
 * que teclearlo dos veces, la segunda no se haría y el stock volvería a estar
 * desactualizado, que es el problema de partida.
 */
export async function recibirLineaPedido(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const pedidoId = String(datos.get('pedido_id'));
  try {
    await recibirCompra(sql, {
    pedidoId, lineaId: String(datos.get('id')),
    cantidad: numero(datos.get('cantidad')) ?? 0,
    ubicacionId: texto(datos.get('ubicacion_id')) ?? '', autor: usuario,
    recepcionId: texto(datos.get('recepcion_id')) ?? '',
    });
  } catch (e) {
    if (e instanceof ErrorCompra) redirect(`/compras/${pedidoId}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(`/compras/${pedidoId}`);
  revalidatePath('/compras');
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos/[id]', 'page');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
}

export async function recibirPedidoCompleto(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const pedidoId = String(datos.get('id'));
  try {
    await recibirCompra(sql, {
    pedidoId, ubicacionId: texto(datos.get('ubicacion_id')) ?? '', autor: usuario,
    recepcionId: texto(datos.get('recepcion_id')) ?? '',
    });
  } catch (e) {
    if (e instanceof ErrorCompra) redirect(`/compras/${pedidoId}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(`/compras/${pedidoId}`);
  revalidatePath('/compras');
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos/[id]', 'page');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
}

export async function registrarOfertaLinea(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const pedidoId = String(datos.get('pedido_id'));
  const precio = numero(datos.get('precio'));
  const referencia = texto(datos.get('oferta'));
  if (precio == null || precio < 0 || !referencia) return;
  await transaccionConControl(sql, async (tx) => {
    await bloquearPedidoCompra(tx, pedidoId);
    await tx`update pedido_lineas set precio_unitario = ${precio}, precio_orientativo = false,
      notas = concat_ws(E'\n', nullif(notas, ''), ${`Oferta final: ${referencia}`}::text) where id = ${String(datos.get('id'))}
      and pedido_id = ${pedidoId} and comprado_en is null and cantidad_recibida = 0`;
  });
  revalidatePath(`/compras/${pedidoId}`);
}

export async function borrarLineaPedido(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const pedidoId = String(datos.get('pedido_id'));
  await transaccionConControl(sql, async (tx) => {
    await bloquearPedidoCompra(tx, pedidoId);
    await tx`delete from pedido_lineas where id = ${String(datos.get('id'))} and pedido_id = ${pedidoId} and comprado_en is null and cantidad_recibida = 0`;
  });
  revalidatePath(`/compras/${pedidoId}`);
}

export async function borrarPedido(datos: FormData) {
  const usuario = await exigirEdicion('compras');
  exigirAutorCompra(usuario);
  const pedidoId = String(datos.get('id'));
  await transaccionConControl(sql, async (tx) => {
    await bloquearPedidoCompra(tx, pedidoId);
    await tx`delete from pedidos p where id = ${pedidoId} and not exists (select 1 from pedido_lineas l where l.pedido_id = p.id and (l.comprado_en is not null or l.cantidad_recibida > 0))`;
  });
  revalidatePath('/compras');
  redirect('/compras');
}

// -------------------------------------------------------------------- cargas
/**
 * La lista de carga sale de las reservas activas de la sala: lo que se apartó
 * es lo que se sube a la furgoneta. Sin reservas no hay lista, a propósito —
 * cargar sin apartar es cómo se lleva a obra material de otro.
 */
export async function crearCargaDesdeReservas(datos: FormData) {
  await exigirEdicion('carga');
  const salaId = String(datos.get('sala_id'));
  const nombre = texto(datos.get('nombre'));

  const cargaId = await transaccionConControl(sql, async (tx) => {
    const [sala] = await tx<Array<{ nombre: string }>>`
      select nombre from salas where id = ${salaId}`;
    if (!sala) return null;

    const reservas = await tx<Array<{ id: string; articulo_id: string; cantidad: string }>>`
      select id, articulo_id, cantidad from reservas
      where sala_id = ${salaId} and estado = 'activa'`;
    if (reservas.length === 0) return null;

    const [carga] = await tx<Array<{ id: string }>>`
      insert into cargas (sala_id, nombre, quien)
      values (${salaId}, ${nombre ?? `Carga · ${sala.nombre}`},
              ${texto(datos.get('quien'))})
      returning id`;

    for (const r of reservas) {
      await tx`
        insert into carga_lineas (carga_id, articulo_id, reserva_id, cantidad)
        values (${carga.id}, ${r.articulo_id}, ${r.id}, ${Number(r.cantidad)})`;
    }
    return carga.id;
  });

  revalidatePath('/carga');
  revalidatePath('/salas/[id]', 'layout');
  if (cargaId) redirect(`/carga/${cargaId}`);
}

/** Marcar o desmarcar una línea. Es lo que se hace de pie en el almacén. */
export async function marcarLineaCarga(datos: FormData) {
  await exigirEdicion('carga');
  const cargaId = String(datos.get('carga_id'));
  await sql`
    update carga_lineas set cargado = not cargado
    where id = ${String(datos.get('id'))}`;
  revalidatePath(`/carga/${cargaId}`);
}

export async function marcarTodaLaCarga(datos: FormData) {
  await exigirEdicion('carga');
  const cargaId = String(datos.get('carga_id'));
  await sql`
    update carga_lineas set cargado = ${datos.get('valor') === 'si'}
    where carga_id = ${cargaId}`;
  revalidatePath(`/carga/${cargaId}`);
}

/**
 * Cerrar la furgoneta: lo marcado sale del almacén y las reservas quedan
 * servidas. Los movimientos los decide `movimientosDeSalida()`, que es lógica
 * pura y está probada.
 */
export async function confirmarCarga(datos: FormData) {
  await exigirEdicion('carga');
  const cargaId = String(datos.get('id'));
  const ubicacionId = texto(datos.get('ubicacion_id'));
  const quien = texto(datos.get('quien'));

  await transaccionConControl(sql, async (tx) => {
    const [carga] = await tx<Array<{ nombre: string; sala_id: string }>>`
      select nombre, sala_id from cargas where id = ${cargaId} and estado = 'preparacion'`;
    if (!carga) return;

    const filas = await tx<
      Array<{ articulo_id: string; cantidad: string; cargado: boolean; reserva_id: string | null; modelo: string }>
    >`select l.articulo_id, l.cantidad, l.cargado, l.reserva_id, a.modelo
      from carga_lineas l join articulos a on a.id = l.articulo_id
      where l.carga_id = ${cargaId}`;

    const lineas = filas.map((f) => ({
      articulo_id: f.articulo_id,
      cantidad: Number(f.cantidad),
      cargado: f.cargado,
      descripcion: f.modelo,
    }));

    for (const m of movimientosDeSalida(lineas, carga.nombre)) {
      await tx`
        insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien)
        values (${m.articulo_id}, ${ubicacionId}, ${m.tipo}::tipo_movimiento,
                ${m.cantidad}, ${carga.sala_id}, ${m.motivo}, ${quien})`;
    }

    const servidas = filas
      .filter((f) => f.cargado && f.reserva_id)
      .map((f) => f.reserva_id as string);
    if (servidas.length > 0) {
      await tx`update reservas set estado = 'servida' where id in ${tx(servidas)}`;
    }

    await tx`update cargas set estado = 'cargada' where id = ${cargaId}`;
  });

  revalidatePath(`/carga/${cargaId}`);
  revalidatePath('/carga');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
}

/** El reparto de una línea al volver de obra: instalado, devuelto y roto. */
export async function guardarCierreLinea(datos: FormData) {
  await exigirEdicion('carga');
  const cargaId = String(datos.get('carga_id'));
  await sql`
    update carga_lineas set
      instalado = ${Math.max(0, numero(datos.get('instalado')) ?? 0)},
      devuelto  = ${Math.max(0, numero(datos.get('devuelto')) ?? 0)},
      roto      = ${Math.max(0, numero(datos.get('roto')) ?? 0)},
      notas     = ${texto(datos.get('notas'))}
    where id = ${String(datos.get('id'))}`;
  revalidatePath(`/carga/${cargaId}`);
}

/**
 * Cierre de obra. Lo que sobra vuelve, lo roto queda registrado como baja.
 * Qué movimientos salen de cada línea lo decide `movimientosDeCierre()`.
 */
export async function cerrarCarga(datos: FormData) {
  await exigirEdicion('carga');
  const cargaId = String(datos.get('id'));
  const ubicacionId = texto(datos.get('ubicacion_id'));
  const quien = texto(datos.get('quien'));

  await transaccionConControl(sql, async (tx) => {
    const [carga] = await tx<Array<{ nombre: string; sala_id: string }>>`
      select nombre, sala_id from cargas where id = ${cargaId} and estado = 'cargada'`;
    if (!carga) return;

    const filas = await tx<
      Array<{ articulo_id: string; devuelto: string; roto: string; modelo: string }>
    >`select l.articulo_id, l.devuelto, l.roto, a.modelo
      from carga_lineas l join articulos a on a.id = l.articulo_id
      where l.carga_id = ${cargaId}`;

    const lineas: Array<Pick<LineaCarga, 'articulo_id' | 'devuelto' | 'roto' | 'descripcion'>> =
      filas.map((f) => ({
        articulo_id: f.articulo_id,
        devuelto: Number(f.devuelto),
        roto: Number(f.roto),
        descripcion: f.modelo,
      }));

    for (const m of movimientosDeCierre(lineas, carga.nombre)) {
      await tx`
        insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien)
        values (${m.articulo_id}, ${ubicacionId}, ${m.tipo}::tipo_movimiento,
                ${m.cantidad}, ${carga.sala_id}, ${m.motivo}, ${quien})`;
    }

    await tx`
      update cargas set estado = 'cerrada', cerrado_en = now() where id = ${cargaId}`;
  });

  revalidatePath(`/carga/${cargaId}`);
  revalidatePath('/carga');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
  revalidatePath('/almacen/bajas');
}

export async function borrarCarga(datos: FormData) {
  await exigirEdicion('carga');
  await sql`delete from cargas where id = ${String(datos.get('id'))}`;
  revalidatePath('/carga');
  redirect('/carga');
}
