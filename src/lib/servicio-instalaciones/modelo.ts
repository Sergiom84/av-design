import { z } from 'zod';
export class ErrorServicio extends Error {
  constructor(message: string, public status = 400, public detalle?: unknown) { super(message); }
}
export const id = z.uuid();
export const texto = z.string().trim().min(1).max(2000);
export const etiqueta = z.string().trim().min(1).max(160);
export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const hora = z.object({ fecha, hora: z.string().regex(/^\d{2}:\d{2}$/), offset: z.enum(['+01:00','+02:00']).optional() }).strict();
export const base = z.object({ id, actualId: id, numero: z.number().int().positive().max(1000) }).strict();
export const contexto = { salaId: id, proyectoId: id.optional() };
export const unidad = z.object({ equipoId: id, ordinal: z.number().int().min(1).max(10000) }).strict();
export const seleccion = z.object({ ...contexto, revisionId: id.nullable(), unidades: z.array(unidad).min(1).max(50) }).strict().refine(v=>new Set(v.unidades.map(u=>`${u.equipoId}/${u.ordinal}`)).size===v.unidades.length,'No repitas unidades.');
export const tipoAtencion = z.enum(['diagnostico','reparacion','sustitucion','preventivo']);
export const reglaSla = z.discriminatedUnion('regla', [
  z.object({ regla:z.literal('minutos_reales'), cantidad:z.number().int().min(1).max(525600), fuente:texto, origen:z.enum(['apertura_registrada','deteccion_confirmada']) }).strict(),
  z.object({ regla:z.literal('dias_civiles'), cantidad:z.number().int().min(1).max(366), fuente:texto, origen:z.enum(['apertura_registrada','deteccion_confirmada']) }).strict(),
  z.object({ regla:z.literal('fecha_limite'), fuente:texto, origen:z.enum(['apertura_registrada','deteccion_confirmada']) }).strict()
]).nullable();
export const condiciones = z.object({ titulo:etiqueta, activos:z.array(id).max(30), ambito:z.enum(['sala','activos']), desde:fecha.nullable(), final:z.discriminatedUnion('tipo',[
  z.object({ tipo:z.literal('fecha'), fecha }).strict(), z.object({ tipo:z.literal('sin_fin_explicito') }).strict(), z.object({ tipo:z.literal('desconocido') }).strict()
]), incluidos:z.array(tipoAtencion).max(4), excluidos:z.array(tipoAtencion).max(4), condiciones:texto, fuente:texto, referenciaTemporal:z.enum(['apertura_registrada','deteccion_confirmada']), primeraAtencion:reglaSla, resolucion:reglaSla, archivado:z.boolean() }).strict();
export const datosVisita = z.object({ fecha, tecnicos:z.array(id).min(1).max(10), motivoInactivo:texto.nullable(), inicio:hora.nullable(), fin:hora.nullable(), pruebas:texto, resultado:texto, evidencia:texto, seguimiento:texto.nullable(), tareaId:id.nullable(), anulada:z.boolean() }).strict();
export const identificacion = z.object({ etiqueta, serial:z.string().max(200).nullable(), articuloId:id.nullable().optional(), referencia:texto, evidencia:texto }).strict();
const entregaEntrada = z.object({ revisionId:id, hitoId:id, fecha, evidencia:texto, noRepresentado:z.boolean(), motivoNoRepresentado:texto.nullable(), revisionPosteriorAceptada:z.boolean() }).strict();
const comunes = { clavePeticion:id, motivo:texto, proyectoId:id.optional() };
const duplicado = { duplicadosHash:z.string().regex(/^[a-f0-9]{64}$/).optional(), motivoDuplicado:texto.optional() };
export const comando = z.discriminatedUnion('accion',[
  z.object({ accion:z.literal('preparar_materializacion'), ...comunes, seleccion }).strict(),
  z.object({ accion:z.literal('materializar'), ...comunes, token:z.string().max(64000) }).strict(),
  z.object({ accion:z.literal('manual'), ...comunes, salaId:id, datos:identificacion, ...duplicado }).strict(),
  z.object({ accion:z.literal('identificar'), ...comunes, base, datos:identificacion, ...duplicado }).strict(),
  z.object({ accion:z.literal('preparar_confirmacion'), ...comunes, base, salaId:id, entrega:entregaEntrada, trasladar:z.boolean(), ...duplicado }).strict(),
  z.object({ accion:z.literal('confirmar'), ...comunes, token:z.string().max(64000) }).strict(),
  z.object({ accion:z.literal('retirar'), ...comunes, base, evidencia:texto, fecha }).strict(),
  z.object({ accion:z.literal('preparar_sustitucion'), ...comunes, antiguo:base, nuevo:base, salaId:id, entrega:entregaEntrada, ...duplicado }).strict(),
  z.object({ accion:z.literal('sustituir'), ...comunes, token:z.string().max(64000) }).strict(),
  z.object({ accion:z.literal('abrir_incidencia'), ...comunes, activo:base, sintoma:texto, tipo:tipoAtencion.nullable(), prioridad:z.enum(['baja','normal','alta','critica']).nullable(), tecnicoId:id.nullable(), deteccion:hora.nullable(), aceptarFuenteCambiada:z.boolean() }).strict(),
  z.object({ accion:z.literal('incidencia'), ...comunes, base, transicion:z.enum(['editar','atender','resolver','cerrar','reabrir','anular','corregir_atencion','corregir_resolucion']), sintoma:texto, tipo:tipoAtencion.nullable(), prioridad:z.enum(['baja','normal','alta','critica']).nullable(), tecnicoId:id.nullable(), instante:hora.nullable(), evidencia:texto }).strict(),
  z.object({ accion:z.literal('visita'), ...comunes, incidencia:base, datos:datosVisita }).strict(),
  z.object({ accion:z.literal('corregir_visita'), ...comunes, base, datos:datosVisita }).strict(),
  z.object({ accion:z.literal('acuerdo'), ...comunes, salaId:id, entrega:entregaEntrada, datos:condiciones }).strict(),
  z.object({ accion:z.literal('editar_acuerdo'), ...comunes, base, datos:condiciones }).strict(),
  z.object({ accion:z.literal('preparar_acuerdo'), ...comunes, incidencia:base, acuerdo:base, atenderFuera:z.boolean(), notaFuera:texto.nullable(), limiteAtencion:hora.nullable(), limiteResolucion:hora.nullable() }).strict(),
  z.object({ accion:z.literal('aplicar_acuerdo'), ...comunes, token:z.string().max(64000) }).strict()
]);
export type Comando = z.infer<typeof comando>;
export type Identificacion = z.infer<typeof identificacion>;
export type Condiciones = z.infer<typeof condiciones>;
export type DatosVisita = z.infer<typeof datosVisita>;
export type EntradaEntrega = z.infer<typeof entregaEntrada>;
export type Base = z.infer<typeof base>;
export function validar<T>(schema:z.ZodType<T>, v:unknown):T { const r=schema.safeParse(v); if(!r.success) throw new ErrorServicio('Comprueba los campos de servicio.',400,r.error.issues.map(i=>({ruta:i.path.join('.'),mensaje:i.message}))); return r.data; }
export type Objeto = Record<string, unknown>;
export interface Registro { id:string; tipo:'activo'|'acuerdo'|'incidencia'|'visita'; sala_id:string; proyecto_id:string|null; numero_actual:number; actual_id:string; }
export interface Version extends Registro { snapshot:Objeto; sha256:string; revision_diseno_id:string|null; hito_entrega_id:string|null; entrega_snapshot:Objeto|null; creado_en:string; }
