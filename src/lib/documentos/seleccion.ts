import { z } from 'zod';
import { DOCUMENTOS, type TipoDocumento } from './modelo';
import { puede, type Permisos } from '../usuarios';

export const seleccionDocumentos = z.object({
  salaIds: z.array(z.uuid()).min(1).max(20),
  proyectoId: z.uuid().optional(),
  documentos: z.array(z.enum(DOCUMENTOS.map(d => d.id) as [TipoDocumento, ...TipoDocumento[]])).min(1).max(7),
  opciones: z.object({
    papel: z.enum(['A4', 'A3']), orientacion: z.enum(['horizontal', 'vertical']),
    escala: z.union([z.literal(20), z.literal(25), z.literal(50), z.literal(100)]),
  }),
}).strict().refine(s => new Set(s.salaIds).size === s.salaIds.length &&
  new Set(s.documentos).size === s.documentos.length, 'La selección contiene duplicados.')
  .refine(s => s.salaIds.length === 1 || Boolean(s.proyectoId), 'Selecciona una obra para exportar varias salas.');

export function puedeExportarBom(permisos: Permisos): boolean {
  return ['catalogo', 'almacen', 'compras'].every(s => puede(permisos, s as 'catalogo'|'almacen'|'compras', 'ver'));
}
export function permisoExportacion(permisos: Permisos, documentos: readonly TipoDocumento[], esObra: boolean): boolean {
  return puede(permisos, 'salas', 'ver') && (!esObra || puede(permisos, 'proyectos', 'ver')) &&
    (!documentos.some(d => d.startsWith('bom-')) || puedeExportarBom(permisos));
}
