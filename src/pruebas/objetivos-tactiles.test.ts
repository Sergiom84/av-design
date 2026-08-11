/**
 * El mínimo táctil, comprobado sobre la hoja de estilos.
 *
 * La medida de verdad se toma en el navegador: sin motor de disposición no hay
 * píxeles que medir, y esto no los mide. Lo que sí caza es la regresión que
 * hubo: la regla existía y estaba escrita para `max-width: 640px`, así que a
 * 768 —una tableta, con el dedo— los campos medían 34 px y el informe daba el
 * objetivo por cumplido porque la regla aparecía en el fichero.
 *
 * Aquí se comprueba dónde entra la regla y a qué alcanza. Que de verdad mida
 * 44 px se comprueba a 768, 390 y 320 en el navegador.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** El bloque `@media` del mínimo táctil, con sus llaves equilibradas. */
function bloqueTactil(): string {
  const inicio = CSS.indexOf('@media (max-width: 768px)');
  assert.notEqual(
    inicio,
    -1,
    'el mínimo táctil tiene que entrar en tableta (768 px), no solo por debajo de 640',
  );
  const i = CSS.indexOf('{', inicio);
  let nivel = 0;
  for (let j = i; j < CSS.length; j += 1) {
    if (CSS[j] === '{') nivel += 1;
    else if (CSS[j] === '}') {
      nivel -= 1;
      if (nivel === 0) return CSS.slice(i, j + 1);
    }
  }
  throw new Error('bloque @media sin cerrar');
}

describe('el objetivo táctil mínimo', () => {
  const bloque = bloqueTactil();

  it('no se queda por debajo de 640 px: a 768 se usa con el dedo', () => {
    assert.equal(
      CSS.includes('@media (max-width: 640px)'),
      false,
      'la regla antigua dejaba fuera la tableta',
    );
  });

  it('alcanza a los botones, tengan o no la clase del sistema', () => {
    assert.ok(bloque.includes('.boton'), 'los botones del sistema');
    assert.ok(/(^|[\s,])button([\s,])/.test(bloque), 'y cualquier <button>');
    assert.ok(bloque.includes('[role="button"]'), 'y lo que se comporta como botón');
  });

  it('alcanza a campos, selectores y áreas de texto', () => {
    assert.ok(bloque.includes('input:not([type="checkbox"]):not([type="radio"])'));
    assert.ok(/(^|[\s,])select([\s,])/.test(bloque));
    assert.ok(/(^|[\s,])textarea([\s,])/.test(bloque));
  });

  it('pide 44 px de alto y de ancho a lo accionable', () => {
    const alturas = [...bloque.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    const anchuras = [...bloque.matchAll(/min-width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    assert.ok(alturas.length >= 3, 'varias reglas de alto mínimo');
    assert.ok(
      alturas.every((v) => v >= 44),
      `ningún mínimo por debajo de 44: ${alturas.join(', ')}`,
    );
    assert.ok(anchuras.length >= 1 && anchuras.every((v) => v >= 44));
  });
});
