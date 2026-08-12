/**
 * La tarjeta que pregunta de dónde sale el plano, montada.
 *
 * Lo que se comprueba aquí es una diferencia que no se ve mirando la pantalla
 * un solo instante: «no hay plantillas» y «no se ha podido mirar» son dos
 * frases distintas, y antes eran la misma. Importa porque la respuesta es
 * permanente: `Desde cero` se escribe en `salas.diagrama_iniciado_en`, la
 * pregunta no se repite, y un 500 acababa en la base como una decisión que
 * nadie tomó.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { montar, esperar, moverFoco, pulsar, type Montaje } from '@/pruebas/dom';
import { OrigenDiagrama } from './origen-diagrama';

/** Más que los 150 ms que el combobox deja pasar entre teclas. */
const TRAS_LA_ESPERA_MS = 220;

const PLANTILLA = {
  id: '44444444-4444-4444-8444-444444444444',
  nombre: 'Sala de reuniones 8',
  tipologia: 'SALA TP',
  largo_m: 6,
  ancho_m: 4,
  alto_m: 3,
  muebles: 9,
  lineas: 4,
  conexiones: 3,
};

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

const montados: Montaje[] = [];

after(async () => {
  for (const m of montados) await m.desmontar();
});

interface Tarjeta {
  m: Montaje;
  texto: () => string;
  campo: HTMLInputElement;
  desdeCero: () => HTMLButtonElement;
  reintentar: () => HTMLButtonElement | null;
  opciones: () => HTMLElement[];
}

/** Monta la tarjeta y abre el buscador de plantillas. */
async function abierta(): Promise<Tarjeta> {
  const m = await montar(
    conEnrutador(
      createElement(OrigenDiagrama, {
        salaId: '11111111-1111-4111-8111-111111111111',
        version: 1,
        cerrado: false,
      }),
    ),
  );
  montados.push(m);
  const campo = m.contenedor.querySelector('input[role="combobox"]') as HTMLInputElement;
  await moverFoco(null, campo);
  await esperar(TRAS_LA_ESPERA_MS);
  return {
    m,
    texto: () => m.contenedor.textContent ?? '',
    campo,
    desdeCero: () =>
      [...m.contenedor.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').includes('Empezar desde cero'),
      ) as HTMLButtonElement,
    reintentar: () =>
      ([...m.contenedor.querySelectorAll('button')].find(
        (b) => b.textContent === 'Reintentar',
      ) ?? null) as HTMLButtonElement | null,
    opciones: () => [...m.contenedor.querySelectorAll('[role="option"]')] as HTMLElement[],
  };
}

const caida = (async () => new Response('vaya', { status: 500 })) as typeof fetch;
const listado = (async () =>
  new Response(JSON.stringify([PLANTILLA]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;

describe('la tarjeta de origen con el listado de plantillas caído', () => {
  it('dice que no se pudo mirar, y no que no haya plantillas', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = caida;
    try {
      const t = await abierta();
      assert.ok(
        t.texto().includes('No se han podido consultar las plantillas'),
        `la tarjeta lo dice: ${t.texto().slice(0, 400)}`,
      );
      assert.equal(
        t.texto().includes('Sin plantillas que coincidan'),
        false,
        'un 500 no es una lista vacía',
      );
      assert.ok(t.reintentar(), 'y se ofrece reintentar');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('«Desde cero» deja de ser la opción principal mientras no se pueda mirar', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = caida;
    try {
      const t = await abierta();
      assert.equal(
        t.desdeCero().className.includes('boton-principal'),
        false,
        'la decisión es permanente: no se pinta como la obvia',
      );
      assert.equal(t.desdeCero().disabled, false, 'pero se puede elegir igual');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('reintentar recupera: vuelven las plantillas y se va el aviso', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = caida;
    try {
      const t = await abierta();
      const boton = t.reintentar();
      assert.ok(boton);

      globalThis.fetch = listado;
      await pulsar(boton);
      await esperar(TRAS_LA_ESPERA_MS);

      assert.equal(t.opciones().length, 1, 'la plantilla aparece');
      assert.equal(
        t.texto().includes('No se han podido consultar las plantillas'),
        false,
        'y el aviso de caída se retira',
      );
      assert.ok(
        t.desdeCero().className.includes('boton-principal'),
        'con el listado en pie, la tarjeta vuelve a su forma normal',
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('la tarjeta de origen con el listado en pie', () => {
  it('no inventa ninguna caída', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = listado;
    try {
      const t = await abierta();
      assert.equal(t.opciones().length, 1);
      assert.equal(t.texto().includes('No se han podido consultar'), false);
      assert.equal(t.reintentar(), null);
    } finally {
      globalThis.fetch = original;
    }
  });
});
