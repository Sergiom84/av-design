import type postgres from 'postgres';
import { z } from 'zod';

export const entradaPuertoSchema = z.object({
  nombre: z.string().trim().min(1).max(200), total: z.number().int().positive().max(1_000_000),
  sentido: z.enum(['entrada', 'salida', 'bidireccional', 'control']),
  senal: z.enum(['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro']),
  conector: z.string().trim().max(200).nullable(), orden: z.number().int().nullable(),
  notas: z.string().max(4000).nullable(),
}).strict();
export class ErrorAltaPuerto extends Error {
  constructor(mensaje: string, public readonly estadoHttp = 409) { super(mensaje); this.name = 'ErrorAltaPuerto'; }
}

/** Caller exige catalogo:editar actual; nunca actualiza un puerto por coincidencia. */
export async function crearPuertoEnTransaccion(tx: postgres.TransactionSql<Record<string, unknown>>,
  articuloId: string, entrada: unknown, opciones: { rechazarDuplicado?: boolean } = {}): Promise<string | null> {
  z.uuid().parse(articuloId);
  const e = entradaPuertoSchema.parse(entrada);
  const [articulo] = await tx`select id from articulos where id=${articuloId} for update`;
  if (!articulo) throw new ErrorAltaPuerto('La referencia ya no existe.', 404);
  const [puerto] = await tx`insert into puertos(articulo_id,nombre,total,sentido,senal,conector,orden,notas,fuente)
    values(${articuloId},${e.nombre},${e.total},${e.sentido}::sentido_puerto,${e.senal}::senal,
      ${e.conector},${e.orden},${e.notas},'app')
    on conflict(articulo_id,nombre) do nothing returning id`;
  if (!puerto && opciones.rechazarDuplicado) throw new ErrorAltaPuerto('Ese puerto ya existe: abre su ficha para revisarlo.');
  return puerto ? String(puerto.id) : null;
}

/** El artículo real se bloquea antes que su puerto, igual que en el alta. */
async function bloquearArticuloDelPuerto(tx: postgres.TransactionSql<Record<string, unknown>>, puertoId: string): Promise<string | null> {
  z.uuid().parse(puertoId);
  const [puerto] = await tx`select articulo_id from puertos where id=${puertoId}`;
  if (!puerto) return null;
  const [articulo] = await tx`select id from articulos where id=${puerto.articulo_id} for update`;
  if (!articulo) return null;
  const [actual] = await tx`select id from puertos where id=${puertoId} and articulo_id=${articulo.id} for update`;
  if (!actual) throw new ErrorAltaPuerto('El puerto cambió mientras se esperaba. Recarga su ficha.');
  return String(articulo.id);
}

/** Caller exige catalogo:editar. El identificador del artículo no viene del formulario. */
export async function guardarPuertoEnTransaccion(tx: postgres.TransactionSql<Record<string, unknown>>, puertoId: string, entrada: unknown): Promise<string | null> {
  const e = entradaPuertoSchema.parse(entrada);
  const articuloId = await bloquearArticuloDelPuerto(tx, puertoId);
  if (!articuloId) return null;
  await tx`update puertos set nombre=${e.nombre},total=${e.total},sentido=${e.sentido}::sentido_puerto,
    senal=${e.senal}::senal,conector=${e.conector},orden=${e.orden},notas=${e.notas}
    where id=${puertoId} and articulo_id=${articuloId}`;
  return articuloId;
}

export async function borrarPuertoEnTransaccion(tx: postgres.TransactionSql<Record<string, unknown>>, puertoId: string): Promise<string | null> {
  const articuloId = await bloquearArticuloDelPuerto(tx, puertoId);
  if (!articuloId) return null;
  await tx`delete from puertos where id=${puertoId} and articulo_id=${articuloId}`;
  return articuloId;
}
