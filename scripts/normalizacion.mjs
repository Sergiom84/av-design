/**
 * Reglas de limpieza del catálogo.
 *
 * El inventario de partida se ha rellenado a mano durante años, así que la
 * misma cosa aparece escrita de varias formas: "CISCO ROOM NAVIGATOR" y
 * "ROOM NAVIGATOR", "TRANSMISOR VIDEO" y "TRANSMISOR DE VIDEO", "SLX D4D" y
 * "SLXD4D". Aquí están las reglas que lo unifican.
 *
 * Las usan `generar-seed.mjs` (para que el seed salga limpio) y
 * `normalizar-catalogo.mjs` (para arreglar una base de datos ya sembrada).
 *
 * Criterio: solo se unifica lo que es inequívocamente la misma cosa. Las
 * variantes reales de producto (QB65R y QB65R-B, TCM-X y TCM-XEX, SK2000 y
 * SKM2000) se dejan en paz.
 */

/** Mayúsculas, sin espacios de más. Conserva acentos y eñes. */
export function normalizarTexto(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// --------------------------------------------------------------------------
// Secciones
// --------------------------------------------------------------------------

/**
 * Sinónimo escrito en el inventario → sección canónica.
 * La canónica va en español correcto, con sus acentos.
 */
export const SECCIONES = {
  // paneles
  'PANEL TACTIL': 'PANEL TÁCTIL',
  'PANEL CISCO': 'PANEL TÁCTIL',
  'TOUCH PANEL': 'PANEL TÁCTIL',
  'MONITOR TACTIL': 'MONITOR TÁCTIL',

  // microfonía
  MICROFONO: 'MICRÓFONO',
  'MICROFONO MESA': 'MICRÓFONO DE MESA',
  'MICROFONO DE MESA': 'MICRÓFONO DE MESA',
  'MICROFONO TECHO': 'MICRÓFONO DE TECHO',
  'MICROFONO EXTENSOR': 'MICRÓFONO EXTENSOR',
  MICROFONIA: 'MICROFONÍA',
  'RECEPTOR MICROFONO': 'RECEPTOR DE MICRÓFONO',
  'RECEPTOR MICROFONIA': 'RECEPTOR DE MICRÓFONO',
  'RECEPTOR INALAMBRICO': 'RECEPTOR DE MICRÓFONO',
  'TRANSMISOR MICROFONIA': 'TRANSMISOR DE MICROFONÍA',
  'UNIDAD CONTROL MICROFONIA': 'UNIDAD DE CONTROL DE MICROFONÍA',
  'BASE CARGA MICROFONO': 'BASE DE CARGA DE MICRÓFONO',
  'AMPLIFICADOR MIC': 'AMPLIFICADOR DE MICRÓFONO',

  // vídeo
  'TRANSMISOR VIDEO': 'TRANSMISOR DE VÍDEO',
  'TRANSMISOR DE VIDEO': 'TRANSMISOR DE VÍDEO',
  'EMISOR VIDEO': 'TRANSMISOR DE VÍDEO',
  TRANSMISOR: 'TRANSMISOR DE VÍDEO',
  'RECEPTOR VIDEO': 'RECEPTOR DE VÍDEO',
  'RECEPTOR DE VIDEO': 'RECEPTOR DE VÍDEO',
  RECEPTOR: 'RECEPTOR DE VÍDEO',
  'EXTENSOR VIDEO': 'EXTENSOR',
  'MATRIZ VIDEO': 'MATRIZ',
  'DISTRIBUIDOR VIDEO': 'DISTRIBUIDOR',
  'DISTRIBUIDOR HDMI': 'DISTRIBUIDOR',
  'CAPTURADORA VIDEO': 'CAPTURADORA DE VÍDEO',

  // cámaras y barras
  CAMARA: 'CÁMARA',
  CAM: 'CÁMARA',
  'CAMARA IP': 'CÁMARA IP',
  'BANDEJA CAMARA': 'BANDEJA DE CÁMARA',
  BARRA: 'BARRA DE VIDEOCONFERENCIA',
  'BARRA VIDEOCONFERENCIA': 'BARRA DE VIDEOCONFERENCIA',
  'BARRA USB VIDEOCONFERENCIA': 'BARRA DE VIDEOCONFERENCIA',
  'BARRA VIDEOCONFERENCIA USB': 'BARRA DE VIDEOCONFERENCIA',
  'BARRA CISCO': 'BARRA DE VIDEOCONFERENCIA',

  // audio
  ALTAVOCES: 'ALTAVOZ',
  'CAJAS ACUSTICAS': 'ALTAVOZ',
  'CAJA ACUSTICA': 'ALTAVOZ',
  'ALTAVOCES (X4)': 'ALTAVOZ',
  'ALTAVOCES TECHO': 'ALTAVOZ DE TECHO',
  'SUBWOOFER TECHO': 'SUBWOOFER DE TECHO',
  'PROCESADOR AUDIO': 'PROCESADOR DE AUDIO',
  DSP: 'PROCESADOR DE AUDIO',
  'DSP AUDIO': 'PROCESADOR DE AUDIO',
  'MEZCLADOR AUDIO': 'MEZCLADOR DE AUDIO',
  'MESA DE SONIDO': 'MEZCLADOR DE AUDIO',
  'MESA MEZCLAS': 'MEZCLADOR DE AUDIO',
  'ETAPA DE POTENCIA': 'AMPLIFICADOR',
  'ETAPA DE SONIDO': 'AMPLIFICADOR',
  'AMPLIFICADOR - MEZCLADOR': 'AMPLIFICADOR',
  'EMBEBEDOR AUDIO': 'EMBEBEDOR DE AUDIO',
  'HDMI EMBEBEDOR/DESEMBEBEDOR': 'EMBEBEDOR DE AUDIO',
  'INTERFAZ AUDIO': 'INTERFAZ DE AUDIO',
  'INTERFAZ AUDIO USB': 'INTERFAZ DE AUDIO',
  '↳TARJETA DANTE': 'TARJETA DANTE',

  // pantallas y proyección
  'PANTALLA DE PROYECCION': 'PANTALLA DE PROYECCIÓN',
  'PANTALLA PROYECCION': 'PANTALLA DE PROYECCIÓN',
  'PANTALLA ELECTRICA': 'PANTALLA DE PROYECCIÓN',
  'PANTALLA MECANIZADA': 'PANTALLA DE PROYECCIÓN',
  'CONTROLADORA PROYECTOR': 'CONTROLADORA DE PROYECTOR',
  'SOPORTE PROYECTOR': 'SOPORTE DE PROYECTOR',

  // puestos y periféricos
  'PC SALA': 'PC',
  'TECLADO INALAMBRICO': 'TECLADO',
  'TECLADO/RATON': 'TECLADO Y RATÓN',
  'KIT TECLADO Y RATON': 'TECLADO Y RATÓN',
  'TECLADO Y RATON': 'TECLADO Y RATÓN',
  RATON: 'RATÓN',
  'RATON INALAMBRICO': 'RATÓN',
  DOCKSTATION: 'DOCK STATION',

  // soportes y mobiliario
  TOTEM: 'TÓTEM',
  'TOTEM PANTALLA': 'TÓTEM CON PANTALLA',
  'SOPORTE PANTALLA': 'SOPORTE DE PANTALLA',
  'SOPORTE ALTAVOZ': 'SOPORTE DE ALTAVOZ',
  'SOPORTE ALTAVOCES': 'SOPORTE DE ALTAVOZ',
  'SOPORTE PARED': 'SOPORTE DE PARED',
  'SOPORTE DE PIE': 'SOPORTE DE PIE',
  'CAJA CONEXIONES': 'CAJA DE CONEXIONES',
  'CAJA DE MESA': 'CAJA DE CONEXIONES',

  // control
  'PASARELA RELE': 'PASARELA',
  'PASARELA MODULO RELE': 'PASARELA',
  'CONTROLADORA VW': 'CONTROLADORA DE VIDEOWALL',
  'CONTROLADORA VIDEOWALL': 'CONTROLADORA DE VIDEOWALL',
  'DISTRIBUIDOR VW': 'DISTRIBUIDOR DE VIDEOWALL',

  // varios
  SENALETICA: 'SEÑALÉTICA',
  'SIN CATEGORIA': 'SIN SECCIÓN',
  'COMPARTICION INALAMBRICA': 'COMPARTICIÓN INALÁMBRICA',
  MIRRORING: 'COMPARTICIÓN INALÁMBRICA',
  'WIRELESS DISPLAY': 'COMPARTICIÓN INALÁMBRICA',
  'TELEFONO IP': 'TELÉFONO IP',
};

export function normalizarSeccion(s) {
  const base = normalizarTexto(s) || 'SIN SECCIÓN';
  return SECCIONES[base] ?? base;
}

// --------------------------------------------------------------------------
// Marcas
// --------------------------------------------------------------------------

/**
 * Marca mal escrita → marca buena. Comprobadas una a una contra el fabricante.
 * Cuando las dos formas son válidas se deja la que más unidades tiene, para no
 * cambiar de golpe lo que el departamento ya reconoce.
 */
export const MARCAS = {
  'B.MONJE': 'B. MONJE',
  BMONJE: 'B. MONJE',
  'BEYER DINAMIC': 'BEYERDYNAMIC',
  'BEYER DYNAMIC': 'BEYERDYNAMIC',
  BLUESTREAM: 'BLUSTREAM',
  CRESTON: 'CRESTRON',
  ELITESCREEN: 'ELITE SCREENS',
  INDETERMINADO: 'INDETERMINADA',
  PHILLIPS: 'PHILIPS',
  PIONNER: 'PIONEER',
  'PLUS SCREEN': 'PLUSSCREEN',
  SAMGUNG: 'SAMSUNG',
  SANSUNG: 'SAMSUNG',
  SENHEISER: 'SENNHEISER',
  VOGEL: 'VOGELS',
  "VOGEL'S": 'VOGELS',
  'VOGEL´S': 'VOGELS',
  YEALIMK: 'YEALINK',
};

export function normalizarMarca(m) {
  const base = normalizarTexto(m);
  if (!base) return null;
  return MARCAS[base] ?? base;
}

// --------------------------------------------------------------------------
// Modelos
// --------------------------------------------------------------------------

/**
 * Marcas cuyo nombre forma parte del nombre del producto y por tanto no se
 * quita del modelo. "Apple TV" se llama así.
 */
const MARCA_EN_EL_PRODUCTO = new Set(['APPLE']);

/**
 * "CISCO ROOM NAVIGATOR" con marca CISCO → "ROOM NAVIGATOR".
 *
 * No se quita si lo que queda no sirve para identificar el producto: en
 * "SHURE 185" quitar la marca deja "185", que no dice nada.
 */
export function quitarPrefijoMarca(marca, modelo) {
  const mo = normalizarTexto(modelo);
  const candidatas = [normalizarTexto(marca), normalizarMarca(marca)].filter(Boolean);

  for (const m of candidatas) {
    if (MARCA_EN_EL_PRODUCTO.has(m)) continue;
    if (mo.startsWith(m + ' ')) {
      const resto = mo.slice(m.length + 1).trim();
      if (resto.length >= 3 && !/^[0-9]+$/.test(resto)) return resto;
    }
  }
  return mo;
}

/**
 * Erratas confirmadas una a una. Clave: `MARCA|MODELO` tal cual está escrito.
 * No se corrige nada por parecido: solo lo que se ha comprobado.
 */
export const ERRATAS = {
  'CISCO|ROOM NAVIGATO': 'ROOM NAVIGATOR',
  'CRESTRON|HD-TXU-4KZ-211-CHRG': 'HD-TXU-4KZ-211-CHGR',
  'KAPTIVO|WALL MOUNT CAMARA': 'WALL MOUNT CAMERA',
  'HP|ELITE DESK 800 G5': 'ELITEDESK 800 G5',
  'HP|ELITE DESK SFF 800 G5': 'ELITEDESK SFF 800 G5',
  'LOGITECH|GRUOP': 'GROUP',
};

/**
 * Familias de producto que el fabricante escribe de una forma concreta y en el
 * inventario aparecen de varias. Se aplica sobre el modelo ya sin marca.
 */
const FAMILIAS = [
  // Biamp: el producto es TesiraFORTÉ, todo junto y con acento
  [/^TESIRA ?FORT[EÉ]\b/, 'TESIRAFORTÉ'],
  // Biamp: Tesira Parlé, con acento
  [/^TESIRA PARLE\b/, 'TESIRA PARLÉ'],
];

/** Deja el modelo tal y como debe escribirse. */
export function normalizarModelo(marca, modelo) {
  let mo = quitarPrefijoMarca(marca, modelo);

  const errata = ERRATAS[`${normalizarMarca(marca)}|${mo}`];
  if (errata) mo = errata;

  for (const [patron, reemplazo] of FAMILIAS) mo = mo.replace(patron, reemplazo);

  // Punto final suelto: "SKM 2000." y "TESIRAFORTÉ AVB CI."
  mo = mo.replace(/\.\s*$/, '').trim();

  return mo;
}

/**
 * Clave para detectar el mismo modelo escrito con distintos separadores.
 * Ignora espacios y guiones, pero NO el "+", que sí distingue producto
 * (K400 y K400+ son distintos, VB342 y VB342+ también).
 */
export function claveModelo(marca, modelo) {
  return normalizarModelo(marca, modelo).replace(/[ \-]/g, '');
}
