'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { faltaParaSala } from '@/lib/datos-almacen';
import { estadoPorRecepcion } from '@/lib/compras';
import { movimientosDeCierre, movimientosDeSalida } from '@/lib/carga';
import type { EstadoPedido, LineaCarga } from '@/lib/tipos';
import { exigirEdicion } from '@/lib/sesion-servidor';

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
  const falta = await faltaParaSala(salaId);
  if (!falta) return;

  for (const linea of falta.necesidad) {
    const yaReservado = falta.reservadoAqui.get(linea.articulo_id) ?? 0;
    const porApartar = linea.cantidad - yaReservado;
    if (porApartar <= 0) continue;
    const disponible = falta.disponibilidad.get(linea.articulo_id)?.disponible ?? 0;
    const cantidad = Math.min(porApartar, disponible);
    if (cantidad <= 0) continue;

    await sql`
      insert into reservas (sala_id, articulo_id, cantidad, notas, quien)
      values (${salaId}, ${linea.articulo_id}, ${cantidad},
              'Reserva automática de lo disponible', ${quien})`;
  }

  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

/** Soltar la reserva: el material vuelve a estar disponible para otra obra. */
export async function liberarReserva(datos: FormData) {
  await exigirEdicion('almacen');
  const salaId = String(datos.get('sala_id'));
  await sql`
    update reservas set estado = 'liberada'
    where id = ${String(datos.get('id'))} and estado = 'activa'`;
  refrescarAlmacen();
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarReserva(datos: FormData) {
  await exigirEdicion('almacen');
  const salaId = String(datos.get('sala_id'));
  await sql`delete from reservas where id = ${String(datos.get('id'))}`;
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
  await exigirEdicion('compras');
  const salaId = String(datos.get('sala_id'));
  const proveedorPedido = texto(datos.get('proveedor'));
  const falta = await faltaParaSala(salaId);
  if (!falta) return;

  const grupos = proveedorPedido
    ? falta.grupos.filter((g) => g.proveedor === proveedorPedido)
    : falta.grupos;

  const creados = await sql.begin(async (tx) => {
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
            (pedido_id, articulo_id, cantidad, precio_unitario, precio_orientativo)
          values (${pedido.id}, ${l.articulo_id}, ${l.cantidad},
                  ${l.precio_unitario}, ${l.precio_orientativo})`;
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
  await exigirEdicion('compras');
  const id = String(datos.get('id'));
  const estado = (texto(datos.get('estado')) ?? 'borrador') as EstadoPedido;
  if (estado === 'pedido') {
    const [orientativo] = await sql<Array<{ existe: boolean }>>`
      select exists(
        select 1 from pedido_lineas
        where pedido_id = ${id} and precio_orientativo
      ) as existe`;
    if (orientativo?.existe) return;
  }
  await sql`
    update pedidos set
      estado = ${estado}::estado_pedido,
      fecha  = coalesce(fecha, case when ${estado} = 'pedido' then current_date end)
    where id = ${id}`;
  revalidatePath('/compras');
  revalidatePath(`/compras/${id}`);
  refrescarAlmacen();
}

export async function guardarPedido(datos: FormData) {
  await exigirEdicion('compras');
  const id = String(datos.get('id'));
  await sql`
    update pedidos set
      referencia = ${texto(datos.get('referencia'))},
      fecha      = ${texto(datos.get('fecha'))}::date,
      notas      = ${texto(datos.get('notas'))}
    where id = ${id}`;
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
  await exigirEdicion('compras');
  const lineaId = String(datos.get('id'));
  const pedidoId = String(datos.get('pedido_id'));
  const cantidad = numero(datos.get('cantidad'));
  const ubicacionId = texto(datos.get('ubicacion_id'));
  if (!cantidad || cantidad <= 0) return;

  await sql.begin(async (tx) => {
    const [linea] = await tx<Array<{ articulo_id: string }>>`
      update pedido_lineas
      set cantidad_recibida = cantidad_recibida + ${cantidad}
      where id = ${lineaId}
      returning articulo_id`;
    if (!linea) return;

    const [pedido] = await tx<Array<{ estado: EstadoPedido; sala_id: string | null; referencia: string | null }>>`
      select estado, sala_id, referencia from pedidos where id = ${pedidoId}`;

    const [orientativo] = await tx<Array<{ existe: boolean }>>`
      select exists(
        select 1 from pedido_lineas
        where pedido_id = ${pedidoId} and precio_orientativo
      ) as existe`;
    if (orientativo?.existe) return;

    await tx`
      insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien)
      values (${linea.articulo_id}, ${ubicacionId}, 'entrada', ${cantidad},
              ${pedido?.sala_id ?? null},
              ${`Recepción de pedido${pedido?.referencia ? ` · ${pedido.referencia}` : ''}`},
              ${texto(datos.get('quien'))})`;

    const lineas = await tx<Array<{ cantidad: string; cantidad_recibida: string }>>`
      select cantidad, cantidad_recibida from pedido_lineas where pedido_id = ${pedidoId}`;

    const nuevo = estadoPorRecepcion(
      pedido?.estado ?? 'borrador',
      lineas.map((l) => ({
        cantidad: Number(l.cantidad),
        cantidad_recibida: Number(l.cantidad_recibida),
      })),
    );
    await tx`update pedidos set estado = ${nuevo}::estado_pedido where id = ${pedidoId}`;
  });

  revalidatePath(`/compras/${pedidoId}`);
  revalidatePath('/compras');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
}

/** Recibir de golpe todo lo que falta del pedido. Lo normal cuando llega entero. */
export async function recibirPedidoCompleto(datos: FormData) {
  await exigirEdicion('compras');
  const pedidoId = String(datos.get('id'));
  const ubicacionId = texto(datos.get('ubicacion_id'));
  const quien = texto(datos.get('quien'));

  await sql.begin(async (tx) => {
    const [orientativo] = await tx<Array<{ existe: boolean }>>`
      select exists(
        select 1 from pedido_lineas
        where pedido_id = ${pedidoId} and precio_orientativo
      ) as existe`;
    if (orientativo?.existe) return;
    const [pedido] = await tx<Array<{ sala_id: string | null; referencia: string | null }>>`
      select sala_id, referencia from pedidos where id = ${pedidoId}`;

    const lineas = await tx<
      Array<{ id: string; articulo_id: string; cantidad: string; cantidad_recibida: string }>
    >`select id, articulo_id, cantidad, cantidad_recibida
      from pedido_lineas where pedido_id = ${pedidoId}`;

    for (const l of lineas) {
      const pendiente = Number(l.cantidad) - Number(l.cantidad_recibida);
      if (pendiente <= 0) continue;
      await tx`
        update pedido_lineas set cantidad_recibida = cantidad where id = ${l.id}`;
      await tx`
        insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien)
        values (${l.articulo_id}, ${ubicacionId}, 'entrada', ${pendiente},
                ${pedido?.sala_id ?? null},
                ${`Recepción de pedido${pedido?.referencia ? ` · ${pedido.referencia}` : ''}`},
                ${quien})`;
    }

    await tx`update pedidos set estado = 'recibido' where id = ${pedidoId}`;
  });

  revalidatePath(`/compras/${pedidoId}`);
  revalidatePath('/compras');
  refrescarAlmacen();
  revalidatePath('/almacen/movimientos');
}

export async function borrarLineaPedido(datos: FormData) {
  await exigirEdicion('compras');
  const pedidoId = String(datos.get('pedido_id'));
  await sql`delete from pedido_lineas where id = ${String(datos.get('id'))}`;
  revalidatePath(`/compras/${pedidoId}`);
}

export async function borrarPedido(datos: FormData) {
  await exigirEdicion('compras');
  await sql`delete from pedidos where id = ${String(datos.get('id'))}`;
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

  const cargaId = await sql.begin(async (tx) => {
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

  await sql.begin(async (tx) => {
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

  await sql.begin(async (tx) => {
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
