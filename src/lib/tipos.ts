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

/**
 * Por dónde entra o sale la señal en un puerto del equipo.
 * `bidireccional` es el USB-C o el Dante; `control`, el RS-232 y el IR.
 */
export type SentidoPuerto = 'entrada' | 'salida' | 'bidireccional' | 'control';

/**
 * Un conector físico de un artículo del catálogo: el `LAN PoE` del Room
 * Navigator, los `HDMI IN 1..4` de una matriz. Es lo que permite decir de qué
 * salida a qué entrada va un cable, y sin eso no hay tabla de cables.
 */
export interface Puerto {
  id: string;
  articulo_id: string;
  /** El literal del fabricante: `HDMI IN 1`, `LAN PoE`, `MIC IN 1`. */
  nombre: string;
  /** Cuántos puertos iguales hay. Cuatro entradas sin numerar son una fila con total 4. */
  total: number;
  sentido: SentidoPuerto;
  senal: Senal;
  /** `RJ45`, `HDMI A`, `USB-C`, `Euroblock 5`, `Jack 3.5`, `XLR M`… */
  conector: string | null;
  /** Para listarlos como los pinta el fabricante en la trasera del equipo. */
  orden: number | null;
  notas: string | null;
  /** `csv` lo regenera la siembra. `app` se escribió aquí y es intocable. */
  fuente: 'csv' | 'app';
}

export interface Punto {
  x_m: number;
  y_m: number;
  z_m: number;
}

export interface Sala {
  id: string;
  sede_id: string | null;
  /**
   * Nombre de la sede, ya resuelto por la consulta. Es el `Location` de
   * XTEN-AV. Opcional a propósito: es un dato de presentación, no entra en
   * ningún cálculo, y obligarlo rompería a quien construye una sala a mano.
   */
  sede?: string | null;
  /** Nula = sala de antes de la jerarquía de obra. Legado válido, no error. */
  localizacion_id: string | null;
  /** Nombre de la localización y de su proyecto, resueltos por la consulta. */
  localizacion?: string | null;
  proyecto_id?: string | null;
  proyecto?: string | null;
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
  /** Mesa de la sala. Nula mientras no se haya medido: el croquis la omite. */
  mesa_largo_m: number | null;
  mesa_ancho_m: number | null;
  /** Altura de la mesa desde el suelo, en centímetros: se mide así en obra. */
  mesa_alto_cm: number | null;
  /** Centro de la mesa desde la esquina inferior izquierda. Nulo = centrada. */
  mesa_x_m: number | null;
  mesa_y_m: number | null;
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
  /** Mesa estándar de esta tipología. La sala nueva la hereda. */
  mesa_largo_m: number | null;
  mesa_ancho_m: number | null;
  mesa_alto_cm: number | null;
}

/**
 * Una línea del equipamiento estándar de una plantilla. Es lo que hereda la
 * sala al crearse: se copia a `sala_equipos` tal cual.
 *
 * Vive aquí y no en `datos.ts` porque el formulario de alta —que corre en el
 * navegador— necesita el tipo para enseñar qué se va a heredar.
 */
export interface LineaPlantilla {
  id: string;
  articulo_id: string | null;
  categoria: string;
  cantidad: number;
  /** `no en todas`: la sala nueva no la hereda. */
  opcional: boolean;
  modelo_texto: string | null;
  /**
   * Dónde va este equipo en la sala tipo. Se copia tal cual a la sala nueva, y
   * es lo que hace que el croquis salga medido en vez de deducido. Nulo
   * mientras nadie lo haya colocado.
   */
  extremo: Extremo | null;
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
}

/**
 * Una tirada tipo de la plantilla. Apunta a las líneas de equipamiento y no a
 * artículos: una plantilla puede llevar dos pantallas del mismo modelo y la
 * tirada va a una de las dos.
 */
export interface TiradaPlantilla {
  id: string;
  plantilla_id: string;
  origen_linea_id: string;
  destino_linea_id: string;
  /** Ya resueltos, para poder pintarlos sin otra consulta. */
  origen: string;
  destino: string;
  articulo_cable_id: string | null;
  senal: Senal;
  ruta: Ruta | null;
  notas: string | null;
  orden: number;
}

