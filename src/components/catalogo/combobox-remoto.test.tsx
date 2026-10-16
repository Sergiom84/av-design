/**
 * El combobox, montado.
 *
 * `src/lib/combobox.test.ts` prueba los mensajes y cuándo se puede reintentar,
 * que es lógica pura. Lo que no puede probar es el navegador: que el panel siga
 * abierto cuando el foco pasa al botón `Reintentar`, que `Enter` reintente
 * desde el estado de error, y que dentro del `role="listbox"` no haya nada que
 * no sea una opción. Eso es lo que se comprueba aquí, con un DOM de verdad y
 * empujando con eventos.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createElement } from 'react';

import { montar, esperar, moverFoco, pulsar, teclear, escribir, type Montaje } from '@/pruebas/dom';
import { ComboboxRemoto, type OpcionCombobox } from './combobox-remoto';
import { BuscadorArticulo } from './buscador-articulo';

const OPCIONES: OpcionCombobox[] = [
  { id: '1', etiqueta: 'Samsung QB65R', detalle: 'PANTALLAS' },
  { id: '2', etiqueta: 'Samsung QB65R-B', detalle: 'PANTALLAS' },
];

/** Espera más que los 150 ms que el combobox deja pasar entre teclas. */
const TRAS_LA_ESPERA_MS = 220;

interface Caso {
  m: Montaje;
  campo: HTMLInputElement;
  lista: HTMLElement;
  panel: HTMLElement;
  reintentar: () => HTMLButtonElement | null;
  opciones: () => HTMLElement[];
}

async function abierto(
  buscar: (consulta: string, signal: AbortSignal) => Promise<OpcionCombobox[]>,
  alElegir?: (o: OpcionCombobox | null) => void,
): Promise<Caso> {
  const m = await montar(
    createElement(ComboboxRemoto, { etiqueta: 'Referencia', buscar, alElegir }),
  );
  const campo = m.contenedor.querySelector('input[role="combobox"]') as HTMLInputElement;
  await moverFoco(null, campo);
  await esperar(TRAS_LA_ESPERA_MS);
  const lista = m.contenedor.querySelector('[role="listbox"]') as HTMLElement;
  return {
    m,
    campo,
    lista,
    panel: lista.parentElement as HTMLElement,
    reintentar: () =>
      ([...m.contenedor.querySelectorAll('button')].find(
        (b) => b.textContent === 'Reintentar',
      ) ?? null) as HTMLButtonElement | null,
    opciones: () => [...m.contenedor.querySelectorAll('[role="option"]')] as HTMLElement[],
  };
}

const montados: Montaje[] = [];
const registrar = async (c: Caso) => {
  montados.push(c.m);
  return c;
};

after(async () => {
  for (const m of montados) await m.desmontar();
});

