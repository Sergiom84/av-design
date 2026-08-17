import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectorBocaConexion } from './selector-boca-conexion';
import type { Puerto } from '@/lib/tipos';

test('la tabla de una conexión existente envía y conserva sus dos bocas físicas', () => {
  const puertosOrigen = [
    { id: 'puerto-a', articulo_id: 'articulo-a', nombre: 'OUTPUT', sentido: 'salida', total: 2 },
  ] as Puerto[];
  const puertosDestino = [
    { id: 'puerto-b', articulo_id: 'articulo-b', nombre: 'INPUT', sentido: 'entrada', total: 2 },
  ] as Puerto[];

  const origen = renderToStaticMarkup(createElement(SelectorBocaConexion, {
    conexionId: 'conexion-1', lado: 'origen', puertos: puertosOrigen,
    puertoActual: 'puerto-a', ordinalActual: 2,
  }));
  const destino = renderToStaticMarkup(createElement(SelectorBocaConexion, {
    conexionId: 'conexion-1', lado: 'destino', puertos: puertosDestino,
    puertoActual: 'puerto-b', ordinalActual: 1,
  }));

  assert.match(origen, /name="boca_origen"/);
  assert.match(destino, /name="boca_destino"/);
  assert.match(origen, /value="puerto-a:2" selected=""/);
  assert.match(destino, /value="puerto-b:1" selected=""/);
  assert.match(origen, /value="puerto-a:1"/);
  assert.match(destino, /value="puerto-b:2"/);
});
