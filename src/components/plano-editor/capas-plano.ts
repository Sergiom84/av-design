/**
 * Qué capas del plano se están mirando.
 *
 * Una sala con catorce sillas y cuatro equipos es ilegible cuando se está
 * colocando la pantalla, y al revés: para repartir el mobiliario estorban las
 * tiradas de cable. Por eso Mobiliario y Equipamiento se apagan por separado.
 *
 * Lo importante es lo que esto NO es. Las capas son estado de interfaz y viven
 * fuera de `BorradorPlano`: apagar una capa no ensucia el borrador, no entra
 * en `PatchPlano`, no toca el historial de deshacer y no borra nada. Si las
 * capas vivieran en el borrador, ocultar el mobiliario marcaría la pestaña
 * como «sin guardar» y el siguiente guardado escribiría una decisión de vista
 * como si fuera una medida de la sala.
 *
 * El filtro se aplica sobre la escena ya construida —lo que se pinta— y no
 * sobre los datos de entrada. Así el croquis, el cálculo de cable, la lista de
 * material y lo que se guarda siguen viendo la sala entera, esté mirándose lo
 * que se esté mirando.
 */

import type { EscenaCroquis } from '@/lib/croquis';
import type { Seleccion } from '@/lib/plano-editor';

/** Las dos capas que se pueden apagar. La sala y la mesa no son una capa. */
export type CapaPlano = 'mobiliario' | 'equipamiento';

export const CAPAS: readonly CapaPlano[] = ['mobiliario', 'equipamiento'];

export const ETIQUETA_CAPA: Record<CapaPlano, string> = {
  mobiliario: 'Mobiliario',
  equipamiento: 'Equipamiento',
};

export type CapasPlano = Record<CapaPlano, boolean>;

/** Al entrar se ve todo. Un plano que abre a medias esconde trabajo hecho. */
export const CAPAS_INICIALES: CapasPlano = { mobiliario: true, equipamiento: true };

export function alternarCapa(capas: CapasPlano, capa: CapaPlano): CapasPlano {
  return { ...capas, [capa]: !capas[capa] };
}

/**
 * Las cotas que sólo tienen sentido con el equipamiento a la vista.
 *
 * `pantalla_caja` mide de la pared de la pantalla a la caja de conexiones
 * (`cotasDeLaEscena`, en `src/lib/croquis.ts`). Con el equipamiento apagado
 * los dos extremos desaparecen y la cota se queda flotando entre dos sitios
 * vacíos, midiendo algo que no se ve. Las de la sala y las de la mesa se
 * quedan siempre: miden la sala, no lo que hay dentro.
 */
const COTAS_DE_EQUIPAMIENTO: ReadonlySet<string> = new Set(['pantalla_caja']);

/**
 * Las anotaciones que hablan de un equipo concreto.
 *
 * «SAMSUNG QB65R-B a 74 cm del suelo» describe algo que con la capa apagada no
 * se ve. Se reconocen por el prefijo de su `clave`, no por el texto: comparar
 * cadenas de interfaz para decidir qué se oculta es exactamente lo que deja de
 * funcionar el día que alguien corrige una palabra.
 *
 * Hoy el editor todavía no pinta las anotaciones —solo lo hace la tarjeta de
 * Resumen, que no filtra por capas—, así que esto no arregla ninguna fuga
 * visible: deja el contrato bien para cuando las acotaciones y las puertas sí
 * las pinten.
 */
const PREFIJO_ANOTACION_EQUIPO = 'equipo_';

/** A qué capa pertenece lo que está seleccionado. La sala y la mesa, a ninguna. */
export function capaDeSeleccion(seleccion: Seleccion): CapaPlano | null {
  if (seleccion === null) return null;
  switch (seleccion.tipo) {
    case 'mueble':
      return 'mobiliario';
    case 'equipo':
    case 'toma':
      return 'equipamiento';
    default:
      return null;
  }
}

/** Si lo seleccionado está escondido ahora mismo por una capa apagada. */
export function seleccionOculta(seleccion: Seleccion, capas: CapasPlano): boolean {
  const capa = capaDeSeleccion(seleccion);
  return capa !== null && !capas[capa];
}

/**
 * La escena recortada a lo que se está mirando.
 *
 * Con las dos capas encendidas devuelve **la misma referencia**, no una copia:
 * el caso normal no paga nada y `useMemo` aguas abajo no se invalida.
 *
 * Las sillas van con el mobiliario aunque vengan del aforo: quien apaga
 * Mobiliario quiere ver la sala sin sillas, y le da igual de qué fuente salen.
 * Las tiradas van con el equipamiento porque unen equipos: dejarlas dibujadas
 * sin sus extremos serían líneas que no van a ningún sitio.
 */
export function escenaVisible(escena: EscenaCroquis, capas: CapasPlano): EscenaCroquis {
  if (capas.mobiliario && capas.equipamiento) return escena;

  return {
    ...escena,
    muebles: capas.mobiliario ? escena.muebles : [],
    sillas: capas.mobiliario ? escena.sillas : [],
    equipos: capas.equipamiento ? escena.equipos : [],
    tomas: capas.equipamiento ? escena.tomas : [],
    tiradas: capas.equipamiento ? escena.tiradas : [],
    cotas: capas.equipamiento
      ? escena.cotas
      : escena.cotas.filter((c) => !COTAS_DE_EQUIPAMIENTO.has(c.clave)),
    anotaciones: capas.equipamiento
      ? escena.anotaciones
      : escena.anotaciones.filter((a) => !a.clave.startsWith(PREFIJO_ANOTACION_EQUIPO)),
  };
}
