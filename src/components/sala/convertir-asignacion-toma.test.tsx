import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { montar, escribir, esperar, pulsar } from '@/pruebas/dom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ConvertirAsignacionToma } from './convertir-asignacion-toma';
import type { Conexion, EquipoEnSala, Puerto, TomaRed } from '@/lib/tipos';

const equipo: EquipoEnSala = { id: 'e', sala_id: 's', articulo_id: 'a', nombre: 'Codec', cantidad: 1,
  extremo: 'rack', posicion: { x_m: 0, y_m: 0, z_m: 0 }, posicion_confirmada: true,
  rotacion_grados: 0, toma_red_id: 't', toma_red_conexion_id: null };
const puerto: Puerto = { id: 'p', articulo_id: 'a', nombre: 'LAN', total: 2, sentido: 'bidireccional',
  senal: 'red', conector: 'RJ45', fuente: 'app', orden: 1, notas: null };
const toma: TomaRed = { id: 't', sala_id: 's', codigo: 'R1', capacidad_documentada: 2,
  codigo_referencia: null, codigo_confirmado: false, esquema_x: null, esquema_y: null,
  x_m: 0, y_m: 0, z_m: 0, ubicacion: null, notas: null,
  bocas: [1, 2].map((ordinal) => ({ id: `b${ordinal}`, toma_red_id: 't', ordinal, etiqueta: null, conector: 'RJ45', senal: 'red' })) };
const conexion: Conexion = { id: 'c', sala_id: 's', origen_id: 'e', destino_id: null,
  detalle: { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'e', puerto_id: 'p', ordinal: 1 },
    destino: { tipo: 'roseta', toma_boca_id: 'b1' } },
  senal: 'red', articulo_cable_id: null, ruta: null, longitud_manual_m: null, notas: null };
function vista(e = equipo, t = toma, conexiones: Conexion[] = []) {
  return new JSDOM(renderToStaticMarkup(<AppRouterContext.Provider value={{ refresh() {} } as AppRouterInstance}>
    <ConvertirAsignacionToma equipo={e} toma={t} puertos={[puerto]} conexiones={conexiones} version={1} cerrado={false} />
  </AppRouterContext.Provider>));
}

test('la conversión ofrece ordinal y boca libres exactos, sin asignarlos por defecto', () => {
  const dom = vista(equipo, toma, [conexion]);
  const equipoSelect = dom.window.document.querySelector<HTMLSelectElement>('[name="boca_equipo"]')!;
  const tomaSelect = dom.window.document.querySelector<HTMLSelectElement>('[name="toma_boca_id"]')!;
  assert.deepEqual([...equipoSelect.options].map((o) => o.value), ['', 'p|2']);
  assert.deepEqual([...tomaSelect.options].map((o) => o.value), ['', 'b2']);
  assert.equal(equipoSelect.value, '');
  assert.equal(tomaSelect.value, '');
  dom.window.close();
});
test('capacidad desconocida pide documentar y conexión vinculada no ofrece otra alta', () => {
  const desconocida = vista(equipo, { ...toma, capacidad_documentada: null, bocas: [] });
  assert.equal(desconocida.window.document.querySelector('form'), null);
  assert.ok(desconocida.window.document.body.textContent?.includes('documenta las bocas'));
  desconocida.window.close();
  const vinculada = vista({ ...equipo, toma_red_conexion_id: 'c' });
  assert.equal(vinculada.window.document.querySelector('form'), null);
  assert.equal(vinculada.window.document.querySelector('a')?.getAttribute('href'), '/salas/s/diagrama');
  vinculada.window.close();
});

test('enlaza explícitamente el cable existente en ambos sentidos y conserva su selección exacta', async () => {
  assert.equal(conexion.detalle.estado, 'completo');
  if (conexion.detalle.estado !== 'completo') throw new Error('Fixture incompleta');
  for (const detalle of [conexion.detalle, { ...conexion.detalle, origen: conexion.detalle.destino, destino: conexion.detalle.origen }]) {
    const recibidos: FormData[] = [];
    let refrescos = 0;
    const existente: Conexion = { ...conexion, detalle, articulo_cable_id: 'cable-existente', ruta: 'directo', longitud_manual_m: 7.25 };
    const convertirAccion = async (datos: FormData) => {
      recibidos.push(datos);
      return { ok: true as const, id: existente.id, version: 2 };
    };
    const m = await montar(<AppRouterContext.Provider value={{ refresh() { refrescos++; } } as AppRouterInstance}>
      <ConvertirAsignacionToma equipo={equipo} toma={toma} puertos={[puerto]} conexiones={[existente]}
        version={1} cerrado={false} convertirAccion={convertirAccion} />
    </AppRouterContext.Provider>);
    const selfAnterior = Object.getOwnPropertyDescriptor(globalThis, 'self');
    Object.defineProperty(globalThis, 'self', { configurable: true, value: m.ventana });
    try {
      const enlace = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Enlazar conexión existente'));
      assert.ok(enlace, 'las bocas ocupadas del mismo cable deben poder enlazarse explícitamente');
      assert.ok(enlace.textContent?.includes('LAN 1 → R1 · Boca 1'));
      assert.equal(recibidos.length, 0, 'no enlazar automáticamente');
      await pulsar(enlace);
      await esperar();
      assert.equal(recibidos.length, 1);
      assert.deepEqual(Object.fromEntries(recibidos[0]), {
        boca_equipo: 'p|1', toma_boca_id: 'b1', senal: 'red', ruta: 'directo', longitud_manual_m: '7.25',
        sala_id: 's', equipo_id: 'e', versionEsperada: '1', puerto_id: 'p', ordinal: '1', articulo_cable_id: 'cable-existente',
      });
      assert.equal(refrescos, 1);
      assert.equal(m.contenedor.querySelector('form') === null, true, 'ACK de enlace impide otra alta');
    } finally {
      await m.desmontar();
      if (selfAnterior) Object.defineProperty(globalThis, 'self', selfAnterior);
      else Reflect.deleteProperty(globalThis, 'self');
    }
  }
});

