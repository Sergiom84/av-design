import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { construirExtraccion } from './requisitos/extraccion';
import { resultadoExtraccionSchema } from './requisitos/modelo';

test('reextraer el mismo original conserva la necesidad local y renueva su ancla de intento', () => {
  const documento = randomUUID(), paginas = [{ numero: 1, texto: 'Sala: Alfa\nModelo: QB65R\nModelo: QB65R' }];
  const primera = construirExtraccion(documento, randomUUID(), paginas, 'con_texto');
  const segunda = construirExtraccion(documento, randomUUID(), paginas, 'con_texto');
  assert.deepEqual(segunda.candidatos.map(c => c.id), primera.candidatos.map(c => c.id));
  assert.notEqual(segunda.candidatos[0].ancla.extraccionId, primera.candidatos[0].ancla.extraccionId);
  assert.notEqual(primera.candidatos[1].id, primera.candidatos[2].id, 'Dos ocurrencias distintas no se consolidan');
  const otroDocumento = construirExtraccion(randomUUID(), randomUUID(), paginas, 'con_texto');
  assert.notEqual(otroDocumento.candidatos[0].id, primera.candidatos[0].id);
});

test('una nueva demanda manual conserva motivo y distingue intentos sin inventar razones históricas', () => {
  const documento = randomUUID(), paginas = [{ numero: null, texto: 'Modelo: QB65R' }];
  const primera = construirExtraccion(documento, randomUUID(), paginas, 'manual', true, 'Otra demanda revisada explícitamente');
  const segunda = construirExtraccion(documento, randomUUID(), paginas, 'manual', true, 'Necesidad adicional independiente');
  assert.notEqual(primera.candidatos[0].id, segunda.candidatos[0].id);
  assert.equal(primera.motivoManual, 'Otra demanda revisada explícitamente');
  const historica = construirExtraccion(documento, randomUUID(), paginas, 'manual', true);
  assert.equal(resultadoExtraccionSchema.parse(historica).motivoManual, undefined);
});
