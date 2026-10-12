import assert from 'node:assert/strict';
import { it } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar, teclear } from '@/pruebas/dom';
import { LienzoConexiones } from './lienzo-conexiones';
import { bloquesDelLienzo, conexionesSinDibujar, puntoDeBoca } from '@/lib/lienzo-conexiones';
import type { ExtremoConexion, Conexion, EquipoEnSala, Puerto } from '@/lib/tipos';
import { rosetaEnsayo } from './roseta.fixture';

const equipos: EquipoEnSala[] = ['Cámara', 'Pantalla', 'Sin puertos'].map((nombre, i) => ({ id: `e${i}`, articulo_id: `a${i}`, nombre, sala_id: 's', cantidad: 1, extremo: 'pantalla', posicion: { x_m: 0, y_m: 0, z_m: 0 }, posicion_confirmada: false, rotacion_grados: 0 }));
const puertos: Puerto[] = ['salida', 'entrada'].map((sentido, i) => ({ id: `p${i}`, articulo_id: `a${i}`, nombre: i ? 'HDMI IN' : 'HDMI OUT', total: 2, sentido: sentido as Puerto['sentido'], senal: 'hdmi', conector: 'HDMI A', orden: 1, notas: null, fuente: 'app' }));

const pareja: Conexion['detalle'] = { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'e0', puerto_id: 'p0', ordinal: 1 }, destino: { tipo: 'equipo', equipo_id: 'e1', puerto_id: 'p1', ordinal: 2 } };

it('roseta conecta su boca exacta por clic y teclado mueve solo el bloque lógico', async () => {
  const llamadas: ExtremoConexion[][] = [], movimientos: unknown[] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [], posiciones: {},
    tomas: [rosetaEnsayo], posicionesRosetas: {}, onMoverRoseta: (...args) => movimientos.push(args),
    onMover() {}, onConectar: (a, b) => llamadas.push([a, b]), onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    await pulsar(m.contenedor.querySelector('[data-boca="e0:p0:2"]')!);
    await pulsar(m.contenedor.querySelector('[data-boca="roseta:r2"]')!);
    assert.deepEqual(llamadas, [[{ tipo: 'equipo', equipo_id: 'e0', puerto_id: 'p0', ordinal: 2 }, { tipo: 'roseta', toma_boca_id: 'r2' }]]);
    await teclear(m.contenedor.querySelector('[aria-label="Mover R-12"]')!, 'ArrowRight');
    assert.deepEqual(movimientos, [['t1', { x: 910, y: 80 }]]);
    assert.deepEqual([rosetaEnsayo.x_m, rosetaEnsayo.y_m, rosetaEnsayo.z_m], [0, 0, null]);
  } finally { await m.desmontar(); }
});

it('dibuja equipos desconectados y conecta las bocas exactas por clic, incluso empezando en entrada', async () => {
  const llamadas: ExtremoConexion[][] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover() {}, onConectar: (a, b) => llamadas.push([a, b]), onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    assert.equal(m.contenedor.querySelectorAll('button[aria-label^="Mover "]').length, 3);
    assert.match(m.contenedor.textContent!, /Sin puertos en el catálogo/);
    await pulsar(m.contenedor.querySelector('[data-boca="e1:p1:2"]')!);
    await pulsar(m.contenedor.querySelector('[data-boca="e0:p0:1"]')!);
    assert.deepEqual(llamadas, [[{ tipo: 'equipo', equipo_id: 'e0', puerto_id: 'p0', ordinal: 1 }, { tipo: 'equipo', equipo_id: 'e1', puerto_id: 'p1', ordinal: 2 }]].map((pair) => pair));
  } finally { await m.desmontar(); }
});

