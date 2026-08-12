import assert from 'node:assert/strict';
import test from 'node:test';

import { resultadoE2eAprobado } from './resultado-e2e-diagrama.mjs';

const verde = { expected: 4, skipped: 0, unexpected: 0, flaky: 0 };

test('el gate E2E acepta una ejecución completa y limpia', () => {
  assert.equal(resultadoE2eAprobado(0, verde), true);
});

test('el gate E2E rechaza una ejecución con pruebas omitidas', () => {
  assert.equal(resultadoE2eAprobado(0, { ...verde, skipped: 1 }), false);
});

test('el gate E2E rechaza pruebas inesperadas o inestables', () => {
  assert.equal(resultadoE2eAprobado(0, { ...verde, unexpected: 1 }), false);
  assert.equal(resultadoE2eAprobado(0, { ...verde, flaky: 1 }), false);
});

test('el gate E2E rechaza cero pruebas y resultados incompletos', () => {
  assert.equal(resultadoE2eAprobado(0, { ...verde, expected: 0 }), false);
  assert.equal(resultadoE2eAprobado(0, undefined), false);
});

test('el gate E2E conserva el código de salida del proceso', () => {
  assert.equal(resultadoE2eAprobado(1, verde), false);
});
