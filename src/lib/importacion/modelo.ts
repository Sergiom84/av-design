import type postgres from 'postgres';

export const MAXIMO_FILAS_IMPORTACION = 500;
export const MAXIMO_BYTES_IMPORTACION = 5 * 1024 * 1024;
export type DestinoImportacion = 'catalogo' | 'bom' | 'precios';
export type SqlImportacion = postgres.Sql<Record<string, unknown>>;
export interface EntradaImportacion {
  destino: DestinoImportacion;
  salaId?: string;
  origen: string;
  archivo: { nombre: string; bytes: Uint8Array };
}
export interface SeleccionFila { fila: number; articuloId?: string; crear?: boolean; revisionArticulo?: number }
export interface CandidatoImportacion {
  id: string; etiqueta: string; categoria: string; unidad: 'ud' | 'm';
  activo: boolean;
  revision: number;
}
export interface FilaImportacion {
  fila: number;
  datos: Record<string, string>;
  candidatos: CandidatoImportacion[];
  estado: 'alta' | 'coincidencia' | 'ambigua' | 'no_encontrada' | 'rechazada';
  errores: string[];
  avisos: string[];
}
export interface PreviewImportacion {
  previewHash: string;
  parametrosPrecio?: { fechaCalculo: string; tipoCambioUsdEur: number; vigenciaMeses: number };
  destino: DestinoImportacion;
  salaId: string | null;
  origen: string;
  archivo: { nombre: string; sha256: string; bytes: number; formato: 'csv' | 'xlsx' };
  filas: FilaImportacion[];
  resumen: { filas: number; altas: number; coincidencias: number; ambiguas: number; rechazadas: number; noEncontradas: number };
}
export interface InformeFilaImportacion {
  fila: number;
  estado: 'alta' | 'cambio' | 'omitida' | 'rechazada';
  articuloId: string | null;
  mensaje: string;
}
export interface InformeReversion {
  cambioId: string; tabla: string; filaId: string;
  estado: 'revertido' | 'conservado'; motivo: string;
}
export interface LoteImportacion {
  id: string; destino: DestinoImportacion; salaId: string | null;
  usuarioId: string; origen: string;
  archivoNombre: string; archivoSha256: string; archivoBytes: number;
  estado: 'confirmado' | 'revertido' | 'reversion_parcial';
  creadoEn: string; revertidoEn: string | null;
  informe: InformeFilaImportacion[];
  reversion: InformeReversion[];
}
export class ErrorImportacion extends Error {
  constructor(mensaje: string, public readonly estadoHttp = 400) {
    super(mensaje); this.name = 'ErrorImportacion';
  }
}