it('Escape cancela y las flechas mueven el bloque sin tocar coordenadas físicas', async () => {
  const llamadas: unknown[] = []; const movimientos: unknown[] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover: (...args) => movimientos.push(args), onConectar: (...args) => llamadas.push(args), onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    const origen = m.contenedor.querySelector('[data-boca="e0:p0:1"]')!;
    await pulsar(origen); await teclear(origen, 'Escape');
    await pulsar(m.contenedor.querySelector('[data-boca="e1:p1:2"]')!);
    assert.equal(llamadas.length, 0);
    await teclear(m.contenedor.querySelector('button[aria-label="Mover Cámara"]')!, 'ArrowRight');
    assert.deepEqual(movimientos, [['e0', { x: 50, y: 40 }]]);
    assert.deepEqual(equipos[0].posicion, { x_m: 0, y_m: 0, z_m: 0 });
  } finally { await m.desmontar(); }
});

it('arrastrar entre bocas emite ordinales exactos y no duplica por clic posterior', async () => {
  const llamadas: ExtremoConexion[][] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover() {}, onConectar: (a, b) => llamadas.push([a, b]), onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    const origen = m.contenedor.querySelector('[data-boca="e0:p0:2"]')!;
    const destino = m.contenedor.querySelector('[data-boca="e1:p1:1"]')!;
    const W = m.ventana as Window & typeof globalThis;
    await act(async () => { origen.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10 })); destino.dispatchEvent(new W.MouseEvent('pointerup', { bubbles: true, clientX: 300 })); });
    await pulsar(destino);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0], [{ tipo: 'equipo', equipo_id: 'e0', puerto_id: 'p0', ordinal: 2 }, { tipo: 'equipo', equipo_id: 'e1', puerto_id: 'p1', ordinal: 1 }]);
    assert.equal(m.contenedor.querySelector('[aria-pressed="true"]'), null);
  } finally { await m.desmontar(); }
});

it('las líneas llegan a distinta altura para cada ordinal y siguen las posiciones visuales', () => {
  const bloques = bloquesDelLienzo(equipos, puertos, { e0: { x: 150, y: 200 } });
  assert.deepEqual(puntoDeBoca(bloques, { equipo_id: 'e0', puerto_id: 'p0', ordinal: 1 }), { x: 510, y: 294 });
  assert.deepEqual(puntoDeBoca(bloques, { equipo_id: 'e0', puerto_id: 'p0', ordinal: 2 }), { x: 510, y: 338 });
});

it('una conexión sin bocas no se dibuja, se cuenta y se puede seleccionar', async () => {
  const historica: Conexion = { id: 'c9', etiqueta_cable: 'HD-1009', detalle: { estado: 'legacy' }, sala_id: 's', origen_id: 'e0', destino_id: 'e1', puerto_origen_id: null, puerto_origen_ordinal: null, puerto_destino_id: null, puerto_destino_ordinal: null, articulo_cable_id: null, senal: 'hdmi', ruta: null, longitud_manual_m: null, notas: null };
  const dibujada: Conexion = { ...historica, id: 'c1', detalle: pareja, puerto_origen_id: 'p0', puerto_origen_ordinal: 1, puerto_destino_id: 'p1', puerto_destino_ordinal: 2 };
  const bloques = bloquesDelLienzo(equipos, puertos, {});
  assert.deepEqual(conexionesSinDibujar(bloques, [dibujada, historica]), ['c9']);
  // Un equipo borrado del borrador deja su conexión sin extremo aunque tenga bocas.
  assert.deepEqual(conexionesSinDibujar(bloquesDelLienzo([equipos[0]], puertos, {}), [dibujada]), ['c1']);
  const seleccionadas: string[] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [dibujada, historica], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover() {}, onConectar() {}, onSeleccionarConexion: (id: string) => seleccionadas.push(id), conexionSeleccionada: null, bloqueado: false }));
  try {
    assert.equal(m.contenedor.querySelectorAll('svg[aria-label="Cables del esquema"] > g').length, 1);
    await pulsar(m.contenedor.querySelector('button[aria-label="Ver la primera de 1 conexiones sin bocas"]')!);
    assert.deepEqual(seleccionadas, ['c9']);
  } finally { await m.desmontar(); }
});

