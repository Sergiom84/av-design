import React, { act } from 'react';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { montar, pulsar, escribir, esperar } from '@/pruebas/dom';
import { Importador } from './importador';
import type { PreviewImportacion } from '@/lib/importacion/modelo';
Object.assign(globalThis, { React });
const sala = { id: 'b1000000-0000-4000-8000-000000009000', nombre: 'Sala REA01 B' };
const id = 'b1000000-0000-4000-8000-000000000001';
const vista: PreviewImportacion = { destino: 'bom', salaId: sala.id, origen: 'Fuente', previewHash: 'a'.repeat(64),
  archivo: { nombre: 'PRUEBA-B.csv', sha256: 'b'.repeat(64), bytes: 20, formato: 'csv' },
  resumen: { filas: 1, altas: 0, coincidencias: 1, ambiguas: 0, rechazadas: 0, noEncontradas: 0 },
  filas: [{ fila: 2, datos: { referencia: 'ORIG', cantidad: '3', unidad: 'ud' }, estado: 'coincidencia', errores: [], avisos: [],
    candidatos: [{ id, etiqueta: 'Original', tipo: 'equipo', unidad: 'ud', categoria: 'Pantalla', activo: true, revision: 1 }] }],
};
async function preparar(m: Awaited<ReturnType<typeof montar>>) {
  const ventana = m.ventana as Window & typeof globalThis;
  const origen = [...m.contenedor.querySelectorAll('input')].find(i => i.maxLength === 500)!;
  await escribir(origen, 'Fuente');
  const archivo = m.contenedor.querySelector('input[type=file]')!;
  Object.defineProperty(archivo, 'files', { configurable: true, value: [new File(['fuente'], 'PRUEBA-B.csv')] });
  await act(async () => archivo.dispatchEvent(new ventana.Event('change', { bubbles: true })));
  await act(async () => m.contenedor.querySelector('form')!.dispatchEvent(new ventana.Event('submit', { bubbles: true, cancelable: true })));
  await esperar();
}
it('selección masiva, revisión final y desmarcado invalidan exactamente la confirmación visible', async () => {
  const anterior = globalThis.fetch; let revisiones = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/lotes')) return Response.json([]);
    if (String(url) === '/api/importacion') {
      const seleccion = (init?.body as FormData).get('seleccion');
      if (!seleccion) return Response.json(vista);
      revisiones++;
      return Response.json({ ...vista, previewHash: 'c'.repeat(64), seleccionRevisada: [{ seleccion: { fila: 2, articuloId: id, revisionArticulo: 1 }, original: vista.filas[0].candidatos[0], destino: vista.filas[0].candidatos[0], cantidad: 3, unidad: 'ud', tipoOrigen: 'equipo', fuenteTipo: 'catalogo', datosOriginales: vista.filas[0].datos }] });
    }
    throw new Error(`Petición inesperada ${String(url)}`);
  };
  const m = await montar(<Importador sala={sala} puedeBom puedeCatalogo/>);
  const boton = (texto: string) => [...m.contenedor.querySelectorAll('button')].find(b => b.textContent?.includes(texto))!;
  try {
    await preparar(m);
    await pulsar(boton('Seleccionar coincidencias válidas'));
    assert.equal((boton('Confirmar 1') as HTMLButtonElement).disabled, true);
    await pulsar(boton('Revisar selección')); await esperar();
    assert.equal(revisiones, 1); assert.equal((boton('Confirmar 1') as HTMLButtonElement).disabled, false);
    assert.ok(m.contenedor.textContent?.includes('Selección revisada para confirmar'));
    await pulsar(boton('Desmarcar todas'));
    assert.equal(m.contenedor.querySelector('input[aria-label="Incluir fila 2"]')?.getAttribute('checked'), null);
    assert.equal((boton('Confirmar 0') as HTMLButtonElement).disabled, true);
    assert.ok(!m.contenedor.textContent?.includes('Selección revisada para confirmar'));
    await pulsar(boton('Usar alternativa'));
    const motivo = m.contenedor.querySelector('textarea')!;
    const vistaDom = m.ventana as Window & typeof globalThis;
    await act(async () => {
      Object.getOwnPropertyDescriptor(vistaDom.HTMLTextAreaElement.prototype, 'value')!.set!.call(motivo, 'Motivo que debe desaparecer');
      motivo.dispatchEvent(new vistaDom.Event('input', { bubbles: true }));
    });
    await pulsar(boton('Desmarcar todas'));
    assert.equal(m.contenedor.querySelector('textarea'), null);
    assert.equal((boton('Confirmar 0') as HTMLButtonElement).disabled, true);
  } finally { await m.desmontar(); globalThis.fetch = anterior; }
});

