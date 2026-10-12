import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import '@/pruebas/dom';
import { TiradasDePlantilla } from './tiradas';
import type { TiradaDocumental } from '@/lib/datos-tiradas-documentales';

const documental: TiradaDocumental = {
  id: 'documental', plantilla_id: 'p', fuente_clave: 'tirada-001', origen_categoria: 'CAJA CONEXIONES',
  destino_categoria: 'VIDEOCONFERENCIA', senal: 'red', ruta: 'falso_techo', orden: '1',
  notas: 'Texto original sin certificación de longitud.', conexion_resuelta_id: null, completa: false,
};

test('puede elegir la tirada histórica que documentar aunque no proceda de CSV', () => {
  const dom = new JSDOM(renderToStaticMarkup(<TiradasDePlantilla plantillaId="p" lineas={[]} puertos={[]}
    tiradas={[{ id: 'historica', plantilla_id: 'p', origen_linea_id: 'a', destino_linea_id: 'b',
      origen: 'Equipo A', destino: 'Equipo B', articulo_cable_id: null, senal: 'hdmi', ruta: null, notas: null, orden: 1 }]}
    documentales={[]} />));
  const select = dom.window.document.querySelector<HTMLSelectElement>('[name="conexion_existente_id"]');
  assert.ok(select);
  assert.equal(select.options[1].value, 'historica');
  dom.window.close();
});

test('una tirada documental sin equipos identificados se muestra pendiente y no desaparece', () => {
  const dom = new JSDOM(renderToStaticMarkup(<TiradasDePlantilla plantillaId="p" lineas={[]}
    tiradas={[]} puertos={[]} documentales={[documental]} bocasRosetas={[]} />));
  const documento = dom.window.document;
  assert.ok(documento.querySelector('[aria-label="Tiradas pendientes de documentar"]'));
  assert.ok(documento.body.textContent?.includes(documental.notas));
  assert.equal(documento.querySelector<HTMLSelectElement>('[name="documental_id"]')?.options[1].value, 'documental');
  assert.equal(documento.querySelector<HTMLSelectElement>('[name="boca_origen"]')?.options.length, 1);
  assert.equal(documento.querySelectorAll('tbody tr').length, 0, 'no se representa como cable físico');
  dom.window.close();
});

test('una documental resuelta sale de pendientes y las bocas de roseta tienen identidad explícita', () => {
  const dom = new JSDOM(renderToStaticMarkup(<TiradasDePlantilla plantillaId="p" lineas={[]}
    tiradas={[]} puertos={[]} documentales={[{ ...documental, completa: true, conexion_resuelta_id: 'c' }]}
    bocasRosetas={[{ id: 'boca-2', plantilla_id: 'p', codigo: 'R3', ordinal: 2, etiqueta: null }]} />));
  const documento = dom.window.document;
  assert.equal(documento.querySelector('[aria-label="Tiradas pendientes de documentar"]'), null);
  const opcion = documento.querySelector<HTMLSelectElement>('[name="boca_destino"]')!.options[1];
  assert.equal(opcion.value, 'roseta:boca-2');
  assert.equal(opcion.textContent, 'R3 · Boca 2');
  dom.window.close();
});
