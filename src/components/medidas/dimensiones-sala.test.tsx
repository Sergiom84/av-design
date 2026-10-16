import React, { act } from 'react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montar, escribir } from '@/pruebas/dom';
import { DimensionesSala } from './dimensiones-sala';

Object.assign(globalThis, { React });
async function unidad(select: HTMLSelectElement, valor: string) {
  await act(async () => { select.value = valor; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
describe('unidad como presentación del formulario real', () => {
  it('conserva la medida editada al cambiar de unidad sin callback ni drift', async () => {
    const m = await montar(<form><DimensionesSala valores={{ largo_m: 6, ancho_m: 4, alto_m: null }} /></form>);
    try {
      const select = m.contenedor.querySelector('select')!;
      const largo = m.contenedor.querySelector<HTMLInputElement>('[name="entrada_largo"]')!;
      await unidad(select, 'ft'); await escribir(largo, '10');
      assert.ok(m.contenedor.textContent?.includes('Se guardará 3,05 m'));
      await unidad(select, 'm');
      assert.equal(largo.value, '3,05');
      for (let i = 0; i < 5; i++) { await unidad(select, 'ft'); await unidad(select, 'm'); }
      assert.equal(largo.value, '3,05');
      assert.equal(m.contenedor.querySelector<HTMLInputElement>('[name="entrada_alto"]')!.value, '');
    } finally { await m.desmontar(); }
  });
  it('alternar unidad no publica una edición; una entrada inválida no altera el dato', async () => {
    const cambios: unknown[] = [];
    const m = await montar(<DimensionesSala valores={{ largo_m: 6, ancho_m: null, alto_m: null }} alCambiar={v => cambios.push(v)} />);
    try {
      const select = m.contenedor.querySelector('select')!;
      await unidad(select, 'ft'); await unidad(select, 'm');
      assert.deepEqual(cambios, []);
      const largo = m.contenedor.querySelector<HTMLInputElement>('[name="entrada_largo"]')!;
      await escribir(largo, '-2');
      assert.deepEqual(cambios, []); assert.equal(largo.checkValidity(), false);
      assert.ok(m.contenedor.querySelector('[role="alert"]'));
    } finally { await m.desmontar(); }
  });
});
