import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { altaTiempoSchema, anularTiempoSchema, canonicoTiempo, corregirTiempoSchema, entradaTiempo, ErrorTiempo, LIMITES_TIEMPOS } from './tiempos/modelo';
const uuid = 'd5150000-0000-4000-8000-000000000001';
const alta = { tareaId: uuid, inicio: { fecha: '2026-10-14', hora: '09:00' }, fin: { fecha: '2026-10-14', hora: '10:00' }, clavePeticion: uuid };
describe('contrato de entrada operativo de tiempos', () => {
  it('rechaza identidad, duración, autor y datos monetarios aportados por cliente', () => {
    for (const campo of ['titular_usuario_id','autorUsuarioId','minutos','moneda','tarifa','proyectoId','salaId']) assert.throws(() => entradaTiempo(altaTiempoSchema, { ...alta, [campo]: 'inventado' }), ErrorTiempo);
    assert.equal(entradaTiempo(altaTiempoSchema, alta).notas, '');
  });
  it('corrección y anulación exigen CAS completo y motivo no vacío', () => {
    for (const motivo of [undefined, '', '   ', 'a'.repeat(2001)]) assert(!anularTiempoSchema.safeParse({ numeroActual: 1, actualId: uuid, clavePeticion: uuid, motivo }).success);
    assert(!corregirTiempoSchema.safeParse({ ...alta, motivo: 'Corrección' }).success);
  });
  it('canonical conserva instantes, contexto y diferencias del payload', () => {
    assert.equal(canonicoTiempo({ z: 1, a: { b: 'x', a: 1 } }), canonicoTiempo({ a: { a: 1, b: 'x' }, z: 1 }));
    assert.notEqual(canonicoTiempo(alta), canonicoTiempo({ ...alta, notas: 'otra' }));
    assert.equal(LIMITES_TIEMPOS.cuerpo, 65536); assert.equal(LIMITES_TIEMPOS.pagina, 50); assert.equal(LIMITES_TIEMPOS.sugerencias, 20);
  });
});
