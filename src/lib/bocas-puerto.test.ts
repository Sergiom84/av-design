import test from 'node:test';
import assert from 'node:assert/strict';
import { bocasDePuerto, claveBoca, ordinalValido } from './bocas-puerto';
import type { Puerto } from './tipos';

const puerto: Puerto = {
  id: 'p', articulo_id: 'a', nombre: 'OUTPUT', total: 2, sentido: 'salida',
  senal: 'hdmi', conector: 'HDMI A', orden: 1, notas: null, fuente: 'app',
};

test('expande cada boca física sin inventar una selección', () => {
  const bocas = bocasDePuerto(puerto, 'e');
  assert.deepEqual(bocas.map((b) => [b.ordinal, b.etiqueta]), [[1, 'OUTPUT 1'], [2, 'OUTPUT 2']]);
  assert.notEqual(claveBoca(bocas[0]), claveBoca(bocas[1]));
});

test('el ordinal es entero y está dentro de 1..total', () => {
  assert.equal(ordinalValido(1, 2), true);
  assert.equal(ordinalValido(2, 2), true);
  assert.equal(ordinalValido(0, 2), false);
  assert.equal(ordinalValido(1.5, 2), false);
  assert.equal(ordinalValido(3, 2), false);
});
