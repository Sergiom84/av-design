/**
 * Las operaciones que se pueden hacer sobre lo que está seleccionado, en un
 * solo sitio.
 *
 * El inspector ya sabía girar y quitar. Al añadir el menú contextual del botón
 * derecho aparecía la tentación de que ese menú llamara por su cuenta a
 * `girar()` y a `quitarAlta()`: dos caminos hacia lo mismo que se pueden
 * separar sin que nadie se entere, y entonces girar desde el menú y girar
 * desde propiedades dejan de dar el mismo plano. Aquí hay un único
 * despachador, y los dos recorridos lo llaman.
 *
 * Es lógica pura: entra un borrador y una selección, sale un borrador y una
 * selección. Ni React, ni DOM, ni base de datos. Lo que sí devuelve es si hay
 * que llevar el foco al panel de propiedades, porque eso es una consecuencia
 * de la operación y no una decisión del componente que la pidió.
 *
 * `operacionDisponible` no está para pintar el menú en gris: está para que la
 * operación no se aplique. Ocultar un control no es una guarda, así que
 * `aplicarOperacion` devuelve el borrador intacto cuando la operación no
 * corresponde, y el menú se limita a no ofrecer lo que ya sabe que no hace
 * nada.
 */

import { girar, quitarAlta, type BorradorPlano, type Seleccion } from '@/lib/plano-editor';

export type OperacionPlano =
  /** Marcar el objeto como el seleccionado, sin abrir nada. */
  | { tipo: 'seleccionar' }
  /** Seleccionarlo y llevar el foco a sus propiedades. */
  | { tipo: 'propiedades' }
  | { tipo: 'girar'; grados: number }
  | { tipo: 'eliminar' };

export type ClaseOperacion = OperacionPlano['tipo'];

export const ETIQUETA_OPERACION: Record<ClaseOperacion, string> = {
  seleccionar: 'Seleccionar',
  propiedades: 'Propiedades',
  girar: 'Girar 90°',
  eliminar: 'Quitar del plano',
};

/** Un cuarto de vuelta es lo que se pide desde un menú; el ángulo exacto se teclea en propiedades. */
export const GIRO_RAPIDO_GRADOS = 90;

export interface ResultadoOperacion {
  borrador: BorradorPlano;
  seleccion: Seleccion;
  /** El panel de propiedades tiene que recibir el foco. */
  enfocarPropiedades: boolean;
}

/** El giro actual de lo seleccionado, para poder sumarle un cuarto de vuelta. */
export function giroActual(borrador: BorradorPlano, seleccion: Seleccion): number {
  if (seleccion === null) return 0;
  switch (seleccion.tipo) {
    case 'mesa':
      return borrador.mesa_rotacion_grados;
    case 'equipo':
      return borrador.equipos.find((e) => e.id === seleccion.id)?.rotacion_grados ?? 0;
    case 'mueble':
      return borrador.mobiliario.find((m) => m.id === seleccion.id)?.rotacion_grados ?? 0;
    default:
      return 0;
  }
}

/**
 * Si la operación va a hacer algo de verdad sobre esta selección.
 *
 * Girar: la mesa, un equipo y un mueble giran. La sala no gira, y una roseta
 * cuyo símbolo es un círculo tampoco —un control que no cambia nada deja a
 * quien lo pulsa buscando el cambio.
 *
 * Eliminar: un mueble se quita siempre; un equipo, solo mientras sea un alta
 * sin guardar. Quitar del plano un equipo ya persistido es darlo de baja del
 * material de la sala, y eso se hace desde Equipamiento, no de un clic
 * derecho. Es la regla que ya aplicaba `quitarAlta`; aquí se hace visible en
 * vez de quedar escondida dentro de un `if`.
 */
export function operacionDisponible(
  clase: ClaseOperacion,
  seleccion: Seleccion,
  borrador: BorradorPlano,
): boolean {
  if (seleccion === null) return false;
  switch (clase) {
    case 'seleccionar':
    case 'propiedades':
      return true;
    case 'girar':
      return seleccion.tipo === 'mesa' || seleccion.tipo === 'equipo' || seleccion.tipo === 'mueble';
    case 'eliminar':
      if (seleccion.tipo === 'mueble') {
        return borrador.mobiliario.some((m) => m.id === seleccion.id);
      }
      if (seleccion.tipo === 'equipo') {
        return borrador.equipos.some((e) => e.id === seleccion.id && e.es_nuevo);
      }
      return false;
  }
}

/**
 * El único sitio donde una operación se convierte en un borrador nuevo.
 *
 * Cuando la operación no corresponde devuelve el borrador **por referencia**,
 * no una copia igual: el editor compara por identidad para decidir si hay algo
 * que apilar en el historial, y una copia haría que girar una sala apilara un
 * paso de deshacer que no deshace nada.
 */
export function aplicarOperacion(
  borrador: BorradorPlano,
  seleccion: Seleccion,
  operacion: OperacionPlano,
): ResultadoOperacion {
  const quieto: ResultadoOperacion = { borrador, seleccion, enfocarPropiedades: false };
  if (!operacionDisponible(operacion.tipo, seleccion, borrador)) return quieto;

  switch (operacion.tipo) {
    case 'seleccionar':
      return quieto;
    case 'propiedades':
      return { borrador, seleccion, enfocarPropiedades: true };
    case 'girar':
      return {
        borrador: girar(borrador, seleccion, operacion.grados),
        seleccion,
        enfocarPropiedades: false,
      };
    case 'eliminar':
      // Lo que se quita deja de existir, así que la selección tiene que
      // soltarlo: si no, el panel se queda enseñando la ficha de algo que ya
      // no está en el plano.
      return {
        borrador: quitarAlta(borrador, seleccion),
        seleccion: null,
        enfocarPropiedades: false,
      };
  }
}

/** Lo que un menú contextual debe ofrecer para esta selección, en orden. */
export function operacionesOfrecidas(
  seleccion: Seleccion,
  borrador: BorradorPlano,
  { soloLectura }: { soloLectura: boolean },
): ClaseOperacion[] {
  const clases: ClaseOperacion[] = ['propiedades', 'girar', 'eliminar'];
  return clases.filter((c) => {
    // Con la obra cerrada el plano se ve pero no se toca: queda mirar la
    // ficha, que no escribe nada.
    if (soloLectura && c !== 'propiedades') return false;
    return operacionDisponible(c, seleccion, borrador);
  });
}
