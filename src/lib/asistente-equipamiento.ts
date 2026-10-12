import type { DatoTecnico } from './ficha-tecnica';
import type { EquipoEnSala, Puerto } from './tipos';

export type ReferenciaAsistente = { marca: string | null; modelo: string; categoria: string };
export type CatalogoAsistente = Map<string, ReferenciaAsistente>;
export type SeleccionAsistente = {
  articulo_id: string | null;
  nombre: string;
  cantidad: number;
  referencia?: ReferenciaAsistente;
  /**
   * Identidad de la fila instalada en la sala, cuando la hay.
   *
   * El aviso de videoconferencia duplicada tiene que llevar al equipo concreto
   * que ya está puesto, no a su referencia de catálogo: dos unidades del mismo
   * modelo comparten artículo y son dos montajes distintos.
   */
  equipo_id?: string | null;
};
export const FUENTE_EQ = 'https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html';
export const FUENTE_BAR_PRO = 'https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/room-bar-pro-ds.html';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
const CATEGORIAS_VIDEO = new Set(['VIDEOCONFERENCIA', 'BARRA VIDEOCONFERENCIA', 'BARRA DE VIDEOCONFERENCIA', 'CODEC']);
const CATEGORIAS_MICRO = new Set(['MICROFONO', 'MICROFONO MESA', 'MICROFONO DE MESA', 'MICROFONO TECHO', 'MICROFONO DE TECHO', 'MICRO BEAMTRACKING', 'MICROFONIA']);

export function funcionEquipo(referencia?: ReferenciaAsistente) {
  const categoria = normalizar(referencia?.categoria ?? '');
  if (CATEGORIAS_VIDEO.has(categoria)) return 'videoconferencia';
  if (CATEGORIAS_MICRO.has(categoria)) return 'microfono';
  return categoria ? 'otro' : 'desconocido';
}

/**
 * Captación de voz de la reunión, no seguimiento de cámara ni control de micros.
 * `funcionEquipo` sigue clasificando el beamtracking como micrófono: no cuenta aquí.
 */
export function esMicrofonoDeVoz(referencia?: ReferenciaAsistente): boolean {
  if (funcionEquipo(referencia) !== 'microfono') return false;
  const categoria = normalizar(referencia?.categoria ?? '');
  const modelo = normalizar(referencia?.modelo ?? '');
  if (categoria === 'MICRO BEAMTRACKING') return false;
  if (modelo.includes('QUAD CAMERA') || /(^| )QUADCAM( |$)/.test(modelo)) return false;
  return true;
}

/** Identidad exacta de modelo: EQX, KIT y nombres abreviados no son un codec. */
export function perfilEquipo(referencia?: ReferenciaAsistente): {
  microfono: 'integrado' | 'externo' | 'desconocido'; fuente?: string; nota?: string; eq?: boolean;
} {
  const marca = normalizar(referencia?.marca ?? '');
  if (marca && marca !== 'CISCO') return { microfono: 'desconocido' };
  const modelo = normalizar(referencia?.modelo ?? '');
  if (modelo === 'ROOM BAR PRO') {
    return { microfono: 'integrado', fuente: FUENTE_BAR_PRO, nota: 'Micrófono integrado. Revisar cobertura según la sala.' };
  }
  if (['CODEC EQ', 'CS-CODEC-EQ-K9'].includes(modelo)) {
    return { microfono: 'externo', fuente: FUENTE_EQ, eq: true, nota: 'Codec EQ: requiere captación de voz externa.' };
  }
  if (['ROOM KIT EQ', 'CISCO ROOM KIT EQ'].includes(modelo)) {
    return { microfono: 'externo', fuente: FUENTE_EQ, eq: true, nota: 'Puertos del Codec EQ incluido; cámara/control se documentan aparte. Los micros de Quad Camera son para seguimiento. Confirmar los micrófonos de voz incluidos y el montaje real.' };
  }
  if (['EQ', 'WEBEX ROOM EQ', 'WEBEX ROOM EQ QUADCAM'].includes(modelo)) {
    return { microfono: 'desconocido', fuente: FUENTE_EQ, eq: true, nota: 'Referencia de inventario ambigua: confirmar si es codec o kit. Los datos del Codec EQ no se asignan a esta referencia.' };
  }
  return { microfono: 'desconocido' };
}

export type ProcedenciaDato = 'verificado' | 'parcial' | 'sin_documentar';

export interface CaptacionVoz {
  /** Qué se sabe, no qué se supone. */
  captacion: 'integrada' | 'externa' | 'desconocida';
  /**
   * De dónde sale la afirmación. Un reconocimiento por nombre de modelo nunca
   * llega a `verificado`: eso lo acredita un hecho documentado de la ficha.
   */
  procedencia: ProcedenciaDato;
  fuente?: string;
  nota?: string;
  /** Restricciones documentadas (distancia, acústica). No son compatibilidad. */
  restricciones: string[];
}

