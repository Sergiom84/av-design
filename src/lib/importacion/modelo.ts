import type postgres from 'postgres';

export const MAXIMO_FILAS_IMPORTACION = 500;
export const MAXIMO_BYTES_IMPORTACION = 5 * 1024 * 1024;
export type DestinoImportacion = 'catalogo' | 'bom' | 'precios';
export type SqlImportacion = postgres.Sql<Record<string, unknown>>;
/** Lecturas y núcleos reutilizables, sin abrir una segunda transacción. */
export type ConexionImportacion = SqlImportacion | postgres.TransactionSql<Record<string, unknown>>;
export interface EntradaImportacion {
  destino: DestinoImportacion;
  salaId?: string;
  origen: string;
  archivo: { nombre: string; bytes: Uint8Array };
}
export type TipoImportado = 'equipo' | 'cable' | 'consumible';
export interface AlternativaBom {
  motivo: string; articuloOriginalId: string | null; tipoOrigen: TipoImportado;
  fuenteTipo: 'catalogo' | 'archivo' | 'confirmado_por_usuario';
}
export interface SeleccionFila { fila: number; articuloId?: string; crear?: boolean; revisionArticulo?: number; alternativa?: AlternativaBom }
export interface CandidatoImportacion {
  id: string; etiqueta: string; categoria: string; unidad: 'ud' | 'm';
  activo: boolean;
  revision: number;
  tipo: TipoImportado;
}
export interface DecisionBomRevisada {
  seleccion: SeleccionFila; original: CandidatoImportacion | null; destino: CandidatoImportacion;
  cantidad: number; unidad: 'ud' | 'm'; tipoOrigen: TipoImportado; fuenteTipo: AlternativaBom['fuenteTipo'];
  datosOriginales: Record<string, string>;
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
  seleccionRevisada?: DecisionBomRevisada[];
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
  alternativa?: DecisionBomRevisada & { autorId: string; previewHash: string };
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
