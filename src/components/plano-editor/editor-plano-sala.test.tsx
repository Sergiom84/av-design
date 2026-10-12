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
import { act, createElement, type ReactElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import {
  montar,
  escribir,
  esperar,
  moverFoco,
  pulsar,
  teclear,
  type Montaje,
} from '@/pruebas/dom';
import type { ResultadoGuardado } from '@/app/acciones-diagrama';
import type { Sala, EquipoEnSala, TomaRed } from '@/lib/tipos';
import { EditorPlanoSala } from './editor-plano-sala';
import { PanelPropiedadesPlano } from './panel-propiedades-plano';
import { borradorDesde, type BorradorPlano, type PatchPlano } from '@/lib/plano-editor';

const SALA: Sala = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'TEST editor',
  codigo: null,
  sede: null,
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
  /** A dónde se ha navegado, en orden. */
  ido: string[];
}

function conEnrutador(elemento: ReactElement, contador: Enrutador): ReactElement {
  const enrutador = {
    refresh: () => {
      contador.refrescos += 1;
    },
    push: (ruta: string) => contador.ido.push(ruta),
    replace: (ruta: string) => contador.ido.push(ruta),
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  } as unknown as AppRouterInstance;
  return createElement(AppRouterContext.Provider, { value: enrutador }, elemento);
}

/** La ruta de otra pestaña de la ficha, que es el caso del hallazgo. */
const RUTA_RESUMEN = `/salas/${SALA.id}`;

interface Editor {
  m: Montaje;
  contador: Enrutador;
  boton: (texto: string) => HTMLButtonElement | null;
  texto: () => string;
  resumenMovil: () => string;
  /** El enlace a Resumen, montado al lado del editor como en la ficha real. */
  pestana: () => HTMLAnchorElement;
  dialogo: () => HTMLElement | null;
  repintarSala: (sala: Sala) => Promise<void>;
}

