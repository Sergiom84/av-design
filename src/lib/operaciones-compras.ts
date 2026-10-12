import {transaccionConControl} from './control-escritura';
import type { Sql, TransactionSql } from 'postgres';

export class ErrorCompra extends Error {}

export type AutorCompra = { id: string; nombre: string; ficticio: boolean };
export function exigirAutorCompra(autor: AutorCompra) {
  if (autor.ficticio) throw new ErrorCompra('Inicia sesión con un usuario real para modificar compras.');
  if (!autor.id || !autor.nombre.trim()) throw new ErrorCompra('Falta quién registra la compra o recepción.');
}

/** Mismo orden que cierre de obra: salas ordenadas, proyecto, pedido, líneas.
 * También bloquea el proyecto sin salas: el FK del hito de cierre comparte ese cerrojo.
 */
export async function bloquearObraCompra(tx: TransactionSql, salaId: string | null, proyectoId: string | null = null) {
  const [origen] = salaId ? await tx`select l.proyecto_id from salas s
    left join localizaciones l on l.id = s.localizacion_id where s.id = ${salaId}` : [];
  if (salaId && !origen) throw new ErrorCompra('Sala no encontrada.');
  const proyectos = [...new Set([proyectoId, origen?.proyecto_id].filter((id): id is string => Boolean(id)))].sort();
  await tx`select s.id from salas s left join localizaciones l on l.id = s.localizacion_id
    where s.id = ${salaId} or l.proyecto_id = any(${proyectos}::uuid[])
    order by s.id for update of s`;
  const [actual] = salaId ? await tx`select l.proyecto_id from salas s
    left join localizaciones l on l.id = s.localizacion_id where s.id = ${salaId}` : [];
  if (salaId && (!actual || actual.proyecto_id !== origen?.proyecto_id)) {
    throw new ErrorCompra('La sala ha cambiado de obra. Recarga antes de continuar.');
  }
  await tx`select id from proyectos where id = any(${proyectos}::uuid[]) order by id for update`;
  const cierres = await tx`select id from hitos_proyecto where proyecto_id = any(${proyectos}::uuid[]) and tipo = 'cierre'`;
  if (cierres.length) throw new ErrorCompra('El proyecto está cerrado. Reábrelo antes de modificar compras.');
}

export async function bloquearPedidoCompra(tx: TransactionSql, pedidoId: string) {
  const [origen] = await tx`select sala_id, proyecto_id from pedidos where id = ${pedidoId}`;
  if (!origen) throw new ErrorCompra('Pedido no encontrado.');
  await bloquearObraCompra(tx, origen.sala_id, origen.proyecto_id);
  const [pedido] = await tx`select * from pedidos where id = ${pedidoId} for update`;
  if (!pedido) throw new ErrorCompra('Pedido no encontrado.');
  if (pedido.sala_id !== origen.sala_id || pedido.proyecto_id !== origen.proyecto_id) {
    throw new ErrorCompra('El pedido ha cambiado de obra. Recarga antes de continuar.');
  }
  return pedido;
}

/** Serializa compra y recepción por pedido. Toda validación precede a la escritura. */
export async function comprarLineas(sql: Sql, pedidoId: string, autor: AutorCompra, lineaId?: string) {
  exigirAutorCompra(autor);
  await transaccionConControl(sql, async (tx) => {
    await bloquearPedidoCompra(tx, pedidoId);
    const lineas = await tx`select * from pedido_lineas where pedido_id = ${pedidoId} order by id for update`;
    const elegidas = lineas.filter((l) => (!lineaId || l.id === lineaId) && !l.comprado_en);
    if (lineaId && !lineas.some((l) => l.id === lineaId)) throw new ErrorCompra('La línea no pertenece al pedido.');
    if (elegidas.some((l) => l.precio_orientativo)) throw new ErrorCompra('Falta una oferta final para comprar.');
    for (const l of elegidas) {
      await tx`update pedido_lineas set comprado_en = current_date, comprado_por = ${autor.nombre} where id = ${l.id}`;
    }
    if (elegidas.length) await tx`update pedidos set estado = case when exists (select 1 from pedido_lineas where pedido_id = ${pedidoId} and cantidad_recibida > 0) then 'recibido_parcial'::estado_pedido else 'pedido'::estado_pedido end, fecha = coalesce(fecha, current_date) where id = ${pedidoId}`;
  });
}

