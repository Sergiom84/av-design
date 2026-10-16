import { z } from 'zod';
import { IDS_SECCION, type Seccion } from '../usuarios';
export const MOTOR_CONSULTA = 'local-1' as const;
export const LIMITES_CONSULTA = { cuerpo: 16384, salas: 20, conversaciones: 20, turnos: 100, pregunta: 2000, hechos: 1000, bytesTurno: 262144, bytesPersona: 10485760, pagina: 20 } as const;
export const uuidConsulta = z.uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ids = z.array(uuidConsulta).min(1).max(20).refine(a => new Set(a).size === a.length);
export const ambitoConsultaSchema = z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('sala'), id: uuidConsulta }).strict(),
    z.object({ tipo: z.literal('obra'), id: uuidConsulta, salaIds: ids }).strict(),
    z.object({ tipo: z.literal('catalogo') }).strict(),
]);
export const retencionConsultaSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export const versionSchema = z.number().int().min(0).max(2147483646);
export const crearConsultaSchema = z.object({ ambito: ambitoConsultaSchema, retencionDias: retencionConsultaSchema.default(30) }).strict();
export const seleccionRequisitoConsultaSchema = z.object({ tipo: z.literal('documento_requisitos'), id: uuidConsulta, extraccionId: uuidConsulta, candidatoIds: ids }).strict();
export const fuenteElegidaSchema = z.union([z.object({ tipo: z.enum(['documento_e1', 'informe_03', 'propuesta_06', 'catalogo']), id: uuidConsulta }).strict(), seleccionRequisitoConsultaSchema]);
export const preguntarConsultaSchema = z.object({ pregunta: z.string().trim().min(1).max(2000), version: versionSchema, clavePeticion: uuidConsulta, fuente: fuenteElegidaSchema.optional() }).strict();
export const retenerConsultaSchema = z.object({ version: versionSchema, retencionDias: retencionConsultaSchema }).strict();
export const borrarConsultaSchema = z.object({ version: versionSchema }).strict();
export const intentSchema = z.enum(['medidas', 'equipos', 'conexiones', 'cables', 'necesidad', 'catalogo', 'documentos', 'informe', 'no_disponible']);
export type AmbitoConsulta = z.infer<typeof ambitoConsultaSchema>;
export type EntradaPregunta = z.infer<typeof preguntarConsultaSchema>;
export type IntentConsulta = z.infer<typeof intentSchema>;
export interface ClasificacionConsulta {
    motor: typeof MOTOR_CONSULTA;
    intent: IntentConsulta;
    cableId?: string;
    motivo?: string;
}
const seccion = z.enum(IDS_SECCION as [
    Seccion,
    ...Seccion[]
]);
export const CLAVES_PARAMETROS_CONSULTA = ['holgura_pantalla', 'holgura_proyector', 'holgura_rack', 'holgura_caja_conexiones', 'holgura_mesa', 'holgura_techo', 'holgura_pared', 'margen', 'cables_por_canalizacion', 'ocupacion_maxima_canaleta'] as const;
const filaConsultaSchema = z.union([
    z.object({ tabla: z.enum(['sala_equipos', 'conexiones', 'puertos', 'sala_material_bom', 'articulos', 'tomas_red', 'conexion_puntos_paso', 'articulos_tecnicos', 'preferencias_usuario']), id: uuidConsulta }).strict(),
    z.object({ tabla: z.literal('conexion_bocas'), id: uuidConsulta, lado: z.enum(['origen', 'destino']) }).strict(),
    z.object({ tabla: z.literal('parametros'), clave: z.enum(CLAVES_PARAMETROS_CONSULTA) }).strict(),
]);
export const anclaRequisitoConsultaSchema = z.object({ documentoId: uuidConsulta, extraccionId: uuidConsulta,
    pagina: z.number().int().min(1).max(100).nullable(), linea: z.number().int().positive().nullable(),
    inicio: z.number().int().nonnegative(), fin: z.number().int().nonnegative(), sha256: hash,
    metodo: z.enum(['literal_estructurado', 'hipotesis', 'transcripcion_manual']) }).strict();