describe('el combobox con un fallo de red', () => {
  it('el botón Reintentar se puede alcanzar con el foco sin que se cierre el panel', async () => {
    const c = await registrar(await abierto(async () => { throw new Error('HTTP 500'); }));

    const boton = c.reintentar();
    assert.ok(boton, 'con la búsqueda caída sale el botón de reintentar');

    // Tabular lleva el foco del campo al botón. Antes el `blur` del campo
    // cerraba el panel y el botón desaparecía justo antes de recibirlo.
    await moverFoco(c.campo, boton);
    assert.equal(c.panel.hidden, false, 'el panel sigue abierto con el foco en el botón');
    assert.ok(c.reintentar(), 'y el botón sigue en la página');
  });

  it('salir del combobox de verdad sí lo cierra', async () => {
    const c = await registrar(await abierto(async () => { throw new Error('HTTP 500'); }));
    const fuera = c.m.documento.createElement('button');
    c.m.documento.body.appendChild(fuera);

    await moverFoco(c.campo, fuera);
    assert.equal(c.panel.hidden, true, 'el foco se fue del bloque: se cierra');
  });

  it('Enter desde el estado de error reintenta y recupera los resultados', async () => {
    let intentos = 0;
    const buscar = async () => {
      intentos += 1;
      if (intentos === 1) throw new Error('HTTP 500');
      return OPCIONES;
    };
    const c = await registrar(await abierto(buscar));
    assert.ok(c.reintentar(), 'primero falla');
    assert.equal(c.opciones().length, 0);

    await teclear(c.campo, 'Enter');
    await esperar(TRAS_LA_ESPERA_MS);

    assert.equal(c.reintentar(), null, 'el error se ha ido');
    assert.equal(c.opciones().length, 2, 'y vuelven los resultados');
  });

  it('pulsar Reintentar hace lo mismo que Enter', async () => {
    let intentos = 0;
    const buscar = async () => {
      intentos += 1;
      if (intentos === 1) throw new Error('HTTP 500');
      return OPCIONES;
    };
    const c = await registrar(await abierto(buscar));
    const boton = c.reintentar();
    assert.ok(boton);

    await moverFoco(c.campo, boton);
    await pulsar(boton);
    await esperar(TRAS_LA_ESPERA_MS);

    assert.equal(c.opciones().length, 2);
  });

  it('el botón de reintentar no cuelga del listbox: un botón no es una opción', async () => {
    const c = await registrar(await abierto(async () => { throw new Error('HTTP 500'); }));
    const boton = c.reintentar();
    assert.ok(boton);
    assert.equal(
      c.lista.contains(boton),
      false,
      'el listbox solo puede contener opciones',
    );
    assert.equal(c.lista.children.length, 0, 'sin resultados, el listbox va vacío');
  });
});

