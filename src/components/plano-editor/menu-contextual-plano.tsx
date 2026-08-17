'use client';

import { useEffect, useRef } from 'react';

import type { BorradorPlano, Seleccion } from '@/lib/plano-editor';
import {
  ETIQUETA_OPERACION,
  GIRO_RAPIDO_GRADOS,
  giroActual,
  operacionesOfrecidas,
  type ClaseOperacion,
  type OperacionPlano,
} from './operaciones-plano';

/**
 * El menú del botón derecho sobre un objeto del plano.
 *
 * Es un atajo y nunca un camino único: todo lo que hay aquí está también en la
 * lista de objetos y en el inspector, que son los que funcionan con teclado,
 * con el dedo y con lector de pantalla. Quien no tenga botón derecho no pierde
 * ninguna operación; solo pierde el atajo.
 *
 * Por eso no se ofrece nada que el despachador no vaya a hacer:
 * `operacionesOfrecidas` decide la lista, y es la misma función que sabe que
 * un equipo ya guardado no se quita del plano y que una roseta no gira. Un
 * menú con una opción muerta es peor que un menú corto.
 *
 * Se pinta en coordenadas de ventana, con `position: fixed`, y no dentro del
 * SVG: dibujarlo en el lienzo lo recortaría con el `viewBox` y lo escalaría
 * con el zoom, así que a zoom 40 % el texto sería ilegible.
 */
export interface MenuContextualAbierto {
  seleccion: Exclude<Seleccion, null>;
  x: number;
  y: number;
}

/** Ancho fijo del menú, para poder voltearlo antes de pintarlo. */
const ANCHO_PX = 208;
const ALTO_FILA_PX = 44;
const MARGEN_PX = 8;

export function MenuContextualPlano({
  abierto,
  borrador,
  soloLectura,
  alOperar,
  alCerrar,
}: {
  abierto: MenuContextualAbierto | null;
  borrador: BorradorPlano;
  soloLectura: boolean;
  alOperar: (operacion: OperacionPlano) => void;
  alCerrar: () => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  /**
   * Dónde estaba el foco antes de abrir, para devolverlo al cerrar.
   *
   * Sin esto, Escape o un clic fuera dejaban el foco en el `body`: quien
   * navega con teclado se quedaba sin punto de partida y tenía que tabular
   * desde el principio de la página. Cerrar un menú tiene que devolver a donde
   * se estaba, no expulsar.
   */
  const focoPrevio = useRef<HTMLElement | null>(null);

  // Al abrirse se lleva el foco a la primera opción: si no, el menú aparece y
  // el foco se queda en el lienzo, así que Escape y las flechas no van a
  // ninguna parte y el menú solo se puede usar con el ratón.
  useEffect(() => {
    if (!abierto) return;
    // El nodo se copia a una variable del efecto: en la limpieza,
    // `contenedor.current` ya puede apuntar a otro sitio o a nada.
    const caja = contenedor.current;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    caja?.querySelector('button')?.focus();
    return () => {
      // Solo si el foco sigue dentro del menú que se va: si algo ya se lo
      // llevó a otro sitio —«Propiedades» lo manda al inspector— devolverlo
      // aquí sería arrebatárselo.
      // React desmonta el menú antes de correr esta limpieza, así que cuando
      // el foco estaba dentro ya se ha caído al `body`: comprobar solo
      // `caja.contains(...)` daba siempre falso y no se restauraba nunca.
      // El `body` con el foco es justamente la señal de que se perdió al
      // desmontar. Si en cambio lo tiene otro elemento —«Propiedades» lo manda
      // al inspector— no se toca, que sería arrebatárselo.
      const eraNuestro =
        caja?.contains(document.activeElement) || document.activeElement === document.body;
      const previo = focoPrevio.current;
      focoPrevio.current = null;
      if (!eraNuestro) return;

      // El menú se abre con el botón derecho sobre el SVG, y eso no da el foco
      // a nada: lo normal es que el «foco previo» fuera el propio `body`.
      // Devolverlo ahí es dejar a quien navega con teclado sin punto de
      // partida, tabulando otra vez desde la cabecera de la página. El destino
      // de reserva es el panel de propiedades, que ya es enfocable y habla
      // justo del objeto sobre el que se abrió el menú.
      if (previo?.isConnected && previo !== document.body) {
        previo.focus();
        return;
      }
      document
        .querySelector<HTMLElement>('[aria-label="Propiedades de lo seleccionado"]')
        ?.focus();
    };
  }, [abierto]);

  // Cerrar al pulsar fuera y al hacer scroll. Un menú anclado a una posición
  // de ventana que se queda quieto mientras la página se mueve acaba señalando
  // a otra cosa.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => {
      if (!contenedor.current?.contains(ev.target as Node)) alCerrar();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        alCerrar();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('scroll', alCerrar, true);
    window.addEventListener('resize', alCerrar);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('scroll', alCerrar, true);
      window.removeEventListener('resize', alCerrar);
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  const clases = operacionesOfrecidas(abierto.seleccion, borrador, { soloLectura });
  if (clases.length === 0) return null;

  // Volteado contra el borde: cerca de la derecha o del pie de la ventana el
  // menú se abre hacia dentro en vez de salirse. Se calcula aquí y no con CSS
  // porque hace falta saber cuánto mide, y mide un número de filas conocido.
  const alto = clases.length * ALTO_FILA_PX + MARGEN_PX * 2;
  const izquierda = Math.max(
    MARGEN_PX,
    Math.min(abierto.x, window.innerWidth - ANCHO_PX - MARGEN_PX),
  );
  const arriba = Math.max(MARGEN_PX, Math.min(abierto.y, window.innerHeight - alto - MARGEN_PX));

  const operacionDe = (clase: ClaseOperacion): OperacionPlano =>
    clase === 'girar'
      ? { tipo: 'girar', grados: giroActual(borrador, abierto.seleccion) + GIRO_RAPIDO_GRADOS }
      : { tipo: clase };

  return (
    <div
      ref={contenedor}
      role="menu"
      aria-label="Acciones del objeto seleccionado"
      className="tarjeta fixed z-50 py-2"
      style={{ left: izquierda, top: arriba, width: ANCHO_PX }}
    >
      {clases.map((clase) => (
        <button
          key={clase}
          type="button"
          role="menuitem"
          // 44 px: es el mismo objetivo táctil que el resto de la aplicación,
          // y este menú también se abre con pulsación larga en una tableta.
          className="flex w-full min-h-11 items-center px-3 text-left hover:bg-fondo-suave focus-visible:bg-fondo-suave"
          onClick={() => {
            alOperar(operacionDe(clase));
            alCerrar();
          }}
        >
          {ETIQUETA_OPERACION[clase]}
        </button>
      ))}
    </div>
  );
}
