import type { Articulo, Conexion, EquipoEnSala, MuebleEnSala, ParametrosCable, Puerto, PuertaEnSala, Sala, TomaRed } from '../tipos';
import type { ResultadoCable } from '../calculo-cable';
import type { FilaCable } from '../cable-schedule';
import type { Disponibilidad } from '../almacen';
import type { LineaMaterialBom } from '../compras';

export interface SalaExportada {
  sala: Sala;
  equipos: EquipoEnSala[];
  muebles: MuebleEnSala[];
  puertas: PuertaEnSala[];
  conexiones: Conexion[];
  tomas: TomaRed[];
  puertos: Puerto[];
  resultadosCable: ResultadoCable[];
  filasCable: FilaCable[];
  reservas: Array<{ articulo_id: string; cantidad: number }>;
  posicionesEsquema: Record<string, { x: number; y: number }>;
  materialBom?: LineaMaterialBom[];
}

export interface SnapshotExportacion {
  revision: string;
  creadoEn: string;
  proyecto: { id: string; nombre: string; codigo: string | null } | null;
  salas: SalaExportada[];
  articulos: Articulo[];
  parametros: ParametrosCable;
  disponibilidad: Disponibilidad[];
}

export const DOCUMENTOS = [
  { id: 'plano', nombre: 'Plano PDF', formato: 'pdf' },
  { id: 'elevaciones', nombre: 'Elevaciones PDF', formato: 'pdf' },
  { id: 'esquema', nombre: 'Esquema PDF', formato: 'pdf' },
  { id: 'bom-xlsx', nombre: 'Material XLSX', formato: 'xlsx' },
  { id: 'bom-csv', nombre: 'Material CSV', formato: 'csv' },
  { id: 'cables-xlsx', nombre: 'Cables XLSX', formato: 'xlsx' },
  { id: 'cables-csv', nombre: 'Cables CSV', formato: 'csv' },
] as const;
export type TipoDocumento = typeof DOCUMENTOS[number]['id'];
export interface OpcionesPdf {
  papel: 'A4' | 'A3';
  orientacion: 'horizontal' | 'vertical';
  escala: 20 | 25 | 50 | 100;
}

export interface ArchivoDocumento {
  nombre: string;
  documento: TipoDocumento;
  salaId: string | null;
  estado: 'correcto' | 'error';
  error?: string;
  bytes?: number;
  sha256?: string;
}
export interface ManifiestoExportacion {
  version: 1;
  id: string;
  revision: string;
  creadoEn: string;
  caducaEn: string;
  proyecto: SnapshotExportacion['proyecto'];
  salas: Array<{ id: string; nombre: string; codigo: string | null }>;
  opciones: OpcionesPdf;
  documentos: TipoDocumento[];
  archivos: ArchivoDocumento[];
}
