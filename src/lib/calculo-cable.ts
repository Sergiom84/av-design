/**
 * Cálculo de metros de cable a partir de la geometría de la sala.
 *
 * Criterio del departamento AV (2026-08-05):
 *  - El cable se tira por falso techo, canaleta o suelo técnico. Nunca en línea recta.
 *  - Se deja holgura en cada extremo: 20–50 cm si acaba en pantalla, ~10 cm si acaba
 *    en proyector. El resto de extremos son parametrizables.
 *  - La canalización se dimensiona para 3 cables: el previsto más un RJ45 y un HDMI
 *    de reserva. Eso afecta al tubo o canaleta, no a la longitud del cable.
 *
 * Todo lo que hay aquí son funciones puras: entra geometría, sale número.
 */

import {
  Articulo,
  Conexion,
  EquipoEnSala,
  ParametrosCable,
  PARAMETROS_POR_DEFECTO,
  Punto,
  Ruta,
  Sala,
} from './tipos';

/** Recorrido horizontal ortogonal. Los cables van por bandeja o canaleta, no en diagonal. */
function horizontalOrtogonal(a: Punto, b: Punto): number {
  return Math.abs(a.x_m - b.x_m) + Math.abs(a.y_m - b.y_m);
}

/**
 * Recorrido horizontal pegado a las paredes, para rutas por canaleta.
 * Se toma el camino más corto de los dos posibles rodeando el perímetro.
 */
function horizontalPerimetro(a: Punto, b: Punto, sala: Sala): number {
  const perimetro = 2 * (sala.largo_m + sala.ancho_m);
  const sa = distanciaPerimetral(a, sala);
  const sb = distanciaPerimetral(b, sala);
  const directo = Math.abs(sa - sb);
  return Math.min(directo, perimetro - directo);
}

/** Proyecta un punto sobre la pared más cercana y devuelve su posición a lo largo del perímetro. */
function distanciaPerimetral(p: Punto, sala: Sala): number {
  const { largo_m: L, ancho_m: W } = sala;
  const dIzq = p.x_m;
  const dDer = L - p.x_m;
  const dInf = p.y_m;
  const dSup = W - p.y_m;
  const min = Math.min(dIzq, dDer, dInf, dSup);
  if (min === dInf) return p.x_m; // pared sur:  0 .. L
  if (min === dDer) return L + p.y_m; // pared este: L .. L+W
  if (min === dSup) return L + W + (L - p.x_m); // pared norte
  return 2 * L + W + (W - p.y_m); // pared oeste
}

/** Altura a la que discurre el tramo horizontal según la ruta. */
function alturaDeRuta(ruta: Ruta, sala: Sala): number | null {
  switch (ruta) {
    case 'falso_techo':
      return sala.alto_falso_techo_m ?? sala.alto_m;
    case 'suelo_tecnico':
      return sala.alto_suelo_tecnico_m ?? 0;
    case 'canaleta':
      return sala.alto_canaleta_m ?? 0.3;
    case 'directo':
      return null;
  }
}

export interface DetalleRecorrido {
  ruta: Ruta;
  subida_m: number;
  horizontal_m: number;
  bajada_m: number;
  recorrido_m: number;
}

/** Recorrido físico entre dos puntos, sin holguras. */
export function calcularRecorrido(
  origen: Punto,
  destino: Punto,
  ruta: Ruta,
  sala: Sala,
): DetalleRecorrido {
  if (ruta === 'directo') {
    const recorrido =
      horizontalOrtogonal(origen, destino) + Math.abs(origen.z_m - destino.z_m);
    return {
      ruta,
      subida_m: 0,
      horizontal_m: recorrido,
      bajada_m: 0,
      recorrido_m: redondear(recorrido),
    };
  }

  const altura = alturaDeRuta(ruta, sala) ?? 0;
  const subida = Math.abs(altura - origen.z_m);
  const bajada = Math.abs(altura - destino.z_m);
  const horizontal =
    ruta === 'canaleta'
      ? horizontalPerimetro(origen, destino, sala)
      : horizontalOrtogonal(origen, destino);

  return {
    ruta,
    subida_m: redondear(subida),
    horizontal_m: redondear(horizontal),
    bajada_m: redondear(bajada),
    recorrido_m: redondear(subida + horizontal + bajada),
  };
}

