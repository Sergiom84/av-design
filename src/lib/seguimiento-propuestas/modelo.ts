import { createHash } from 'node:crypto';
import { z } from 'zod';
export class ErrorSeguimiento extends Error { constructor(message: string, public status = 400) { super(message); } }
export const LIMITES = { cuerpo: 65536, motivo: 2000, referencia: 1000, pagina: 50, eventos: 1000, propuestas: 10000, dias: 366, tokenMs: 600000 } as const;
export const uuid = z.uuid(), sha = z.string().regex(/^[a-f0-9]{64}$/);
export const estados = ['borrador', 'emitida', 'aceptada', 'rechazada'] as const;
export type Estado = typeof estados[number];
export type Comando = 'emitir' | 'aceptar' | 'rechazar' | 'revocar_decision';
export const comandoSchema = z.object({ propuestaId: uuid, revisionId: uuid, revisionHash: sha, versionPropuesta: z.number().int().nonnegative(), versionSeguimiento: z.number().int().nonnegative(), ultimoEventoId: uuid.nullable(), comando: z.enum(['emitir', 'aceptar', 'rechazar', 'revocar_decision']), decisionRevocadaId: uuid.nullable(), motivo: z.string().trim().min(1).max(LIMITES.motivo), referencia: z.string().trim().min(1).max(LIMITES.referencia), clavePeticion: uuid }).strict();
export type EntradaComando = z.infer<typeof comandoSchema>;
export const filtrosSchema = z.object({ desde: z.string(), hasta: z.string(), observadoEn: z.iso.datetime(), archivo: z.enum(['activas', 'archivadas', 'todas']), ambito: z.discriminatedUnion('tipo', [z.object({ tipo: z.literal('sala'), id: uuid }).strict(), z.object({ tipo: z.literal('obra'), id: uuid }).strict(), z.object({ tipo: z.literal('seleccion'), ids: z.array(uuid).min(1).max(LIMITES.propuestas).refine(a => new Set(a).size === a.length) }).strict()]), importes: z.boolean() }).strict();
export type Filtros = z.infer<typeof filtrosSchema>;
export interface Evento { id: string; propuestaId: string; revisionId: string; revisionHash: string; numero: number; antecedenteId: string | null; tipo: Comando; decisionRevocadaId: string | null; motivo: string; referencia: string; autorId: string; autor: string; creadoEn: string; }
export interface Miembro { propuestaId: string; revisionId: string; revisionHash: string; numeroRevision: number; titulo: string; publicadaEn: string; primeraPublicacionEn: string; publicacionOperacionId: string; ultimoEventoId: string | null; numeroEvento: number; archivoAlCorte: boolean; estado: Estado; }
export function canonico(v: unknown): string { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`; return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(',')}}`; }
export const hash = (v: unknown) => createHash('sha256').update(canonico(v)).digest('hex');
export function validar<T>(s: z.ZodType<T>, v: unknown): T { const r = s.safeParse(v); if (!r.success) throw new ErrorSeguimiento('Comprueba los campos del seguimiento.', 400); return r.data; }
export const identificador = (v: string) => validar(uuid, v);
