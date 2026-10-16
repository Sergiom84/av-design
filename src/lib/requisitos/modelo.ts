import { createHash } from 'node:crypto';
import { z } from 'zod';
import { datosTecnicosSchema, urlTecnicaSchema } from '../catalogo-tecnico';
import { entradaPuertoSchema } from '../catalogo-puertos-escritura';

export const LIMITES_REQUISITOS = { archivo: 5 * 1024 * 1024, cuerpo: 32 * 1024,
  multipart: 5 * 1024 * 1024 + 64 * 1024, documentos: 100, bytesObra: 100 * 1024 * 1024,
  planes: 20, candidatos: 500, fragmento: 2000, tokenMs: 600_000, parsers: 2 } as const;
export class ErrorRequisito extends Error {
  constructor(public codigo: string, mensaje: string, public status = 400) { super(mensaje); this.name = 'ErrorRequisito'; }
}
export const uuid = z.uuid();
export const sha = z.string().regex(/^[a-f0-9]{64}$/u);
export function canonico(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonico(x)}`).join(',')}}`;
  return JSON.stringify(v);
}
export function hash(v: unknown): string { return createHash('sha256').update(typeof v === 'string' ? v : canonico(v)).digest('hex'); }
export function hashBytes(v: Uint8Array): string { return createHash('sha256').update(v).digest('hex'); }
export function validar<T>(s: z.ZodType<T>, v: unknown): T {
  const r = s.safeParse(v); if (!r.success) throw new ErrorRequisito('ENTRADA', 'Revisa los campos y los identificadores de la petición.'); return r.data;
}
export const metadatosSchema = z.object({ nombre: z.string().min(1).max(120),
  mime: z.enum(['application/pdf', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  procedencia: z.string().trim().min(1).max(500), fechaFuente: z.iso.date().nullable(),
  url: urlTecnicaSchema.nullable(), tamano: z.number().int().positive().max(LIMITES_REQUISITOS.archivo) }).strict();
export const referenciaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ficha_e2'), articuloId: uuid, archivoId: uuid, sha256: sha, revisionFuente: z.string().regex(/^\d+$/u) }).strict(),
  z.object({ tipo: z.literal('lote_e2'), loteId: uuid, sha256: sha, destino: z.enum(['catalogo', 'bom', 'precios']) }).strict(),
]);
export const altaReferenciaSchema = z.object({ proyectoId: uuid, referencia: referenciaSchema, procedencia: z.string().trim().min(1).max(500) }).strict();
export const anclaSchema = z.object({ documentoId: uuid, extraccionId: uuid,
  pagina: z.number().int().min(1).max(100).nullable(), linea: z.number().int().positive().nullable(),
  inicio: z.number().int().nonnegative(), fin: z.number().int().nonnegative(), sha256: sha,
  metodo: z.enum(['literal_estructurado', 'hipotesis', 'transcripcion_manual']) }).strict();
export const candidatoSchema = z.object({ id: uuid, clase: z.enum(['area', 'material', 'tecnico', 'puerto', 'hipotesis']),
  ancla: anclaSchema, fragmento: z.string().min(1).max(2000), original: z.record(z.string(), z.string().max(2000)),
  ambiguedades: z.array(z.string().max(300)).max(20) }).strict();
export type Candidato = z.infer<typeof candidatoSchema>;
export const resultadoExtraccionSchema = z.object({ versionModelo: z.literal(1),
  estado: z.enum(['con_texto', 'sin_texto', 'mixto', 'manual', 'referencia']),
  motivoManual: z.string().trim().min(1).max(500).optional(),
  paginas: z.array(z.object({ numero: z.number().int().min(1).max(100).nullable(), texto: z.string().max(1_048_576) }).strict()).max(100),
  candidatos: z.array(candidatoSchema).max(500), avisos: z.array(z.string().max(500)).max(101) }).strict();
