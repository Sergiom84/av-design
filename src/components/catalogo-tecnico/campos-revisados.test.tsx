import React from 'react';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { montar, pulsar } from '@/pruebas/dom';
import { FichaTecnicaArticulo, PuertoDesdeRequisito, type PrefillRequisito } from './ficha-tecnica';
import type { Decisiones } from '@/lib/requisitos/modelo';

Object.assign(globalThis, { React });
const router: AppRouterInstance = { bfcacheId: 'ruta-sintetica', push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const base = { versionModelo: 1 as const, candidatoId: 'c1000000-0000-4000-8000-000000000001',
  articuloId: 'c1000000-0000-4000-8000-000000000002', baseHash: 'a'.repeat(64), baseRevision: '0',
  camposRevisados: [], motivo: 'Revisión humana sintética' };
const tecnico: PrefillRequisito<Extract<Decisiones, { destino: 'tecnico' }>> = {
  planId: 'c1000000-0000-4000-8000-000000000003', version: 0,
  decisiones: { ...base, destino: 'tecnico', datos: { marca: 'Marca sintética', modelo: 'MODELO-EXACTO',
    ancho: 1200, alto: null, fondo: null, unidad: 'mm', ru: null,
    origen: 'Ficha sintética', url: 'https://example.test/ficha', fecha: '2026-10-16' } },
};
const puerto: PrefillRequisito<Extract<Decisiones, { destino: 'puerto' }>> = {
  planId: 'c1000000-0000-4000-8000-000000000004', version: 0,
  decisiones: { ...base, destino: 'puerto', datos: { nombre: 'HDMI IN 1', total: 2,
    sentido: 'entrada', senal: 'hdmi', conector: 'HDMI', orden: null, notas: null } },
};

for (const superficie of ['tecnico', 'puerto'] as const) {
  it(`la etiqueta completa de cada campo ${superficie} acciona sólo su casilla y conserva sus valores`, async () => {
    const contenido = superficie === 'tecnico'
      ? <FichaTecnicaArticulo articuloId={base.articuloId} marca="Marca sintética" modelo="MODELO-EXACTO"
        ficha={{ datos: null, archivos: [] }} puedeEditar requisito={tecnico} />
      : <PuertoDesdeRequisito requisito={puerto} />;
    const m = await montar(<AppRouterContext.Provider value={router}>{contenido}</AppRouterContext.Provider>);
    try {
      const datos = superficie === 'tecnico' ? tecnico.decisiones.datos : puerto.decisiones.datos;
      const campos = [...Object.keys(datos), 'modeloExacto'];
      const casillas = [...m.contenedor.querySelectorAll<HTMLInputElement>('input[name="revisado"]')];
      assert.deepEqual(casillas.map(c => c.value), campos);
      const formulario = casillas[0].form!;
      const Formulario = (m.ventana as Window & typeof globalThis).FormData;
      assert.deepEqual(new Formulario(formulario).getAll('revisado'), []);
      for (const casilla of casillas) {
        const etiqueta = casilla.labels?.[0];
        assert.ok(etiqueta);
        assert.equal(etiqueta.control, casilla);
        assert.equal(etiqueta.textContent, casilla.value === 'modeloExacto' ? 'Modelo y variante exactos' : casilla.value);
        await pulsar(etiqueta.querySelector('span')!);
        assert.equal(casilla.checked, true);
        assert.deepEqual(new Formulario(formulario).getAll('revisado'), [casilla.value]);
        await pulsar(etiqueta);
        assert.equal(casilla.checked, false);
        assert.deepEqual(new Formulario(formulario).getAll('revisado'), []);
      }
    } finally { await m.desmontar(); }
  });
}

it('la etiqueta no permite marcar una revisión técnica si el formulario está deshabilitado', async () => {
  const m = await montar(<AppRouterContext.Provider value={router}>
    <FichaTecnicaArticulo articuloId={base.articuloId} marca="Marca sintética" modelo="MODELO-EXACTO"
      ficha={{ datos: null, archivos: [] }} puedeEditar={false} requisito={tecnico} />
  </AppRouterContext.Provider>);
  try {
    const casilla = m.contenedor.querySelector<HTMLInputElement>('input[name="revisado"]')!;
    assert.equal(casilla.matches(':disabled'), true);
    await pulsar(casilla.labels![0].querySelector('span')!);
    assert.equal(casilla.checked, false);
  } finally { await m.desmontar(); }
});
