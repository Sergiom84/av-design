import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerDetalleConexion, leerTomasRed } from './lectura-extremos';

const fila = {
  id: 'c', detalle_extremos: 'completo',
  boca_equipo_origen_id: 'equipo', boca_puerto_origen_id: 'puerto', puerto_origen_ordinal: 2,
  boca_toma_origen_id: null, boca_toma_destino_id: 'boca',
  boca_equipo_destino_id: null, boca_puerto_destino_id: null, puerto_destino_ordinal: null,
};

test('lee equipo y boca de roseta sin convertir la roseta en equipo', () => {
  assert.deepEqual(leerDetalleConexion(fila), {
    estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'equipo', puerto_id: 'puerto', ordinal: 2 },
    destino: { tipo: 'roseta', toma_boca_id: 'boca' },
  });
});
test('no inventa un ordinal ni acepta dos clases de extremo a la vez', () => {
  assert.throws(() => leerDetalleConexion({ ...fila, puerto_origen_ordinal: null }), /origen incompleto/);
  assert.throws(() => leerDetalleConexion({ ...fila, boca_equipo_destino_id: 'equipo' }), /destino incompleto/);
  assert.throws(() => leerDetalleConexion({ ...fila, detalle_extremos: null }), /estado de extremos/);
});
test('el estado histórico es explícito y no fabrica bocas', () => {
  assert.deepEqual(leerDetalleConexion({ id: 'antigua', detalle_extremos: 'legacy' }), { estado: 'legacy' });
});
test('preserva XYZ parcial histórico, cero medido y capacidad desconocida', () => {
  const tomas = leerTomasRed([
    { id: 't1', sala_id: 's', codigo: 'R1', x_m: 0, y_m: 0, z_m: null },
    { id: 't2', sala_id: 's', codigo: 'R2', x_m: 0, y_m: 0, z_m: 0, capacidad_documentada: 1 },
  ], [{ id: 'b', toma_red_id: 't2', ordinal: 1, senal: 'red', conector: 'RJ45', etiqueta: null }]);
  assert.equal(tomas[0].z_m, null);
  assert.equal(tomas[0].capacidad_documentada, null);
  assert.deepEqual(tomas[0].bocas, []);
  assert.equal(tomas[0].codigo_confirmado, false);
  assert.equal(tomas[1].z_m, 0);
  assert.equal(tomas[1].bocas[0].id, 'b');
  assert.equal(tomas[1].bocas[0].etiqueta, null);
});