/**
 * Captación de voz de un equipo: hecho documentado primero, perfil por modelo
 * después, y nada en tercer lugar.
 *
 * **La ausencia de datos no es compatibilidad.** Sin hecho ni perfil el
 * resultado es `desconocida` / `sin_documentar`, que no significa que el equipo
 * no necesite micrófono: significa que nadie lo ha comprobado. Y un hecho
 * guardado explícitamente como `sin_documentar` gana al reconocimiento por
 * nombre: es una declaración deliberada de que esa identidad está pendiente.
 */
export function captacionDeVoz(referencia?: ReferenciaAsistente, hechos: DatoTecnico[] = []): CaptacionVoz {
  const restricciones = hechos
    .filter((h) => h.tipo === 'restriccion' && h.valor !== null && h.estado !== 'sin_documentar')
    .map((h) => (h.valor as { texto: string }).texto);
  const microfonia = hechos.filter((h) => h.tipo === 'microfonia');
  const documentado = microfonia.find((h) => h.valor !== null && h.estado !== 'sin_documentar');
  if (documentado && documentado.valor) {
    const captacion = (documentado.valor as { captacion: 'integrada' | 'externa' | 'desconocida' }).captacion;
    return {
      captacion,
      procedencia: documentado.estado,
      fuente: documentado.fuente_url ?? undefined,
      nota: documentado.concepto,
      restricciones,
    };
  }
  if (microfonia.length > 0) {
    return {
      captacion: 'desconocida',
      procedencia: 'sin_documentar',
      nota: 'La ficha declara la captación de voz como sin documentar. No se hereda el perfil por nombre de modelo.',
      restricciones,
    };
  }
  const perfil = perfilEquipo(referencia);
  if (perfil.microfono === 'desconocido') {
    return { captacion: 'desconocida', procedencia: 'sin_documentar', fuente: perfil.fuente, nota: perfil.nota, restricciones };
  }
  // Reconocimiento por modelo exacto con enlace oficial: es parcial, no verificado.
  return {
    captacion: perfil.microfono === 'integrado' ? 'integrada' : 'externa',
    procedencia: 'parcial',
    fuente: perfil.fuente,
    nota: perfil.nota,
    restricciones,
  };
}

export function seleccionDeSala(equipos: EquipoEnSala[], catalogo: CatalogoAsistente): SeleccionAsistente[] {
  return equipos.map((e) => ({ articulo_id: e.articulo_id, nombre: e.nombre, cantidad: e.cantidad, equipo_id: e.id,
    referencia: e.articulo_id ? catalogo.get(e.articulo_id) : undefined }));
}

export interface AvisoSeleccion {
  /** Estable: se puede enlazar, comparar y probar sin depender del texto. */
  clave: string;
  mensaje: string;
  /** El equipo ya puesto en la sala al que lleva el aviso, cuando lo hay. */
  elemento?: { equipo_id?: string | null; articulo_id?: string | null; nombre: string };
  accion?: string;
  procedencia?: ProcedenciaDato;
}

/**
 * Los avisos de la selección, con causa, elemento y acción.
 *
 * Avisa, no bloquea: el proyecto entero funciona así. Un montaje con dos
 * sistemas de videoconferencia puede ser deliberado, y una incompatibilidad
 * puede resolverse con un adaptador. Lo que no se hace es dar por buena una
 * hipótesis: la falta de ficha se dice, no se calla.
 */
