import type { Candidato, Decisiones, Destino, ResultadoExtraccion } from '@/lib/requisitos/modelo';
export type { Candidato, Decisiones, Destino, ResultadoExtraccion };
export type Area = Extract<Decisiones, { destino: 'areas_bom' }>['areas'][number];
export type Material = Extract<Decisiones, { destino: 'areas_bom' }>['material'][number];
export interface ObraRequisitos {
  id: string; nombre: string;
  localizaciones: { id: string; nombre: string }[];
  salas: { id: string; nombre: string; codigo: string | null }[];
}
export interface Metadatos { nombre: string; mime: string; procedencia: string; fechaFuente: string | null; url: string | null; tamano: number }
export interface Documento {
  id: string; proyectoId: string; autorId: string; version: number;
  tipo: 'archivo_obra' | 'ficha_e2' | 'lote_e2'; sha256: string; estado: string; creadoEn: string;
  metadatos?: Metadatos | null;
}
export interface Extraccion { id: string; metodo: string; parser: string; parser_version: string; sha256: string; resultado: ResultadoExtraccion }
export interface Plan { id: string; extraccion_id: string; version: number; destino: Destino; estado: string; decisiones: { datos: Decisiones; revisadoPor?: string; fecha?: string } | Decisiones | { pendiente: true } | null }
export interface Aplicacion { id: string; plan_id: string; resultado: unknown; creado_en?: string }
export interface Detalle { documento: Documento; metadatos: Metadatos | null; extracciones: Extraccion[]; planes: Plan[]; aplicaciones: Aplicacion[] }
export interface Preview { token: string; version: number; huella: string; diff: unknown }
export const DESTINOS: Record<Destino, string> = { areas_bom: 'Salas y material adicional', catalogo: 'Catálogo', ofertas: 'Ofertas', tecnico: 'Ficha técnica', puerto: 'Puerto físico' };
export const ETIQUETAS_CAMPOS: Record<string, string> = { accion: 'Acción elegida', nombre: 'Nombre', codigo: 'Código', localizacion: 'Localización', medidas: 'Medidas y unidades', aceptarHomonimo: 'Coincidencia de nombres', sala: 'Sala de destino', articuloId: 'Referencia exacta', cantidad: 'Cantidad adicional', unidad: 'Unidad', disenoRevisado: 'Material ya incluido por el diseño', modeloExacto: 'Modelo y variante exactos', seleccion: 'Referencia elegida o alta explícita', referencia: 'Referencia', marca: 'Marca', modelo: 'Modelo', tipo: 'Tipo de artículo', categoria: 'Categoría', descripcion: 'Descripción', observaciones: 'Observaciones', proveedor: 'Proveedor', presupuesto: 'Presupuesto', precio_compra: 'Precio de compra sin IVA', moneda: 'Moneda', fecha: 'Fecha de la fuente', unidad_compra: 'Unidad de compra', unidades_por_compra: 'Unidades por compra', origen: 'Procedencia o clasificación', kit: 'Forma parte de un kit', vinculante: 'Oferta vinculante', url: 'URL HTTPS de la fuente', ancho: 'Ancho', alto: 'Alto', fondo: 'Fondo', ru: 'Altura en RU', total: 'Número de puertos', sentido: 'Sentido', senal: 'Señal', conector: 'Conector literal', orden: 'Orden', notas: 'Notas' };
export function etiquetaRevision(campo: string) { return `Revisado: ${ETIQUETAS_CAMPOS[campo] ?? campo.replaceAll('_', ' ')}`; }
export function decisionesIniciales(destino: Destino): Decisiones | null {
  if (destino === 'areas_bom') return { versionModelo: 1, destino, areas: [], material: [], excluidos: [] };
  if (destino === 'catalogo' || destino === 'ofertas') return { versionModelo: 1, destino, filas: [], excluidos: [] };
  return null;
}
export function idsElegidos(d: Decisiones | null): string[] {
  if (!d) return [];
  if (d.destino === 'areas_bom') return [...d.areas, ...d.material].map(f => f.candidatoId);
  if (d.destino === 'catalogo' || d.destino === 'ofertas') return d.filas.map(f => f.candidatoId);
  return [d.candidatoId];
}
