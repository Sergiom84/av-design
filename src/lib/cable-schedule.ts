/**
 * Tabla de cables (cable schedule): el entregable que se lleva el técnico a obra.
 *
 * Es lógica pura, como `calculo-cable.ts`: entra el diseño de la sala, sale la
 * tabla. Aquí NO se calcula ni un metro. Los metros los da `calcularConexion()`,
 * que está probado y congelado; esta capa solo los presenta junto a los puertos,
 * el identificador y los avisos.
 *
 * El hueco que rellena: XTEN-AV genera la misma tabla, pero su columna de
 * longitud o está vacía o trae una constante de plantilla (6, 20 o 50 pies,
 * iguales en una sala de 3 metros y en una de 15). Ver docs/06, apartado 6.
 */

import type { ResultadoCable } from './calculo-cable';
import {
  Articulo,
  Conexion,
  EquipoEnSala,
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  PREFIJO_CABLE,
  PRIMER_CORRELATIVO_CABLE,
  Puerto,
  Ruta,
  Senal,
  TomaRed,
} from './tipos';

/**
 * Orden determinista de las conexiones de una sala.
 *
 * De aquí sale el correlativo del identificador, así que tiene que ser estable:
 * una tirada ya etiquetada en obra no puede cambiar de número porque se dé de
 * alta otra. Se ordena por fecha de alta y se desempata por id; ambos son
 * inmutables, y una conexión nueva siempre cae al final de su serie.
 */
