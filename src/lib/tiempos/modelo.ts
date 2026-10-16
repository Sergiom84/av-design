import { z } from 'zod';
import type { HoraTrabajo } from './fechas';

export const LIMITES_TIEMPOS = { cuerpo: 64 * 1024, pagina: 50, sugerencias: 20, dias: 366 } as const;
export class ErrorTiempo extends Error {
  constructor(public codigo: string, mensaje: string, public status = 400, public detalle?: unknown) { super(mensaje); }
}
export const uuidTiempo = z.string().uuid();
const hora = z.object({ fecha: z.string().max(10), hora: z.string().max(5), offset: z.string().max(6).optional() }).strict();
const motivo = z.string().trim().min(1).max(2000);
const cas = { numeroActual: z.number().int().min(1).max(2147483646), actualId: uuidTiempo, clavePeticion: uuidTiempo };
export const altaTiempoSchema = z.object({ tareaId: uuidTiempo, tecnicoId: uuidTiempo.optional(), inicio: hora, fin: hora, notas: z.string().trim().max(2000).default(''), motivo: motivo.optional(), relacionadoId: uuidTiempo.optional(), clavePeticion: uuidTiempo }).strict();
export const corregirTiempoSchema = z.object({ ...cas, inicio: hora, fin: hora, notas: z.string().trim().max(2000).default(''), motivo }).strict();
export const anularTiempoSchema = z.object({ ...cas, motivo }).strict();
export const restaurarTiempoSchema = z.object({ ...cas, versionId: uuidTiempo, motivo }).strict();
export type AltaTiempo = z.infer<typeof altaTiempoSchema>;
export type CorreccionTiempo = z.infer<typeof corregirTiempoSchema>;
export type AnulacionTiempo = z.infer<typeof anularTiempoSchema>;
export type RestauracionTiempo = z.infer<typeof restaurarTiempoSchema>;
export type FiltroTiempos = { desde: string; hasta: string; pagina: number };
export interface VersionTiempo {
  id: string; numero: number; antecedenteId: string | null; accion: 'registro' | 'correccion' | 'anulacion';
  inicioUtc: string; finUtc: string; minutos: number; entradaLocal: { inicio: HoraTrabajo; fin: HoraTrabajo };
  notas: string; motivo: string | null; autorNombre: string; creadoEn: string;
}
export interface ParteTiempo {
  id: string; tareaId: string; tarea: string; proyectoId: string; proyecto: string; salaId: string | null; sala: string | null;
  tecnicoId: string; tecnico: string; tecnicoActivo: boolean; relacionadoId: string | null;
  numeroActual: number; actualId: string; version: VersionTiempo; puedeEscribir: boolean;
}
export interface IdentidadTiempos { usuarioId: string; gestionar: boolean; puedeRegistrar: boolean; tecnicoId: string | null; aviso: string | null; alcance: string }
export interface ListaTiempos { identidad: IdentidadTiempos; partes: ParteTiempo[]; pagina: number; hayMas: boolean; desde: string; hasta: string; minutos: number; dias: { fecha: string; minutos: number }[] }
export interface TareaTiempo { id: string; titulo: string; proyectoId: string; proyecto: string; sala: string | null; estado: string; historica: boolean }
export function entradaTiempo<T>(schema: z.ZodType<T>, valor: unknown): T {
  const r = schema.safeParse(valor);
  if (!r.success) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Comprueba los campos, identificadores y versiones de la solicitud.');
  return r.data;
}
export function canonicoTiempo(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicoTiempo).join(',') + ']';
  return '{' + Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => JSON.stringify(k) + ':' + canonicoTiempo(x)).join(',') + '}';
}
