import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, act } from 'react';
import { montar, moverFoco, esperar, pulsar } from '@/pruebas/dom';
import { AltaEquipo } from './alta-equipo';
import { AvisosSeleccion, DatosEquipo } from './asistencia';
import { ErrorConcurrencia } from '@/lib/control-escritura';
import type { Puerto } from '@/lib/tipos';

// Next Link espera el alias de window propio del navegador.
Object.defineProperty(globalThis, 'self', { configurable: true, get: () => globalThis.window });

test('buscador remoto muestra aviso sin bloquear, envía id sin coordenadas y limpia tras añadir', async () => {
  const fetchOriginal = globalThis.fetch;
  const formDataOriginal = globalThis.FormData;
  const peticiones: string[] = [];
  const envios: FormData[] = [];
  globalThis.fetch = async (url) => {
    peticiones.push(String(url));
    if (String(url).endsWith('/hechos')) return Response.json([]);
    if (String(url).endsWith('/puertos')) return Response.json([{ id: 'p', articulo_id: 'eq', nombre: 'HDMI', total: 3, sentido: 'entrada', senal: 'hdmi' }]);
    return Response.json([{ id: 'eq', etiqueta: 'CISCO ROOM KIT EQ', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' }]);
  };
  const m = await montar(<AltaEquipo
    salaId="sala" equipos={[{ articulo_id: 'eq', nombre: 'CISCO ROOM KIT EQ', cantidad: 1, referencia: { marca: 'CISCO', modelo: 'ROOM KIT EQ', categoria: 'VIDEOCONFERENCIA' } }]}
    accion={async (datos) => { envios.push(datos); }}
  ><input name="x_m" type="number" /></AltaEquipo>);
  try {
    globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
    const campo = m.contenedor.querySelector('[role="combobox"]') as HTMLInputElement;
    await moverFoco(null, campo);
    await esperar(220);
    const opcion = m.contenedor.querySelector('[role="option"]');
    assert.ok(opcion);
    await pulsar(opcion);
    assert.ok(peticiones.length > 0);
    assert.ok(peticiones.some((url) => url.startsWith('/api/catalogo?') && url.includes('tipo=equipo')));
    assert.ok(peticiones.includes('/api/catalogo/eq/puertos'));
    assert.match(m.contenedor.textContent ?? '', /Entrada HDMI: 3/);
    assert.match(m.contenedor.textContent ?? '', /Ya hay videoconferencia/);
    assert.doesNotMatch(m.contenedor.textContent ?? '', /referencias repetidas|varias unidades de videoconferencia/);
    assert.match(m.contenedor.textContent ?? '', /falta micrófono/);
    assert.match(m.contenedor.textContent ?? '', /Puertos del Codec EQ incluido; cámara\/control se documentan aparte/);
    assert.match(m.contenedor.textContent ?? '', /Conectores de cámara y control no incluidos/);
    const boton = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Añadir equipo');
    assert.ok(boton);
    assert.equal(boton.disabled, false);
    const detalles = m.contenedor.querySelector('input[name="x_m"]')?.closest('details');
    assert.ok(detalles);
    assert.equal(detalles.open, false);
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios.length, 1);
    assert.equal(envios[0].get('articulo_id'), 'eq');
    assert.equal(envios[0].get('sala_id'), 'sala');
    assert.equal(envios[0].get('x_m'), '');
    assert.equal(envios[0].get('nombre'), null);
    assert.equal((m.contenedor.querySelector('input[name="articulo_id"]') as HTMLInputElement).value, '');
    assert.doesNotMatch(m.contenedor.textContent ?? '', /Ya hay videoconferencia/);
  } finally {
    await m.desmontar();
    globalThis.fetch = fetchOriginal;
    globalThis.FormData = formDataOriginal;
  }
});

test('error de puertos permite reintentar sin añadir equipo ni confundirlo con ausencia', async () => {
  const anterior = globalThis.fetch;
  let intentos = 0;
  let envios = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/hechos')) return Response.json([]);
    if (String(url).endsWith('/puertos')) {
      intentos++;
      return intentos === 1 ? new Response('', { status: 503 }) : Response.json([]);
    }
    return Response.json([{ id: 'a', etiqueta: 'CISCO EQ', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' }]);
  };
  const m = await montar(<AltaEquipo salaId="s" equipos={[]} accion={async () => { envios++; }}>{null}</AltaEquipo>);
  try {
    await moverFoco(null, m.contenedor.querySelector('[role="combobox"]')!);
    await esperar(220);
    await pulsar(m.contenedor.querySelector('[role="option"]')!);
    assert.match(m.contenedor.textContent ?? '', /No se han podido cargar/);
    assert.doesNotMatch(m.contenedor.textContent ?? '', /Sin datos de puertos/);
    const reintento = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Reintentar puertos');
    assert.ok(reintento);
    assert.equal(reintento.type, 'button');
    await pulsar(reintento);
    assert.equal(intentos, 2);
    assert.equal(envios, 0);
    assert.match(m.contenedor.textContent ?? '', /Sin datos de puertos/);
  } finally { await m.desmontar(); globalThis.fetch = anterior; }
});

test('resumen visible cuenta bocas por unidad y enlaza a ficha sin convertir ausencia en cero', async () => {
  const puerto: Puerto = { id: 'p', articulo_id: 'a', nombre: 'HDMI OUT', total: 3, sentido: 'salida', senal: 'hdmi', conector: null, orden: null, notas: null, fuente: 'csv' };
  const m = await montar(createElement(DatosEquipo, { equipo: { articulo_id: 'a', nombre: 'equipo', cantidad: 2 }, puertos: [puerto] }));
  try {
    assert.match(m.contenedor.textContent ?? '', /por unidad: Salida HDMI: 3/);
    assert.equal(m.contenedor.querySelector('a')?.getAttribute('href'), '/articulo/a');
    await m.repintar(createElement(DatosEquipo, { equipo: { articulo_id: 'b', nombre: 'otro', cantidad: 1 }, puertos: [puerto] }));
    assert.match(m.contenedor.textContent ?? '', /Sin datos de puertos/);
    assert.doesNotMatch(m.contenedor.textContent ?? '', /HDMI: 0/);
  } finally { await m.desmontar(); }
});

test('WEBEX ROOM BAR PRO no pinta captación integrada ni el PDF de Cisco', async () => {
  const m = await montar(createElement(DatosEquipo, {
    equipo: {
      articulo_id: 'w', nombre: 'WEBEX ROOM BAR PRO', cantidad: 1,
      referencia: { marca: 'CISCO', modelo: 'WEBEX ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' },
    },
    puertos: [],
    hechos: [],
  }));
  try {
    const texto = m.contenedor.textContent ?? '';
    assert.doesNotMatch(texto, /Micrófono integrado/);
    assert.equal(m.contenedor.querySelector('a[href*="cisco.com"]'), null);
    const conHecho = await montar(createElement(DatosEquipo, {
      equipo: {
        articulo_id: 'w', nombre: 'WEBEX ROOM BAR PRO', cantidad: 1,
        referencia: { marca: 'CISCO', modelo: 'WEBEX ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' },
      },
      puertos: [],
      hechos: [{
        clave: 'captacion-voz', concepto: 'Captación de voz', tipo: 'microfonia',
        estado: 'sin_documentar', valor: null, fuente: 'csv',
      }],
    }));
    try {
      assert.doesNotMatch(conHecho.contenedor.textContent ?? '', /Micrófono integrado/);
      assert.equal(conHecho.contenedor.querySelector('a[href*="cisco.com"]'), null);
    } finally { await conHecho.desmontar(); }
  } finally { await m.desmontar(); }
});

test('los hechos de un artículo no se enseñan bajo el siguiente mientras llegan los suyos', async () => {
  const anterior = globalThis.fetch;
  // Los hechos del segundo artículo no llegan nunca en esta prueba: es justo
  // la ventana en la que una respuesta antigua podría pisar a la nueva.
  let nunca: () => void = () => {};
  const pendiente = new Promise<Response>((resolver) => { nunca = () => resolver(Response.json([])); });
  globalThis.fetch = async (url) => {
    const texto = String(url);
    if (texto === '/api/catalogo/a/hechos') {
      return Response.json([{
        clave: 'captacion-voz', concepto: 'Captación documentada del equipo A', tipo: 'microfonia',
        estado: 'verificado', valor: { captacion: 'integrada' }, fuente: 'csv',
      }]);
    }
    if (texto === '/api/catalogo/b/hechos') return pendiente;
    if (texto.endsWith('/puertos')) return Response.json([]);
    return Response.json([
      { id: 'a', etiqueta: 'EQUIPO A', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' },
      { id: 'b', etiqueta: 'EQUIPO B', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' },
    ]);
  };
  const m = await montar(<AltaEquipo salaId="s" equipos={[]} accion={async () => {}}>{null}</AltaEquipo>);
  try {
    const campo = m.contenedor.querySelector('[role="combobox"]')!;
    await moverFoco(null, campo);
    await esperar(220);
    const primeras = m.contenedor.querySelectorAll('[role="option"]');
    assert.equal(primeras.length, 2);
    await pulsar(primeras[0]);
    await esperar(0);
    assert.match(m.contenedor.textContent ?? '', /Captación documentada del equipo A/);
    // Se vuelve a abrir la lista y se elige el segundo artículo.
    await moverFoco(campo, null);
    await moverFoco(null, campo);
    await esperar(220);
    const segundas = m.contenedor.querySelectorAll('[role="option"]');
    assert.equal(segundas.length, 2);
    await pulsar(segundas[1]);
    await esperar(0);
    const texto = m.contenedor.textContent ?? '';
    assert.doesNotMatch(texto, /Captación documentada del equipo A/, 'los hechos de A no pueden pisar a B');
    assert.match(texto, /EQUIPO B: micrófono integrado desconocido/);
    assert.doesNotMatch(texto, /No se han podido cargar los hechos técnicos/);
  } finally { nunca(); await m.desmontar(); globalThis.fetch = anterior; }
});

test('el aviso de duplicidad enseña causa, enlace al equipo y acción', async () => {
  const m = await montar(createElement(AvisosSeleccion, {
    equipos: [{
      articulo_id: 'kit', nombre: 'ROOM KIT EQ', cantidad: 1, equipo_id: 'eq-1',
      referencia: { marca: 'CISCO', modelo: 'ROOM KIT EQ', categoria: 'VIDEOCONFERENCIA' },
    }],
    candidato: {
      articulo_id: 'bar', nombre: 'ROOM BAR PRO', cantidad: 1,
      referencia: { marca: 'CISCO', modelo: 'ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' },
    },
  }));
  try {
    const texto = m.contenedor.textContent ?? '';
    assert.match(texto, /Ya hay videoconferencia/);
    assert.match(texto, /Revisar el equipo ya seleccionado/);
    const enlace = m.contenedor.querySelector('a[href="#equipo-eq-1"]');
    assert.ok(enlace);
    assert.equal(enlace.textContent, 'ROOM KIT EQ');
    assert.equal(m.contenedor.querySelector('[aria-live="polite"]')?.getAttribute('aria-live'), 'polite');
  } finally { await m.desmontar(); }
});

test('un rechazo de guardado conserva la selección; un fallo de puertos no es ese rechazo', async () => {
  const fetchOriginal = globalThis.fetch;
  const formDataOriginal = globalThis.FormData;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/hechos')) return Response.json([]);
    if (String(url).endsWith('/puertos')) return new Response('', { status: 503 });
    return Response.json([{ id: 'eq', etiqueta: 'CISCO ROOM KIT EQ', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' }]);
  };
  let envios = 0;
  const m = await montar(<AltaEquipo salaId="sala" equipos={[]} accion={async () => {
    envios++;
    throw new ErrorConcurrencia();
  }}>{null}</AltaEquipo>);
  try {
    globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
    await moverFoco(null, m.contenedor.querySelector('[role="combobox"]')!);
    await esperar(220);
    await pulsar(m.contenedor.querySelector('[role="option"]')!);
    assert.match(m.contenedor.textContent ?? '', /No se han podido cargar/);
    assert.equal(m.contenedor.querySelector('[role="alert"]'), null, 'el fallo de fetch no es un rechazo de guardado');
    const articulo = m.contenedor.querySelector('input[name="articulo_id"]') as HTMLInputElement;
    assert.equal(articulo.value, 'eq');
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios, 1);
    assert.ok(m.contenedor.querySelector('[role="alert"]'));
    assert.equal((m.contenedor.querySelector('input[name="articulo_id"]') as HTMLInputElement).value, 'eq');
    assert.match(m.contenedor.textContent ?? '', /CISCO ROOM KIT EQ|falta micrófono|desconocido/);
  } finally {
    await m.desmontar();
    globalThis.fetch = fetchOriginal;
    globalThis.FormData = formDataOriginal;
  }
});

test('si fallan los hechos se enseña el error y no se reconstruye la captación por nombre', async () => {
  const anterior = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/hechos')) return new Response('', { status: 503 });
    if (String(url).endsWith('/puertos')) return Response.json([]);
    return Response.json([{ id: 'bar', etiqueta: 'ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA', unidad: 'ud' }]);
  };
  const m = await montar(<AltaEquipo salaId="s" equipos={[]} accion={async () => {}}>{null}</AltaEquipo>);
  try {
    await moverFoco(null, m.contenedor.querySelector('[role="combobox"]')!);
    await esperar(220);
    await pulsar(m.contenedor.querySelector('[role="option"]')!);
    await esperar(0);
    const texto = m.contenedor.textContent ?? '';
    assert.match(texto, /No se han podido cargar los hechos técnicos/);
    assert.doesNotMatch(texto, /Micrófono integrado/);
    assert.equal(m.contenedor.querySelector('a[href*="cisco.com"]'), null);
    assert.equal(m.contenedor.querySelector('[role="alert"]'), null);
  } finally { await m.desmontar(); globalThis.fetch = anterior; }
});
