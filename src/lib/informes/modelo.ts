import { z } from 'zod';
export const CLAVES = ['material_actual', 'material_movimientos', 'carga_actual', 'carga_hechos', 'estado_actual', 'estado_hitos'] as const;
export const FORMATOS = ['pdf', 'xlsx', 'csv'] as const;
export const GENERADOR = 'rea03-1';
export const ZONA = 'Europe/Madrid';
export const LIMITES = { definiciones: 20, programaciones: 20, grupos: 20, miembros: 100, receptores: 100, cola: 5, salas: 500, filas: 10000, snapshot: 8 * 1024 * 1024, paginas: 200, archivo: 25 * 1024 * 1024, ejecucion: 50 * 1024 * 1024, propietario: 250 * 1024 * 1024, global: 1024 * 1024 * 1024, cuerpo: 16384 } as const;
export const uuid = z.uuid();
const ids = z.array(uuid).max(500).refine(a => new Set(a).size === a.length, 'Identificadores repetidos');
export const ambitoSchema = z.discriminatedUnion('tipo', [z.object({ tipo: z.literal('sala'), id: uuid }).strict(), z.object({ tipo: z.literal('obra'), id: uuid, salaIds: ids.optional() }).strict(), z.object({ tipo: z.literal('sede'), id: uuid, salaIds: ids.optional() }).strict()]);
export const periodoSchema = z.discriminatedUnion('modo', [z.object({ modo: z.literal('actual') }).strict(), z.object({ modo: z.literal('rango'), desde: z.string(), hasta: z.string() }).strict(), z.object({ modo: z.literal('relativo'), intervalo: z.enum(['dia_anterior', 'semana_anterior', 'mes_anterior']) }).strict()]);
export const configuracionSchema = z.object({ versionModelo: z.literal(1), clave: z.enum(CLAVES), versionRegistro: z.literal(1), ambito: ambitoSchema, periodo: periodoSchema, formatos: z.array(z.enum(FORMATOS)).min(1).max(3).refine(a => new Set(a).size === a.length), audiencia: z.object({ usuarios: ids, grupos: z.array(z.object({ id: uuid, version: z.number().int().nonnegative() }).strict()).max(20).refine(a => new Set(a.map(g => g.id)).size === a.length) }).strict() }).strict().refine(c => c.clave.endsWith('_actual') ? c.periodo.modo === 'actual' : c.periodo.modo !== 'actual', 'Período incompatible con el informe');
export const calendarioSchema = z.object({ frecuencia: z.enum(['una_vez', 'diaria', 'semanal']), inicio: z.string(), fin: z.string().nullable(), hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), diasSemana: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional() }).strict().refine(c => c.frecuencia === 'semanal' ? !!c.diasSemana && new Set(c.diasSemana).size === c.diasSemana.length : c.diasSemana === undefined, 'Días semanales inválidos');
export type ClaveInforme = typeof CLAVES[number];
export type FormatoInforme = typeof FORMATOS[number];
export type AmbitoInforme = z.infer<typeof ambitoSchema>;
export type PeriodoInforme = z.infer<typeof periodoSchema>;
export type ConfiguracionInforme = z.infer<typeof configuracionSchema>;
export type CalendarioInforme = z.infer<typeof calendarioSchema>;
export type EstadoEjecucion = 'pendiente' | 'en_curso' | 'correcta' | 'fallida' | 'bloqueada' | 'cancelada' | 'caducada';
export type Celda = string | number | boolean | null;
export interface ColumnaInforme {
    clave: string;
    titulo: string;
    tipo: 'texto' | 'numero' | 'booleano' | 'fecha';
    unidad?: string;
}
export interface FilaInforme {
    clave: string;
    valores: Record<string, Celda>;
    enlace?: string;
}
export interface SalaResuelta {
    id: string;
    nombre: string;
    codigo: string | null;
    proyectoId?: string | null;
    proyectoNombre?: string | null;
    sedeId?: string | null;
    localizacion?: string | null;
}
export interface AmbitoResuelto {
    solicitado: AmbitoInforme;
    nombre: string;
    salas: SalaResuelta[];
    proyectos: {
        id: string;
        nombre: string;
        codigo: string | null;
    }[];
}
export type PeriodoResuelto = {
    modo: 'actual';
    zona: typeof ZONA;
} | {
    modo: 'rango';
    zona: typeof ZONA;
    desde: string;
    hasta: string;
    desdeUtc: string;
    hastaUtcExclusivo: string;
};
export interface DefinicionCongelada {
    id: string;
    nombre: string;
    version: number;
    propietarioId: string;
    configuracion: ConfiguracionInforme;
    programacion: {
        id: string;
        version: number;
    } | null;
    versionGenerador: string;
}
export interface SnapshotInforme {
    versionModelo: 1;
    versionGenerador: typeof GENERADOR;
    revision: string;
    ejecucionId: string;
    definicion: DefinicionCongelada;
    definicionSha256: string;
    periodo: PeriodoResuelto;
    ambito: AmbitoResuelto;
    previstaEn: string;
    observadoEn: string;
    columnas: ColumnaInforme[];
    filas: FilaInforme[];
    avisos: string[];
    resumen?: Record<string, number | null>;
    material?: import('../documentos/modelo').SnapshotExportacion;
    detalleMaterial?: unknown;
}
export interface ArchivoInforme {
    id: string;
    formato: FormatoInforme;
    nombre: string;
    mime: string;
    contenido: Uint8Array;
    sha256: string;
    bytes: number;
}
export interface ManifiestoInforme {
    versionModelo: 1;
    ejecucionId: string;
    revision: string;
    snapshotSha256: string;
    contexto: Omit<SnapshotInforme, 'material' | 'filas' | 'detalleMaterial'>;
    archivos: Omit<ArchivoInforme, 'contenido'>[];
    entregaInterna: 'disponible_en_aplicacion';
    entregaExterna: 'entrega_externa_no_configurada';
}
export class ErrorInforme extends Error {
    constructor(public codigo: string, message: string, public status = 400, public transitorio = false) {
        super(message);
        this.name = 'ErrorInforme';
    }
}
export function entrada<T>(schema: z.ZodType<T>, valor: unknown): T {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        const v = valor as Record<string, unknown>;
        if (('versionModelo' in v && v.versionModelo !== 1) || ('versionRegistro' in v && v.versionRegistro !== 1))
            throw new ErrorInforme('VERSION_NO_SOPORTADA', 'La versión de la definición no está soportada.', 422);
    }
    const r = schema.safeParse(valor);
    if (!r.success)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Revisa los campos del informe.', 400);
    return r.data;
}
export function identificador(valor: unknown): string {
    return entrada(uuid, valor);
}
export function serializarCanonico(valor: unknown): string {
    const ordenar = (v: unknown): unknown => {
        if (v === null || typeof v === 'string' || typeof v === 'boolean')
            return v;
        if (typeof v === 'number') {
            if (!Number.isFinite(v))
                throw new ErrorInforme('ENTRADA_INVALIDA', 'Número no finito.');
            return v;
        }
        if (v instanceof Date)
            return v.toISOString();
        if (Array.isArray(v))
            return v.map(ordenar);
        if (typeof v === 'object' && v) {
            return Object.fromEntries(Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined).map(k => [k, ordenar((v as Record<string, unknown>)[k])]));
        }
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Valor de captura inválido.');
    };
    return JSON.stringify(ordenar(valor));
}
export function errorSeguro(error: unknown): ErrorInforme {
    if (error instanceof ErrorInforme)
        return error;
    return new ErrorInforme('FUENTE_NO_DISPONIBLE', 'El servicio de informes no está disponible. Vuelve a intentarlo.', 503, true);
}
export function compararTexto(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
