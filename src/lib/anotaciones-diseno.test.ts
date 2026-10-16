import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolverAnotacionesDeAncla, type AnotacionDiseno } from './anotaciones-diseno';
import { leyendaDiseno, simboloPorCategoria } from './presentacion-diagrama';
import type { Conexion, EquipoEnSala } from './tipos';

const notas: AnotacionDiseno[] = [{ id: 'n1', texto: 'Instalar adaptador', ancla_tipo: 'conexion', ancla_id: 'c1', x: null, y: null }, { id: 'n2', texto: 'Reserva de paso', ancla_tipo: 'visual', ancla_id: null, x: 140, y: 90 }];
test('borrar ancla requiere decisión y conservar convierte en nota de sala sin tocar las demás', () => {
  assert.equal(resolverAnotacionesDeAncla(notas, 'conexion', 'c1', []), null);
  assert.deepEqual(resolverAnotacionesDeAncla(notas, 'conexion', 'c1', [{ anotacion_id: 'n1', accion: 'conservar' }]), [{ ...notas[0], ancla_tipo: 'sala', ancla_id: null }, notas[1]]);
  assert.deepEqual(resolverAnotacionesDeAncla(notas, 'conexion', 'c1', [{ anotacion_id: 'n1', accion: 'retirar' }]), [notas[1]]);
  assert.equal(notas[0].ancla_id, 'c1');
});
test('la leyenda incluye sólo símbolos y señales usados y las formas distinguen categorías sin color', () => {
  const equipos = [{ articulo_id: 'a1' }, { articulo_id: 'a2' }, { articulo_id: 'a1' }] as EquipoEnSala[];
  const leyenda = leyendaDiseno(equipos, [{ senal: 'hdmi' }, { senal: 'red' }, { senal: 'hdmi' }] as Conexion[], new Map([['a1', 'PANTALLAS'], ['a2', 'CÁMARAS']]));
  assert.deepEqual(leyenda.simbolos.map(s => s.clave).sort(), ['camara', 'pantalla']);
  assert.deepEqual(leyenda.senales.map(s => s.senal), ['hdmi', 'red']);
  assert.notEqual(simboloPorCategoria('PANTALLAS').forma, simboloPorCategoria('CÁMARAS').forma);
  assert.notEqual(leyenda.senales[0].trazo, leyenda.senales[1].trazo);
});
