/**
 * Un DOM de verdad para probar componentes.
 *
 * Las pruebas puras de `src/lib` comprueban la geometría y los mensajes, que
 * es donde vive la mayor parte del criterio. Pero hay contratos que solo
 * existen en el navegador: dónde va el foco al tabular, si el panel sigue
 * abierto cuando el foco cambia, qué elementos cuelgan de un `role="listbox"`.
 * Una prueba pura no los toca, y darlos por cerrados sin montar nada es
 * convertir un fallo vivo en una casilla marcada.
 *
 * Se monta con `react-dom/client` sobre jsdom y se empuja con eventos, no
 * llamando a los manejadores de React: llamar al manejador comprueba que la
 * función hace lo que hace, no que el navegador llegue a ella.
 *
 * El navegador real sigue haciendo falta para el arrastre, la disposición y
 * las medidas: jsdom no calcula ni un píxel. Esto cubre estructura, estado y
 * foco; lo demás se mira en el navegador.
 */

import Module from 'node:module';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import type { ReactElement } from 'react';

/**
 * `server-only`, en memoria.
 *
 * Un componente de cliente puede acabar importando la acción de servidor solo
 * para tener su tipo y su valor por defecto, y `src/lib/db.ts` empieza pidiendo
 * `server-only`, que solo existe dentro del empaquetador de Next. Se
 * intercepta aquí, en el módulo que las pruebas de componente importan
 * primero, igual que hacen los verificadores de `scripts/`.
 */
const moduloInterno = Module as unknown as {
  _load: (peticion: string, ...resto: unknown[]) => unknown;
};
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (peticion, ...resto) =>
  peticion === 'server-only' ? {} : cargarOriginal.call(Module, peticion, ...resto);

export interface Montaje {
  contenedor: HTMLElement;
  documento: Document;
  ventana: Window;
  /** Vuelve a pintar con otro elemento, dentro de `act`. */
  repintar: (elemento: ReactElement) => Promise<void>;
  desmontar: () => Promise<void>;
}

const GLOBALES = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'FocusEvent',
  'CustomEvent',
  'getComputedStyle',
  'DOMRect',
] as const;

/**
 * Monta el componente en un DOM nuevo.
 *
 * `IS_REACT_ACT_ENVIRONMENT` es lo que le dice a React que estamos en pruebas
 * y que puede vaciar la cola de efectos dentro de `act`. Sin él, cada render
 * avisa por consola y los efectos se quedan a medias.
 */
export async function montar(elemento: ReactElement): Promise<Montaje> {
  const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });

  const g = globalThis as unknown as Record<string, unknown>;
  for (const clave of GLOBALES) {
    // `navigator` es de solo lectura en Node: se define encima con
    // `defineProperty`, que sí puede. Asignarlo directamente lanza.
    Object.defineProperty(g, clave, {
      configurable: true,
      writable: true,
      value: (dom.window as unknown as Record<string, unknown>)[clave],
    });
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;

  // `react-dom/client` se importa DESPUÉS de poner los globales: al cargarse
  // mira si hay documento, y sin él se queda en modo servidor.
  const { createRoot } = await import('react-dom/client');

  const contenedor = dom.window.document.getElementById('raiz') as HTMLElement;
  const raiz = createRoot(contenedor);

  await act(async () => {
    raiz.render(elemento);
  });

  return {
    contenedor,
    documento: dom.window.document,
    ventana: dom.window as unknown as Window,
    repintar: async (siguiente) => {
      await act(async () => {
        raiz.render(siguiente);
      });
    },
    desmontar: async () => {
      await act(async () => {
        raiz.unmount();
      });
      // Los globales NO se quitan aquí: un fichero de pruebas monta varios
      // componentes y los desmonta al final, y quitarlos con el primero deja a
      // React sin `window` para los siguientes.
      dom.window.close();
    },
  };
}

/** Deja correr los temporizadores y las promesas pendientes. */
export async function esperar(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Un evento de teclado de verdad, con burbujeo, como el del navegador. */
export async function teclear(
  destino: Element,
  key: string,
  extra: KeyboardEventInit = {},
): Promise<void> {
  await act(async () => {
    destino.dispatchEvent(
      new (destino.ownerDocument.defaultView as Window & typeof globalThis).KeyboardEvent(
        'keydown',
        { key, bubbles: true, cancelable: true, ...extra },
      ),
    );
  });
}

/**
 * Escribe en un campo como escribe una persona.
 *
 * Asignar `input.value` a secas no llega a React: React guarda el valor
 * anterior en el nodo y, al ver que coincide con el nuevo, se ahorra el
 * `onChange`. Se usa el `setter` nativo del prototipo, que es lo que React
 * vigila, y luego se lanza el evento `input`.
 */
export async function escribir(campo: HTMLInputElement, valor: string): Promise<void> {
  const vista = campo.ownerDocument.defaultView as Window & typeof globalThis;
  const setter = Object.getOwnPropertyDescriptor(
    vista.HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(campo, valor);
    campo.dispatchEvent(new vista.Event('input', { bubbles: true }));
  });
}

/**
 * Un clic de verdad. Devuelve el evento para poder preguntarle si alguien lo
 * canceló: interceptar un enlace es justo eso, y comprobarlo mirando la
 * pantalla no distingue «no navegó» de «navegó y volvió».
 */
export async function pulsar(
  destino: Element,
  extra: MouseEventInit = {},
): Promise<MouseEvent> {
  const vista = destino.ownerDocument.defaultView as Window & typeof globalThis;
  const evento = new vista.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...extra,
  });
  await act(async () => {
    destino.dispatchEvent(evento);
  });
  return evento as unknown as MouseEvent;
}

/**
 * Mueve el foco como lo mueve el navegador: `focusout` en el que lo pierde con
 * `relatedTarget` apuntando al que lo gana, y `focusin` en el que lo gana.
 *
 * React escucha `focusout`/`focusin` para su `onBlur`/`onFocus`, así que este
 * es el camino real. `elemento.focus()` de jsdom no dispara `relatedTarget`, y
 * `relatedTarget` es justo lo que decide si el combobox se cierra.
 */
export async function moverFoco(desde: Element | null, hasta: Element | null): Promise<void> {
  const vista = (desde ?? hasta)?.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  if (!vista) return;
  await act(async () => {
    if (desde) {
      desde.dispatchEvent(
        new vista.FocusEvent('focusout', { bubbles: true, relatedTarget: hasta }),
      );
    }
    if (hasta) {
      (hasta as HTMLElement).focus?.();
      hasta.dispatchEvent(
        new vista.FocusEvent('focusin', { bubbles: true, relatedTarget: desde }),
      );
    }
  });
}