it('las bocas ocupadas seleccionan su cable y el modo bloqueado no permite conectar', async () => {
  const conexiones: Conexion[] = [{ id: 'c1', etiqueta_cable: 'HD-1000', detalle: pareja, sala_id: 's', origen_id: 'e0', destino_id: 'e1', puerto_origen_id: 'p0', puerto_origen_ordinal: 1, puerto_destino_id: 'p1', puerto_destino_ordinal: 2, articulo_cable_id: null, senal: 'hdmi', ruta: null, longitud_manual_m: null, notas: null }];
  const seleccionadas: string[] = []; const llamadas: unknown[] = [];
  const props = { equipos, puertos, conexiones, posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover() {}, onConectar: (...args: ExtremoConexion[]) => llamadas.push(args), onSeleccionarConexion: (id: string) => seleccionadas.push(id), conexionSeleccionada: null, bloqueado: false };
  const m = await montar(createElement(LienzoConexiones, props));
  try {
    await pulsar(m.contenedor.querySelector('[data-boca="e0:p0:1"]')!);
    assert.deepEqual(seleccionadas, ['c1']); assert.equal(llamadas.length, 0);
    await m.repintar(createElement(LienzoConexiones, { ...props, bloqueado: true }));
    await pulsar(m.contenedor.querySelector('[data-boca="e0:p0:2"]')!);
    await pulsar(m.contenedor.querySelector('[data-boca="e1:p1:1"]')!);
    assert.equal(llamadas.length, 0);
  } finally { await m.desmontar(); }
});

it('el arrastre de cabecera confirma su posición visual al soltar', async () => {
  const movimientos: unknown[] = [];
  const m = await montar(createElement(LienzoConexiones, { equipos, puertos, conexiones: [], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover: (...args) => movimientos.push(args), onConectar() {}, onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    const cabecera = m.contenedor.querySelector('button[aria-label="Mover Cámara"]')! as HTMLElement;
    cabecera.setPointerCapture = () => {};
    const W = m.ventana as Window & typeof globalThis;
    await act(async () => { cabecera.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })); cabecera.dispatchEvent(new W.MouseEvent('pointermove', { bubbles: true, clientX: 110, clientY: 80 })); cabecera.dispatchEvent(new W.MouseEvent('pointerup', { bubbles: true, clientX: 110, clientY: 80 })); });
    assert.deepEqual(movimientos, [['e0', { x: 140, y: 110 }]]);
  } finally { await m.desmontar(); }
});

it('distingue equipos iguales, rechaza unidades agrupadas y no ensucia por clic quieto', async () => {
  const llamadas: unknown[] = []; const movimientos: unknown[] = [];
  const iguales = [{ ...equipos[0], nombre: 'Pantalla', cantidad: 2 }, equipos[1]];
  const m = await montar(createElement(LienzoConexiones, { equipos: iguales, puertos, conexiones: [], posiciones: {}, tomas: [], posicionesRosetas: {}, onMoverRoseta() {}, onMover: (...args) => movimientos.push(args), onConectar: (...args) => llamadas.push(args), onSeleccionarConexion() {}, conexionSeleccionada: null, bloqueado: false }));
  try {
    const cabecera = m.contenedor.querySelector('button[aria-label="Mover Pantalla · 1"]')! as HTMLElement;
    assert.ok(cabecera); assert.ok(m.contenedor.querySelector('button[aria-label="Mover Pantalla · 2"]'));
    await pulsar(m.contenedor.querySelector('[data-boca="e0:p0:1"]')!);
    await pulsar(m.contenedor.querySelector('[data-boca="e1:p1:1"]')!);
    assert.equal(llamadas.length, 0);
    cabecera.setPointerCapture = () => {};
    const W = m.ventana as Window & typeof globalThis;
    await act(async () => { cabecera.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })); cabecera.dispatchEvent(new W.MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 })); });
    assert.deepEqual(movimientos, []);
  } finally { await m.desmontar(); }
});