async function editor(
  guardarPlano: (patch: unknown) => Promise<ResultadoGuardado>,
  sala: Sala = SALA,
  { cerrado = false, equipos = [], tomas = [] }: { cerrado?: boolean; equipos?: EquipoEnSala[]; tomas?: TomaRed[] } = {},
): Promise<Editor> {
  const contador: Enrutador = { refrescos: 0, ido: [] };
  const vista = (salaActual: Sala) =>
    conEnrutador(
      createElement(
        'div',
        null,
        // El enlace de la pestaña `Resumen` vive en el layout de la ficha, no
        // en el editor. Se monta al lado porque el guardia escucha el clic en
        // el documento entero, que es justo lo que hay que comprobar.
        createElement('a', { href: RUTA_RESUMEN, id: 'pestana-resumen' }, 'Resumen'),
        createElement(EditorPlanoSala, {
          sala: salaActual,
          equipos,
          conexiones: [],
          tomas,
          puertas: [],
          muebles: [MUEBLE],
          categoriasMobiliario: ['Sillas'],
          plantillaBase: null,
          cerrado,
          guardarPlano: guardarPlano as never,
        }),
      ),
      contador,
    );
  const m = await montar(vista(sala));
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
    pestana: () =>
      m.contenedor.querySelector('#pestana-resumen') as HTMLAnchorElement,
    dialogo: () => m.contenedor.querySelector('[role="dialog"]') as HTMLElement | null,
    repintarSala: (salaActual) => m.repintar(vista(salaActual)),
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

describe('el inspector al cambiar de objeto con un campo en foco', () => {
  for (const tipo of ['equipo', 'mueble', 'puerta', 'toma'] as const) {
    it(`${tipo}: descarta el texto local del anterior y muestra la coordenada del seleccionado`, async () => {
      let borrador: BorradorPlano = {
        ...borradorDesde(SALA, [], []),
        equipos: [3, 0].map((x_m, i) => ({
          id: String(i), articulo_id: 'ref', nombre: `Equipo ${i}`, cantidad: 1,
          extremo: 'pared', x_m, y_m: 0, z_m: 0, posicion_confirmada: true,
          rotacion_grados: 0, toma_red_id: null, es_nuevo: false,
        })),
        mobiliario: [3, 0].map((x_m, i) => ({ ...MUEBLE, id: String(i), x_m, es_nuevo: false })),
        puertas: [3, 0].map((posicion_m, i) => ({
          id: String(i), pared: 'norte', posicion_m, anchura_m: 0.9,
          altura_m: 2, orden: i, es_nuevo: false,
        })),
        tomas: [3, 0].map((x_m, i) => ({
          capacidad_documentada: null, bocas: [], codigo_referencia: null, codigo_confirmado: false,
          esquema_x: null, esquema_y: null,
          id: String(i), codigo: String(i), x_m, y_m: 0, z_m: 0, ubicacion: null, notas: null,
        })),
      };
      const vista = (id: string) => createElement(PanelPropiedadesPlano, {
        seleccion: { tipo, id }, borrador, posicionesDibujadas: new Map(), soloLectura: false,
        alCambiar: (siguiente: BorradorPlano) => { borrador = siguiente; }, alQuitar: () => {},
      });
      const m = await montar(vista('0'));
      try {
        const campo = () => {
          const etiqueta = tipo === 'puerta' ? 'Posición en la pared (m)' : 'X (m)';
          const label = [...m.contenedor.querySelectorAll('label')].find(
            (l) => l.firstElementChild?.textContent === etiqueta,
          );
          const input = label?.querySelector('input');
          assert.ok(input, `existe ${etiqueta}`);
          return input;
        };
        const anterior = campo();
        await moverFoco(null, anterior);
        await escribir(anterior, '3,');
        await m.repintar(vista('0'));
        assert.equal(campo(), anterior, 'editar el mismo objeto conserva el campo');
        assert.equal(campo().value, '3,', 'la coma se conserva mientras escribe');
        assert.equal(m.documento.activeElement, anterior);

        // Cambio de selección sin blur previo: reproduce el estado local
        // retenido; no pretende simular el timing de los clics del navegador.
        await m.repintar(vista('1'));
        assert.equal(campo().value, '0', 'la coordenada pertenece al nuevo objeto');
        await moverFoco(null, campo());
        await escribir(campo(), '2,5');
        const objetos = tipo === 'equipo' ? borrador.equipos
          : tipo === 'mueble' ? borrador.mobiliario
          : tipo === 'puerta' ? borrador.puertas : borrador.tomas;
        const coordenadas = objetos.map((o) => 'posicion_m' in o ? o.posicion_m : o.x_m);
        assert.deepEqual(coordenadas, [3, 2.5], 'editar después afecta solo al seleccionado');
      } finally { await m.desmontar(); }
    });
  }
});

describe('el editor envía los cambios del inspector de equipos', () => {
  for (const campo of ['Extremo', 'Toma de red'] as const) {
    it(`${campo} aislado habilita Guardar y viaja en el patch sin mover X`, async () => {
      const id = '44444444-4444-4444-8444-444444444444';
      const tomaId = '55555555-5555-4555-8555-555555555555';
      const enviados: PatchPlano[] = [];
      const e = registrar(await editor(async (p) => {
        enviados.push(p as PatchPlano);
        return { ok: true, version: 2, ids: {} };
      }, SALA, {
        equipos: [{ id, sala_id: SALA.id, articulo_id: id, nombre: 'QA Codec', cantidad: 1,
          extremo: 'pantalla', posicion: { x_m: 0, y_m: 0, z_m: 0 },
          posicion_confirmada: true, rotacion_grados: 0, toma_red_id: null }],
        tomas: [{ id: tomaId, sala_id: SALA.id, codigo: 'QA-RJ-01', ubicacion: null,
          capacidad_documentada: null, bocas: [], codigo_referencia: null, codigo_confirmado: false,
          esquema_x: null, esquema_y: null,
          x_m: 1, y_m: 1, z_m: 0, notas: null }],
      }));
      assert.equal(e.boton('Guardar cambios')?.disabled, true);
      const fila = e.boton('QA Codec'); assert.ok(fila); await pulsar(fila);
      const label = [...e.m.contenedor.querySelectorAll('label')].find(
        (l) => l.firstElementChild?.textContent === campo,
      );
      const select = label?.querySelector('select'); assert.ok(select);
      await act(async () => {
        select.value = campo === 'Extremo' ? 'rack' : tomaId;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const guardar = e.boton('Guardar cambios'); assert.ok(guardar);
      assert.equal(guardar.disabled, false, 'el cambio aislado ensucia el editor');
      await pulsar(guardar);
      assert.equal(enviados.length, 1);
      assert.equal(enviados[0].equipos.length, 1);
      assert.equal(enviados[0].equipos[0].x_m, 0);
      assert.equal(enviados[0].equipos[0].extremo, campo === 'Extremo' ? 'rack' : 'pantalla');
      assert.equal(enviados[0].equipos[0].toma_red_id, campo === 'Toma de red' ? tomaId : null);
      assert.equal(e.boton('Guardar cambios')?.disabled, true);
      assert.equal(select.value, campo === 'Extremo' ? 'rack' : tomaId);
    });
  }
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
  it('un rechazo inválido y props nuevas no descartan el borrador', async () => {
    const e = registrar(await editor(async () => ({
      ok: false, motivo: 'invalido', detalle: 'Datos inválidos para guardar.',
    })));
    await ensuciar(e);
    await pulsar(e.boton('Guardar cambios')!);
    await esperar(30);
    const mantieneNombre = () => [...e.m.contenedor.querySelectorAll('input')]
      .some((input) => input.value === 'Silla de confidente');
    assert.equal(mantieneNombre(), true);
    await e.repintarSala({ ...SALA, diagrama_version: 2 });
    await esperar();
    assert.equal(mantieneNombre(), true);
    assert.equal(e.boton('Guardar cambios')?.disabled, false);
  });
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
      e.texto().includes('Recargando la versión actual de la sala'),
      true,
      'el conflicto sigue visible hasta recibir la versión nueva',
    );
    assert.equal(e.boton('Guardar cambios'), null, 'no se puede guardar con la versión vieja');
    assert.equal(e.boton('Descartar'), null, 'tampoco se puede volver a descartar a medias');
    await seleccionarSilla(e);
    const nombre = [...e.m.contenedor.querySelectorAll('input')].find(
      (i) => i.type === 'text' && i.value === 'Silla',
    );
    assert.ok(nombre?.disabled, 'el inspector tampoco deja editar mientras llegan las props');
  });

  it('adopta la versión nueva antes de permitir editar y el siguiente guardado ya no choca', async () => {
    const patches: Array<{ versionEsperada?: number }> = [];
    let intento = 0;
    const guardar = async (patch: unknown): Promise<ResultadoGuardado> => {
      patches.push(patch as { versionEsperada?: number });
      intento += 1;
      return intento === 1
        ? { ok: false, motivo: 'conflicto', detalle: 'La sala cambió en otra pestaña.' }
        : { ok: true, version: 3, ids: {} };
    };
    const e = registrar(await editor(guardar));
    await ensuciar(e);
    await pulsar(e.boton('Guardar cambios')!);
    await esperar(30);
    await pulsar(e.boton('Descartar')!);
    await esperar();

    assert.equal(e.boton('Guardar cambios'), null, 'la recarga mantiene bloqueada la edición');

    await e.repintarSala({ ...SALA, diagrama_version: 2 });
    await esperar();
    assert.equal(
      e.texto().includes('Recargando la versión actual de la sala'),
      false,
      'la versión nueva desbloquea el editor',
    );

    await ensuciar(e);
    await pulsar(e.boton('Guardar cambios')!);
    await esperar(30);

    assert.equal(patches.length, 2, 'se intentó guardar una vez antes y otra después de recargar');
    assert.equal(patches[1].versionEsperada, 2, 'el segundo guardado usa la versión adoptada');
    assert.ok(e.texto().includes('Guardado'), 'el guardado posterior termina correctamente');
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

/**
 * Pulsa la pestaña `Resumen` y dice si el clic llegó al final del documento,
 * que es donde `<Link>` tiene su manejador delegado. Si el guardia lo cortó, no
 * llega: eso es exactamente «no ha navegado».
 *
 * El listener del final también cancela el clic, o jsdom intentaría navegar de
 * verdad. Se registra después del guardia y en fase de burbuja, así que el
 * guardia decide primero.
 */
async function pulsarPestana(e: Editor): Promise<boolean> {
  let llego = false;
  const fin = (ev: Event) => {
    llego = true;
    ev.preventDefault();
  };
  e.m.documento.addEventListener('click', fin);
  try {
    await pulsar(e.pestana());
    return llego;
  } finally {
    e.m.documento.removeEventListener('click', fin);
  }
}

describe('salir del editor con cambios sin guardar', () => {
  const bien = async (): Promise<ResultadoGuardado> => ({ ok: true, version: 2, ids: {} });

  it('otra pestaña de la ficha no navega: pregunta antes', async () => {
    const e = registrar(await editor(bien));
    await ensuciar(e);

    assert.equal(await pulsarPestana(e), false, 'el clic no llega al enlace');
    assert.ok(e.dialogo(), 'y sale el aviso');
    assert.deepEqual(e.contador.ido, [], 'no se ha navegado a ningún sitio');
  });

  it('«Salir sin guardar» sale de verdad: el editor no es una trampa', async () => {
    const e = registrar(await editor(bien));
    await ensuciar(e);
    await pulsarPestana(e);

    const salir = e.boton('Salir sin guardar');
    assert.ok(salir, 'el aviso ofrece salir');
    await pulsar(salir);
    await esperar();

    assert.deepEqual(e.contador.ido, [RUTA_RESUMEN], 'y navega a donde se pulsó');
    assert.equal(e.dialogo(), null, 'el aviso se va');
  });

  it('«Seguir editando» se queda, y los cambios siguen ahí', async () => {
    const e = registrar(await editor(bien));
    await ensuciar(e);
    await pulsarPestana(e);
    const url = e.m.ventana.location.href;

    const quedarse = e.boton('Seguir editando');
    assert.ok(quedarse);
    await pulsar(quedarse);
    await esperar();

    assert.equal(e.dialogo(), null, 'el aviso se cierra');
    assert.deepEqual(e.contador.ido, [], 'y no se ha ido a ningún sitio');
    assert.equal(e.m.ventana.location.href, url, 'la dirección tampoco se mueve');
    assert.equal(
      e.m.documento.activeElement,
      e.pestana(),
      'y el foco vuelve a lo que se pulsó, no se queda en un diálogo que ya no existe',
    );
    // Si los cambios se hubieran perdido, el siguiente intento no preguntaría.
    assert.equal(await pulsarPestana(e), false);
    assert.ok(e.dialogo(), 'el borrador sigue sin guardar y vuelve a preguntar');
  });

  it('sin cambios nadie pregunta nada', async () => {
    const e = registrar(await editor(bien));

    assert.equal(await pulsarPestana(e), true, 'el clic llega al enlace');
    assert.equal(e.dialogo(), null, 'y no hay ningún aviso');
  });

  it('con la obra cerrada no hay cambios posibles ni aviso que dar', async () => {
    const e = registrar(await editor(bien, SALA, { cerrado: true }));
    assert.ok(e.texto().includes('La obra está cerrada'));

    assert.equal(await pulsarPestana(e), true);
    assert.equal(e.dialogo(), null);
  });

  it('el aviso es un diálogo modal con nombre, se lleva el foco y Escape cancela', async () => {
    const e = registrar(await editor(bien));
    await ensuciar(e);
    await pulsarPestana(e);

    const dialogo = e.dialogo();
    assert.ok(dialogo);
    assert.equal(dialogo.getAttribute('aria-modal'), 'true');
    const idTitulo = dialogo.getAttribute('aria-labelledby');
    assert.ok(idTitulo, 'el diálogo tiene nombre accesible');
    assert.ok(
      e.m.documento.getElementById(idTitulo)?.textContent?.includes('sin guardar'),
      'y ese nombre existe y dice de qué va',
    );

    const enfocado = e.m.documento.activeElement as HTMLElement;
    assert.equal(
      enfocado?.textContent,
      'Seguir editando',
      'el foco entra por la opción que no pierde nada',
    );

    const url = e.m.ventana.location.href;
    await teclear(enfocado, 'Escape');
    await esperar();
    // No basta con que el manejador exista: se comprueba que el diálogo se ha
    // ido de verdad del documento, que es lo que ve quien pulsa la tecla.
    assert.equal(e.dialogo(), null, 'Escape cancela');
    assert.deepEqual(e.contador.ido, [], 'y Escape nunca navega');
    assert.equal(e.m.ventana.location.href, url, 'ni cambia la dirección');
    assert.equal(
      e.m.documento.activeElement,
      e.pestana(),
      'y devuelve el foco a lo que se pulsó, no lo suelta al cuerpo del documento',
    );

    // El borrador tiene que seguir sucio: cancelar la salida no puede haberlo
    // descartado por el camino. Si se hubiera perdido, el editor dejaría salir
    // sin preguntar.
    assert.equal(await pulsarPestana(e), false, 'el clic sigue sin llegar al enlace');
    assert.ok(e.dialogo(), 'el borrador sigue sin guardar y vuelve a preguntar');
  });

  it('el botón atrás del navegador tampoco se lleva el borrador en silencio', async () => {
    const e = registrar(await editor(bien));
    await ensuciar(e);

    // Con cambios encima el guardia deja una entrada de sobra en el historial:
    // el botón atrás cae en ella y aquí se puede preguntar.
    e.m.ventana.history.back();
    await esperar(30);

    assert.ok(e.dialogo(), 'volver atrás pregunta');
    assert.ok(
      e.dialogo()?.textContent?.includes('Volver atrás'),
      'y dice de qué salida está hablando',
    );
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

describe('la barra de guardado en móvil', () => {
  const bien = async (): Promise<ResultadoGuardado> => ({ ok: true, version: 2, ids: {} });

  it('envuelve las acciones sin partir sus palabras y conserva los objetivos táctiles', async () => {
    const e = registrar(await editor(bien));
    const descartar = e.boton('Descartar');
    const guardar = e.boton('Guardar cambios');
    assert.ok(descartar && guardar);
    const grupo = descartar.parentElement;
    assert.ok(grupo?.classList.contains('flex-wrap'), 'el grupo puede saltar de línea a 320 px');
    assert.ok(descartar.classList.contains('whitespace-nowrap'));
    assert.ok(guardar.classList.contains('whitespace-nowrap'));
    assert.ok(descartar.classList.contains('min-h-11'));
    assert.ok(guardar.classList.contains('min-h-11'));
  });
});
