import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inicioInformeDesdeEnlace } from './informes/seleccion-inicial';
const sala = 'ab000000-0000-4000-8000-000000000001';
const obra = 'ab000000-0000-4000-8000-000000000002';
const opciones = [{ tipo: 'sala', id: sala }, { tipo: 'obra', id: obra }];
test('el enlace prepara sólo selección explícita y audiencia propia, sin crear ejecución', () => {
  const r = inicioInformeDesdeEnlace({ clave: 'estado_actual', tipo: 'obra', id: obra, salaIds: sala }, ['estado_actual'], opciones);
  assert.equal(r.ejecucionId, undefined);
  assert.deepEqual(r.configuracion?.ambito, { tipo: 'obra', id: obra, salaIds: [sala] });
  assert.deepEqual(r.configuracion?.audiencia, { usuarios: [], grupos: [] });
  assert.deepEqual(r.configuracion?.periodo, { modo: 'actual' });
});
test('no amplía una selección de obra a todas las salas ni acepta recursos no autorizados', () => {
  for (const cambios of [{ salaIds: undefined }, { salaIds: `${sala},${sala}` },
    { salaIds: 'ab000000-0000-4000-8000-000000000003' }, { clave: 'material_actual' },
    { id: [obra, obra] }]) {
    const r = inicioInformeDesdeEnlace({ clave: 'estado_actual', tipo: 'obra', id: obra, salaIds: sala, ...cambios }, ['estado_actual'], opciones);
    assert.equal(r.configuracion, undefined); assert.ok(r.aviso);
  }
});
test('abrir una ejecución sólo entrega su ID a la lectura autenticada existente', () => {
  assert.deepEqual(inicioInformeDesdeEnlace({ ejecucion: sala }, [], []), { ejecucionId: sala });
  assert.ok(inicioInformeDesdeEnlace({ ejecucion: 'https://example.invalid/' }, [], []).aviso);
  assert.deepEqual(inicioInformeDesdeEnlace({}, ['estado_actual'], opciones), {});
});
test('un informe de hechos deja fechas vacías para revisión humana, sin inventar período', () => {
  const r = inicioInformeDesdeEnlace({ clave: 'estado_hitos', tipo: 'sala', id: sala }, ['estado_hitos'], opciones);
  assert.deepEqual(r.configuracion?.periodo, { modo: 'rango', desde: '', hasta: '' });
});