export interface Articulo {
  id: string;
  referencia: string | null;
  tipo: TipoArticulo;
  categoria: string;
  marca: string | null;
  modelo: string;
  descripcion: string | null;
  /** Ficha técnica en texto libre: potencia, resolución, puertos, montaje… */
  caracteristicas: string | null;
  /** Notas del departamento: incidencias, compatibilidades, qué vigilar. */
  observaciones: string | null;
  unidad: UnidadMedida;
  coste: number | null;
  /** El coste es una referencia, no una oferta cerrada. */
  coste_orientativo: boolean;
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

/**
 * Una referencia del catálogo reducida a lo justo para poder elegirla: el
 * identificador que va al formulario y el texto que lee el técnico.
 *
 * Existe porque el catálogo tiene casi mil referencias y mandarlas enteras al
 * navegador —una vez por cada desplegable de la página— era lo que hacía que
 * `/plantillas` pesara megas. El buscador pide como mucho una veintena.
 */
export interface ArticuloElegible {
  id: string;
  /** Marca y modelo, ya unidos: `Samsung QB65R`. */
  etiqueta: string;
  categoria: string;
  unidad: UnidadMedida;
}

/**
 * Una roseta de red del edificio: el número que hay escrito en la placa del
 * suelo, de la pared o de la mesa. "Este Room Navigator pincha en la toma 12".
 *
 * No confundir con `Puerto`: el puerto es del artículo del catálogo y es igual
 * en todas las salas; la toma es de esta sala y de ninguna otra.
 *
 * En esta iteración la toma **no es extremo de tirada**: es dónde pincha un
 * equipo y una columna informativa de la tabla de cables. Hacerla extremo
 * obligaría a cambiar `calculo-cable.ts`, que está congelado.
 */
export interface TomaRed {
  id: string;
  sala_id: string;
  /** El número o la etiqueta de la roseta, tal cual está serigrafiada. */
  codigo: string;
  ubicacion: string | null;
  /** Posición de la roseta, si se conoce. Hoy es documental. */
  x_m: number | null;
  y_m: number | null;
  z_m: number | null;
  notas: string | null;
}

/**
 * Las ubicaciones que ofrece la interfaz. En la base es texto libre, no un
 * enum: nada se bifurca por este valor y cada edificio añade sitios nuevos.
 * Ampliar la lista es esta línea, no una migración.
 */
export const UBICACIONES_TOMA = [
  'suelo',
  'pared',
  'mesa',
  'techo',
  'rack',
] as const;

export interface EquipoEnSala {
  id: string;
  sala_id: string;
  articulo_id: string;
  nombre: string;
  cantidad: number;
  extremo: Extremo;
  posicion: Punto;
  /** En qué roseta de la sala pincha este equipo, si pincha en alguna. */
  toma_red_id?: string | null;
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
  /**
   * De qué puerto sale y a qué puerto entra. Opcionales: hay conexiones dadas
   * de alta antes de que existiera el catálogo de puertos, y siguen valiendo.
   */
  puerto_origen_id?: string | null;
  puerto_destino_id?: string | null;
  /** Orden de alta. Es lo que fija el correlativo del identificador de cable. */
  creado_en?: string | null;
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

export const ETIQUETA_SENTIDO: Record<SentidoPuerto, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  bidireccional: 'Bidireccional',
  control: 'Control',
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

/**
 * Prefijo del identificador de cable, por señal. Es el único sitio donde se
 * define: `HD-1000`, `HD-1001`, `RED-1000`…
 *
 * Sirve para etiquetar físicamente en obra, así que se escribe corto, en
 * mayúsculas y sin acentos: es lo que cabe en una brida y lo que el técnico
 * copia a mano. El correlativo arranca en 1000 —como XTEN-AV— para que todos
 * los identificadores tengan el mismo ancho hasta la tirada 999.
 */
export const PREFIJO_CABLE: Record<Senal, string> = {
  hdmi: 'HD',
  red: 'RED',
  usb: 'USB',
  audio_linea: 'AUD',
  audio_altavoz: 'ALT',
  microfono: 'MIC',
  alimentacion: 'PWR',
  control: 'RS',
  otro: 'CBL',
};

/** Primer número de cada serie de identificadores. */
export const PRIMER_CORRELATIVO_CABLE = 1000;

// ---------------------------------------------------------------------
// Fase 2 · Almacén, reservas, compras y carga
// ---------------------------------------------------------------------

/**
 * Un sitio del almacén: una estantería, un armario, la furgoneta. El mismo
 * artículo puede estar en varios, y por eso la existencia se cuenta por
 * artículo *y* ubicación, no solo por artículo.
 */
export interface Ubicacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  /**
   * Una furgoneta con material fijo también es una ubicación. Se marca para
   * no ofrecerla por defecto al sacar material a obra: cargar la furgoneta es
   * sacar del almacén, no mover de un estante a otro.
   */
  es_furgoneta: boolean;
  activa: boolean;
}

/**
 * `ajuste` es el recuento de inventario y el único que admite cantidad
 * negativa: contar corrige en los dos sentidos.
 */
export type TipoMovimiento = 'entrada' | 'salida' | 'devolucion' | 'baja' | 'ajuste';

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  devolucion: 'Devolución',
  baja: 'Baja',
  ajuste: 'Ajuste',
};

