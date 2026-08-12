/**
 * Las casillas de posición de Equipamiento, montadas.
 *
 * El contrato que se comprueba aquí no está en ninguna función pura: es qué
 * VALOR trae cada casilla al pintarse, y de eso depende una regla del dominio.
 *
 * El formulario proponía `0`, `0` y `1,2` en el alta, y la posición guardada
 * en la edición aunque el equipo estuviera sin colocar. Ninguna de las dos
 * cosas la había medido nadie, así que guardar sin tocarlas escribía una
 * medida falsa; y como el servidor no puede distinguir un cero tecleado de un
 * cero que puso el propio formulario, el arreglo del servidor solo es correcto
 * si el formulario dice la verdad. Vacío significa «no lo sé» y con X e Y el
 * equipo queda colocado, cero incluido: la esquina es donde va el rack.
 *
 * `scripts/verificar-concurrencia.mts` comprueba la otra mitad —qué escribe el
 * servidor con y sin coordenadas— contra Postgres real.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createElement } from 'react';

import { montar, type Montaje } from '@/pruebas/dom';
import type { EquipoEnSala } from '@/lib/tipos';
import { Equipamiento } from './equipamiento';

const SALA_ID = '11111111-1111-4111-8111-111111111111';

const equipo = (
  id: string,
  nombre: string,
  posicion: { x_m: number; y_m: number; z_m: number },
  posicion_confirmada: boolean,
): EquipoEnSala =>
  ({
    id,
    sala_id: SALA_ID,
    articulo_id: '99999999-9999-4999-8999-999999999999',
    nombre,
    cantidad: 1,
    extremo: 'rack',
    posicion,
    posicion_confirmada,
    rotacion_grados: 0,
    toma_red_id: null,
  }) as unknown as EquipoEnSala;

/** El formulario de una fila, localizado por el nombre que enseña su casilla. */
function formularioDe(contenedor: HTMLElement, nombre: string): HTMLFormElement {
  const formularios = [...contenedor.querySelectorAll('form')];
  const encontrado = formularios.find(
    (f) => (f.querySelector('input[name="nombre"]') as HTMLInputElement | null)?.value === nombre,
  );
  assert.ok(encontrado, `no hay formulario para ${nombre}`);
  return encontrado as HTMLFormElement;
}

const valorDe = (raiz: ParentNode, campo: string): string =>
  (raiz.querySelector(`input[name="${campo}"]`) as HTMLInputElement).value;

const montajes: Montaje[] = [];
after(async () => {
  for (const m of montajes) await m.desmontar();
});

const pintar = async (equipos: EquipoEnSala[]) => {
  const m = await montar(
    createElement(Equipamiento, {
      salaId: SALA_ID,
      equipos,
      tomas: [],
      catalogo: new Map(),
    }),
  );
  montajes.push(m);
  return m;
};

describe('las casillas de posición de Equipamiento', () => {
  it('el alta no propone coordenadas: nadie ha medido nada todavía', async () => {
    const { contenedor } = await pintar([]);
    // El único formulario con casillas de posición cuando no hay equipos es el
    // de alta, que es el de arriba.
    const alta = contenedor.querySelector('form') as HTMLFormElement;
    assert.equal(valorDe(alta, 'x_m'), '');
    assert.equal(valorDe(alta, 'y_m'), '');
    assert.equal(
      valorDe(alta, 'z_m'),
      '',
      'la altura tampoco: 1,2 m era una suposición del formulario',
    );
  });

  it('un equipo sin colocar enseña las casillas vacías', async () => {
    const { contenedor } = await pintar([
      equipo('a1111111-1111-4111-8111-111111111111', 'TEST estimado', { x_m: 0, y_m: 0, z_m: 0 }, false),
    ]);
    const fila = formularioDe(contenedor, 'TEST estimado');
    assert.equal(valorDe(fila, 'x_m'), '');
    assert.equal(valorDe(fila, 'y_m'), '');
    assert.equal(valorDe(fila, 'z_m'), '');
  });

  it('y uno colocado enseña sus números, aunque valgan cero', async () => {
    const { contenedor } = await pintar([
      equipo('b1111111-1111-4111-8111-111111111111', 'TEST colocado', { x_m: 4.5, y_m: 2.5, z_m: 1.4 }, true),
      // El rack en la esquina: confirmado es una medida aunque valga cero, y
      // la casilla tiene que enseñar ese cero para poder corregirlo.
      equipo('c1111111-1111-4111-8111-111111111111', 'TEST rack', { x_m: 0, y_m: 0, z_m: 0 }, true),
    ]);

    const colocado = formularioDe(contenedor, 'TEST colocado');
    assert.equal(valorDe(colocado, 'x_m'), '4.5');
    assert.equal(valorDe(colocado, 'y_m'), '2.5');
    assert.equal(valorDe(colocado, 'z_m'), '1.4');

    const rack = formularioDe(contenedor, 'TEST rack');
    assert.equal(valorDe(rack, 'x_m'), '0');
    assert.equal(valorDe(rack, 'y_m'), '0');
  });

  it('con la obra cerrada, lo que no está colocado no finge una coordenada', async () => {
    const m = await montar(
      createElement(Equipamiento, {
        salaId: SALA_ID,
        equipos: [
          equipo('d1111111-1111-4111-8111-111111111111', 'TEST estimado', { x_m: 0, y_m: 0, z_m: 0 }, false),
          equipo('e1111111-1111-4111-8111-111111111111', 'TEST colocado', { x_m: 4.5, y_m: 2.5, z_m: 1.4 }, true),
        ],
        tomas: [],
        cerrado: true,
        catalogo: new Map(),
      }),
    );
    montajes.push(m);
    const texto = m.contenedor.textContent ?? '';
    assert.ok(texto.includes('Sin colocar'), 'el estimado se lee como lo que es');
    assert.ok(texto.includes('X 4.5'), 'y el colocado sigue enseñando su medida');
    assert.ok(!texto.includes('X 0 '), 'nadie midió un cero en la esquina');
  });
});
