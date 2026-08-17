import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  destinoSeguro,
  esRutaLibre,
  estadoPuerta,
  firmarSesion,
  igualSinFiltrar,
  leerSesion,
  limpiarSecreto,
} from './sesion';

const SECRETO = 'secreto-de-pruebas-largo-y-tonto';
const AHORA = 1_800_000_000_000;
const YO = '11111111-1111-1111-1111-111111111111';
const OTRO = '22222222-2222-2222-2222-222222222222';

describe('la comparación no filtra por tiempo', () => {
  it('iguales', () => {
    assert.equal(igualSinFiltrar('abcdef', 'abcdef'), true);
  });

  it('distinta longitud', () => {
    assert.equal(igualSinFiltrar('abc', 'abcd'), false);
  });

  it('mismo largo y un carácter distinto', () => {
    assert.equal(igualSinFiltrar('abcdef', 'abcdeg'), false);
  });

  it('acertar el principio no vale de nada', () => {
    assert.equal(igualSinFiltrar('aaaaaa', 'aaaaab'), false);
  });
});

describe('la sesión firmada', () => {
  it('una sesión recién hecha vale y dice de quién es', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA + 60_000, YO);
    const sesion = await leerSesion(SECRETO, cookie, AHORA);
    assert.equal(sesion?.usuarioId, YO);
  });

  it('una sesión caducada no vale', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA - 1, YO);
    assert.equal(await leerSesion(SECRETO, cookie, AHORA), null);
  });

  it('sin cookie no se pasa', async () => {
    assert.equal(await leerSesion(SECRETO, undefined, AHORA), null);
    assert.equal(await leerSesion(SECRETO, '', AHORA), null);
  });

  it('una cookie inventada no vale', async () => {
    assert.equal(await leerSesion(SECRETO, `${AHORA + 60_000}.${YO}.aaaa`, AHORA), null);
  });

  it('con otro secreto no vale: cambiarlo echa a todo el mundo', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA + 60_000, YO);
    assert.equal(await leerSesion('otro secreto', cookie, AHORA), null);
  });

  it('estirar la caducidad rompe la firma', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA - 1, YO);
    const firma = cookie.split('.')[2];
    const estirada = `${AHORA + 999_999}.${YO}.${firma}`;
    assert.equal(await leerSesion(SECRETO, estirada, AHORA), null);
  });

  it('cambiar de quién es la cookie rompe la firma', async () => {
    // Lo que impide coger la propia sesión y ponerle el identificador del
    // administrador. Es la razón de que el identificador vaya dentro de lo
    // firmado y no al lado.
    const cookie = await firmarSesion(SECRETO, AHORA + 60_000, YO);
    const [expira, , firma] = cookie.split('.');
    assert.equal(await leerSesion(SECRETO, `${expira}.${OTRO}.${firma}`, AHORA), null);
  });

  it('la firma de una persona no sirve para otra en el mismo instante', async () => {
    const mia = await firmarSesion(SECRETO, AHORA + 60_000, YO);
    const suya = await firmarSesion(SECRETO, AHORA + 60_000, OTRO);
    assert.notEqual(mia.split('.')[2], suya.split('.')[2]);
  });

  it('una cookie con basura no lanza, devuelve nulo', async () => {
    for (const basura of ['.', 'sinpunto', '.abc', 'x.y', 'a.b.c.d', 'nan.x.abc', `${AHORA + 1}..x`]) {
      assert.equal(await leerSesion(SECRETO, basura, AHORA), null, basura);
    }
  });
});

describe('qué rutas no piden sesión', () => {
  it('la propia entrada y sus recursos', () => {
    assert.equal(esRutaLibre('/entrar'), true);
    assert.equal(esRutaLibre('/_next/static/chunk.js'), true);
    assert.equal(esRutaLibre('/favicon.ico'), true);
  });

  it('todo lo demás pide sesión, incluida la interfaz de programación', () => {
    for (const r of ['/', '/salas', '/salas/abc', '/almacen', '/api/catalogo', '/usuarios', '/cuenta']) {
      assert.equal(esRutaLibre(r), false, r);
    }
  });

  it('no basta con que la ruta empiece parecido', () => {
    assert.equal(esRutaLibre('/entrar-por-la-ventana'), false);
    assert.equal(esRutaLibre('/_nextcosa'), false);
  });
});

describe('a dónde se puede devolver después de entrar', () => {
  it('una ruta de la aplicación se respeta, con lo que lleve detrás', () => {
    assert.equal(destinoSeguro('/salas/abc'), '/salas/abc');
    assert.equal(destinoSeguro('/plantillas?abierta=3'), '/plantillas?abierta=3');
  });

  it('sin destino se va al panel', () => {
    assert.equal(destinoSeguro(undefined), '/');
    assert.equal(destinoSeguro(''), '/');
  });

  it('un dominio de fuera no cuela: la puerta no es un trampolín', () => {
    for (const malo of [
      'https://malo.example',
      'http://malo.example',
      '//malo.example',
      '/\\malo.example',
      'javascript:alert(1)',
      'malo.example',
    ]) {
      assert.equal(destinoSeguro(malo), '/', malo);
    }
  });
});

describe('la limpieza de lo que llega del servidor', () => {
  it('el salto de linea que arrastra el portapapeles no cuenta', () => {
    assert.equal(limpiarSecreto('  abc  \n'), 'abc');
  });

  it('vacio o solo espacios es no configurado, no cadena vacia', () => {
    assert.equal(limpiarSecreto(undefined), undefined);
    assert.equal(limpiarSecreto(''), undefined);
    assert.equal(limpiarSecreto('   \n'), undefined);
  });

  it('el secreto se recorta pero NO se pasa a minusculas: cambiarlo echa a todos', () => {
    assert.equal(limpiarSecreto('  AbCdEf  '), 'AbCdEf');
  });
});

describe('el estado de la puerta', () => {
  it('con secreto está protegida, se mire donde se mire', () => {
    assert.equal(estadoPuerta('s', true), 'protegida');
    assert.equal(estadoPuerta('s', false), 'protegida');
  });

  it('en desarrollo sin configurar se pasa: pedir clave ahí solo estorba', () => {
    assert.equal(estadoPuerta(undefined, false), 'abierta');
  });

  it('en producción sin configurar NO se pasa', () => {
    assert.equal(estadoPuerta(undefined, true), 'sin_configurar');
  });
});
