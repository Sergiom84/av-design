import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  destinoSeguro,
  esRutaLibre,
  estadoPuerta,
  firmarSesion,
  huella,
  igualSinFiltrar,
  limpiarHuella,
  limpiarSecreto,
  sesionValida,
} from './sesion';

const SECRETO = 'secreto-de-pruebas-largo-y-tonto';
const AHORA = 1_800_000_000_000;

describe('la huella de la clave', () => {
  it('la misma clave da la misma huella', async () => {
    assert.equal(await huella('abeto'), await huella('abeto'));
  });

  it('claves distintas dan huellas distintas', async () => {
    assert.notEqual(await huella('abeto'), await huella('abeta'));
  });

  it('la huella no contiene la clave', async () => {
    const h = await huella('caja-de-conexiones');
    assert.ok(!h.includes('caja'));
    assert.equal(h.length, 64);
  });
});

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
  it('una sesión recién hecha vale', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA + 60_000);
    assert.equal(await sesionValida(SECRETO, cookie, AHORA), true);
  });

  it('una sesión caducada no vale', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA - 1);
    assert.equal(await sesionValida(SECRETO, cookie, AHORA), false);
  });

  it('sin cookie no se pasa', async () => {
    assert.equal(await sesionValida(SECRETO, undefined, AHORA), false);
    assert.equal(await sesionValida(SECRETO, '', AHORA), false);
  });

  it('una cookie inventada no vale', async () => {
    assert.equal(
      await sesionValida(SECRETO, `${AHORA + 60_000}.aaaa`, AHORA),
      false,
    );
  });

  it('con otro secreto no vale: cambiarlo echa a todo el mundo', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA + 60_000);
    assert.equal(await sesionValida('otro secreto', cookie, AHORA), false);
  });

  it('estirar la caducidad rompe la firma', async () => {
    const cookie = await firmarSesion(SECRETO, AHORA - 1);
    const firma = cookie.slice(cookie.indexOf('.') + 1);
    const estirada = `${AHORA + 999_999}.${firma}`;
    assert.equal(await sesionValida(SECRETO, estirada, AHORA), false);
  });

  it('una cookie con basura no lanza, devuelve falso', async () => {
    for (const basura of ['.', 'sinpunto', '.abc', 'x.y.z', 'nan.abc']) {
      assert.equal(await sesionValida(SECRETO, basura, AHORA), false, basura);
    }
  });
});

describe('qué rutas no piden clave', () => {
  it('la propia entrada y sus recursos', () => {
    assert.equal(esRutaLibre('/entrar'), true);
    assert.equal(esRutaLibre('/_next/static/chunk.js'), true);
    assert.equal(esRutaLibre('/favicon.ico'), true);
  });

  it('todo lo demás pide clave, incluida la interfaz de programación', () => {
    for (const r of ['/', '/salas', '/salas/abc', '/almacen', '/api/catalogo']) {
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
    // 65 caracteres en vez de 64, y la clave correcta dejaba de entrar.
    assert.equal(limpiarHuella('a'.repeat(64) + '\n'), 'a'.repeat(64));
    assert.equal(limpiarHuella('  ' + 'b'.repeat(64) + '  '), 'b'.repeat(64));
  });

  it('una huella en mayusculas es la misma huella', () => {
    assert.equal(limpiarHuella('ABCDEF'), 'abcdef');
  });

  it('vacio o solo espacios es no configurado, no cadena vacia', () => {
    assert.equal(limpiarHuella(undefined), undefined);
    assert.equal(limpiarHuella(''), undefined);
    assert.equal(limpiarHuella('   \n'), undefined);
    assert.equal(limpiarSecreto('  '), undefined);
  });

  it('el secreto se recorta pero NO se pasa a minusculas: cambiarlo echa a todos', () => {
    assert.equal(limpiarSecreto('  AbCdEf  '), 'AbCdEf');
  });
});

describe('el estado de la puerta', () => {
  const configurada = { huellaClave: 'h', secreto: 's' };

  it('con clave y secreto está protegida, se mire donde se mire', () => {
    assert.equal(estadoPuerta(configurada, true), 'protegida');
    assert.equal(estadoPuerta(configurada, false), 'protegida');
  });

  it('en desarrollo sin configurar se pasa: pedir clave ahí solo estorba', () => {
    assert.equal(
      estadoPuerta({ huellaClave: undefined, secreto: undefined }, false),
      'abierta',
    );
  });

  it('en producción sin configurar NO se pasa', () => {
    assert.equal(
      estadoPuerta({ huellaClave: undefined, secreto: undefined }, true),
      'sin_configurar',
    );
  });

  it('media configuración es no configuración', () => {
    assert.equal(estadoPuerta({ huellaClave: 'h', secreto: undefined }, true), 'sin_configurar');
    assert.equal(estadoPuerta({ huellaClave: undefined, secreto: 's' }, true), 'sin_configurar');
  });
});