/**
 * Un apunte del almacén. Los movimientos son la verdad: la existencia se
 * deriva de ellos y no se edita a mano, porque un stock que se sobrescribe
 * sin dejar rastro vuelve a ser el Excel del que se viene.
 */
export interface Movimiento {
  id: string;
  articulo_id: string;
  ubicacion_id: string | null;
  tipo: TipoMovimiento;
  /** Siempre positiva salvo en `ajuste`. El signo lo pone el tipo. */
  cantidad: number;
  /** Para qué obra. Nulo en una compra de reposición. */
  sala_id: string | null;
  motivo: string | null;
  quien: string | null;
  fecha: string;
}

export type EstadoReserva = 'activa' | 'liberada' | 'servida';

export const ETIQUETA_RESERVA: Record<EstadoReserva, string> = {
  activa: 'Activa',
  liberada: 'Liberada',
  servida: 'Servida',
};

/**
 * Material comprometido para una sala. Sigue contando como existencia —está
 * en el estante— pero no está disponible para otra obra.
 */
export interface Reserva {
  id: string;
  sala_id: string;
  articulo_id: string;
  cantidad: number;
  estado: EstadoReserva;
  notas: string | null;
  quien: string | null;
}

export type EstadoPedido = 'borrador' | 'pedido' | 'recibido_parcial' | 'recibido';

export const ETIQUETA_PEDIDO: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  pedido: 'Pedido',
  recibido_parcial: 'Recibido parcial',
  recibido: 'Recibido',
};

export interface Pedido {
  id: string;
  proveedor_id: string | null;
  proveedor: string | null;
  sala_id: string | null;
  sala: string | null;
  referencia: string | null;
  estado: EstadoPedido;
  fecha: string | null;
  notas: string | null;
}

export interface LineaPedido {
  id: string;
  pedido_id: string;
  articulo_id: string;
  descripcion: string;
  unidad: UnidadMedida;
  cantidad: number;
  cantidad_recibida: number;
  /** Congelado al generar la línea: el catálogo cambia y el pedido no. */
  precio_unitario: number | null;
  /** Se puede presupuestar con él; no se puede pedir. */
  precio_orientativo: boolean;
  notas: string | null;
}

export type EstadoCarga = 'preparacion' | 'cargada' | 'cerrada';

export const ETIQUETA_CARGA: Record<EstadoCarga, string> = {
  preparacion: 'En preparación',
  cargada: 'Cargada',
  cerrada: 'Cerrada',
};

export interface Carga {
  id: string;
  sala_id: string;
  sala: string | null;
  nombre: string;
  estado: EstadoCarga;
  quien: string | null;
  notas: string | null;
  cerrado_en: string | null;
}

export interface LineaCarga {
  id: string;
  carga_id: string;
  articulo_id: string;
  descripcion: string;
  unidad: UnidadMedida;
  reserva_id: string | null;
  cantidad: number;
  cargado: boolean;
  /** Cierre de obra. Entre los tres no pueden pasar de `cantidad`. */
  instalado: number;
  devuelto: number;
  roto: number;
  notas: string | null;
}

// ---------------------------------------------------------------------
// Check-in de sala
// ---------------------------------------------------------------------

/**
 * Cómo ha quedado un punto de la visita. `no_aplica` no es un hueco: hay
 * salas sin rack y sin falso techo, y dejar el punto en pendiente para
 * siempre haría que ninguna visita se cerrara nunca.
 */
export type EstadoPunto = 'pendiente' | 'conforme' | 'incidencia' | 'no_aplica';

export const ETIQUETA_PUNTO: Record<EstadoPunto, string> = {
  pendiente: 'Sin mirar',
  conforme: 'Conforme',
  incidencia: 'Incidencia',
  no_aplica: 'No aplica',
};

export interface Revision {
  id: string;
  sala_id: string;
  sala?: string | null;
  nombre: string;
  cerrada: boolean;
  quien: string | null;
  notas: string | null;
  creado_en: string;
  cerrado_en: string | null;
}

export interface PuntoRevision {
  id: string;
  revision_id: string;
  /** Clave estable: `medidas_largo`, `roseta`, `corriente_rack`. */
  clave: string;
  bloque: string;
  titulo: string;
  estado: EstadoPunto;
  /** Lo medido, cuando el punto pide un número. Texto: `4,68`. */
  valor: string | null;
  notas: string | null;
  orden: number;
}