export async function recibirCompra(sql: Sql, entrada: {
  pedidoId: string; lineaId?: string; cantidad?: number; ubicacionId: string; autor: AutorCompra; recepcionId: string;
}) {
  exigirAutorCompra(entrada.autor);
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(entrada.recepcionId ?? '')) {
    throw new ErrorCompra('Falta un identificador válido de recepción. Recarga el pedido.');
  }
  if (entrada.lineaId && (!Number.isFinite(entrada.cantidad) || entrada.cantidad! <= 0)) throw new ErrorCompra('Cantidad no válida.');
  try { await transaccionConControl(sql, async (tx) => {
    const pedido = await bloquearPedidoCompra(tx, entrada.pedidoId);
    // La PK serializa incluso el uso del mismo token en pedidos distintos.
    // Token y efectos se confirman juntos; un rechazo permite reintentar el formulario.
    const solicitud = { pedidoId: entrada.pedidoId, lineaId: entrada.lineaId ?? null,
      cantidad: entrada.lineaId ? entrada.cantidad! : null, ubicacionId: entrada.ubicacionId, autorId: entrada.autor.id };
    // Antes del INSERT: su trigger captura pendiente; un reintento ya agotado
    // debe verificar el token original, no intentar capturar otra recepción.
    const [existente] = await tx`select solicitud from recepciones_compra where id=${entrada.recepcionId}`;
    if (existente) {
      if (Object.entries(solicitud).some(([clave, valor]) => existente.solicitud[clave] !== valor)) {
        throw new ErrorCompra('El identificador de recepción ya se usó con otros datos. Recarga el pedido.');
      }
      return;
    }
    const nuevas = await tx`insert into recepciones_compra (id, pedido_id, solicitud)
      values (${entrada.recepcionId}, ${entrada.pedidoId}, ${tx.json(solicitud)}) on conflict (id) do nothing returning id,protocolo,lineas_esperadas`;
    if (!nuevas.length) {
      const [anterior] = await tx`select solicitud from recepciones_compra where id = ${entrada.recepcionId}`;
      if (Object.entries(solicitud).some(([clave, valor]) => anterior.solicitud[clave] !== valor)) {
        throw new ErrorCompra('El identificador de recepción ya se usó con otros datos. Recarga el pedido.');
      }
      return;
    }
    if (nuevas[0].protocolo === 'kit_v1') {
      for (const linea of nuevas[0].lineas_esperadas as Array<{linea:string;cantidad:number}>) {
        await tx`insert into recepcion_lineas(recepcion_id,pedido_linea_id,cantidad)
          values(${entrada.recepcionId},${linea.linea},${linea.cantidad})`;
      }
      return;
    }
    const [ubicacion] = await tx`select id from ubicaciones where id = ${entrada.ubicacionId}`;
    if (!ubicacion) throw new ErrorCompra('Elige un almacén de recepción.');
    const lineas = await tx`select * from pedido_lineas where pedido_id = ${entrada.pedidoId} order by id for update`;
    if (entrada.lineaId && !lineas.some((l) => l.id === entrada.lineaId)) throw new ErrorCompra('La línea no pertenece al pedido.');
    const elegidas = lineas.filter((l) => entrada.lineaId ? l.id === entrada.lineaId : Number(l.cantidad_recibida) < Number(l.cantidad));
    for (const l of elegidas) {
      if (!l.comprado_en || l.precio_orientativo) throw new ErrorCompra('Primero registra la compra con oferta final.');
      const pendiente = Number(l.cantidad) - Number(l.cantidad_recibida);
      const cantidad = entrada.lineaId ? entrada.cantidad! : pendiente;
      if (cantidad > pendiente || cantidad <= 0) throw new ErrorCompra('La recepción supera lo pendiente.');
    }
    for (const l of elegidas) {
      const cantidad = entrada.lineaId ? entrada.cantidad! : Number(l.cantidad) - Number(l.cantidad_recibida);
      await tx`update pedido_lineas set cantidad_recibida = cantidad_recibida + ${cantidad} where id = ${l.id}`;
      await tx`insert into movimientos (articulo_id, ubicacion_id, tipo, cantidad, sala_id, motivo, quien, pedido_linea_id, recepcion_compra_id)
        values (${l.articulo_id}, ${entrada.ubicacionId}, 'entrada', ${cantidad}, ${pedido.sala_id},
          ${`Recepción de pedido · ${pedido.referencia ?? pedido.id}`}, ${entrada.autor.nombre}, ${l.id}, ${entrada.recepcionId})`;
    }
    if (lineas.length) await tx`update pedidos set estado = case
      when not exists (select 1 from pedido_lineas where pedido_id = ${entrada.pedidoId} and cantidad_recibida < cantidad)
        then 'recibido'::estado_pedido
      when exists (select 1 from pedido_lineas where pedido_id = ${entrada.pedidoId} and cantidad_recibida > 0)
        then 'recibido_parcial'::estado_pedido else estado end where id = ${entrada.pedidoId}`;
  }); } catch (error) {
    // Solo rechazos de negocio conocidos; conservar fallos internos y de integridad.
    const mensajes = new Map([
      ['La recepcion supera lo pendiente', 'La recepción supera lo pendiente.'],
      ['Primero registra la compra con oferta final', 'Primero registra la compra con oferta final.'],
      ['Kit exige unidades enteras y atribucion explicita previa', 'El kit requiere unidades enteras y una atribución de compra previa.'],
      ['Elige un almacen de recepcion', 'Elige un almacén de recepción.'],
      ['El proyecto esta cerrado', 'El proyecto está cerrado.'],
      ['La linea no pertenece al pedido', 'La línea no pertenece al pedido.'],
      ['El pedido ha cambiado de destino; recarga', 'El pedido ha cambiado de destino. Recarga antes de recibir.'],
      ['La recepcion requiere usuario activo', 'La recepción requiere un usuario activo.'],
    ]);
    if (error instanceof Error && 'code' in error && error.code === '23514' && mensajes.has(error.message)) {
      throw new ErrorCompra(mensajes.get(error.message)!);
    }
    throw error;
  }
}
