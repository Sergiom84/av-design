import { z } from 'zod';
import { CLAVES, uuid, type ClaveInforme, type ConfiguracionInforme } from './modelo';
export interface InicioInforme {
  configuracion?: ConfiguracionInforme;
  ejecucionId?: string;
  aviso?: string;
}
const seleccionSchema = z.object({
  clave: z.enum(CLAVES), tipo: z.enum(['sala', 'obra']), id: uuid,
  salaIds: z.array(uuid).min(1).max(20).refine(a => new Set(a).size === a.length).optional(),
}).strict().refine(s => s.tipo === 'sala' ? s.salaIds === undefined : !!s.salaIds);

/** Precarga sólo un borrador visible; jamás genera preview, definición o ejecución. */
export function inicioInformeDesdeEnlace(params: Record<string, string | string[] | undefined>,
  claves: ClaveInforme[], opciones: Array<{ id: string; tipo: string }>): InicioInforme {
  if (params.ejecucion !== undefined) {
    const id = uuid.safeParse(params.ejecucion);
    return id.success ? { ejecucionId: id.data } : { aviso: 'La referencia del informe no es válida.' };
  }
  if (!['clave', 'tipo', 'id', 'salaIds'].some(k => params[k] !== undefined)) return {};
  const salas = typeof params.salaIds === 'string' && params.salaIds.length <= 1000
    ? params.salaIds.split(',') : params.salaIds;
  const s = seleccionSchema.safeParse({ clave: params.clave, tipo: params.tipo, id: params.id,
    ...(salas !== undefined ? { salaIds: salas } : {}) });
  if (!s.success || !claves.includes(s.data.clave) ||
    !opciones.some(o => o.tipo === s.data.tipo && o.id === s.data.id) ||
    s.data.salaIds?.some(id => !opciones.some(o => o.tipo === 'sala' && o.id === id)))
    return { aviso: 'La selección solicitada no está disponible. Elige el contenido y el ámbito antes de revisar.' };
  const { clave, tipo, id, salaIds } = s.data;
  return { configuracion: { versionModelo: 1, versionRegistro: 1, clave,
    ambito: tipo === 'sala' ? { tipo, id } : { tipo, id, salaIds },
    periodo: clave.endsWith('_actual') ? { modo: 'actual' } : { modo: 'rango', desde: '', hasta: '' },
    formatos: ['pdf', 'xlsx', 'csv'], audiencia: { usuarios: [], grupos: [] } } };
}