export function revisarSeleccion(
  equipos: SeleccionAsistente[],
  candidato?: SeleccionAsistente,
  hechos: Map<string, DatoTecnico[]> = new Map(),
): AvisoSeleccion[] {
  const actuales = equipos.filter((e) => e.cantidad > 0);
  const lista = candidato ? [...actuales, candidato] : actuales;
  const avisos: AvisoSeleccion[] = [];
  const hechosDe = (e: SeleccionAsistente) => (e.articulo_id ? hechos.get(e.articulo_id) ?? [] : []);
  const videoActual = actuales.filter((e) => funcionEquipo(e.referencia) === 'videoconferencia');
  const duplicado = Boolean(candidato && funcionEquipo(candidato.referencia) === 'videoconferencia' && videoActual.length);
  if (duplicado) {
    const ya = videoActual[0];
    avisos.push({
      clave: 'videoconferencia_duplicada',
      mensaje: 'Ya hay videoconferencia en la sala. Puedes añadir otra si el montaje lo requiere.',
      elemento: { equipo_id: ya.equipo_id, articulo_id: ya.articulo_id, nombre: ya.nombre },
      accion: 'Revisar el equipo ya seleccionado',
    });
  }
  const repetidos = new Map<string, number>();
  for (const e of lista) if (e.articulo_id && funcionEquipo(e.referencia) !== 'videoconferencia') repetidos.set(e.articulo_id, (repetidos.get(e.articulo_id) ?? 0) + e.cantidad);
  if ([...repetidos.values()].some((total) => total > 1)) {
    avisos.push({ clave: 'referencias_repetidas', mensaje: 'Hay referencias repetidas. Revisa las cantidades.', accion: 'Ajustar las unidades de la fila repetida' });
  }
  const videos = lista.filter((e) => funcionEquipo(e.referencia) === 'videoconferencia');
  if (!duplicado && videos.reduce((total, e) => total + e.cantidad, 0) > 1) {
    avisos.push({ clave: 'videoconferencia_varias_unidades', mensaje: 'Hay varias unidades de videoconferencia. Revisa su función en el montaje.', accion: 'Confirmar que el montaje lleva varios sistemas' });
  }
  const hayMicro = lista.some((e) => esMicrofonoDeVoz(e.referencia));
  for (const e of videos) {
    const captacion = captacionDeVoz(e.referencia, hechosDe(e));
    if (!hayMicro && captacion.captacion === 'externa') {
      avisos.push({
        clave: `captacion_ausente:${e.equipo_id ?? e.articulo_id ?? e.nombre}`,
        mensaje: `${e.nombre}: falta micrófono de voz en la selección. Confirma si el suministro lo incluye.`,
        elemento: { equipo_id: e.equipo_id, articulo_id: e.articulo_id, nombre: e.nombre },
        accion: 'Añadir un micrófono o acreditar el suministro del kit',
        procedencia: captacion.procedencia,
      });
    }
    if (captacion.captacion === 'desconocida') {
      avisos.push({
        clave: `captacion_desconocida:${e.equipo_id ?? e.articulo_id ?? e.nombre}`,
        mensaje: `${e.nombre}: micrófono integrado desconocido. ${hayMicro ? 'Verifica la conexión del micrófono seleccionado.' : 'Confirma la captación de voz.'}`,
        elemento: { equipo_id: e.equipo_id, articulo_id: e.articulo_id, nombre: e.nombre },
        accion: 'Documentar la captación en la ficha del artículo',
        procedencia: 'sin_documentar',
      });
    }
    if (captacion.captacion === 'integrada' && captacion.restricciones.length > 0) {
      avisos.push({
        clave: `captacion_restringida:${e.equipo_id ?? e.articulo_id ?? e.nombre}`,
        mensaje: `${e.nombre}: captación integrada documentada con límites. ${captacion.restricciones.join(' ')}`,
        elemento: { equipo_id: e.equipo_id, articulo_id: e.articulo_id, nombre: e.nombre },
        accion: 'Comprobar la cobertura en esta sala',
        procedencia: captacion.procedencia,
      });
    }
  }
  if (hayMicro && videos.length) {
    avisos.push({ clave: 'microfono_pendiente_de_comprobar', mensaje: 'Hay micrófono seleccionado. Compatibilidad, conexión y cobertura pendientes de comprobar.', accion: 'Comprobar la conexión en el diagrama' });
  }
  if (lista.some((e) => funcionEquipo(e.referencia) === 'desconocido')) {
    avisos.push({ clave: 'sin_categoria', mensaje: 'Hay equipos sin categoría conocida. No se puede determinar su función.', accion: 'Asignar una referencia de catálogo' });
  }
  const vistos = new Set<string>();
  return avisos.filter((a) => (vistos.has(a.mensaje) ? false : vistos.add(a.mensaje)));
}

export function avisosEquipamiento(
  equipos: SeleccionAsistente[],
  candidato?: SeleccionAsistente,
  hechos?: Map<string, DatoTecnico[]>,
): string[] {
  return revisarSeleccion(equipos, candidato, hechos).map((a) => a.mensaje);
}

/** Suma bocas, no filas, sin duplicar una interfaz por sus usos de audio/vídeo. */
export function resumenPuertos(puertos: Puerto[], articuloId: string) {
  const grupos = new Map<string, { sentido: Puerto['sentido']; senal: Puerto['senal']; total: number }>();
  for (const p of puertos.filter((p) => p.articulo_id === articuloId)) {
    const clave = `${p.sentido}:${p.senal}`;
    const grupo = grupos.get(clave) ?? { sentido: p.sentido, senal: p.senal, total: 0 };
    grupo.total += p.total;
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].sort((a, b) => `${a.sentido}:${a.senal}`.localeCompare(`${b.sentido}:${b.senal}`));
}
