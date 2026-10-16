import React, { act } from 'react';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { montar, esperar, pulsar, escribir } from '@/pruebas/dom';
import { EditorPlan } from './plan';
import { EditorAvanzado } from './avanzado';
import { decisionesIniciales, type Candidato, type Decisiones, type Destino, type Extraccion, type Plan } from './tipos';
Object.assign(globalThis, { React, self: globalThis });

type Avanzado = Exclude<Destino, 'areas_bom'>;
const articuloId = 'b2000000-0000-4000-8000-000000000001';
const candidato: Candidato = { id: 'b2000000-0000-4000-8000-000000000002', clase: 'tecnico', fragmento: 'Ancho: 1200 mm', original: { marca: 'Marca QA', modelo: 'QB65R', referencia: 'QA-EXACTO', tipo: 'equipo', categoria: 'Pantalla', unidad: 'ud', descripcion: 'Texto original', observaciones: '', proveedor: 'Proveedor QA', presupuesto: 'QA-OFERTA', precio_compra: '10', moneda: 'EUR', fecha: '2026-10-16', unidad_compra: 'ud', unidades_por_compra: '1', origen: 'final', kit: 'no', vinculante: 'sí', puerto: 'HDMI IN 1' }, ambiguedades: [], ancla: { documentoId: 'b2000000-0000-4000-8000-000000000003', extraccionId: 'b2000000-0000-4000-8000-000000000004', pagina: 1, linea: null, inicio: 0, fin: 14, sha256: 'c'.repeat(64), metodo: 'literal_estructurado' } };
const extraccion: Extraccion = { id: candidato.ancla.extraccionId, metodo: 'pdf_local', parser: 'pdfjs-dist', parser_version: '6.4.299', sha256: 'd'.repeat(64), resultado: { versionModelo: 1, estado: 'con_texto', paginas: [{ numero: 1, texto: candidato.fragmento }], candidatos: [candidato], avisos: [] } };
const articulo = { id: articuloId, marca: 'Marca QA', modelo: 'QB65R', revision: 3 };
const tecnico = { marca: 'Marca QA', modelo: 'QB65R', origen: 'Ficha sintética', url: 'https://example.invalid/ficha', fecha: '2026-10-16', ancho: 1200, alto: null, fondo: null, unidad: 'mm', ru: null };
function base(destino: Avanzado) { return { articulo, ...(destino === 'tecnico' || destino === 'puerto' ? { baseHash: 'a'.repeat(64), baseRevision: '10', datos: destino === 'tecnico' ? tecnico : [] } : {}) }; }
const boton = (m: Awaited<ReturnType<typeof montar>>, texto: string) => [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === texto)!;
function campo(m: Awaited<ReturnType<typeof montar>>, etiqueta: string) {
  const label = [...m.contenedor.querySelectorAll('label')].find(l => l.querySelector('.t-etiqueta')?.textContent === etiqueta);
  assert.ok(label, `Falta campo ${etiqueta}`); return label.querySelector('input,textarea,select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}
async function llenar(m: Awaited<ReturnType<typeof montar>>, etiqueta: string, valor: string) {
  const control = campo(m, etiqueta), v = m.ventana as Window & typeof globalThis;
  const tipo = control.tagName === 'TEXTAREA' ? v.HTMLTextAreaElement : control.tagName === 'SELECT' ? v.HTMLSelectElement : v.HTMLInputElement;
  await act(async () => { Object.getOwnPropertyDescriptor(tipo.prototype, 'value')!.set!.call(control, valor); control.dispatchEvent(new v.Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
const casillas = (m: Awaited<ReturnType<typeof montar>>) => [...m.contenedor.querySelectorAll('label.campo-casilla')].filter(l => l.textContent?.startsWith('Revisado:')).map(l => l.querySelector('input')!);
async function revisarCampos(m: Awaited<ReturnType<typeof montar>>) { for (const c of casillas(m)) if (!c.checked) await pulsar(c); }
async function preparar(m: Awaited<ReturnType<typeof montar>>, destino: Avanzado) {
  await escribir(m.contenedor.querySelector('input[role=combobox]')!, 'QB65R'); await esperar(240);
  await pulsar(m.contenedor.querySelector('[role=option]')!); await pulsar(boton(m, 'Comprobar registro actual')); await esperar();
  const cambiado = destino === 'tecnico' ? ['Ancho', '1210'] : destino === 'puerto' ? ['Número de puertos', '2'] : destino === 'catalogo' ? ['Descripción', 'Descripción local revisada'] : ['Precio de compra sin IVA', '12.50'];
  await llenar(m, cambiado[0], cambiado[1]);
  if (destino === 'puerto') { await llenar(m, 'Sentido', 'entrada'); await llenar(m, 'Señal', 'hdmi'); await llenar(m, 'Conector literal', 'HDMI A'); }
  await llenar(m, 'Motivo de la decisión', `Borrador ${destino} que debe conservarse`); await revisarCampos(m);
  return cambiado;
}
function decisionFila(d: Decisiones) { return d.destino === 'catalogo' || d.destino === 'ofertas' ? d.filas[0] : d.destino === 'areas_bom' ? null : d; }

for (const destino of ['catalogo', 'ofertas', 'tecnico', 'puerto'] as const) {
  for (const status of [409, 503]) it(`${destino}: reabrir tras ${status} conserva referencia, propuesta, motivo, revisión y base locales`, async () => {
    const fetchOriginal = globalThis.fetch; const guardados: Decisiones[] = [];
    globalThis.fetch = async () => Response.json([{ id: articuloId, etiqueta: 'Marca QA QB65R', categoria: 'Pantalla', unidad: 'ud' }]);
    const plan: Plan = { id: 'b2000000-0000-4000-8000-000000000005', extraccion_id: extraccion.id, version: 0, destino, estado: 'borrador', decisiones: decisionesIniciales(destino) ?? { pendiente: true } };
    const pedir = async <T,>(url: string, cuerpo?: object): Promise<T> => {
      if (url.includes('/base-tecnica?')) return base(destino) as T;
      guardados.push(structuredClone((cuerpo as { decisiones: Decisiones }).decisiones)); throw Object.assign(new Error(`Fallo sintético ${status}`), { status });
    };
    const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={{ id: 'b2000000-0000-4000-8000-000000000006', nombre: 'Obra QA', localizaciones: [], salas: [] }} pedir={pedir} actualizar={async () => {}} ocupadoExterior={false} />);
    try {
      await pulsar(boton(m, 'Revisar decisión')); const cambiado = await preparar(m, destino);
      await pulsar(boton(m, 'Incluir decisión revisada')); await pulsar(boton(m, 'Guardar revisión y preparar preview')); await esperar();
      assert.ok(m.contenedor.textContent?.includes(`Fallo sintético ${status}`));
      await pulsar(boton(m, 'Revisar decisión'));
      assert.equal((m.contenedor.querySelector('input[role=combobox]') as HTMLInputElement).value, 'Marca QA QB65R');
      assert.equal(campo(m, cambiado[0]).value, cambiado[1]); assert.equal(campo(m, 'Motivo de la decisión').value, `Borrador ${destino} que debe conservarse`);
      assert.ok(casillas(m).length > 0 && casillas(m).every(c => c.checked));
      assert.equal((boton(m, 'Incluir decisión revisada') as HTMLButtonElement).disabled, false);
      await pulsar(boton(m, 'Comprobar registro actual')); await esperar();
      assert.equal(campo(m, cambiado[0]).value, cambiado[1]); assert.ok(casillas(m).every(c => c.checked));
      assert.ok(m.contenedor.textContent?.includes(destino === 'tecnico' || destino === 'puerto' ? 'Revisión de fuente 10' : 'Revisión del artículo 3'));
      await pulsar(boton(m, 'Incluir decisión revisada')); await pulsar(boton(m, 'Guardar revisión y preparar preview')); await esperar();
      assert.equal(guardados.length, 2); assert.deepEqual(guardados[1], guardados[0]);
      assert.equal(decisionFila(guardados[1])?.articuloId, articuloId);
    } finally { await m.desmontar(); globalThis.fetch = fetchOriginal; }
  });

  it(`${destino}: comprobar una base distinta conserva el checkpoint hasta actualizarlo explícitamente y exige revisión nueva`, async () => {
    const fetchOriginal = globalThis.fetch; let actual = base(destino); let incluida: Decisiones | null = null;
    globalThis.fetch = async () => Response.json([{ id: articuloId, etiqueta: 'Marca QA QB65R', categoria: 'Pantalla', unidad: 'ud' }]);
    const m = await montar(<EditorAvanzado candidato={candidato} destino={destino} incluir={d => { incluida = d; }} cancelar={() => {}} leerBase={async () => actual} />);
    try {
      const cambiado = await preparar(m, destino); await pulsar(boton(m, 'Incluir decisión revisada'));
      const anterior = structuredClone(incluida!);
      actual = { ...actual, articulo: { ...actual.articulo, revision: 4 }, ...(destino === 'tecnico' || destino === 'puerto' ? { baseHash: 'b'.repeat(64), baseRevision: '11' } : {}) };
      await pulsar(boton(m, 'Comprobar registro actual')); await esperar();
      assert.equal(campo(m, cambiado[0]).value, cambiado[1]); assert.ok(casillas(m).every(c => c.checked));
      assert.deepEqual(incluida, anterior); assert.equal((boton(m, 'Incluir decisión revisada') as HTMLButtonElement).disabled, true);
      await pulsar(boton(m, 'Actualizar base y volver a revisar'));
      assert.equal(campo(m, cambiado[0]).value, cambiado[1]); assert.ok(casillas(m).every(c => !c.checked));
      await revisarCampos(m); await pulsar(boton(m, 'Incluir decisión revisada'));
      const fila = decisionFila(incluida!); assert.ok(fila);
      if ('baseHash' in fila) { assert.equal(fila.baseHash, 'b'.repeat(64)); assert.equal(fila.baseRevision, '11'); }
      else assert.equal(fila.revisionArticulo, 4);
    } finally { await m.desmontar(); globalThis.fetch = fetchOriginal; }
  });
}

it('una comprobación503 de cualquiera de los cuatro destinos conserva propuesta, motivo, revisiones y checkpoint', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => Response.json([{ id: articuloId, etiqueta: 'Marca QA QB65R', categoria: 'Pantalla', unidad: 'ud' }]);
  try {
    for (const destino of ['catalogo', 'ofertas', 'tecnico', 'puerto'] as const) {
      let fallar = false; const enviadas: Decisiones[] = [];
      const m = await montar(<EditorAvanzado candidato={candidato} destino={destino} incluir={d => { enviadas.push(structuredClone(d)); }} cancelar={() => {}} leerBase={async () => { if (fallar) throw Object.assign(new Error('503 de comprobación'), { status: 503 }); return base(destino); }} />);
      try {
        const cambiado = await preparar(m, destino); await pulsar(boton(m, 'Incluir decisión revisada'));
        fallar = true; await pulsar(boton(m, 'Comprobar registro actual')); await esperar();
        assert.ok(m.contenedor.textContent?.includes('Tu propuesta, revisión y base anteriores se conservan.'));
        assert.equal(campo(m, cambiado[0]).value, cambiado[1]); assert.equal(campo(m, 'Motivo de la decisión').value, `Borrador ${destino} que debe conservarse`);
        assert.ok(casillas(m).every(c => c.checked)); assert.equal((boton(m, 'Incluir decisión revisada') as HTMLButtonElement).disabled, false);
        await pulsar(boton(m, 'Incluir decisión revisada')); assert.deepEqual(enviadas[1], enviadas[0]);
      } finally { await m.desmontar(); }
    }
  } finally { globalThis.fetch = fetchOriginal; }
});

it('una primera apertura de una decisión guardada conserva los campos y la base sin consultar ni sobrescribirlos', async () => {
  const inicial: Decisiones = { versionModelo: 1, destino: 'tecnico', candidatoId: candidato.id, articuloId, baseHash: 'a'.repeat(64), baseRevision: '10', datos: { ...tecnico, unidad: 'mm', ancho: 1210 }, camposRevisados: [...Object.keys(tecnico), 'modeloExacto'], motivo: 'Decisión recuperada de la revisión guardada' };
  let llamadas = 0; let enviada: Decisiones | null = null;
  const m = await montar(<EditorAvanzado candidato={candidato} destino="tecnico" inicial={inicial} incluir={d => { enviada = d; }} cancelar={() => {}} leerBase={async () => { llamadas++; return base('tecnico'); }} />);
  try {
    assert.equal(campo(m, 'Ancho').value, '1210'); assert.equal(campo(m, 'Motivo de la decisión').value, inicial.motivo);
    assert.ok(casillas(m).every(c => c.checked)); assert.equal(llamadas, 0); assert.ok(m.contenedor.querySelector(`a[href="/articulo/${articuloId}"]`));
    await pulsar(boton(m, 'Incluir decisión revisada')); assert.deepEqual(enviada, inicial); assert.equal(llamadas, 0);
  } finally { await m.desmontar(); }
});
