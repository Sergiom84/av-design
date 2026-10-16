import { z } from 'zod';
export const ZONA_PLAN = 'Europe/Madrid';
export const LIMITES_PLAN = { cuerpo: 65536, salas: 500, reglas: 200, candidatas: 2000, acciones: 200, fuente: 10 * 1024 * 1024, tareas: 5000, grupos: 50, miembros: 100, asignados: 50, pagina: 50, busqueda: 20, dias: 93 } as const;
export const ESTADOS_TAREA = ['borrador', 'pendiente', 'en_curso', 'hecha', 'anulada'] as const;
export type EstadoTarea = typeof ESTADOS_TAREA[number];
export class ErrorPlan extends Error {
    constructor(public codigo: string, mensaje: string, public status = 400, public detalle?: unknown) {
        super(mensaje);
    }
}
export const uuidPlan = z.uuid();
export const versionPlan = z.number().int().min(0).max(2147483646);
const texto = (max: number) => z.string().trim().max(max).refine(t => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(t), 'Usa texto literal.');
export const motivoPlan = texto(2000).min(1);
export const duracionPlan = z.number().int().min(1).max(43200).nullable();
export const listaIds = (max: number) => z.array(uuidPlan).max(max).refine(a => new Set(a).size === a.length, 'Identificadores repetidos.');
export const trabajoSchema = z.object({ titulo: texto(160).min(1), descripcion: texto(2000).default(''), duracionEstimadaMin: duracionPlan.default(null), activo: z.boolean().default(true) }).strict();
const senal = z.enum(['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro']);
export const selectorSchema = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('sala') }).strict(),
    z.object({ tipo: z.literal('tipologia'), tipologia: texto(160).min(1) }).strict(),
    z.object({ tipo: z.literal('equipo'), articuloId: uuidPlan.optional(), categoria: texto(160).min(1).optional() }).strict(),
    z.object({ tipo: z.literal('conexion'), senal: senal.optional(), articuloCableId: uuidPlan.optional() }).strict(),
    z.object({ tipo: z.literal('material_bom'), articuloId: uuidPlan.optional() }).strict(),
]);
export type SelectorRegla = z.infer<typeof selectorSchema>;
export const reglaSchema = z.object({ trabajoId: uuidPlan, selector: selectorSchema, activo: z.boolean().default(true) }).strict();
export const horaLocalSchema = z.object({ fecha: z.string().length(10), hora: z.string().length(5), offset: z.enum(['+01:00', '+02:00']).optional() }).strict();
export const intervaloSchema = z.object({ inicio: horaLocalSchema, fin: horaLocalSchema }).strict().nullable();
export const camposTareaSchema = z.object({ titulo: texto(160).min(1), descripcion: texto(2000).default(''), notas: texto(2000).default(''), duracionEstimadaMin: duracionPlan.default(null), estado: z.enum(ESTADOS_TAREA).default('borrador'), venceFecha: z.string().length(10).nullable().default(null), intervalo: intervaloSchema.default(null) }).strict();
export const casSchema = z.object({ versionPlan, versionTarea: versionPlan, clavePeticion: uuidPlan, motivo: motivoPlan.optional() });
export const manualSchema = camposTareaSchema.extend({ salaId: uuidPlan.nullable().default(null), trabajoId: uuidPlan.nullable().default(null), versionPlan, clavePeticion: uuidPlan }).strict();
export const editarTareaSchema = camposTareaSchema.extend(casSchema.shape).extend({ aceptacionConflictos: z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/), nota: texto(500).min(1) }).strict().optional() }).strict();
export const asignacionSchema = casSchema.extend({ tecnicos: listaIds(50), grupos: z.array(z.object({ id: uuidPlan, version: versionPlan }).strict()).max(50).refine(a => new Set(a.map(g => g.id)).size === a.length), aceptacionConflictos: z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/), nota: texto(500).min(1) }).strict().optional() }).strict();
export const seleccionSchema = z.object({ versionPlan: versionPlan.nullable(), salas: z.discriminatedUnion('modo', [z.object({ modo: z.literal('todas') }).strict(), z.object({ modo: z.literal('seleccion'), ids: listaIds(500).min(1) }).strict()]), reglas: listaIds(200).min(1), fuentes: z.array(z.object({ salaId: uuidPlan, tipo: z.enum(['actual', 'revision']), revisionId: uuidPlan.optional() }).strict().refine(f => f.tipo === 'revision' ? !!f.revisionId : !f.revisionId)).max(500).refine(a => new Set(a.map(f => f.salaId)).size === a.length) }).strict();
export const confirmarSchema = z.object({ seleccion: seleccionSchema, token: z.string().max(2048), clavePeticion: uuidPlan, aceptoFuenteAnterior: z.boolean().default(false), acciones: z.array(z.object({ clave: z.string().regex(/^[0-9a-f]{64}$/), accion: z.enum(['crear', 'actualizar', 'anular']), versionTarea: versionPlan.nullable(), campos: z.array(z.enum(['titulo', 'descripcion', 'duracionEstimadaMin'])).max(3).refine(a => new Set(a).size === a.length).default([]), motivo: motivoPlan.optional() }).strict()).min(1).max(200).refine(a => new Set(a.map(f => f.clave)).size === a.length) }).strict();
export type SeleccionPlan = z.infer<typeof seleccionSchema>;
export type CamposTarea = z.infer<typeof camposTareaSchema>;
export type EntradaManual = z.infer<typeof manualSchema>;
export type EdicionTarea = z.infer<typeof editarTareaSchema>;
export type EntradaAsignacion = z.infer<typeof asignacionSchema>;
export type ConfirmacionPlan = z.infer<typeof confirmarSchema>;
export type Trabajo = z.infer<typeof trabajoSchema> & {
    id: string;
    version: number;
};
export interface Regla {
    id: string;
    version: number;
    trabajoId: string;
    selector: SelectorRegla;
    activo: boolean;
    trabajo: Trabajo;
}
export interface TecnicoPlan {
    id: string;
    nombre: string;
    activo: boolean;
}
export interface TareaAgenda {
    id: string;
    planId: string;
    proyectoId: string;
    proyectoNombre: string;
    salaId: string | null;
    salaNombre: string | null;
    titulo: string;
    descripcion: string;
    notas: string;
    duracionEstimadaMin: number | null;
    estado: EstadoTarea;
    venceFecha: string | null;
    inicio: string | null;
    fin: string | null;
    version: number;
    tecnicos: TecnicoPlan[];
    archivado: boolean;
}
export interface TareaPlan extends TareaAgenda {
    trabajoId: string | null;
    reglaId: string | null;
    claveOrigen: string | null;
    fuenteId: string | null;
    origenPublico: Record<string, unknown>;
    origenCatalogo?: Record<string, unknown>;
    baseGenerada: BaseGenerada | null;
    versionPlan: number;
    desactualizada: boolean;
}
export interface BaseGenerada {
    titulo: string;
    descripcion: string;
    duracionEstimadaMin: number | null;
}
export interface CandidataPlan extends BaseGenerada {
    clave: string;
    salaId: string;
    reglaId: string;
    trabajoId: string;
    origenPublico: Record<string, unknown>;
    origenCatalogo: Record<string, unknown>;
}
export type EstadoDiff = 'nueva' | 'sin_cambios' | 'cambiada' | 'origen_retirado' | 'anulada_existente' | 'edicion_manual';
export interface DiferenciaPlan {
    clave: string;
    estado: EstadoDiff;
    candidata: CandidataPlan | null;
    tarea: TareaPlan | null;
    campos: {
        campo: keyof BaseGenerada;
        anterior: unknown;
        actual: unknown;
        propuesto: unknown;
        manual: boolean;
    }[];
}
export interface FiltroAgenda {
    vista: 'hoy' | 'semana' | 'vencidas' | 'sin_fecha';
    proyectoId?: string;
    tecnicoId?: string;
    desde?: string;
    hasta?: string;
    historial?: boolean;
}
export const filtroAgendaSchema = z.object({ vista: z.enum(['hoy', 'semana', 'vencidas', 'sin_fecha']).default('hoy'), proyectoId: uuidPlan.optional(), tecnicoId: uuidPlan.optional(), desde: z.string().optional(), hasta: z.string().optional(), historial: z.boolean().default(false) }).strict().refine(f => !!f.desde === !!f.hasta, 'Elige ambos extremos del rango.');
export function canonico(valor: unknown): string {
    if (valor === null || typeof valor !== 'object')
        return JSON.stringify(valor);
    if (Array.isArray(valor))
        return '[' + valor.map(canonico).join(',') + ']';
    return '{' + Object.entries(valor as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonico(v)).join(',') + '}';
}
export function entradaPlan<T>(schema: z.ZodType<T>, valor: unknown): T {
    const r = schema.safeParse(valor);
    if (!r.success)
        throw new ErrorPlan('ENTRADA_INVALIDA', 'Comprueba los campos, versiones y límites de la solicitud.');
    return r.data;
}
export function urlAgendaPlan(filtro: FiltroAgenda): string {
    const q = new URLSearchParams({ vista: filtro.vista });
    for (const k of ['proyectoId', 'tecnicoId', 'desde', 'hasta'] as const)
        if (filtro[k])
            q.set(k, filtro[k]!);
    if (filtro.historial)
        q.set('historial', '1');
    return '/proyectos/agenda?' + q;
}
