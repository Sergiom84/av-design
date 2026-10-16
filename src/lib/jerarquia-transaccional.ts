import type postgres from 'postgres';
import { z } from 'zod';

type Transaccion = postgres.TransactionSql<Record<string, unknown>>;
export class ErrorJerarquia extends Error {
  constructor(mensaje: string, public readonly estadoHttp = 409) { super(mensaje); this.name = 'ErrorJerarquia'; }
}
const nombre = z.string().trim().min(1).max(160);
const medida = z.number().finite().positive().max(9999.99)
  .refine(n => Number(n.toFixed(2)) === n, 'La precisión de sala es un centímetro.');
const entradaSala = z.object({ proyectoId: z.uuid(), localizacionId: z.uuid(),
  id: z.uuid().optional(),
  nombre, codigo: z.string().trim().min(1).max(80).nullable(),
  medidas: z.object({ largo_m: medida.nullable(), ancho_m: medida.nullable(), alto_m: medida.nullable() }).strict(),
  procedencia: z.string().trim().min(1).max(1000), aceptarHomonimo: z.boolean(),
}).strict();

/** Caller autoriza el conjunto y bloquea sus salas existentes antes de llamar. */
export async function bloquearProyectoParaAlta(tx: Transaccion, proyectoId: string) {
  z.uuid().parse(proyectoId);
  const [proyecto] = await tx`select id, sede_id from proyectos where id=${proyectoId} for update`;
  if (!proyecto) throw new ErrorJerarquia('La obra no existe.', 404);
  // Se consulta después de esperar: el preview anterior no autoriza un alta tras cierre.
  const [cierre] = await tx`select exists(select 1 from hitos_proyecto where proyecto_id=${proyectoId} and tipo='cierre') as cerrado`;
  if (cierre.cerrado) throw new ErrorJerarquia('La obra está cerrada.');
  return { id: String(proyecto.id), sedeId: proyecto.sede_id == null ? null : String(proyecto.sede_id) };
}

/** Alta nueva explícita; una colisión concurrente no se convierte en vínculo implícito. */
export async function crearLocalizacionEnTransaccion(tx: Transaccion, proyectoId: string, nombreNuevo: string): Promise<string> {
  const n = nombre.parse(nombreNuevo);
  await bloquearProyectoParaAlta(tx, proyectoId);
  const [fila] = await tx`insert into localizaciones(proyecto_id,nombre) values(${proyectoId},${n})
    on conflict(proyecto_id,nombre) do nothing returning id`;
  if (!fila) throw new ErrorJerarquia('Ya existe esa localización: vuelve a revisar y elige su identificador.');
  return String(fila.id);
}

/** Sala sin plantilla, diseño ni material; ausencia usa el valor canónico «sin medir». */
export async function crearSalaMinimaEnTransaccion(tx: Transaccion, entrada: z.input<typeof entradaSala>): Promise<string> {
  const e = entradaSala.parse(entrada);
  const proyecto = await bloquearProyectoParaAlta(tx, e.proyectoId);
  const [localizacion] = await tx`select id,proyecto_id from localizaciones where id=${e.localizacionId}`;
  if (!localizacion || localizacion.proyecto_id !== e.proyectoId) throw new ErrorJerarquia('La localización ya no pertenece a la obra.');
  if (!e.aceptarHomonimo) {
    const [existe] = await tx`select exists(select 1 from salas where localizacion_id=${e.localizacionId}
      and (nombre=${e.nombre} or (${e.codigo}::text is not null and codigo=${e.codigo}))) as existe`;
    if (existe.existe) throw new ErrorJerarquia('Ya hay una sala con ese nombre o código: revisa si debes vincularla.');
  }
  // El plan10 puede fijar el UUID antes del alta para ligar a él su previewBOM.
  const [fila] = await tx`insert into salas(id,localizacion_id,sede_id,nombre,codigo,largo_m,ancho_m,alto_m,notas)
    values(coalesce(${e.id??null}::uuid,gen_random_uuid()),${e.localizacionId},${proyecto.sedeId},${e.nombre},${e.codigo},
      ${e.medidas.largo_m ?? 0},${e.medidas.ancho_m ?? 0},${e.medidas.alto_m ?? 0},
      ${'Según documento, pendiente de comprobación física. ' + e.procedencia}) returning id`;
  return String(fila.id);
}
