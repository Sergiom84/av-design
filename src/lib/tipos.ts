/**
 * Tipos del dominio AV. El vocabulario es el que usa el departamento:
 * sala, tipología, aforo, caja de conexiones, canaleta, falso techo.
 */

export type TipoArticulo = 'equipo' | 'cable' | 'consumible';

export type UnidadMedida = 'ud' | 'm';

/** Por dónde discurre físicamente el cable entre dos puntos de la sala. */
export type Ruta = 'falso_techo' | 'canaleta' | 'suelo_tecnico' | 'directo';

/**
 * Dónde acaba cada extremo del cable. Determina la holgura que se deja.
 * Los valores por defecto salen del criterio del departamento:
 * 20–50 cm en pantalla, ~10 cm en proyector.
 */
export type Extremo =
  | 'pantalla'
  | 'proyector'
  | 'rack'
  | 'caja_conexiones'
  | 'mesa'
  | 'techo'
  | 'pared';

export type Senal =
  | 'hdmi'
  | 'red'
  | 'usb'
  | 'audio_linea'
  | 'audio_altavoz'
  | 'microfono'
  | 'alimentacion'
  | 'control'
  | 'otro';

export interface Punto {
  x_m: number;
  y_m: number;
  z_m: number;
}

export interface Sala {
  id: string;
  sede_id: string | null;
  edificio: string | null;
  nivel: string | null;
  codigo: string | null;
  nombre: string;
  tipologia: string | null;
  aforo: number | null;
  plantilla_id: string | null;
  largo_m: number;
  ancho_m: number;
  alto_m: number;
  alto_falso_techo_m: number | null;
  alto_canaleta_m: number | null;
  alto_suelo_tecnico_m: number | null;
  ruta_por_defecto: Ruta;
  notas: string | null;
}

export interface PlantillaSala {
  id: string;
  nombre: string;
  tipologia: string;
  aforo: number | null;
  n_salas_reales: number | null;
  largo_m: number | null;
  ancho_m: number | null;
  alto_m: number | null;
  alto_falso_techo_m: number | null;
  ruta_por_defecto: Ruta;
  notas: string | null;
}

export interface Articulo {
  id: string;
  referencia: string | null;
  tipo: TipoArticulo;
  categoria: string;
  marca: string | null;
  modelo: string;
  descripcion: string | null;
  unidad: UnidadMedida;
  coste: number | null;
  pvp: number | null;
  proveedor: string | null;
  plazo_dias: number | null;
  stock_minimo: number | null;
  /** Solo para tipo = 'cable' */
  senal: Senal | null;
  conector_a: string | null;
  conector_b: string | null;
  /** Longitudes comerciales de latiguillo, en metros. Vacío si es cable a metros. */
  longitudes_comerciales_m: number[] | null;
  /** Metros por bobina, para cable a granel. */
  bobina_m: number | null;
  /** Diámetro exterior en mm, para dimensionar canaleta y tubo. */
  diametro_mm: number | null;
  unidades_instaladas: number | null;
  activo: boolean;
}

export interface EquipoEnSala {
  id: string;
  sala_id: string;
  articulo_id: string;
  nombre: string;
  cantidad: number;
  extremo: Extremo;
  posicion: Punto;
}

export interface Conexion {
  id: string;
  sala_id: string;
  origen_id: string;
  destino_id: string;
  articulo_cable_id: string | null;
  senal: Senal;
  ruta: Ruta | null;
  /** Si se rellena, manda sobre el cálculo. */
  longitud_manual_m: number | null;
  notas: string | null;
}

/** Holguras y márgenes configurables. Se guardan en la tabla `parametros`. */
export interface ParametrosCable {
  /** Holgura en metros por tipo de extremo. */
  holguras: Record<Extremo, number>;
  /** Margen de seguridad sobre el total, en tanto por uno. 0 = sin margen. */
  margen: number;
  /** Nº de cables para los que se dimensiona la canalización (el previsto + reservas). */
  cables_por_canalizacion: number;
  /** Factor de ocupación máximo de la canaleta (0.4 = 40 %). */
  ocupacion_maxima_canaleta: number;
}

export const PARAMETROS_POR_DEFECTO: ParametrosCable = {
  holguras: {
    pantalla: 0.35, // criterio del departamento: entre 20 y 50 cm
    proyector: 0.1,
    rack: 1.0,
    caja_conexiones: 0.5,
    mesa: 0.5,
    techo: 0.3,
    pared: 0.3,
  },
  margen: 0,
  cables_por_canalizacion: 3, // el previsto + un RJ45 y un HDMI de reserva
  ocupacion_maxima_canaleta: 0.4,
};

export const ETIQUETA_RUTA: Record<Ruta, string> = {
  falso_techo: 'Falso techo',
  canaleta: 'Canaleta',
  suelo_tecnico: 'Suelo técnico',
  directo: 'Directo',
};

export const ETIQUETA_EXTREMO: Record<Extremo, string> = {
  pantalla: 'Pantalla',
  proyector: 'Proyector',
  rack: 'Rack',
  caja_conexiones: 'Caja de conexiones',
  mesa: 'Mesa',
  techo: 'Techo',
  pared: 'Pared',
};

export const ETIQUETA_SENAL: Record<Senal, string> = {
  hdmi: 'HDMI',
  red: 'Red',
  usb: 'USB',
  audio_linea: 'Audio línea',
  audio_altavoz: 'Audio altavoz',
  microfono: 'Micrófono',
  alimentacion: 'Alimentación',
  control: 'Control',
  otro: 'Otro',
};
