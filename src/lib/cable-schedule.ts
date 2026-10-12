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
  PARAMETROS_POR_DEFECTO,
} from './tipos';
import { resolverLadoConexion } from './extremos-conexion';
import { estadoComercialCable, type CableSuministrado, type SuministroSala } from './suministros';

/**
 * Orden determinista de las conexiones de una sala.
 *
 * Orden de presentación. El backfill histórico usa este mismo desempate;
 * la brida de las conexiones guardadas ya no depende del orden de la lista.
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
 * Algoritmo histórico congelado, exclusivo del backfill y sus verificaciones.
 * Identificador correlativo por tipo de señal: `HD-1000`, `HD-1001`, `RED-1000`.
 * Los prefijos están en `PREFIJO_CABLE` (src/lib/tipos.ts), que es su único sitio.
 */
export function identificadoresHistoricosDeCable(conexiones: Conexion[]): Map<string, string> {
  const siguiente = new Map<Senal, number>();
  const ids = new Map<string, string>();
  for (const c of ordenarConexiones(conexiones)) {
    const n = siguiente.get(c.senal) ?? PRIMER_CORRELATIVO_CABLE;
    siguiente.set(c.senal, n + 1);
    ids.set(c.id, `${PREFIJO_CABLE[c.senal]}-${n}`);
  }
  return ids;
}

/** Solo para lectores de filas persistidas: nunca reconstruir una brida ausente. */
export function exigirEtiquetaCable(etiqueta: unknown, id: unknown): string {
  if (typeof etiqueta !== 'string' || !etiqueta.trim()) {
    throw new Error(`La conexión ${String(id)} no tiene etiqueta de cable. Aplica la migración de etiquetas antes de leer la sala.`);
  }
  return etiqueta;
}

/** El navegador presenta la asignación confirmada; las altas aún no tienen brida. */
export function identificadoresDeCable(conexiones: Conexion[]): Map<string, string> {
  return new Map(conexiones.map((c) => [c.id, c.etiqueta_cable ?? 'Pendiente de guardar']));
}

/**
 * Avisos de compatibilidad. Avisan, no bloquean: el técnico puede tener un
 * motivo para conectar algo raro (un adaptador por medio, un puerto mal
 * serigrafiado), y una aplicación que se lo impida acaba siendo un estorbo.
 */
export function avisosDeConexion(
  conexion: Pick<Conexion, 'senal'>,
  puertoOrigen: Pick<Puerto, 'senal' | 'sentido'> | undefined,
  puertoDestino: Pick<Puerto, 'senal' | 'sentido'> | undefined,
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
  /** Metros a cortar o pedir. Nulo mientras falten datos para calcular. */
  metros: number | null;
  /** Diagnóstico del cálculo, separado de los avisos de compatibilidad. */
  motivo_calculo_pendiente?: string;
  recorrido_m: number | null;
  holgura_origen_m: number | null;
  holgura_destino_m: number | null;
  margen_m: number | null;
  manual: boolean;
  articulo_cable: string | null;
  longitud_comercial_m: number | null;
  estado_suministro?: 'incluido' | 'adicional' | 'por_determinar';
  longitud_utilizable_m?: number | null;
  etiqueta_suministro?: string | null;
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
  avisosCalculo?: Map<string, string[]>;
  cables?: CableSuministrado[];
  suministros?: SuministroSala[];
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
  const cables = new Map((entrada.cables ?? []).map((k) => [k.id, k]));
  const sku = new Map((entrada.suministros ?? []).map((s) => [s.id, s.snapshot.sku]));

  return ordenarConexiones(conexiones).map((c) => {
    const origen = resolverLadoConexion(c, 'origen', equipos, { tomas, puertos }, PARAMETROS_POR_DEFECTO);
    const destino = resolverLadoConexion(c, 'destino', equipos, { tomas, puertos }, PARAMETROS_POR_DEFECTO);
    const pOrigen = origen?.senal && origen.sentido ? { senal: origen.senal, sentido: origen.sentido } : undefined;
    const pDestino = destino?.senal && destino.sentido ? { senal: destino.senal, sentido: destino.sentido } : undefined;
    const cable = c.articulo_cable_id ? articulos.get(c.articulo_cable_id) : undefined;
    const r = resultados.get(c.id);
    const estado = estadoComercialCable(c.estado_suministro);
    const fisico = c.cable_suministrado_id ? cables.get(c.cable_suministrado_id) : undefined;
    const avisosSuministro: string[] = [];
    if (estado === 'por_determinar') avisosSuministro.push('Suministro del cable por determinar');
    if (estado === 'incluido' && (fisico?.longitud_utilizable_m == null)) avisosSuministro.push('Longitud suministrada pendiente');
    if (estado === 'incluido' && fisico?.longitud_utilizable_m != null && r && fisico.longitud_utilizable_m + 1e-9 < r.longitud_m) {
      avisosSuministro.push(`Cable incluido de ${fisico.longitud_utilizable_m} m insuficiente para ${r.longitud_m} m`);
    }

    return {
      identificador: identificadores.get(c.id) ?? '—',
      conexion_id: c.id,
      origen: origen?.nombre ?? '—',
      puerto_origen: origen?.boca ?? null,
      conector_origen: origen?.conector ?? null,
      destino: destino?.nombre ?? '—',
      puerto_destino: destino?.boca ?? null,
      conector_destino: destino?.conector ?? null,
      toma_red: describirTomas(
        origen?.toma ?? undefined,
        destino?.toma ?? undefined,
      ),
      senal: c.senal,
      ruta: r?.ruta ?? c.ruta,
      metros: r?.longitud_m ?? null,
      motivo_calculo_pendiente: !r ? entrada.avisosCalculo?.get(c.id)?.join(' ') || undefined : undefined,
      recorrido_m: r?.detalle.recorrido_m ?? null,
      holgura_origen_m: r?.holgura_origen_m ?? null,
      holgura_destino_m: r?.holgura_destino_m ?? null,
      margen_m: r?.margen_m ?? null,
      manual: r?.manual ?? false,
      articulo_cable: cable ? `${cable.marca ?? ''} ${cable.modelo}`.trim() : null,
      longitud_comercial_m: r?.longitud_comercial_m ?? null,
      estado_suministro: estado,
      longitud_utilizable_m: fisico?.longitud_utilizable_m ?? null,
      etiqueta_suministro: estado === 'incluido' && fisico
        ? `Incluido en ${sku.get(fisico.suministro_id) ?? 'suministro'}`
        : estado === 'adicional' ? 'Adicional' : estado === 'por_determinar' ? 'Por determinar' : null,
      avisos: [...avisosDeConexion(c, pOrigen, pDestino, cable), ...(entrada.avisosCalculo?.get(c.id) ?? []), ...avisosSuministro],
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
  'estado_suministro',
  'longitud_utilizable_m',
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
  const celda = (v: string | number | null | undefined): string => {
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
      f.estado_suministro,
      f.longitud_utilizable_m,
      f.avisos.join(' | ') || null,
    ]
      .map(celda)
      .join(';'),
  );

  return [CABECERAS_CSV.join(';'), ...lineas].join('\r\n');
}
