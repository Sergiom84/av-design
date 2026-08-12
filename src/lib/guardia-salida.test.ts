import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { destinoDeSalida, type AnclaClicada, type ClicDeRaton } from './guardia-salida';

const AQUI = 'http://localhost:3000/salas/abc/diagrama';

const CLIC: ClicDeRaton = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

const ancla = (href: string, extra: Partial<AnclaClicada> = {}): AnclaClicada => ({
  href,
  target: '',
  descarga: false,
  ...extra,
});

describe('qué clic saca del editor del plano', () => {
  it('una pestaña de la ficha sí: es navegación de cliente y no dispara beforeunload', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc'), AQUI, CLIC),
      '/salas/abc',
    );
  });

  it('la barra lateral también, con su cadena de consulta', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/plantillas?abierta=7'), AQUI, CLIC),
      '/plantillas?abierta=7',
    );
  });

  it('un clic que no cayó en ningún enlace no es una salida', () => {
    assert.equal(destinoDeSalida(null, AQUI, CLIC), null);
  });

  it('el mismo sitio no es salir: la pestaña activa se puede pulsar', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc/diagrama'), AQUI, CLIC),
      null,
    );
  });

  it('un salto a un fragmento tampoco: no se sale del documento', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc/diagrama#lista'), AQUI, CLIC),
      null,
    );
  });

  it('otra pestaña se lleva el clic y esta se queda con el borrador', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc', { target: '_blank' }), AQUI, CLIC),
      null,
    );
    for (const tecla of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      assert.equal(
        destinoDeSalida(ancla('http://localhost:3000/salas/abc'), AQUI, {
          ...CLIC,
          [tecla]: true,
        }),
        null,
        `con ${tecla} el navegador abre aparte`,
      );
    }
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc'), AQUI, { ...CLIC, button: 1 }),
      null,
      'el botón del medio abre en otra pestaña',
    );
  });

  it('una descarga no navega', () => {
    assert.equal(
      destinoDeSalida(
        ancla('http://localhost:3000/salas/abc/informe.pdf', { descarga: true }),
        AQUI,
        CLIC,
      ),
      null,
    );
  });

  it('otro dominio y un mailto recargan el documento: de eso ya avisa beforeunload', () => {
    assert.equal(destinoDeSalida(ancla('https://xten.av/otra'), AQUI, CLIC), null);
    assert.equal(destinoDeSalida(ancla('mailto:av@ejemplo.es'), AQUI, CLIC), null);
  });

  it('un clic que alguien ya canceló no hay que volver a cancelarlo', () => {
    assert.equal(
      destinoDeSalida(ancla('http://localhost:3000/salas/abc'), AQUI, {
        ...CLIC,
        defaultPrevented: true,
      }),
      null,
    );
  });
});
