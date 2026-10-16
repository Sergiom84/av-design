import { z } from 'zod';
import { ErrorImportacion, type DestinoImportacion, type PreviewImportacion, type SeleccionFila } from './modelo';

const tipo = z.enum(['equipo', 'cable', 'consumible']);
const esquema = z.array(z.object({ fila: z.number().int().positive(), articuloId: z.uuid().optional(), crear: z.boolean().optional(),
  revisionArticulo: z.number().int().nonnegative().optional(), alternativa: z.object({ motivo: z.string().trim().min(1).max(500),
    articuloOriginalId: z.uuid().nullable(), tipoOrigen: tipo, fuenteTipo: z.enum(['catalogo', 'archivo', 'confirmado_por_usuario']) }).strict().optional(),
}).strict()).min(1).max(500);

export function validarSeleccion(entrada: unknown, destino: DestinoImportacion): SeleccionFila[] {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorImportacion('Selección inválida: revisa filas, identificadores, revisión y motivo (1–500 caracteres).');
  if (new Set(r.data.map(f => f.fila)).size !== r.data.length) throw new ErrorImportacion('La selección contiene filas repetidas.');
  if (destino !== 'bom' && r.data.some(f => f.alternativa)) throw new ErrorImportacion('Las alternativas sólo se admiten en la BOM.');
  return r.data.sort((a, b) => a.fila - b.fila);
}

export function serializarCanonico(valor: unknown): string {
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, ordenar(x)])) : v;
  return JSON.stringify(ordenar(valor));
}

export function seleccionarCoincidenciasValidas(preview: PreviewImportacion, actual: Record<number, SeleccionFila>) {
  const seleccion = { ...actual }; const omitidas: Record<string, number> = {}; let agregadas = 0;
  const clave = (id: string, fila: number) => `${id}${preview.destino === 'precios' ? `|${preview.filas.find(f => f.fila === fila)?.datos.presupuesto ?? ''}` : ''}`;
  const identidades = new Map<string, number>();
  for (const f of preview.filas) if (f.candidatos.length === 1) { const k = clave(f.candidatos[0].id, f.fila); identidades.set(k, (identidades.get(k) ?? 0) + 1); }
  for (const f of preview.filas) {
    const c = f.candidatos[0]; let motivo = '';
    if (actual[f.fila]) motivo = 'Decisión manual conservada';
    else if (f.errores.length || f.estado === 'rechazada') motivo = 'Fila rechazada';
    else if (f.candidatos.length !== 1 || f.estado !== 'coincidencia') motivo = 'Revisión individual';
    else if (!c.activo || !Number.isInteger(c.revision) || c.revision < 0 || c.unidad !== f.datos.unidad || !tipo.safeParse(c.tipo).success || (f.datos.tipo && f.datos.tipo !== c.tipo)) motivo = 'Referencia incompatible o sin revisión';
    else if ((identidades.get(clave(c.id, f.fila)) ?? 0) > 1 || Object.values(actual).some(s => s.fila !== f.fila && s.articuloId && clave(s.articuloId, s.fila) === clave(c.id, f.fila))) motivo = 'Identidad duplicada';
    if (motivo) omitidas[motivo] = (omitidas[motivo] ?? 0) + 1;
    else { seleccion[f.fila] = { fila: f.fila, articuloId: c.id, revisionArticulo: c.revision }; agregadas++; }
  }
  return { seleccion, agregadas, omitidas };
}