it('una revisión antigua no restaura preview, selección o hash tras otra respuesta y cambio de fuente', async () => {
  const anterior = globalThis.fetch; const respuestas: Array<(respuesta: Response) => void> = [];
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/lotes')) return Response.json([]);
    if (String(url) === '/api/importacion') return new Promise<Response>(resolver => respuestas.push(resolver));
    throw new Error(`Petición inesperada ${String(url)}`);
  };
  const m = await montar(<Importador sala={sala} puedeBom puedeCatalogo/>);
  try {
    await preparar(m); await preparar(m); assert.equal(respuestas.length, 2);
    await act(async () => respuestas[1](Response.json({ ...vista, archivo: { ...vista.archivo, nombre: 'REVISIÓN-NUEVA.csv' } })));
    await esperar();
    await act(async () => respuestas[0](Response.json({ ...vista, archivo: { ...vista.archivo, nombre: 'ANTIGUA.csv' } })));
    await esperar();
    assert.ok(m.contenedor.textContent?.includes('REVISIÓN-NUEVA.csv'));
    assert.ok(!m.contenedor.textContent?.includes('ANTIGUA.csv'));
    const origen = [...m.contenedor.querySelectorAll('input')].find(i => i.maxLength === 500)!;
    await escribir(origen, 'Otra procedencia');
    assert.ok(!m.contenedor.textContent?.includes('Revisión antes de guardar'));
    assert.ok(!m.contenedor.textContent?.includes('Selección revisada para confirmar'));
  } finally { await m.desmontar(); globalThis.fetch = anterior; }
});

it('editar o vaciar el buscador después de revisar una alternativa elimina la revisión y bloquea confirmar', async () => {
  const anterior = globalThis.fetch;
  const alternativo = { ...vista.filas[0].candidatos[0], id: 'b1000000-0000-4000-8000-000000000002', etiqueta: 'Alternativa elegida' };
  let confirmaciones = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/lotes')) return Response.json([]);
    if (String(url).startsWith('/api/catalogo?')) return Response.json([alternativo]);
    if (String(url) === '/api/importacion') {
      const s = (init?.body as FormData).get('seleccion');
      if (!s) return Response.json(vista);
      const seleccion = JSON.parse(String(s));
      return Response.json({ ...vista, previewHash: 'c'.repeat(64), seleccionRevisada: [{ seleccion: { ...seleccion[0], revisionArticulo: 1 },
        original: vista.filas[0].candidatos[0], destino: alternativo, cantidad: 3, unidad: 'ud', tipoOrigen: 'equipo', fuenteTipo: 'catalogo', datosOriginales: vista.filas[0].datos }] });
    }
    if (String(url) === '/api/importacion/confirmar') { confirmaciones++; throw new Error('No debe confirmar una elección retirada'); }
    throw new Error(`Petición inesperada ${String(url)}`);
  };
  const m = await montar(<Importador sala={sala} puedeBom puedeCatalogo/>);
  const boton = (texto: string) => [...m.contenedor.querySelectorAll('button')].find(b => b.textContent?.includes(texto))!;
  try {
    await preparar(m); await pulsar(boton('Usar alternativa'));
    const campo = m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement;
    const motivo = m.contenedor.querySelector('textarea')!;
    const ventana = m.ventana as Window & typeof globalThis;
    for (const texto of ['Otra referencia todavía sin elegir', '']) {
      await escribir(campo, 'Alternativa'); await esperar(220);
      await pulsar(m.contenedor.querySelector('[role=option]')!);
      await act(async () => {
        Object.getOwnPropertyDescriptor(ventana.HTMLTextAreaElement.prototype, 'value')!.set!.call(motivo, 'Motivo revisado');
        motivo.dispatchEvent(new ventana.Event('input', { bubbles: true }));
      });
      await pulsar(boton('Revisar selección')); await esperar();
      assert.equal((boton('Confirmar 1') as HTMLButtonElement).disabled, false);
      await escribir(campo, texto);
      assert.equal((boton('Confirmar 1') as HTMLButtonElement).disabled, true);
      assert.ok(!m.contenedor.textContent?.includes('Selección revisada para confirmar'));
      await pulsar(boton('Confirmar 1')); assert.equal(confirmaciones, 0);
    }
  } finally { await m.desmontar(); globalThis.fetch = anterior; }
});