export function ordenarConexiones(conexiones: Conexion[]): Conexion[] {
  return [...conexiones].sort((a, b) => {
    const fa = a.creado_en ?? '';
    const fb = b.creado_en ?? '';
    if (fa !== fb) return fa < fb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Identificador correlativo por tipo de señal: `HD-1000`, `HD-1001`, `RED-1000`.
 * Los prefijos están en `PREFIJO_CABLE` (src/lib/tipos.ts), que es su único sitio.
 */
export function identificadoresDeCable(conexiones: Conexion[]): Map<string, string> {
  const siguiente = new Map<Senal, number>();
  const ids = new Map<string, string>();
  for (const c of ordenarConexiones(conexiones)) {
    const n = siguiente.get(c.senal) ?? PRIMER_CORRELATIVO_CABLE;
    siguiente.set(c.senal, n + 1);
    ids.set(c.id, `${PREFIJO_CABLE[c.senal]}-${n}`);
  }
  return ids;
}

/**
 * Avisos de compatibilidad. Avisan, no bloquean: el técnico puede tener un
 * motivo para conectar algo raro (un adaptador por medio, un puerto mal
 * serigrafiado), y una aplicación que se lo impida acaba siendo un estorbo.
 */
export function avisosDeConexion(
  conexion: Pick<Conexion, 'senal'>,
  puertoOrigen: Puerto | undefined,
  puertoDestino: Puerto | undefined,
  /** Solo interesa su señal, así que vale cualquier cosa que la tenga. */
  cable: { senal: Senal | null } | undefined,
): string[] {
  const avisos: string[] = [];

  if (puertoOrigen && puertoDestino) {
    if (puertoOrigen.senal !== puertoDestino.senal) {
      avisos.push(
        `Señales distintas: ${ETIQUETA_SENAL[puertoOrigen.senal]} en origen y ` +
          `${ETIQUETA_SENAL[puertoDestino.senal]} en destino.`,
      );
    }
    // `bidireccional` y `control` valen en los dos sentidos, así que no se miran.
    if (puertoOrigen.sentido === 'salida' && puertoDestino.sentido === 'salida') {
      avisos.push('Salida contra salida: ninguno de los dos extremos recibe.');
    }
    if (puertoOrigen.sentido === 'entrada' && puertoDestino.sentido === 'entrada') {
      avisos.push('Entrada contra entrada: ninguno de los dos extremos emite.');
    }
    if (puertoOrigen.sentido === 'entrada' && puertoDestino.sentido === 'salida') {
      avisos.push('El cable va de una entrada a una salida: revisa si están del revés.');
    }
  }

  const senalPuerto = puertoOrigen?.senal ?? puertoDestino?.senal;
  if (senalPuerto && senalPuerto !== conexion.senal) {
    avisos.push(
      `La conexión está marcada como ${ETIQUETA_SENAL[conexion.senal]} y el puerto es ` +
        `${ETIQUETA_SENAL[senalPuerto]}.`,
    );
  }

  if (cable?.senal && senalPuerto && cable.senal !== senalPuerto) {
    avisos.push(
      `El cable elegido es de ${ETIQUETA_SENAL[cable.senal]} y el puerto es ` +
        `${ETIQUETA_SENAL[senalPuerto]}.`,
    );
  }

  return avisos;
}

export interface FilaCable {
  /** `HD-1000`. Lo que se escribe en la brida. */
  identificador: string;
  conexion_id: string;
  origen: string;
  puerto_origen: string | null;
  conector_origen: string | null;
  destino: string;
  puerto_destino: string | null;
  conector_destino: string | null;
  /** Roseta del edificio donde pincha alguno de los dos extremos, si la hay. */
  toma_red: string | null;
  senal: Senal;
  ruta: Ruta | null;
  /** Metros a cortar o pedir. Nulo si la sala no tiene medidas y no hay cálculo. */
  metros: number | null;
  recorrido_m: number | null;
  holgura_origen_m: number | null;
  holgura_destino_m: number | null;
  margen_m: number | null;
  manual: boolean;
  articulo_cable: string | null;
  longitud_comercial_m: number | null;
  avisos: string[];
}

export interface EntradaTablaCables {
  conexiones: Conexion[];
  equipos: Map<string, EquipoEnSala>;
  tomas: Map<string, TomaRed>;
  puertos: Map<string, Puerto>;
  articulos: Map<string, Articulo>;
  /** Lo que ha devuelto `calcularConexion()`, indexado por conexión. */
  resultados: Map<string, ResultadoCable>;
}

/** Cómo se lee la roseta en la tabla cuando la tienen los dos extremos. */
function describirTomas(
  origen: TomaRed | undefined,
  destino: TomaRed | undefined,
): string | null {
  const partes: string[] = [];
  if (origen) partes.push(`${origen.codigo} (origen)`);
  if (destino) partes.push(`${destino.codigo} (destino)`);
  return partes.length ? partes.join(' · ') : null;
}

export function construirTablaCables(entrada: EntradaTablaCables): FilaCable[] {
  const { conexiones, equipos, tomas, puertos, articulos, resultados } = entrada;
  const identificadores = identificadoresDeCable(conexiones);

  return ordenarConexiones(conexiones).map((c) => {
    const origen = equipos.get(c.origen_id);
    const destino = equipos.get(c.destino_id);
    const pOrigen = c.puerto_origen_id ? puertos.get(c.puerto_origen_id) : undefined;
    const pDestino = c.puerto_destino_id ? puertos.get(c.puerto_destino_id) : undefined;
    const cable = c.articulo_cable_id ? articulos.get(c.articulo_cable_id) : undefined;
    const r = resultados.get(c.id);

    return {
      identificador: identificadores.get(c.id) ?? '—',
      conexion_id: c.id,
      origen: origen?.nombre ?? '—',
      puerto_origen: pOrigen
        ? `${pOrigen.nombre}${c.puerto_origen_ordinal != null && pOrigen.total > 1 ? ` ${c.puerto_origen_ordinal}` : ''}`
        : null,
      conector_origen: pOrigen?.conector ?? null,
      destino: destino?.nombre ?? '—',
      puerto_destino: pDestino
        ? `${pDestino.nombre}${c.puerto_destino_ordinal != null && pDestino.total > 1 ? ` ${c.puerto_destino_ordinal}` : ''}`
        : null,
      conector_destino: pDestino?.conector ?? null,
      toma_red: describirTomas(
        origen?.toma_red_id ? tomas.get(origen.toma_red_id) : undefined,
        destino?.toma_red_id ? tomas.get(destino.toma_red_id) : undefined,
      ),
      senal: c.senal,
      ruta: r?.ruta ?? c.ruta,
      metros: r?.longitud_m ?? null,
      recorrido_m: r?.detalle.recorrido_m ?? null,
      holgura_origen_m: r?.holgura_origen_m ?? null,
      holgura_destino_m: r?.holgura_destino_m ?? null,
      margen_m: r?.margen_m ?? null,
      manual: r?.manual ?? false,
      articulo_cable: cable ? `${cable.marca ?? ''} ${cable.modelo}`.trim() : null,
      longitud_comercial_m: r?.longitud_comercial_m ?? null,
      avisos: avisosDeConexion(c, pOrigen, pDestino, cable),
    };
  });
}

const CABECERAS_CSV = [
  'id_cable',
  'equipo_origen',
  'puerto_origen',
  'conector_origen',
  'equipo_destino',
  'puerto_destino',
  'conector_destino',
  'toma_red',
  'senal',
  'ruta',
  'metros',
  'recorrido_m',
  'holgura_origen_m',
  'holgura_destino_m',
  'margen_m',
  'articulo_cable',
  'longitud_comercial_m',
  'avisos',
] as const;

/**
 * La tabla en CSV, para abrirla en Excel.
 *
 * Separador `;` como el resto de CSV del proyecto, y decimales con coma: este
 * fichero se abre en el Excel del departamento, que está en español, y con
 * punto decimal los metros llegarían como texto y no se podrían sumar.
 */
export function tablaCablesACsv(filas: FilaCable[]): string {
  const celda = (v: string | number | null): string => {
    if (v == null) return '';
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lineas = filas.map((f) =>
    [
      f.identificador,
      f.origen,
      f.puerto_origen,
      f.conector_origen,
      f.destino,
      f.puerto_destino,
      f.conector_destino,
      f.toma_red,
      ETIQUETA_SENAL[f.senal],
      f.ruta ? ETIQUETA_RUTA[f.ruta] : null,
      f.metros,
      f.recorrido_m,
      f.holgura_origen_m,
      f.holgura_destino_m,
      f.margen_m,
      f.articulo_cable,
      f.longitud_comercial_m,
      f.avisos.join(' | ') || null,
    ]
      .map(celda)
      .join(';'),
  );

  return [CABECERAS_CSV.join(';'), ...lineas].join('\r\n');
}
