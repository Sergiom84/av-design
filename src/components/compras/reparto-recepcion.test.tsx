import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { RepartoRecepcion } from './reparto-recepcion';

test('Dos kits iguales conservan recibido y pendiente separados en la tabla', () => {
  const dom = new JSDOM(renderToStaticMarkup(<RepartoRecepcion filas={[
    { suministroId: 'A', lineaId: 'L', referencia: 'SKU kit', sala: 'Sala Norte', asignado: 1, recibido: 1 },
    { suministroId: 'B', lineaId: 'L', referencia: 'SKU kit', sala: 'Sala Norte', asignado: 1, recibido: 0 },
  ]} sinAtribuir={[]} />));
  const filas = [...dom.window.document.querySelectorAll('tbody tr')];
  assert.equal(filas.length, 2);
  assert.deepEqual(filas.map(fila => [...fila.querySelectorAll('td')].map(celda => celda.textContent)), [
    ['SKU kitUnidad 1', 'Sala Norte', '1', '0'], ['SKU kitUnidad 2', 'Sala Norte', '0', '1'],
  ]);
  assert.equal(dom.window.document.querySelector('h3'), null);
  dom.window.close();
});

test('Sobrante se presenta sin asignarlo a una unidad y legacy sin suministros no añade panel', () => {
  const dom = new JSDOM(renderToStaticMarkup(<RepartoRecepcion filas={[
    { suministroId: 'A', lineaId: 'L', referencia: 'SKU kit', sala: 'Sala Norte', asignado: 1, recibido: 0 },
  ]} sinAtribuir={[{ lineaId: 'L', referencia: 'SKU kit', cantidad: 2, unidad: 'ud' }]} />));
  assert.match(dom.window.document.querySelector('tbody')?.textContent ?? '', /Sala Norte01/);
  assert.equal(dom.window.document.querySelector('li')?.textContent, 'SKU kit: 2 ud');
  assert.equal(renderToStaticMarkup(<RepartoRecepcion filas={[]} sinAtribuir={[]} />), '');
  dom.window.close();
});
