import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ErrorConcurrencia, mensajeErrorSqlNegocio } from './control-escritura';

test('mensajeErrorSqlNegocio convierte 23514 y concurrencia en mensaje; el resto no', () => {
  const sql = Object.assign(new Error('Reserva gestionada conserva historial'), { code: '23514' });
  assert.equal(mensajeErrorSqlNegocio(sql), 'Reserva gestionada conserva historial');
  assert.equal(mensajeErrorSqlNegocio(new ErrorConcurrencia()), 'Hay otra operación en curso. Conserva los datos y vuelve a intentarlo.');
  assert.equal(mensajeErrorSqlNegocio(new Error('Fallo interno')), null);
  assert.equal(mensajeErrorSqlNegocio(Object.assign(new Error('deadlock'), { code: '40P01' })), null);
});

test('borrarReserva y el adaptador de mutación mapean 23514', () => {
  const borrar = readFileSync(new URL('../app/acciones-almacen.ts', import.meta.url), 'utf8')
    .split('export async function borrarReserva')[1]?.split('export async function')[0] ?? '';
  assert.match(borrar, /mensajeErrorSqlNegocio/);
  const adaptador = readFileSync(new URL('../app/acciones-concurrencia.ts', import.meta.url), 'utf8');
  assert.match(adaptador, /mensajeErrorSqlNegocio/);
});
