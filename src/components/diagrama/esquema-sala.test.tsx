/**
 * El esquema con su filtro de señal, montado.
 *
 * Lo que se comprueba aquí no se ve en la lógica pura: qué dice cada enlace,
 * qué parámetros conserva al navegar y qué frase aparece cuando no hay nada
 * que dibujar. Un filtro que pierde `?puertos=todos` al pulsarlo se lee como
 * un fallo del dibujo, y en `diagrama.ts` no hay nada que lo cace.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { montar, type Montaje } from '@/pruebas/dom';
import type { Conexion, EquipoEnSala, Puerto } from '@/lib/tipos';
import type { FiltroSenalDiagrama } from '@/lib/diagrama';
import { EsquemaSala } from './esquema-sala';

const SALA = '11111111-1111-4111-8111-111111111111';

/**
 * `self`, que jsdom no pone en el ámbito de Node.
 *
 * `next/link` prefetch mira `self.requestIdleCallback` al montar, y sin `self`
 * el montaje entero se cae con un `ReferenceError`. Es un alias de la ventana
 * de turno, resuelto en cada lectura: `montar()` crea un DOM nuevo por prueba,
 * así que congelar el valor aquí apuntaría a la ventana de la primera.
 */
Object.defineProperty(globalThis, 'self', {
  configurable: true,
  get: () => (globalThis as unknown as { window: unknown }).window,
});

function conEnrutador(elemento: ReactElement): ReactElement {
  const enrutador = {
    refresh: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  } as unknown as AppRouterInstance;
  return createElement(AppRouterContext.Provider, { value: enrutador }, elemento);
}

