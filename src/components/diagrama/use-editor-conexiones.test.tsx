import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createElement, useEffect } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { montar, pulsar, esperar, type Montaje } from '@/pruebas/dom';
import { useEditorConexiones, type DatosEditor } from './use-editor-conexiones';
import type { EntradaGuardarEditorConexiones } from '@/lib/editor-conexiones';
import type { Puerto } from '@/lib/tipos';

const puertos: Puerto[] = ['salida', 'entrada'].map((sentido, i) => ({ id: `p${i}`, articulo_id: 'a1', nombre: sentido, total: 2, sentido: sentido as Puerto['sentido'], senal: 'hdmi', conector: 'HDMI', orden: i, notas: null, fuente: 'app' }));
const equipos: DatosEditor['equipos'] = ['e1', 'e2'].map((id) => ({ id, sala_id: 's1', articulo_id: 'a1', nombre: id, cantidad: 1, extremo: 'mesa', posicion: { x_m: 2, y_m: 3, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0 }));
let editor: ReturnType<typeof useEditorConexiones>;
let montaje: Montaje | undefined;
const fetchOriginal = globalThis.fetch;
afterEach(async () => { await montaje?.desmontar(); globalThis.fetch = fetchOriginal; });
function Harness({ datos }: { datos: DatosEditor }) {
  const actual = useEditorConexiones(datos);
  useEffect(() => { editor = actual; }, [actual]);
  return createElement('div', null,
    createElement('button', { onClick: () => actual.nuevaConexion({ equipo_id: 'e1', puerto_id: 'p0', ordinal: 2 }, { equipo_id: 'e2', puerto_id: 'p1', ordinal: 1 }) }, 'Conectar'),
    createElement('button', { onClick: () => actual.nuevaConexion() }, 'Incompleta'),
    createElement('button', { onClick: () => actual.mover('e1', { x: 700, y: 200 }) }, 'Mover'),
    createElement('button', { onClick: () => actual.anadirEquipo({ id: 'a1', etiqueta: 'Nuevo', categoria: 'Video', unidad: 'ud' }) }, 'Añadir'),
    createElement('button', { onClick: actual.guardarTodo }, 'Guardar'),
    createElement('button', { onClick: actual.descartar }, 'Descartar'),
  );
}
async function iniciar(guardar: DatosEditor['guardar'], extras: Partial<DatosEditor> = {}) {
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as unknown as AppRouterInstance;
  montaje = await montar(createElement(AppRouterContext.Provider, { value: router }, createElement(Harness, { datos: { salaId: 's1', version: 4, equipos, puertos, conexiones: [], cerrado: false, guardar, ...extras } })));
}
const clic = async (texto: string) => { await pulsar([...montaje!.contenedor.querySelectorAll('button')].find((b) => b.textContent === texto)!); await esperar(); };

test('un guardado lleva extremos concretos y posición visual; descartar restaura el borrador entero', async () => {
  const recibidas: EntradaGuardarEditorConexiones[] = [];
  await iniciar(async (entrada) => { recibidas.push(entrada); return { ok: true, version: 5, ids: Object.fromEntries(entrada.altas.map((a) => [a.temporal_id, 'c1'])) }; });
  await clic('Conectar'); await clic('Mover'); await clic('Guardar');
  assert.equal(recibidas.length, 1);
  assert.equal(recibidas[0].altas[0].puerto_origen_ordinal, 2);
  assert.equal(recibidas[0].altas[0].puerto_destino_ordinal, 1);
  assert.deepEqual(recibidas[0].posiciones, [{ equipo_id: 'e1', x: 700, y: 200 }, { equipo_id: 'e2', x: 540, y: 40 }]);
  assert.deepEqual(editor.equipos[0].posicion, { x_m: 2, y_m: 3, z_m: 1 });
  assert.equal(editor.hayCambios, false);
  await clic('Incompleta'); assert.equal(editor.hayCambios, true);
  await clic('Descartar'); assert.equal(editor.borrador.length, 1); assert.equal(editor.hayCambios, false);
});

test('conexión incompleta no desaparece al guardar ni permite llamada al servidor', async () => {
  let llamadas = 0;
  await iniciar(async () => { llamadas++; return { ok: true, version: 5, ids: {} }; });
  await clic('Incompleta'); await clic('Guardar');
  assert.equal(editor.hayCambios, true); assert.equal(editor.borrador.length, 1);
  assert.equal(llamadas, 0); assert.match(editor.estado!, /Completa las dos bocas/);
});

test('alta de equipo carga puertos y remapea ID visual sin confirmar posición física', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(puertos));
  const recibidas: EntradaGuardarEditorConexiones[] = [];
  await iniciar(async (entrada) => { recibidas.push(entrada); return { ok: true, version: 5, ids: {}, equipos_ids: { [entrada.equipos_alta![0].temporal_id]: 'e3' } }; });
  await clic('Añadir'); assert.equal(editor.altasEquipo.length, 1); assert.equal(editor.hayCambios, true);
  await clic('Guardar');
  assert.equal(recibidas[0].equipos_alta![0].articulo_id, 'a1');
  assert.equal(editor.equipos[2].id, 'e3'); assert.equal(editor.equipos[2].posicion_confirmada, false);
  assert.equal(editor.altasEquipo.length, 0); assert.equal(editor.hayCambios, false);
});

test('respuesta incierta conserva trabajo y bloquea repetición de altas', async () => {
  let llamadas = 0;
  await iniciar(async () => { llamadas++; throw new Error('red'); });
  await clic('Conectar'); await clic('Guardar'); await clic('Guardar');
  assert.equal(llamadas, 1); assert.equal(editor.enConflicto, true); assert.equal(editor.borrador.length, 1);
  assert.match(editor.estado!, /Recarga la sala/);
});

test('fallo de catálogo no crea un equipo ficticio y obra cerrada no modifica borrador', async () => {
  globalThis.fetch = async () => new Response('', { status: 500 });
  await iniciar(async () => ({ ok: true, version: 5, ids: {} }));
  await clic('Añadir'); assert.equal(editor.equipos.length, 2); assert.equal(editor.hayCambios, false);
  assert.match(editor.estado!, /No se pudieron cargar/);
  await montaje!.desmontar(); montaje = undefined;
  await iniciar(async () => { throw new Error('No debería guardar'); }, { cerrado: true });
  await clic('Mover'); await clic('Conectar'); await clic('Añadir');
  assert.equal(editor.hayCambios, false); assert.equal(editor.equipos.length, 2);
});

test('catálogo actualizado no permite marcar guardada una conexión que ya no cabe en el puerto', async () => {
  let llamadas = 0;
  globalThis.fetch = async () => new Response(JSON.stringify(puertos.map((p) => ({ ...p, total: 1 }))));
  await iniciar(async () => { llamadas++; return { ok: true, version: 5, ids: {} }; });
  await clic('Conectar'); await clic('Añadir'); await clic('Guardar');
  assert.equal(llamadas, 0);
  assert.equal(editor.borrador[0].temporal, true);
  assert.equal(editor.hayCambios, true);
  assert.match(editor.estado!, /Completa las dos bocas/);
});