export type ResultadoExtraccion = z.infer<typeof resultadoExtraccionSchema>;
const revision = { candidatoId: uuid, camposRevisados: z.array(z.string().min(1).max(80)).max(40), motivo: z.string().trim().min(1).max(500) };
const medida = z.number().finite().positive().max(9999.99).refine(n => Number(n.toFixed(2)) === n).nullable();
export const areaSchema = z.object({ ...revision, accion: z.enum(['crear', 'vincular']), salaId: uuid.nullable(),
  nombre: z.string().trim().min(1).max(160), codigo: z.string().trim().min(1).max(80).nullable(),
  localizacion: z.object({ id: uuid.nullable(), nombreNuevo: z.string().trim().min(1).max(160).nullable() }).strict(),
  medidas: z.object({ largo_m: medida, ancho_m: medida, alto_m: medida }).strict(), aceptarHomonimo: z.boolean() }).strict();
export const materialSchema = z.object({ ...revision, salaId: uuid.nullable(), areaCandidatoId: uuid.nullable(),
  articuloId: uuid, revisionArticulo: z.number().int().nonnegative(), cantidad: z.number().finite().positive().max(1_000_000),
  unidad: z.enum(['ud', 'm']), disenoRevisado: z.literal(true) }).strict();
const filaSchema = z.object({ ...revision, datos: z.record(z.string(), z.string().max(2000)),
  articuloId: uuid.nullable(), crear: z.boolean(), revisionArticulo: z.number().int().nonnegative().nullable() }).strict();
export const decisionesSchema = z.discriminatedUnion('destino', [
  z.object({ versionModelo: z.literal(1), destino: z.literal('areas_bom'), areas: z.array(areaSchema).max(500), material: z.array(materialSchema).max(500), excluidos: z.array(uuid).max(500) }).strict(),
  z.object({ versionModelo: z.literal(1), destino: z.literal('catalogo'), filas: z.array(filaSchema).max(500), excluidos: z.array(uuid).max(500) }).strict(),
  z.object({ versionModelo: z.literal(1), destino: z.literal('ofertas'), filas: z.array(filaSchema).max(500), excluidos: z.array(uuid).max(500) }).strict(),
  z.object({ versionModelo: z.literal(1), destino: z.literal('tecnico'), ...revision, articuloId: uuid, baseHash: sha, baseRevision: z.string().regex(/^\d+$/u).nullable(), datos: datosTecnicosSchema }).strict(),
  z.object({ versionModelo: z.literal(1), destino: z.literal('puerto'), ...revision, articuloId: uuid, baseHash: sha, baseRevision: z.string().regex(/^\d+$/u), datos: entradaPuertoSchema }).strict(),
]);
export type Decisiones = z.infer<typeof decisionesSchema>;
export type Destino = Decisiones['destino'];
export const crearPlanSchema = z.object({ extraccionId: uuid, destino: z.enum(['areas_bom', 'catalogo', 'ofertas', 'tecnico', 'puerto']) }).strict();
export const editarPlanSchema = z.object({ version: z.number().int().nonnegative(), decisiones: decisionesSchema }).strict();
export const confirmarSchema = z.object({ version: z.number().int().nonnegative(), token: z.string().max(4096), clavePeticion: uuid }).strict();
export const manualSchema = z.object({ modo: z.literal('manual'), texto: z.string().trim().min(1).max(20_000), pagina: z.number().int().min(1).max(100).nullable(), motivo: z.string().trim().min(1).max(500) }).strict();
export const extraerSchema = z.union([z.object({ modo: z.literal('local') }).strict(), manualSchema]);
export const retirarSchema = z.object({ version: z.number().int().nonnegative(), accion: z.enum(['retirar', 'purgar']), motivo: z.string().trim().min(1).max(500), confirmarHash: sha }).strict();
export const revertirSchema = z.object({ clavePeticion: uuid, antecedenteId: uuid.nullable(), motivo: z.string().trim().min(1).max(500) }).strict();
export function decisionesVacias(destino: Destino): Decisiones | null {
  if (destino === 'areas_bom') return { versionModelo: 1, destino, areas: [], material: [], excluidos: [] };
  if (destino === 'catalogo' || destino === 'ofertas') return { versionModelo: 1, destino, filas: [], excluidos: [] };
  return null;
}
