import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import '@/pruebas/dom';
import { ReservasDeSala } from './reservas-sala';
import type { AccionCargaKit } from '@/components/carga/formulario-carga-kit';
import type { FilaReserva } from '@/lib/datos-almacen';

test('Reserva gestionada no ofrece Liberar genérico ni Quitar; la histórica sí', () => {
  const reservas: FilaReserva[] = [
    {id:'gestionada',sala_id:'sala',articulo_id:'art',cantidad:1,estado:'activa',notas:null,quien:null,
      descripcion:'Kit A',unidad:'ud',sala:'Sala'},
    {id:'historica',sala_id:'sala',articulo_id:'art',cantidad:1,estado:'activa',notas:null,quien:null,
      descripcion:'Genérica',unidad:'ud',sala:'Sala'},
  ];
  const preparar: AccionCargaKit = async () => ({error: null});
  const html = renderToStaticMarkup(
    <ReservasDeSala
      salaId="sala"
      reservas={reservas}
      disponibilidad={new Map()}
      necesidad={[]}
      reservadoAqui={new Map()}
      preparar={preparar}
      reservasGestionadas={['gestionada']}
      editableCarga
    />,
  );
  const dom = new JSDOM(html);
  const filas = [...dom.window.document.querySelectorAll('tbody tr')];
  assert.equal(filas.length, 2);
  const textos = filas.map(f => [...f.querySelectorAll('button')].map(b => b.textContent));
  assert.deepEqual(textos[0], ['Preparar']);
  assert.ok(textos[1].includes('Liberar'));
  assert.ok(textos[1].includes('Quitar'));
  assert.equal(filas[0].querySelector('button')?.textContent, 'Preparar');
  assert.equal(filas[0].textContent?.includes('Quitar'), false);
  dom.window.close();
});

test('Reserva gestionada servida no pinta Quitar ni Liberar; una histórica no gestionada sí pinta Quitar', () => {
  const reservas: FilaReserva[] = [
    {id:'gestionada-servida',sala_id:'sala',articulo_id:'art',cantidad:1,estado:'servida',notas:null,quien:null,
      descripcion:'Kit A',unidad:'ud',sala:'Sala'},
    {id:'historica-servida',sala_id:'sala',articulo_id:'art',cantidad:1,estado:'servida',notas:null,quien:null,
      descripcion:'Genérica',unidad:'ud',sala:'Sala'},
  ];
  const preparar: AccionCargaKit = async () => ({error: null});
  const html = renderToStaticMarkup(
    <ReservasDeSala
      salaId="sala"
      reservas={reservas}
      disponibilidad={new Map()}
      necesidad={[]}
      reservadoAqui={new Map()}
      preparar={preparar}
      reservasGestionadas={['gestionada-servida']}
      editableCarga
    />,
  );
  const dom = new JSDOM(html);
  const filas = [...dom.window.document.querySelectorAll('tbody tr')];
  assert.equal(filas.length, 2);
  const textos = filas.map(f => [...f.querySelectorAll('button')].map(b => b.textContent));
  assert.deepEqual(textos[0], []);
  assert.equal(textos[1].includes('Liberar'), false);
  assert.ok(textos[1].includes('Quitar'));
  assert.equal(filas[0].textContent?.includes('Quitar'), false);
  assert.equal(filas[0].textContent?.includes('Liberar'), false);
  assert.equal(filas[0].textContent?.includes('Preparar'), false);
  dom.window.close();
});
