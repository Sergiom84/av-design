import { createHash } from 'node:crypto';
import { z } from 'zod';
export class ErrorPropuesta extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export const LIMITES = { cuerpo: 131072, salas: 20, lineas: 2000, secciones: 30, revisiones: 100, snapshot: 4194304, pdf: 20971520, paginas: 100, cuotaPropuesta: 209715200, cuotaGlobal: 1073741824 } as const;
export const uuid = z.uuid();
const texto = (max: number) => z.string().trim().max(max);
const decimal = z.string().regex(/^(0|[1-9]\d*)(?:\.\d{1,4})?$/).max(35);
export const ambitoSchema = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('sala'), id: uuid }).strict(),
    z.object({ tipo: z.literal('obra'), id: uuid, salaIds: z.array(uuid).min(1).max(20).refine(a => new Set(a).size === a.length) }).strict(),
]);
export const seccionSchema = z.object({ id: uuid, titulo: texto(160).min(1), texto: texto(10000) }).strict();
export const seccionesSchema = z.array(seccionSchema).max(30).refine(a => new Set(a.map(s => s.id)).size === a.length);
export const destinatarioSchema = z.object({ entidad: texto(200), nombre: texto(200), contacto: texto(300), grupo: texto(160) }).strict();
const origenPrecio = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('manual'), motivo: texto(500).min(1) }).strict(),
    z.object({ tipo: z.literal('catalogo'), articuloId: uuid, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
]);
const impuesto = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('sin_configurar') }).strict(),
    z.object({ tipo: z.literal('no_aplica'), motivo: texto(500).min(1) }).strict(),
    z.object({ tipo: z.literal('porcentaje'), porcentaje: decimal, etiqueta: texto(160).min(1), fuente: texto(500).min(1) }).strict(),
]);
export const lineaValoracionSchema = z.object({
    clave: texto(200).min(1), moneda: z.enum(['EUR', 'USD']), coste: decimal.nullable(), origenCoste: origenPrecio.nullable(),
    regla: z.enum(['directo', 'recargo', 'margen']), precio: decimal.nullable(), motivoPrecio: z.string().trim().max(500).nullable().default(null), porcentaje: decimal.nullable(), impuesto,
}).strict();
export const entradaSchema = z.object({
    ambito: ambitoSchema, titulo: texto(160).min(1),
    fuente: z.discriminatedUnion('tipo', [
        z.object({ tipo: z.literal('diseno'), revisiones: z.array(z.object({ salaId: uuid, revisionId: uuid }).strict()).min(1).max(20).refine(a => new Set(a.map(r => r.salaId)).size === a.length) }).strict(),
        z.object({ tipo: z.literal('bom') }).strict(),
    ]),
    aceptoHistorica: z.boolean(), secciones: seccionesSchema, destinatario: destinatarioSchema.nullable(),
    plantilla: z.object({ id: uuid, version: z.number().int().nonnegative(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().nullable(),
    incluidas: z.array(texto(200).min(1)).max(2000).refine(a => new Set(a).size === a.length).nullable(),
    conceptos: z.array(z.object({ id: uuid, descripcion: texto(500).min(1), cantidad: z.string().regex(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/).max(32).nullable(), unidad: texto(30).nullable() }).strict()).max(100),
    valoracion: z.array(lineaValoracionSchema).max(2000).refine(a => new Set(a.map(l => l.clave)).size === a.length).nullable(),
}).strict();
export const baseSchema = z.object({ version: z.number().int().nonnegative(), revisionId: uuid.nullable(), hash: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict();
export const previaSchema = z.object({ id: uuid, creadaEn: z.iso.datetime(), hash: z.string().regex(/^[a-f0-9]{64}$/), fuenteHash: z.string().regex(/^[a-f0-9]{64}$/), permisosHash: z.string().regex(/^[a-f0-9]{64}$/), fuenteRevisada: z.string().regex(/^[a-f0-9]{64}$/).optional(), firma: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type Ambito = z.infer<typeof ambitoSchema>;
export type EntradaPropuesta = z.infer<typeof entradaSchema>;
export type BasePropuesta = z.infer<typeof baseSchema>;
export type Previa = z.infer<typeof previaSchema>;
export type LineaValoracion = z.infer<typeof lineaValoracionSchema>;
export interface LineaFuente {
    clave: string;
    articuloId: string | null;
    descripcion: string;
    cantidad: string | null;
    unidad: string | null;
    detalles: string[];
    origen: string;
    enlace: string;
}
export interface SalaFuente {
    id: string;
    nombre: string;
    codigo: string | null;
    disenoVersion: number;
    revisionId: string | null;
    revisionHash: string | null;
    revisionNumero: number | null;
}
export interface FuentePropuesta {
    tipo: 'diseno' | 'bom';
    leidaEn: string;
    etiqueta: string;
    ambito: Ambito;
    nombre: string;
    codigo: string | null;
    salas: SalaFuente[];
    lineas: LineaFuente[];
    avisos: string[];
    comprobacion: string;
}
export interface DocumentoTecnico {
    titulo: string;
    secciones: Array<{
        id: string;
        titulo: string;
        tituloResuelto?: string;
        texto: string;
        resuelto: string;
        ausencias: string[];
    }>;
    destinatario: (NonNullable<EntradaPropuesta['destinatario']> & {
        autorId: string;
        fecha: string;
        procedencia: 'manual';
    }) | null;
    plantilla: EntradaPropuesta['plantilla'];
    plantillaSnapshot: {
        nombre: string;
        secciones: EntradaPropuesta['secciones'];
    } | null;
    lineas: LineaFuente[];
    excluidas: number;
    variables: Record<string, string | null>;
}
export interface Medida {
    estado: 'sin_datos' | 'parcial' | 'completo';
    subtotal: string | null;
    ausentes: number;
    orientativas: number;
}
export interface LineaCalculada extends LineaValoracion {
    cantidad: string | null;
    descripcion: string;
    fuenteCongelada: unknown;
    precioUnitario: string | null;
    base: string | null;
    impuestoMinor: string | null;
    total: string | null;
    costePrevisto: string | null;
    orientativa: boolean;
}
export interface ValoracionCalculada {
    lineas: LineaCalculada[];
    totales: Record<string, Record<'base' | 'impuesto' | 'total' | 'costePrevisto', Medida>>;
    estado: Medida['estado'];
    redondeo: 'mitad_fuera_cero_v1';
}
export interface ModeloPropuesta {
    id: string;
    numero: number;
    creadoEn: string;
    autorId: string;
    autor: string;
    tecnico: DocumentoTecnico;
    fuente: FuentePropuesta;
    valoracion: ValoracionCalculada | null;
    fuenteHash: string;
    tecnicoHash: string;
    sha256: string;
}
export function canonico(valor: unknown): string {
    if (valor === null || typeof valor !== 'object')
        return JSON.stringify(valor);
    if (Array.isArray(valor))
        return `[${valor.map(canonico).join(',')}]`;
    return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(',')}}`;
}
export const hash = (valor: unknown): string => createHash('sha256').update(canonico(valor)).digest('hex');
export const hashBytes = (valor: Uint8Array): string => createHash('sha256').update(valor).digest('hex');
export function entrada<T>(esquema: z.ZodType<T>, valor: unknown): T {
    const r = esquema.safeParse(valor);
    if (!r.success)
        throw new ErrorPropuesta('Comprueba los campos de la propuesta.', 400);
    return r.data;
}
export function identificador(id: string): string { return entrada(uuid, id); }
export function fechaMadrid(fecha: string): string { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(fecha)); }
