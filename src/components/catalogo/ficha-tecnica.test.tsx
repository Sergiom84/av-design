import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { esquemaDatoTecnico } from '@/lib/ficha-tecnica';
import { FichaTecnica } from './ficha-tecnica';

test('cada hecho renderiza estado, descripción y su propia fuente enlazada', () => {
  const datos = [esquemaDatoTecnico.parse({ clave: 'energia', concepto: 'Alimentación eléctrica', tipo: 'alimentacion', estado: 'verificado',
    valor: { descripcion: '100–240 V CA' }, fuente: 'csv', fuente_url: 'https://example.com/energia',
    documento: 'Ficha de alimentación', apartado: 'Página 2', consultado_en: '2026-09-08' }),
  esquemaDatoTecnico.parse({ clave: 'hdmi-suministrado', concepto: 'Cable HDMI suministrado', tipo: 'suministro', estado: 'sin_documentar', valor: null, fuente: 'app' })];
  const dom = new JSDOM(renderToStaticMarkup(createElement(FichaTecnica, { datos })));
  try {
    const filas = dom.window.document.querySelectorAll('li');
    assert.equal(filas.length, 2);
    assert.match(filas[0].textContent ?? '', /Verificado.*100–240 V CA.*Ficha de alimentación.*Página 2/);
    assert.equal(filas[0].querySelector('a')?.href, 'https://example.com/energia');
    assert.equal(filas[0].querySelector('time')?.dateTime, '2026-09-08');
    assert.match(filas[1].textContent ?? '', /Cable HDMI suministrado.*Sin documentar/);
    assert.equal(filas[1].querySelector('h3')?.textContent, 'Cable HDMI suministrado');
    assert.equal(filas[1].querySelector('a'), null);
    assert.equal(dom.window.document.querySelectorAll('button,input,form').length, 0);
  } finally { dom.window.close(); }
});
test('ficha vacía declara ausencia, no compatibilidad', () => {
  const html = renderToStaticMarkup(createElement(FichaTecnica, { datos: [] }));
  assert.match(html, /Sin documentar/);
  assert.doesNotMatch(html, /compatible|integrada|Todo listo/);
});
