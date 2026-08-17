/**
 * Mover lo seleccionado, sea lo que sea, en un solo sitio.
 *
 * El coordinador tenía tres cadenas de `if` casi iguales —arrastrar, colocar
 * desde la bandeja y las flechas del teclado— y cada tipo nuevo de objeto las
 * hacía crecer las tres. Aquí hay un único reparto por tipo, y el coordinador
 * llama a estas dos funciones sin saber qué hay seleccionado.
 *
 * Es lógica pura, como `operaciones-plano.ts`: entra un borrador y sale un
 * borrador, y un objetivo que no se puede mover devuelve el mismo borrador
 * por referencia, para que el historial de deshacer no apile pasos en blanco.
 */

import {
  desplazarEquipo,
  desplazarMesa,
  desplazarMueble,
  desplazarPuerta,
  desplazarToma,
  moverEquipo,
  moverMesa,
  moverMueble,
  moverPuerta,
  moverToma,
  type BorradorPlano,
  type Seleccion,
} from '@/lib/plano-editor';

interface OpcionesMovimiento {
  ajustar?: boolean;
  paso?: number;
}

/**
 * La posición sobre la pared que corresponde a un punto libre del lienzo.
 *
 * Una puerta no tiene x/y: vive en una pared. Arrastrarla proyecta el puntero
 * sobre el eje de esa pared y descarta la otra coordenada, así que la puerta
 * corre por su pared siguiendo el dedo sin despegarse de ella.
 */
export function posicionEnPared(
  borrador: BorradorPlano,
  id: string,
  punto: { x_m: number; y_m: number },
): number | null {
  const puerta = borrador.puertas.find((x) => x.id === id);
  if (!puerta) return null;
  const horizontal = puerta.pared === 'norte' || puerta.pared === 'sur';
  const aLoLargo = horizontal ? punto.x_m : punto.y_m;
  // El puntero marca el centro del hueco, no su arranque: sin esto la puerta
  // se agarraría siempre por la jamba izquierda.
  return aLoLargo - (puerta.anchura_m ?? 0) / 2;
}

/** Coloca el objetivo donde diga el punto. Arrastre, bandeja y «al centro». */
export function moverSeleccion(
  borrador: BorradorPlano,
  objetivo: Exclude<Seleccion, null>,
  punto: { x_m: number; y_m: number },
  opciones: OpcionesMovimiento = {},
): BorradorPlano {
  switch (objetivo.tipo) {
    case 'equipo':
      return moverEquipo(borrador, objetivo.id, punto, opciones);
    case 'toma':
      return moverToma(borrador, objetivo.id, punto, opciones);
    case 'mueble':
      return moverMueble(borrador, objetivo.id, punto, opciones);
    case 'mesa':
      return moverMesa(borrador, punto, opciones);
    case 'puerta': {
      const posicion = posicionEnPared(borrador, objetivo.id, punto);
      if (posicion == null) return borrador;
      return moverPuerta(borrador, objetivo.id, posicion, opciones);
    }
    case 'sala':
      return borrador;
  }
}

/** Desplaza el objetivo un paso, que es lo que hacen las flechas. */
export function desplazarSeleccion(
  borrador: BorradorPlano,
  objetivo: Exclude<Seleccion, null>,
  paso: { dx_m: number; dy_m: number },
  opciones: OpcionesMovimiento = {},
): BorradorPlano {
  switch (objetivo.tipo) {
    case 'equipo':
      return desplazarEquipo(borrador, objetivo.id, paso, opciones);
    case 'toma':
      return desplazarToma(borrador, objetivo.id, paso, opciones);
    case 'mueble':
      return desplazarMueble(borrador, objetivo.id, paso, opciones);
    case 'mesa':
      return desplazarMesa(borrador, paso, opciones);
    case 'puerta':
      return desplazarPuerta(borrador, objetivo.id, paso, opciones);
    case 'sala':
      return borrador;
  }
}