describe('el DOM del combobox con resultados', () => {
  it('notifica pérdida de acceso401/403 y distingue el fallo de servicio', async () => {
    const fetchAnterior = globalThis.fetch;
    try {
      for (const estado of [401, 403, 503]) {
        let retiradas = 0;
        globalThis.fetch = async () => new Response(null, { status: estado });
        const m = await montar(createElement(BuscadorArticulo, { etiqueta: 'Artículo', alErrorAcceso: () => { retiradas++; } }));
        try {
          await moverFoco(null, m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement);
          await esperar(TRAS_LA_ESPERA_MS);
          assert.equal(retiradas, estado === 503 ? 0 : 1);
          assert.equal(m.contenedor.querySelectorAll('[role=option]').length, 0);
        } finally { await m.desmontar(); }
      }
    } finally { globalThis.fetch = fetchAnterior; }
  });

  it('una búsqueda cancelada no retira el contexto por un401 tardío', async () => {
    const fetchAnterior = globalThis.fetch;
    let terminar!: (r: Response) => void;
    const pendiente = new Promise<Response>(r => { terminar = r; });
    let llamadas = 0, retiradas = 0;
    globalThis.fetch = async () => ++llamadas === 1 ? pendiente : Response.json([]);
    const m = await montar(createElement(BuscadorArticulo, { etiqueta: 'Artículo', alErrorAcceso: () => { retiradas++; } }));
    try {
      const campo = m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement;
      await moverFoco(null, campo); await esperar(TRAS_LA_ESPERA_MS);
      await escribir(campo, 'Otra búsqueda'); await esperar(TRAS_LA_ESPERA_MS);
      terminar(new Response(null, { status: 401 })); await esperar(20);
      assert.equal(llamadas, 2); assert.equal(retiradas, 0);
    } finally { await m.desmontar(); globalThis.fetch = fetchAnterior; }
  });

  it('editar o borrar una elección notifica null antes de otra búsqueda', async () => {
    const elegidas: (OpcionCombobox | null)[] = [];
    const c = await registrar(await abierto(async () => OPCIONES, o => elegidas.push(o)));
    await teclear(c.campo, 'Enter');
    await escribir(c.campo, 'Otro texto');
    assert.deepEqual(elegidas, [OPCIONES[0], null]);
    await escribir(c.campo, '');
    assert.deepEqual(elegidas, [OPCIONES[0], null], 'La misma elección ya fue retirada.');
    await esperar(TRAS_LA_ESPERA_MS);
    await teclear(c.campo, 'Enter');
    await escribir(c.campo, '');
    assert.deepEqual(elegidas, [OPCIONES[0], null, OPCIONES[0], null]);
  });

  it('el modo de añadir y vaciar no revoca una incorporación al escribir de nuevo', async () => {
    const elegidas: (OpcionCombobox | null)[] = [];
    const m = await montar(createElement(ComboboxRemoto, { etiqueta: 'Añadir', buscar: async () => OPCIONES,
      vaciarAlElegir: true, alElegir: o => elegidas.push(o) }));
    montados.push(m);
    const campo = m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement;
    await moverFoco(null, campo); await esperar(TRAS_LA_ESPERA_MS); await teclear(campo, 'Enter');
    assert.equal(campo.value, '');
    await escribir(campo, 'La siguiente incorporación');
    assert.deepEqual(elegidas, [OPCIONES[0]]);
  });

  it('el selector de artículo elimina también su identificador oculto al editar el texto elegido', async () => {
    const fetchAnterior = globalThis.fetch;
    globalThis.fetch = async () => Response.json([{ id: 'referencia', etiqueta: 'Artículo elegido', categoria: 'Pantalla', unidad: 'ud' }]);
    const m = await montar(createElement(BuscadorArticulo, { etiqueta: 'Artículo' }));
    try {
      const campo = m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement;
      const oculto = m.contenedor.querySelector('input[type=hidden]') as HTMLInputElement;
      await moverFoco(null, campo); await esperar(TRAS_LA_ESPERA_MS); await teclear(campo, 'Enter');
      assert.equal(oculto.value, 'referencia');
      await escribir(campo, 'Artículo en revisión');
      assert.equal(oculto.value, '');
    } finally { await m.desmontar(); globalThis.fetch = fetchAnterior; }
  });

  it('dentro del listbox no hay nada que no sea una opción', async () => {
    const c = await registrar(await abierto(async () => OPCIONES));
    assert.equal(c.opciones().length, 2);
    for (const hijo of [...c.lista.children]) {
      assert.equal(hijo.getAttribute('role'), 'option', `hijo con role ${hijo.getAttribute('role')}`);
    }
    assert.equal(c.lista.getAttribute('aria-label'), 'Referencia');
    assert.equal(c.campo.getAttribute('aria-controls'), c.lista.id);
    assert.equal(c.campo.getAttribute('aria-expanded'), 'true');
  });

  it('las flechas recorren la lista y Enter elige', async () => {
    const elegidas: (OpcionCombobox | null)[] = [];
    const c = await registrar(await abierto(async () => OPCIONES, (o) => elegidas.push(o)));

    assert.equal(c.opciones()[0].getAttribute('aria-selected'), 'true');
    await teclear(c.campo, 'ArrowDown');
    assert.equal(c.opciones()[1].getAttribute('aria-selected'), 'true');
    assert.equal(
      c.campo.getAttribute('aria-activedescendant'),
      c.opciones()[1].id,
      'el campo apunta a la opción activa',
    );

    await teclear(c.campo, 'Enter');
    assert.deepEqual(elegidas, [OPCIONES[1]]);
    assert.equal(c.campo.value, 'Samsung QB65R-B');
  });

  it('Escape cierra sin elegir', async () => {
    const elegidas: (OpcionCombobox | null)[] = [];
    const c = await registrar(await abierto(async () => OPCIONES, (o) => elegidas.push(o)));
    await teclear(c.campo, 'Escape');
    assert.equal(c.panel.hidden, true);
    assert.deepEqual(elegidas, []);
  });

  it('el tabulador ya no cierra la lista por su cuenta: lo decide el foco', async () => {
    const c = await registrar(await abierto(async () => OPCIONES));
    await teclear(c.campo, 'Tab');
    assert.equal(
      c.panel.hidden,
      false,
      'cerrar en la tecla quitaba de la página lo que iba a recibir el foco',
    );
  });
});