const equipo = (id: string, nombre: string, articulo_id: string): EquipoEnSala => ({
  id,
  sala_id: SALA,
  articulo_id,
  nombre,
  cantidad: 1,
  extremo: 'mesa',
  posicion: { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada: false,
  rotacion_grados: 0,
});

const conexion = (id: string, senal: Conexion['senal']): Conexion => ({
  id,
  sala_id: SALA,
  origen_id: 'e-caja',
  destino_id: 'e-tv',
  articulo_cable_id: null,
  senal,
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  creado_en: '2026-01-01',
});

const PUERTOS = new Map<string, Puerto[]>([
  [
    'a-caja',
    [
      {
        id: 'p-caja-out',
        articulo_id: 'a-caja',
        nombre: 'HDMI OUT',
        total: 1,
        sentido: 'salida',
        senal: 'hdmi',
        conector: 'HDMI A',
        orden: 1,
        notas: null,
        fuente: 'csv',
      },
    ],
  ],
]);

const montados: Montaje[] = [];

after(async () => {
  for (const m of montados) await m.desmontar();
});

async function montarEsquema({
  conexiones,
  filtroSenal = null,
  todosLosPuertos = false,
}: {
  conexiones: Conexion[];
  filtroSenal?: FiltroSenalDiagrama | null;
  todosLosPuertos?: boolean;
}) {
  const m = await montar(
    conEnrutador(
      createElement(EsquemaSala, {
        salaId: SALA,
        todosLosPuertos,
        filtroSenal,
        entrada: {
          equipos: [equipo('e-caja', 'Caja de conexiones', 'a-caja'), equipo('e-tv', 'Pantalla', 'a-tv')],
          puertosPorArticulo: PUERTOS,
          conexiones,
        },
      }),
    ),
  );
  montados.push(m);
  const navegacion = () =>
    m.contenedor.querySelector('nav[aria-label="Filtro de señal del esquema"]');
  return {
    m,
    texto: () => m.contenedor.textContent ?? '',
    navegacion,
    filtros: () => [...(navegacion()?.querySelectorAll('a') ?? [])] as HTMLAnchorElement[],
    enlace: (texto: string) =>
      [...(navegacion()?.querySelectorAll('a') ?? [])].find(
        (a) => a.textContent === texto,
      ) as HTMLAnchorElement,
    /** El conmutador de puertos, que vive fuera de la navegación de señal. */
    conmutadorPuertos: () =>
      [...m.contenedor.querySelectorAll('a.enlace')].find((a) =>
        (a.textContent ?? '').startsWith('Ver '),
      ) as HTMLAnchorElement,
  };
}

const TODAS = [
  conexion('c1', 'hdmi'),
  conexion('c2', 'red'),
  conexion('c3', 'audio_linea'),
  conexion('c4', 'otro'),
];

describe('los enlaces del filtro de señal', () => {
  it('ofrece las tres señales y la vista completa', async () => {
    const e = await montarEsquema({ conexiones: TODAS });
    assert.deepEqual(
      e.filtros().map((a) => a.textContent),
      ['Todas las señales', 'Vídeo', 'Audio', 'Red'],
    );
  });

  it('sin `puertos`, los enlaces solo llevan `senal`', async () => {
    const e = await montarEsquema({ conexiones: TODAS });
    assert.equal(e.enlace('Vídeo').getAttribute('href'), `/salas/${SALA}/cableado?senal=video`);
    assert.equal(e.enlace('Todas las señales').getAttribute('href'), `/salas/${SALA}/cableado`);
  });

  it('con `puertos=todos`, cada enlace de señal lo conserva, y en orden canónico', async () => {
    const e = await montarEsquema({ conexiones: TODAS, todosLosPuertos: true });
    assert.equal(
      e.enlace('Audio').getAttribute('href'),
      `/salas/${SALA}/cableado?senal=audio&puertos=todos`,
    );
    assert.equal(
      e.enlace('Todas las señales').getAttribute('href'),
      `/salas/${SALA}/cableado?puertos=todos`,
    );
  });

  it('el conmutador de puertos conserva la señal en las dos direcciones', async () => {
    const soloConectados = await montarEsquema({ conexiones: TODAS, filtroSenal: 'video' });
    assert.equal(soloConectados.conmutadorPuertos().textContent, 'Ver todos los puertos');
    assert.equal(
      soloConectados.conmutadorPuertos().getAttribute('href'),
      `/salas/${SALA}/cableado?senal=video&puertos=todos`,
    );

    const todos = await montarEsquema({
      conexiones: TODAS,
      filtroSenal: 'video',
      todosLosPuertos: true,
    });
    assert.equal(todos.conmutadorPuertos().textContent, 'Ver solo los conectados');
    assert.equal(
      todos.conmutadorPuertos().getAttribute('href'),
      `/salas/${SALA}/cableado?senal=video`,
    );
  });

  it('sin filtro, el conmutador de puertos no inventa el parámetro', async () => {
    const e = await montarEsquema({ conexiones: TODAS });
    assert.equal(
      e.conmutadorPuertos().getAttribute('href'),
      `/salas/${SALA}/cableado?puertos=todos`,
    );
  });
});

describe('la accesibilidad del filtro', () => {
  it('los cuatro enlaces cuelgan de una navegación con nombre', async () => {
    const e = await montarEsquema({ conexiones: TODAS });
    const nav = e.navegacion();
    assert.ok(nav, 'existe la navegación');
    assert.equal(nav!.getAttribute('aria-label'), 'Filtro de señal del esquema');
    assert.equal(e.filtros().length, 4);
  });

  it('solo la opción activa lleva aria-current', async () => {
    const conFiltro = await montarEsquema({ conexiones: TODAS, filtroSenal: 'red' });
    assert.equal(conFiltro.enlace('Red').getAttribute('aria-current'), 'page');
    assert.deepEqual(
      conFiltro
        .filtros()
        .filter((a) => a.getAttribute('aria-current') === 'page')
        .map((a) => a.textContent),
      ['Red'],
    );

    const sinFiltro = await montarEsquema({ conexiones: TODAS });
    assert.deepEqual(
      sinFiltro
        .filtros()
        .filter((a) => a.getAttribute('aria-current') === 'page')
        .map((a) => a.textContent),
      ['Todas las señales'],
    );
  });

  it('todos llevan el alto táctil mínimo', async () => {
    const e = await montarEsquema({ conexiones: TODAS });
    for (const a of e.filtros()) {
      assert.ok(
        a.className.includes('min-h-11'),
        `${a.textContent} sin objetivo táctil: ${a.className}`,
      );
    }
  });
});

describe('los vacíos', () => {
  it('una sala sin conexiones lo dice, y no habla del filtro', async () => {
    const e = await montarEsquema({ conexiones: [] });
    assert.ok(e.texto().includes('Sin conexiones'), e.texto());
    assert.equal(e.texto().includes('Quedan fuera'), false);
    assert.ok(e.navegacion(), 'los controles de filtro siguen disponibles');
  });

  it('un filtro sin coincidencias dice cuántas quedan fuera y con qué señales', async () => {
    const e = await montarEsquema({ conexiones: TODAS, filtroSenal: 'video' });
    // La sala tiene una hdmi: se dibuja. Se quita para dejar el filtro vacío.
    const sinVideo = await montarEsquema({
      conexiones: TODAS.filter((c) => c.senal !== 'hdmi'),
      filtroSenal: 'video',
    });
    assert.ok(e.texto().includes('HD-1000'), 'con una hdmi sí se dibuja');

    const texto = sinVideo.texto();
    assert.ok(texto.includes('Ningún cable de vídeo'), texto);
    assert.ok(texto.includes('Quedan fuera 3 conexiones'), texto);
    for (const etiqueta of ['Red', 'Audio línea', 'Otro']) {
      assert.ok(texto.includes(etiqueta), `falta la señal ${etiqueta}: ${texto}`);
    }
    assert.equal(
      texto.includes('Sin conexiones. El esquema se dibuja'),
      false,
      'no es el mismo vacío que una sala sin cables',
    );
    assert.ok(sinVideo.navegacion(), 'los controles de filtro siguen disponibles');
  });

  it('la conexión sin clasificar queda fuera de los tres filtros y se cuenta en singular', async () => {
    const e = await montarEsquema({ conexiones: [conexion('c4', 'otro')], filtroSenal: 'red' });
    assert.ok(e.texto().includes('Quedan fuera 1 conexión: Otro.'), e.texto());
  });
});

/**
 * La integración es de servidor y tiene que seguir siéndolo: el filtro viaja
 * en la dirección para poder enlazarse y funcionar sin JavaScript. Se lee el
 * fichero y **se afirma que se ha leído**: una guarda que solo comprueba
 * ausencias pasa en verde el día que alguien renombra el fichero.
 */
describe('el esquema no se convierte en componente de cliente', () => {
  const RUTA = new URL('./esquema-sala.tsx', import.meta.url);
  const FUENTE = readFileSync(RUTA, 'utf8');

  it('el fichero existe y es el que monta el esquema', () => {
    assert.ok(FUENTE.length > 0, 'el fichero está vacío');
    assert.ok(
      FUENTE.includes('export function EsquemaSala('),
      'este no es el fichero del esquema: la guarda estaría mirando a otro sitio',
    );
    assert.ok(FUENTE.includes('nav aria-label'), 'y es donde vive la navegación del filtro');
  });

  it('no lleva `use client` ni estado ni manejadores', () => {
    assert.equal(/['"]use client['"]/.test(FUENTE), false, 'directiva de cliente');
    assert.equal(/\buseState\b/.test(FUENTE), false, 'useState');
    assert.equal(/\buseEffect\b/.test(FUENTE), false, 'useEffect');
    const manejadores = FUENTE.match(/\son[A-Z][A-Za-z]*=/g);
    assert.equal(manejadores, null, `manejadores de cliente: ${manejadores?.join(', ')}`);
  });
});
