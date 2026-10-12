import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { montar, escribir, esperar } from '@/pruebas/dom';
import { BocasRoseta } from './bocas-roseta';
import type { TomaRed } from '@/lib/tipos';

const toma: TomaRed = {
  id: 't', sala_id: 's', codigo: 'R1', codigo_referencia: 'Original', codigo_confirmado: false,
  capacidad_documentada: null, bocas: [], x_m: null, y_m: null, z_m: null,
  esquema_x: null, esquema_y: null, ubicacion: null, notas: null,
};

test('cambiar capacidad pasando por vacío conserva las bocas aún sin guardar', async () => {
  const m = await montar(createElement(AppRouterContext.Provider, { value: { refresh() {} } as AppRouterInstance },
    createElement(BocasRoseta, { toma, version: 1, bloqueado: false, alGuardar() {} })));
  try {
    const capacidad = m.contenedor.querySelector<HTMLInputElement>('[name="capacidad_documentada"]')!;
    await escribir(capacidad, '2');
    await escribir(m.contenedor.querySelector<HTMLInputElement>('[name="conector_1"]')!, 'RJ45 medido');
    await escribir(capacidad, '');
    await escribir(capacidad, '3');
    assert.equal(m.contenedor.querySelector<HTMLInputElement>('[name="conector_1"]')?.value, 'RJ45 medido');
    assert.equal(m.contenedor.querySelector<HTMLInputElement>('[name="conector_3"]')?.value, '');
  } finally { await m.desmontar(); }
});

test('documentar primera boca envía decisión expresa y conserva campos al rechazar', async () => {
  const recibidos: FormData[] = [];
  const versiones: number[] = [];
  const router = { refresh() {} } as AppRouterInstance;
  const m = await montar(createElement(AppRouterContext.Provider, { value: router },
    createElement(BocasRoseta, { toma, version: 7, bloqueado: false, alGuardar: (v) => versiones.push(v),
      guardarAccion: async (datos) => { recibidos.push(datos); return { ok: false, detalle: 'La boca está ocupada.' }; },
    })));
  const formularioAnterior = globalThis.FormData;
  try {
    const ventana = m.ventana as Window & typeof globalThis;
    globalThis.FormData = ventana.FormData;
    const capacidad = m.contenedor.querySelector<HTMLInputElement>('[name="capacidad_documentada"]')!;
    assert.equal(capacidad.value, '');
    assert.equal(m.contenedor.querySelector('[name="senal_1"]'), null);
    await escribir(capacidad, '1');
    const senal = m.contenedor.querySelector<HTMLSelectElement>('[name="senal_1"]')!;
    assert.equal(senal.value, '', 'no presume la señal de una boca sin documentar');
    await act(async () => { senal.value = 'red'; senal.dispatchEvent(new ventana.Event('change', { bubbles: true })); });
    const conector = m.contenedor.querySelector<HTMLInputElement>('[name="conector_1"]')!;
    await escribir(conector, 'RJ45');
    const form = m.contenedor.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new ventana.Event('submit', { bubbles: true, cancelable: true })); });
    await esperar();
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].get('versionEsperada'), '7');
    assert.deepEqual(JSON.parse(String(recibidos[0].get('bocas'))), [
      { ordinal: 1, etiqueta: null, senal: 'red', conector: 'RJ45' },
    ]);
    assert.equal(conector.value, 'RJ45');
    assert.equal(capacidad.value, '1');
    assert.equal(senal.value, 'red');
    assert.deepEqual(versiones, []);
    assert.ok(m.contenedor.textContent?.includes('La boca está ocupada.'));
  } finally { globalThis.FormData = formularioAnterior; await m.desmontar(); }
});
