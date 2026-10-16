import { z } from 'zod';
import type { leerCorteParaPropuesta } from '../costes/adaptador-propuestas';
import { hash, canonico } from '../seguimiento-propuestas/modelo';
export { hash, canonico };
export class ErrorResultado extends Error { constructor(message:string,public status=400){super(message);} }
export const LIMITES_RESULTADOS={cuerpo:65536,snapshot:4*1024*1024,tokenMs:600000,pagina:50} as const;
export const uuid=z.uuid(),sha=z.string().regex(/^[a-f0-9]{64}$/);
const texto=(max:number)=>z.string().trim().min(1).max(max).refine(s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s));
export const seleccionSchema=z.object({
 propuestaId:uuid,revisionId:uuid,revisionHash:sha,versionPropuesta:z.number().int().nonnegative(),versionSeguimiento:z.number().int().positive(),aceptacionId:uuid,costeCorteId:uuid,costeHash:sha,
 cobertura:z.object({proyectoId:uuid,salaIds:z.array(uuid).min(1).max(20).refine(a=>new Set(a).size===a.length),desde:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),hasta:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),periodoCompleto:z.boolean(),declaracion:texto(2000)}).strict(),
 serieId:uuid.optional(),actualId:uuid.optional(),numeroActual:z.number().int().positive().optional(),motivo:texto(2000),
}).strict().transform(s=>({...s,cobertura:{...s.cobertura,salaIds:[...s.cobertura.salaIds].sort()}}));
export const confirmarSchema=z.object({seleccion:seleccionSchema,token:z.string().min(1).max(4096),clavePeticion:uuid}).strict();
export type SeleccionResultado=z.infer<typeof seleccionSchema>;
export type CorteParaPropuesta=Awaited<ReturnType<typeof leerCorteParaPropuesta>>;
export type EstadoResultado='sin_datos'|'parcial'|'comparable_registrado';
export interface MedidaAprobada {estado:'sin_datos'|'parcial'|'completo';subtotal:string|null;ausentes:number;orientativas:number}
export interface Aprobacion {propuestaId:string;revisionId:string;revisionHash:string;numeroRevision:number;aceptacionId:string;fechaAceptacion:string;valoracionHash:string|null;proyectoId:string|null;salaIds:string[];base:Record<string,MedidaAprobada>;impuesto:Record<string,MedidaAprobada>;bruto:Record<string,MedidaAprobada>}
export interface ComparacionResultado {estado:EstadoResultado;causas:string[];monedas:Record<string,{baseAprobadaMinor:string|null;laboralMinor:string|null;materialMinor:string|null;costeRegistradoMinor:string|null;diferenciaMinor:string|null}>;etiqueta:string;nota:string}
export interface SnapshotResultado {versionModelo:1;seleccion:SeleccionResultado;aprobacion:Aprobacion;coste:CorteParaPropuesta;comparacion:ComparacionResultado;observadoEn:string;autor:{id:string;nombre:string};permisosHash:string}
export function validar<T>(schema:z.ZodType<T>,v:unknown):T{const r=schema.safeParse(v);if(!r.success)throw new ErrorResultado('Comprueba los campos del resultado.');return r.data;}
export function comprobarTamano(v:unknown){if(Buffer.byteLength(canonico(v))>LIMITES_RESULTADOS.snapshot)throw new ErrorResultado('El resultado supera 4 MiB. Reduce el alcance.',413);}