export interface ResultadoCable {
  conexion_id: string;
  etiqueta: string;
  ruta: Ruta;
  detalle: DetalleRecorrido;
  holgura_origen_m: number;
  holgura_destino_m: number;
  margen_m: number;
  /** Longitud que hay que cortar o pedir, antes de ajustar a formato comercial. */
  longitud_m: number;
  /** Longitud final tras ajustar a latiguillo comercial, si el artículo lo tiene. */
  longitud_comercial_m: number | null;
  manual: boolean;
}

/** Longitud comercial inmediatamente superior. Devuelve null si no hay formatos definidos. */
export function ajustarALongitudComercial(
  metros: number,
  longitudes: number[] | null | undefined,
): number | null {
  if (!longitudes || longitudes.length === 0) return null;
  const ordenadas = [...longitudes].sort((a, b) => a - b);
  const encaja = ordenadas.find((l) => l >= metros);
  return encaja ?? ordenadas[ordenadas.length - 1];
}

export function calcularConexion(
  conexion: Conexion,
  sala: Sala,
  equipos: Map<string, EquipoEnSala>,
  articulos: Map<string, Articulo>,
  parametros: ParametrosCable = PARAMETROS_POR_DEFECTO,
): ResultadoCable | null {
  const origen = equipos.get(conexion.origen_id);
  const destino = equipos.get(conexion.destino_id);
  if (!origen || !destino) return null;

  const ruta = conexion.ruta ?? sala.ruta_por_defecto;
  const etiqueta = `${origen.nombre} → ${destino.nombre}`;
  const articulo = conexion.articulo_cable_id
    ? articulos.get(conexion.articulo_cable_id)
    : undefined;

  if (conexion.longitud_manual_m != null) {
    const manual = conexion.longitud_manual_m;
    return {
      conexion_id: conexion.id,
      etiqueta,
      ruta,
      detalle: { ruta, subida_m: 0, horizontal_m: manual, bajada_m: 0, recorrido_m: manual },
      holgura_origen_m: 0,
      holgura_destino_m: 0,
      margen_m: 0,
      longitud_m: manual,
      longitud_comercial_m: ajustarALongitudComercial(
        manual,
        articulo?.longitudes_comerciales_m,
      ),
      manual: true,
    };
  }

  const detalle = calcularRecorrido(origen.posicion, destino.posicion, ruta, sala);
  const holguraOrigen = parametros.holguras[origen.extremo] ?? 0;
  const holguraDestino = parametros.holguras[destino.extremo] ?? 0;
  const base = detalle.recorrido_m + holguraOrigen + holguraDestino;
  const margen = base * parametros.margen;
  const longitud = redondear(base + margen);

  return {
    conexion_id: conexion.id,
    etiqueta,
    ruta,
    detalle,
    holgura_origen_m: holguraOrigen,
    holgura_destino_m: holguraDestino,
    margen_m: redondear(margen),
    longitud_m: longitud,
    longitud_comercial_m: ajustarALongitudComercial(
      longitud,
      articulo?.longitudes_comerciales_m,
    ),
    manual: false,
  };
}

export interface LineaMaterialCable {
  articulo_id: string | null;
  descripcion: string;
  unidad: 'ud' | 'm';
  /** Metros totales si es cable a granel, unidades si son latiguillos. */
  cantidad: number;
  /** Nº de tiradas que agrupa esta línea. */
  tiradas: number;
  /** Bobinas o latiguillos a pedir. */
  a_pedir: string;
  coste_estimado: number | null;
}

/**
 * Agrupa los resultados en líneas de material listas para comprar.
 * Cable a granel → metros totales y bobinas. Latiguillos → unidades por longitud.
 */
