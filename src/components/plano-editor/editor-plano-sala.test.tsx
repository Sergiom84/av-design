/**
 * El editor del plano, montado.
 *
 * `src/lib/plano-editor.test.ts` cubre el borrador, el patch y la geometría,
 * que es lógica pura. Lo que no cubre es lo que solo existe con el componente
 * vivo: qué hace `Descartar` cuando hay un conflicto encima, si el aviso del
 * último alta sobrevive a un guardado correcto, y qué dice el panel móvil de lo
 * que hay seleccionado. Los tres eran fallos reales y los tres se comprueban
 * aquí montando el editor y pulsando botones.
 *
 * El guardado se inyecta: el conflicto es un estado del servidor —otra pestaña
 * guardó primero— y provocarlo de verdad exige dos navegadores. Eso se hace en
 * el navegador real; aquí se comprueba qué hace el editor cuando le llega.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { montar, escribir, esperar, moverFoco, pulsar, type Montaje } from '@/pruebas/dom';
import type { ResultadoGuardado } from '@/app/acciones-diagrama';
import type { Sala } from '@/lib/tipos';
import { EditorPlanoSala } from './editor-plano-sala';

const SALA: Sala = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'TEST editor',
  codigo: null,
  sede: null,
  edificio: null,
  nivel: null,
  tipologia: 'SALA TP',
  aforo: 8,
  largo_m: 6,
  ancho_m: 4,
  alto_m: 3,
  alto_falso_techo_m: null,
  mesa_largo_m: 2.4,
  mesa_ancho_m: 1.2,
  mesa_alto_cm: 73,
  mesa_x_m: 3,
  mesa_y_m: 2,
  mesa_rotacion_grados: 0,
  ruta_por_defecto: 'falso_techo',
  plantilla_id: null,
  localizacion_id: null,
  diagrama_version: 1,
  diagrama_iniciado_en: new Date(),
  diagrama_origen: 'desde_cero',
  diagrama_plantilla_id: null,
  sillas_modo: 'manuales',
} as unknown as Sala;

const MUEBLE = {
  sala_id: '11111111-1111-4111-8111-111111111111',
  id: '22222222-2222-4222-8222-222222222222',
  mobiliario_id: '33333333-3333-4333-8333-333333333333',
  nombre: 'Silla',
  forma: 'circulo' as const,
  largo_m: 0.5,
  ancho_m: 0.5,
  alto_m: 0.9,
  x_m: 1,
  y_m: 1,
  z_m: 0,
  rotacion_grados: 0,
  posicion_confirmada: true,
  origen_plantilla_mobiliario_id: null,
  orden: 0,
};

interface Enrutador {
  refrescos: number;
}

function conEnrutador(elemento: ReactElement, contador: Enrutador): ReactElement {
  const enrutador = {
    refresh: () => {
      contador.refrescos += 1;
    },
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  } as unknown as AppRouterInstance;
  return createElement(AppRouterContext.Provider, { value: enrutador }, elemento);
}

interface Editor {
  m: Montaje;
  contador: Enrutador;
  boton: (texto: string) => HTMLButtonElement | null;
  texto: () => string;
  resumenMovil: () => string;
}

async function editor(
  guardarPlano: (patch: unknown) => Promise<ResultadoGuardado>,
  sala: Sala = SALA,
): Promise<Editor> {
  const contador: Enrutador = { refrescos: 0 };
  const m = await montar(
    conEnrutador(
      createElement(EditorPlanoSala, {
        sala,
        equipos: [],
        conexiones: [],
        tomas: [],
        muebles: [MUEBLE],
        categoriasMobiliario: ['Sillas'],
        plantillaBase: null,
        cerrado: false,
        guardarPlano: guardarPlano as never,
      }),
      contador,
    ),
  );
  return {
    m,
    contador,
    boton: (texto) =>
      ([...m.contenedor.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').includes(texto),
      ) ?? null) as HTMLButtonElement | null,
    texto: () => m.contenedor.textContent ?? '',
    resumenMovil: () =>
      m.contenedor.querySelector('details > summary > span')?.textContent ?? '',
  };
}

const montados: Montaje[] = [];
const registrar = (e: Editor) => {
  montados.push(e.m);
  return e;
};

after(async () => {
  for (const m of montados) await m.desmontar();
});

/** Selecciona la silla de la lista de objetos. */
async function seleccionarSilla(e: Editor) {
  const fila = [...e.m.contenedor.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('Silla'),
  );
  assert.ok(fila, 'la silla sale en la lista de objetos');
  await pulsar(fila);
  await esperar();
}

/**
 * Deja el editor sucio sin depender del arrastre: se le cambia el nombre a la
 * silla desde su inspector, que es un `input` de verdad con su `onChange`.
 */
async function ensuciar(e: Editor) {
  await seleccionarSilla(e);
  const campo = [...e.m.contenedor.querySelectorAll('input')].find(
    (i) => i.type === 'text' && i.value === 'Silla',
  );
  assert.ok(campo, 'el inspector del mueble trae su nombre');
  await escribir(campo, 'Silla de confidente');
  await esperar();
}

