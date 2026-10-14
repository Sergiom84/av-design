import { test } from 'node:test';
import assert from 'node:assert/strict';
import { necesidadDeSala, calcularFaltante } from './compras';

test('la BOM adicional comparte necesidad y stock con equipos, sin inventar diseño', () => {
  const catalogo = new Map([['equipo', { marca: 'Prueba', modelo: 'Pantalla Ágora', unidad: 'ud' as const }], ['cable', { marca: null, modelo: 'Cable', unidad: 'm' as const }]]);
  const equipos = [{ articulo_id: 'equipo', nombre: 'Pantalla', cantidad: 1 }];
  const necesidad = necesidadDeSala(equipos, [], catalogo, [
    { articulo_id: 'equipo', descripcion: 'Pantalla Ágora', unidad: 'ud', cantidad: 2 },
    { articulo_id: 'cable', descripcion: 'Cable', unidad: 'm', cantidad: 3.5 },
  ]);
  assert.equal(necesidad.find(l => l.articulo_id === 'equipo')?.cantidad, 3);
  assert.deepEqual(necesidad.find(l => l.articulo_id === 'equipo')?.origenes, ['equipo', 'bom']);
  assert.equal(calcularFaltante(necesidad, new Map([['equipo', 2]]), new Map()).find(l => l.articulo_id === 'equipo')?.falta, 1);
  assert.deepEqual(equipos, [{ articulo_id: 'equipo', nombre: 'Pantalla', cantidad: 1 }]);
});