export function agruparMaterialCable(
  resultados: ResultadoCable[],
  conexiones: Conexion[],
  articulos: Map<string, Articulo>,
): LineaMaterialCable[] {
  const porConexion = new Map(conexiones.map((c) => [c.id, c]));
  const granel = new Map<string, { metros: number; tiradas: number }>();
  const latiguillos = new Map<string, { unidades: number; longitud: number }>();
  const sinArticulo: LineaMaterialCable[] = [];

  for (const r of resultados) {
    const conexion = porConexion.get(r.conexion_id);
    const articulo = conexion?.articulo_cable_id
      ? articulos.get(conexion.articulo_cable_id)
      : undefined;

    if (!articulo) {
      sinArticulo.push({
        articulo_id: null,
        descripcion: `Sin cable asignado · ${r.etiqueta}`,
        unidad: 'm',
        cantidad: r.longitud_m,
        tiradas: 1,
        a_pedir: 'Asignar cable en la conexión',
        coste_estimado: null,
      });
      continue;
    }

    if (r.longitud_comercial_m != null) {
      const clave = `${articulo.id}|${r.longitud_comercial_m}`;
      const actual = latiguillos.get(clave) ?? {
        unidades: 0,
        longitud: r.longitud_comercial_m,
      };
      actual.unidades += 1;
      latiguillos.set(clave, actual);
    } else {
      const actual = granel.get(articulo.id) ?? { metros: 0, tiradas: 0 };
      actual.metros += r.longitud_m;
      actual.tiradas += 1;
      granel.set(articulo.id, actual);
    }
  }

  const lineas: LineaMaterialCable[] = [];

  for (const [articuloId, { metros, tiradas }] of granel) {
    const articulo = articulos.get(articuloId)!;
    const total = redondear(metros);
    const bobinas = articulo.bobina_m ? Math.ceil(total / articulo.bobina_m) : null;
    lineas.push({
      articulo_id: articuloId,
      descripcion: `${articulo.marca ?? ''} ${articulo.modelo}`.trim(),
      unidad: 'm',
      cantidad: total,
      tiradas,
      a_pedir: bobinas
        ? `${bobinas} bobina${bobinas > 1 ? 's' : ''} de ${articulo.bobina_m} m`
        : `${total} m`,
      coste_estimado: articulo.coste != null ? redondear(articulo.coste * total) : null,
    });
  }

  for (const [clave, { unidades, longitud }] of latiguillos) {
    const articuloId = clave.split('|')[0];
    const articulo = articulos.get(articuloId)!;
    lineas.push({
      articulo_id: articuloId,
      descripcion: `${articulo.marca ?? ''} ${articulo.modelo} · ${longitud} m`.trim(),
      unidad: 'ud',
      cantidad: unidades,
      tiradas: unidades,
      a_pedir: `${unidades} ud de ${longitud} m`,
      coste_estimado: articulo.coste != null ? redondear(articulo.coste * unidades) : null,
    });
  }

  return [...lineas, ...sinArticulo].sort((a, b) =>
    a.descripcion.localeCompare(b.descripcion, 'es'),
  );
}

export interface DimensionCanalizacion {
  cables_previstos: number;
  cables_con_reserva: number;
  seccion_cables_mm2: number;
  seccion_minima_canaleta_mm2: number;
  sugerencia: string;
}

/**
 * Dimensiona la canaleta o el tubo para que quepan los cables previstos más las
 * reservas que pide el departamento (por defecto 3 cables en total).
 */
export function dimensionarCanalizacion(
  diametrosMm: number[],
  parametros: ParametrosCable = PARAMETROS_POR_DEFECTO,
): DimensionCanalizacion {
  const previstos = diametrosMm.length;
  const reserva = Math.max(0, parametros.cables_por_canalizacion - previstos);
  // Las reservas son un RJ45 (~6 mm) y un HDMI (~7,5 mm) salvo que se diga otra cosa.
  const diametrosReserva = [6, 7.5].slice(0, reserva);
  const todos = [...diametrosMm, ...diametrosReserva];
  const seccion = todos.reduce((acc, d) => acc + Math.PI * (d / 2) ** 2, 0);
  const minima = seccion / parametros.ocupacion_maxima_canaleta;

  const catalogo: Array<[string, number]> = [
    ['16 × 16 mm', 256],
    ['20 × 12,5 mm', 250],
    ['25 × 16 mm', 400],
    ['30 × 20 mm', 600],
    ['40 × 25 mm', 1000],
    ['60 × 40 mm', 2400],
    ['100 × 50 mm', 5000],
  ];
  const encaja = catalogo.find(([, area]) => area >= minima);

  return {
    cables_previstos: previstos,
    cables_con_reserva: todos.length,
    seccion_cables_mm2: redondear(seccion),
    seccion_minima_canaleta_mm2: redondear(minima),
    sugerencia: encaja
      ? `Canaleta ${encaja[0]} o superior`
      : 'Por encima de 100 × 50 mm: usar bandeja',
  };
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