test('no ofrece enlazar conexiones de otra sala, equipo o roseta', () => {
  if (conexion.detalle.estado !== 'completo') throw new Error('Fixture incompleta');
  const ajenas: Conexion[] = [
    { ...conexion, sala_id: 'otra-sala' },
    { ...conexion, detalle: { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'otro', puerto_id: 'p', ordinal: 1 }, destino: conexion.detalle.destino } },
    { ...conexion, detalle: { estado: 'completo', origen: conexion.detalle.origen, destino: { tipo: 'roseta', toma_boca_id: 'otra-boca' } } },
  ];
  const dom = vista(equipo, toma, ajenas);
  try {
    assert.equal(dom.window.document.body.textContent?.includes('Enlazar conexión existente'), false);
  } finally { dom.window.close(); }
});

test('rechazo conserva selección y confirmación bloquea otra alta mientras llegan las props', async () => {
  const recibidos: FormData[] = [];
  let refrescos = 0;
  const convertirAccion = async (datos: FormData) => {
    recibidos.push(datos);
    return recibidos.length === 1
      ? { ok: false as const, detalle: 'La boca está ocupada.' }
      : { ok: true as const, id: 'confirmada', version: 2 };
  };
  const elemento = (version: number, vinculo: string | null = null) =>
    <AppRouterContext.Provider value={{ refresh() { refrescos++; } } as AppRouterInstance}>
      <ConvertirAsignacionToma equipo={{ ...equipo, toma_red_conexion_id: vinculo }} toma={toma}
        puertos={[puerto]} conexiones={[]} version={version} cerrado={false} convertirAccion={convertirAccion} />
    </AppRouterContext.Provider>;
  const m = await montar(elemento(1));
  const anterior = globalThis.FormData;
  const selfAnterior = Object.getOwnPropertyDescriptor(globalThis, 'self');
  try {
    const ventana = m.ventana as Window & typeof globalThis;
    globalThis.FormData = ventana.FormData;
    Object.defineProperty(globalThis, 'self', { configurable: true, value: ventana });
    for (const [nombre, valor] of [['boca_equipo', 'p|2'], ['toma_boca_id', 'b2'], ['senal', 'red'], ['ruta', 'directo']]) {
      const select = m.contenedor.querySelector<HTMLSelectElement>(`[name="${nombre}"]`)!;
      await act(async () => { select.value = valor; select.dispatchEvent(new ventana.Event('change', { bubbles: true })); });
    }
    await escribir(m.contenedor.querySelector<HTMLInputElement>('[name="longitud_manual_m"]')!, '7.25');
    const enviar = async () => {
      await act(async () => { m.contenedor.querySelector('form')!.dispatchEvent(new ventana.Event('submit', { bubbles: true, cancelable: true })); });
      await esperar();
    };
    await enviar();
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].get('puerto_id'), 'p');
    assert.equal(recibidos[0].get('ordinal'), '2');
    assert.equal(recibidos[0].get('toma_boca_id'), 'b2');
    assert.equal(recibidos[0].get('versionEsperada'), '1');
    assert.equal(m.contenedor.querySelector<HTMLSelectElement>('[name="boca_equipo"]')?.value, 'p|2');
    assert.equal(m.contenedor.querySelector<HTMLSelectElement>('[name="toma_boca_id"]')?.value, 'b2');
    assert.equal(m.contenedor.querySelector<HTMLInputElement>('[name="longitud_manual_m"]')?.value, '7.25');
    assert.ok(m.contenedor.textContent?.includes('La boca está ocupada.'));
    assert.equal(refrescos, 0);
    await enviar();
    assert.equal(recibidos.length, 2);
    assert.equal(refrescos, 1);
    assert.equal(m.contenedor.querySelector('form') === null, true, 'el ACK bloquea alta antes de actualizar props');
    await m.repintar(elemento(1));
    assert.equal(m.contenedor.querySelector('form') === null, true, 'props antiguas no reabren el formulario');
    await m.repintar(elemento(2, 'confirmada'));
    assert.equal(m.contenedor.querySelector('form') === null, true);
    await m.repintar(elemento(3));
    assert.ok(m.contenedor.querySelector('form'), 'una eliminación posterior sí permite reconectar');
  } finally {
    await m.desmontar();
    globalThis.FormData = anterior;
    if (selfAnterior) Object.defineProperty(globalThis, 'self', selfAnterior);
    else Reflect.deleteProperty(globalThis, 'self');
  }
});