/** Sólo identificadores, versiones y requisitos. Nunca pregunta/nombre/texto en ACL. */
export const fuenteConsultaSchema = z.object({
    tipo: z.enum(['sala', 'equipos', 'conexiones', 'cables', 'necesidad', 'catalogo', 'preferencias', 'documento_e1', 'informe_03', 'propuesta_06', 'documento_requisitos']),
    id: uuidConsulta, hash, secciones: z.array(seccion).max(11), ambito: ambitoConsultaSchema,
    revisionId: uuidConsulta.nullable().optional(), revisionNumero: z.number().int().positive().nullable().optional(), revisionHash: hash.nullable().optional(),
    disenoVersion: z.number().int().nonnegative().optional(), version: z.number().int().nonnegative().optional(),
    cableId: z.string().max(40).optional(), seleccionId: uuidConsulta.optional(),
    versionAnclas: z.literal(1).optional(),
    filas: z.array(filaConsultaSchema).max(4000).optional(),
    extraccionId: uuidConsulta.optional(), candidatoIds: ids.optional(), anclasDocumento: z.array(anclaRequisitoConsultaSchema).max(20).optional(),
}).strict();
export type FuenteConsulta = z.infer<typeof fuenteConsultaSchema>;
export const aclConsultaSchema = z.object({ versionModelo: z.literal(1), intent: intentSchema, ambito: ambitoConsultaSchema, secciones: z.array(seccion).max(11), fuentes: z.array(fuenteConsultaSchema).max(200) }).strict();
export type AclConsulta = z.infer<typeof aclConsultaSchema>;
const enlace = z.string().max(3000).refine(v => v.startsWith('/') && !v.startsWith('//') && !/[\r\n\\]/.test(v));
export const respuestaConsultaSchema = z.object({
    versionModelo: z.literal(1), motor: z.literal(MOTOR_CONSULTA), intent: intentSchema, ambito: ambitoConsultaSchema,
    observadoEn: z.iso.datetime(), texto: z.string().max(4000),
    hechos: z.array(z.object({ etiqueta: z.string().max(1500), valor: z.union([z.string().max(262144), z.number().finite(), z.null()]), unidad: z.string().max(40).optional(), fuenteId: uuidConsulta, campo: z.string().max(300), ausencia: z.enum(['sin_dato', 'sin_filas', 'no_calculable']).optional(), advertencia: z.string().max(2000).optional(), anclaDocumento: anclaRequisitoConsultaSchema.optional() }).strict()).max(1000),
    avisos: z.array(z.string().max(3000)).max(1000),
    citas: z.array(z.object({ fuente: fuenteConsultaSchema, href: enlace, observadoEn: z.iso.datetime(), borrador: z.boolean().optional() }).strict()).max(200),
    enlaces: z.array(z.object({ etiqueta: z.string().max(1000), href: enlace }).strict()).max(200),
}).strict();
export type RespuestaConsulta = z.infer<typeof respuestaConsultaSchema>;
export type HechoConsulta = RespuestaConsulta['hechos'][number];
export interface CapturaConsulta {
    respuesta: RespuestaConsulta;
    acl: AclConsulta;
    hash: string;
}
export class ErrorConsulta extends Error {
    constructor(public codigo: string, mensaje: string, public status = 400) { super(mensaje); this.name = 'ErrorConsulta'; }
}
export function validar<T>(schema: z.ZodType<T>, valor: unknown): T { const p = schema.safeParse(valor); if (!p.success)
    throw new ErrorConsulta('ENTRADA_INVALIDA', 'Revisa los campos de la consulta.', 400); return p.data; }
export function integridad<T>(schema: z.ZodType<T>, valor: unknown): T { const p = schema.safeParse(valor); if (!p.success)
    throw new ErrorConsulta('INTEGRIDAD', 'La consulta conservada no está disponible.', 503); return p.data; }
export function canonico(valor: unknown): string {
    function orden(v: unknown): unknown { if (v instanceof Date)
        return v.toISOString(); if (Array.isArray(v))
        return v.map(orden); if (v && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, orden(x)])); if (typeof v === 'number' && !Number.isFinite(v))
        throw new ErrorConsulta('INTEGRIDAD', 'Número inválido.', 503); return v; }
    return JSON.stringify(orden(valor));
}
export function normalizarAmbito(a: AmbitoConsulta): AmbitoConsulta { return a.tipo === 'obra' ? { ...a, salaIds: [...a.salaIds].sort() } : a; }
/** Interfaz declarativa: ningún proveedor externo está conectado ni puede invocarse. */
export interface AdaptadorGenerativo {
    estado: 'no_configurado';
}
export const adaptadorExterno: AdaptadorGenerativo = Object.freeze({ estado: 'no_configurado' });
