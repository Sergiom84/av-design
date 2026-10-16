import { z } from 'zod';
import type postgres from 'postgres';
import type { Moneda } from '../importes';
import { parsearDecimal } from '../importes';
export type ConexionCostes = postgres.Sql | postgres.TransactionSql;
export const LIMITES_COSTES = { cuerpo: 65536, partes: 200, apuntes: 100, pagina: 50, busqueda: 20, dias: 366, filasCorte: 10000, bytesCorte: 10 * 1024 * 1024 } as const;
export class ErrorCoste extends Error {
  constructor(public codigo: string, mensaje: string, public status = 400) { super(mensaje); }
}
export const uuid = z.uuid();
export const hash = z.string().regex(/^[0-9a-f]{64}$/);
const texto = (max: number) => z.string().trim().max(max).refine(t => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t), 'Texto inválido.');
export const motivo = texto(2000).min(1);
export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const version = z.number().int().min(1).max(2147483646);
export const ids = (max: number) => z.array(uuid).max(max).refine(v => new Set(v).size === v.length, 'Identificadores repetidos.');
export function decimal(escala: number, enteros: number, positivo = false) {
  return z.string().max(32).refine(t => {
    try { const n = parsearDecimal(t, escala); return n >= BigInt(positivo ? '1' : '0') && n < BigInt('10') ** BigInt(enteros + escala); } catch { return false; }
  }, 'Decimal inválido o fuera de precisión.');
}
export const precio = decimal(4, 8), cantidad = decimal(2, 10, true);
export const tarifaSchema = z.object({ tecnicoId: uuid, desde: fecha, hastaExclusivo: fecha.nullable(), precioHora: precio, moneda: z.enum(['EUR','USD']), calidad: z.enum(['estimada','validada']), fuente: texto(1000).min(1), motivo, accion: z.enum(['definir','corregir','anular']).default('definir'), serieId: uuid.optional(), numeroActual: version.optional(), actualId: uuid.optional() }).strict();
export type EntradaTarifa = z.infer<typeof tarifaSchema>;
export const guardarTarifaSchema = tarifaSchema.extend({ clavePeticion: uuid }).strict();
export const laboralSchema = z.object({ partes: z.array(z.object({ registroId: uuid, versionId: uuid }).strict()).min(1).max(LIMITES_COSTES.partes).refine(a => new Set(a.map(p => p.registroId)).size === a.length), motivo }).strict();
export type SeleccionLaboral = z.infer<typeof laboralSchema>;
export const evidenciaSchema = z.object({ referencia: texto(1000).default(''), fechaAdquisicion: fecha.nullable().default(null), atribucion: texto(2000).default(''), procedenciaDirecta: texto(2000).default(''), pedidoLineaId: uuid.nullable().default(null), cargaLineaId: uuid.nullable().default(null), observaciones: texto(2000).default('') }).strict();
export const materialSchema = z.object({ movimientoId: uuid, proyectoId: uuid, salaId: uuid.nullable(), tareaId: uuid.nullable().default(null), cantidad, unidad: z.enum(['ud','m']), calidad: z.enum(['sin_valorar','estimado','documentado']), precioUnitario: precio.nullable().default(null), moneda: z.enum(['EUR','USD']).nullable().default(null), linaje: z.enum(['salida','devolucion','reingreso_baja','baja_directa','pendiente']), origenSalidaVersionId: uuid.nullable().default(null), origenDevolucionVersionId: uuid.nullable().default(null), evidencia: evidenciaSchema, motivo, apunteId: uuid.optional(), numeroActual: version.optional(), actualId: uuid.optional(), accion: z.enum(['imputar','corregir','anular']).default('imputar') }).strict();
export type EntradaMaterial = z.infer<typeof materialSchema>;
export const seleccionMaterialSchema = z.object({ apuntes: z.array(materialSchema).min(1).max(LIMITES_COSTES.apuntes).refine(a => new Set(a.filter(p => p.apunteId).map(p => p.apunteId)).size === a.filter(p => p.apunteId).length) }).strict();
export type SeleccionMaterial = z.infer<typeof seleccionMaterialSchema>;
export const alcanceSchema = z.object({ proyectoId: uuid, salas: z.discriminatedUnion('modo',[z.object({ modo: z.literal('todas') }).strict(),z.object({ modo: z.literal('seleccion'), ids: ids(500).min(1) }).strict()]), tareas: ids(10000).nullable().default(null), desde: fecha, hasta: fecha, componentes: z.array(z.enum(['laboral','material'])).min(1).max(2).refine(a => new Set(a).size === a.length) }).strict().transform(a=>{if(a.salas.modo==='seleccion')a.salas.ids.sort();a.tareas?.sort();a.componentes.sort();return a;});
export type AlcanceCoste = z.infer<typeof alcanceSchema>;
export const fiscalSchema = z.object({ versionId: uuid, base: z.enum(['sin_impuestos','con_impuestos','no_resuelto']), referencia: texto(1000), motivo }).strict().refine(f => f.base === 'no_resuelto' || f.referencia.length > 0, 'Referencia fiscal obligatoria.');
export const corteSchema = z.object({ tipo: z.enum(['previsto','real','comparacion']), alcance: alcanceSchema, cortePrevistoId: uuid.optional(), corteRealId: uuid.optional(), tratamientoFiscal: z.array(fiscalSchema).max(10000).refine(a => new Set(a.map(f => f.versionId)).size === a.length).default([]), exclusionesMaterial: z.array(z.object({ movimientoId: uuid, motivo }).strict()).max(10000).refine(a => new Set(a.map(f => f.movimientoId)).size === a.length).default([]), serieId: uuid.optional(), numeroActual: version.optional(), actualId: uuid.optional(), motivo }).strict();
export type EntradaCorte = z.infer<typeof corteSchema>;
export const confirmarLaboralSchema = z.object({ seleccion: laboralSchema, token: z.string().max(2048), clavePeticion: uuid }).strict();
export const confirmarMaterialSchema = z.object({ seleccion: seleccionMaterialSchema, token: z.string().max(2048), clavePeticion: uuid }).strict();
export const confirmarCorteSchema = z.object({ seleccion: corteSchema, token: z.string().max(2048), clavePeticion: uuid }).strict();
export function entrada<T>(schema: z.ZodType<T>, valor: unknown): T {
  const r = schema.safeParse(valor); if (!r.success) { if(r.error.issues.some(i=>i.code==='invalid_value'&&i.path.at(-1)==='moneda'))throw new ErrorCoste('MONEDA_NO_SOPORTADA','Esta versión admite EUR y USD.',422); if(r.error.issues.some(i=>i.code==='too_big'&&i.origin==='array'))throw new ErrorCoste('LIMITE_EXCEDIDO','La selección supera el límite. Reduce el alcance.',413); throw new ErrorCoste('ENTRADA_INVALIDA','Comprueba los campos de costes.'); } return r.data;
}
export type EstadoCoste = 'sin_datos'|'parcial'|'completo';
export type TotalesCoste = Record<Moneda,string|null>;
export interface TarifaCoste { id:string; serieId:string; numero:number; tecnicoId:string; accion:'definir'|'corregir'|'anular'; desde:string; hastaExclusivo:string|null; precioHora:string; moneda:Moneda; calidad:'estimada'|'validada'; fuente:string; motivo:string; autorId:string; creadoEn:string }
export interface ParteCoste { registroId:string; versionId:string; numero:number; tecnicoId:string; proyectoId:string; salaId:string|null; tareaId:string; inicioUtc:string; finUtc:string; minutos:number; accion:string; titulo:string; tecnicoNombre:string; valoracionActualId:string|null }
export interface TramoCoste { fecha:string; inicioUtc:string; finUtc:string; minutos:number; tarifa:TarifaCoste|null; importeMinor:string|null; divisor:'6000'; redondeo:'mitad_fuera_cero_v1' }
export interface ValoracionLaboral { parte:ParteCoste; tramos:TramoCoste[]; totales:TotalesCoste; estimados:TotalesCoste; estado:EstadoCoste; minutosPendientes:number; fuenteSha256:string; valoracionActualId:string|null }
export interface MovimientoCoste { id:string; articuloId:string; descripcion:string; unidad:'ud'|'m'; tipo:string; cantidad:string; fecha:string; salaId:string|null; proyectoActualId:string|null; ubicacionId:string|null; motivo:string|null; quien:string|null }
export interface VersionMaterial { id:string; apunteId:string; numero:number; antecedenteId:string|null; movimientoId:string; proyectoId:string; salaId:string|null; tareaId:string|null; accion:string; cantidad:string; unidad:'ud'|'m'; tipoHecho:'salida'|'devolucion'|'baja'; signo:1|-1; movimientoSnapshot:MovimientoCoste; movimientoSha256:string; precioUnitario:string|null; moneda:Moneda|null; calidad:'sin_valorar'|'estimado'|'documentado'; importeMinor:string|null; origenSalidaVersionId:string|null; origenDevolucionVersionId:string|null; linaje:EntradaMaterial['linaje']; evidencia:z.infer<typeof evidenciaSchema> & { pedido?:unknown; carga?:unknown }; motivo:string; autorId:string; creadoEn:string }
export interface ComponenteCoste { estado:EstadoCoste; totales:TotalesCoste; estimados:TotalesCoste; incluidos:number; pendientes:number; desactualizados:number; huecos:string[]; minutos:number|null; minutosPendientes:number|null }
export interface CandidatoConciliacion { id:string; tipo:string; cantidad:string|null; repartido:string|null; pendiente:string|null; unidad:'ud'|'m'|null }
export interface ExclusionMaterial extends CandidatoConciliacion { movimientoId:string; motivo:string; detalleCongelado:boolean }
export interface SnapshotCorte { versionModelo:1; tipo:EntradaCorte['tipo']; alcance:AlcanceCoste; salas:string[]; fechaFuentes:string; componentes:Partial<Record<'laboral'|'material',ComponenteCoste>>; seleccion:{ partes:unknown[]; apuntes:unknown[]; plan:unknown[]; bom:unknown[]; pendientes:unknown[]; exclusiones?:ExclusionMaterial[] }; totales:TotalesCoste; estado:EstadoCoste; cobertura:{ registrados:number; pendientes:number; revisadoComo:'registros_del_alcance'; obraEntera:false; conciliacionMaterial?:{ candidatos:number; pendientes:number; excluidos:number } }; huecos:string[]; fuentesSha256:string; permisosFuente:{pedido:boolean;carga:boolean;bom:boolean}; tratamientoFiscal:z.infer<typeof fiscalSchema>[]; comparacion?:unknown }