describe('el editor tras un conflicto', () => {
  const conflicto = async (): Promise<ResultadoGuardado> => ({
    ok: false,
    motivo: 'conflicto',
    detalle: 'La sala cambió en otra pestaña.',
  });

  it('Descartar con un conflicto encima recarga en vez de restaurar lo viejo', async () => {
    const e = registrar(await editor(conflicto));
    await ensuciar(e);

    const guardar = e.boton('Guardar cambios');
    assert.ok(guardar, 'con cambios sale el botón de guardar');
    await pulsar(guardar);
    await esperar(30);

    assert.ok(
      e.texto().includes('La sala cambió en otra pestaña'),
      'el conflicto se explica',
    );
    const antes = e.contador.refrescos;

    const descartar = e.boton('Descartar');
    assert.ok(descartar, 'el botón general de descartar sigue disponible');
    await pulsar(descartar);
    await esperar(30);

    assert.equal(
      e.contador.refrescos,
      antes + 1,
      'descartar con conflicto pide al servidor lo que hay ahora',
    );
    assert.equal(
      e.texto().includes('La sala cambió en otra pestaña'),
      false,
      'y el aviso de conflicto se va porque ya no lo hay',
    );
  });

  it('sin conflicto, Descartar no recarga nada', async () => {
    const e = registrar(await editor(conflicto));
    await ensuciar(e);

    const antes = e.contador.refrescos;
    const descartar = e.boton('Descartar');
    if (descartar) await pulsar(descartar);
    await esperar();

    assert.equal(e.contador.refrescos, antes, 'descartar en local es local');
  });
});

/**
 * Añade una silla desde la biblioteca, que es el camino real del alta: el
 * buscador pregunta a `/api/mobiliario`, se elige de la lista y se pulsa
 * `Añadir`. Se responde a esa petición desde aquí, sin servidor.
 */
async function anadirSillaDesdeLaBiblioteca(e: Editor) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          id: MUEBLE.mobiliario_id,
          clave: 'silla',
          nombre: 'Silla',
          categoria: 'Sillas',
          forma: 'circulo',
          largo_m_defecto: 0.5,
          ancho_m_defecto: 0.5,
          alto_m_defecto: 0.9,
          rol: 'asiento',
        },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const campo = [...e.m.contenedor.querySelectorAll('input')].find(
      (i) => i.getAttribute('role') === 'combobox',
    );
    assert.ok(campo, 'la biblioteca trae el buscador de mobiliario');
    await moverFoco(null, campo);
    await esperar(260);
    const opcion = e.m.contenedor.querySelector('[role="option"]');
    assert.ok(opcion, 'el buscador devuelve la silla');
    await pulsar(opcion);
    await esperar();
    const anadir = e.boton('Añadir');
    assert.ok(anadir, 'y sale el botón de añadir');
    await pulsar(anadir);
    await esperar();
  } finally {
    globalThis.fetch = original;
  }
}

describe('el editor tras un guardado correcto', () => {
  const bien = async (): Promise<ResultadoGuardado> => ({ ok: true, version: 2, ids: {} });

  it('el aviso del último alta se va: no puede convivir con «Guardado»', async () => {
    const e = registrar(await editor(bien));
    await anadirSillaDesdeLaBiblioteca(e);

    assert.ok(
      e.texto().includes('Sin guardar todavía'),
      `el alta lo avisa: ${e.texto().slice(0, 200)}`,
    );

    const guardar = e.boton('Guardar cambios');
    assert.ok(guardar);
    await pulsar(guardar);
    await esperar(30);

    assert.equal(
      e.texto().includes('Sin guardar todavía'),
      false,
      'ningún «Sin guardar todavía» junto a un «Guardado»',
    );
    assert.ok(e.texto().includes('Guardado'), 'y sí un «Guardado»');
  });

  it('Descartar también se lleva el aviso del alta', async () => {
    const e = registrar(await editor(bien));
    await anadirSillaDesdeLaBiblioteca(e);
    assert.ok(e.texto().includes('Sin guardar todavía'));

    const descartar = e.boton('Descartar');
    assert.ok(descartar);
    await pulsar(descartar);
    await esperar();

    assert.equal(e.texto().includes('Sin guardar todavía'), false);
  });
});

describe('el resumen del panel móvil', () => {
  const bien = async (): Promise<ResultadoGuardado> => ({ ok: true, version: 2, ids: {} });

  it('sin nada seleccionado habla de la sala', async () => {
    const e = registrar(await editor(bien));
    assert.equal(e.resumenMovil(), 'Medidas de la sala');
  });

  it('con un mueble seleccionado dice el mueble, no «Toma»', async () => {
    const e = registrar(await editor(bien));
    await seleccionarSilla(e);
    assert.equal(e.resumenMovil(), 'Silla');
    assert.equal(
      e.resumenMovil().startsWith('Toma'),
      false,
      'una silla no es una roseta',
    );
  });
});
