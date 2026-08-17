import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cifrarClave,
  convieneRecifrar,
  generarClaveProvisional,
  igualSinFiltrar,
  ITERACIONES,
  LARGO_MINIMO,
  motivoClaveInvalida,
  verificarClave,
} from './contrasena';

/*
  Estas pruebas cifran de verdad, y cifrar de verdad son 600.000 iteraciones.
  Donde solo importa el formato o el rechazo se usa un coste bajo: la prueba de
  que el coste real funciona es una sola, y las demás no tienen por qué pagarla
  cada vez que alguien guarda un fichero.
*/
const BARATO = 1000;

describe('cómo se guarda una contraseña', () => {
  it('lo guardado no contiene la contraseña', async () => {
    const guardado = await cifrarClave('caja-de-conexiones', BARATO);
    assert.ok(!guardado.includes('caja'));
  });

  it('lleva dentro el algoritmo, el coste y la sal', async () => {
    const guardado = await cifrarClave('abeto', BARATO);
    const [etiqueta, iteraciones, sal, huella] = guardado.split('$');
    assert.equal(etiqueta, 'pbkdf2-sha256');
    assert.equal(iteraciones, String(BARATO));
    assert.equal(sal.length, 32);
    assert.equal(huella.length, 64);
  });

  it('la misma contraseña dos veces da huellas distintas: la sal es por usuario', async () => {
    const a = await cifrarClave('abeto', BARATO);
    const b = await cifrarClave('abeto', BARATO);
    assert.notEqual(a, b);
    // Y las dos siguen valiendo.
    assert.equal(await verificarClave('abeto', a), true);
    assert.equal(await verificarClave('abeto', b), true);
  });
});

describe('la comprobación', () => {
  it('la contraseña correcta entra', async () => {
    const guardado = await cifrarClave('caja-de-conexiones', BARATO);
    assert.equal(await verificarClave('caja-de-conexiones', guardado), true);
  });

  it('una contraseña parecida no entra', async () => {
    const guardado = await cifrarClave('caja-de-conexiones', BARATO);
    assert.equal(await verificarClave('caja-de-conexione', guardado), false);
    assert.equal(await verificarClave('Caja-de-conexiones', guardado), false);
    assert.equal(await verificarClave('', guardado), false);
  });

  it('un valor guardado corrupto devuelve falso, no lanza', async () => {
    for (const basura of [
      '',
      'loquesea',
      'pbkdf2-sha256$600000$zz$aa',
      'md5$600000$aabb$ccdd',
      'pbkdf2-sha256$0$aabb$ccdd',
      'pbkdf2-sha256$600000$aabb',
      'pbkdf2-sha256$99999999$aabb$ccdd',
    ]) {
      assert.equal(await verificarClave('abeto', basura), false, basura);
    }
  });

  it('con el coste real de producción también funciona', async () => {
    const guardado = await cifrarClave('abeto-de-produccion');
    assert.equal(guardado.split('$')[1], String(ITERACIONES));
    assert.equal(await verificarClave('abeto-de-produccion', guardado), true);
  });
});

describe('subir el coste no invalida lo ya guardado', () => {
  it('lo derivado con menos coste se marca para rehacer', async () => {
    assert.equal(convieneRecifrar(await cifrarClave('abeto', BARATO)), true);
  });

  it('lo derivado con el coste actual no', async () => {
    assert.equal(convieneRecifrar(await cifrarClave('abeto')), false);
  });

  it('un valor ilegible se marca para rehacer', () => {
    assert.equal(convieneRecifrar('basura'), true);
  });
});

describe('qué se acepta como contraseña', () => {
  it('el largo mínimo', () => {
    assert.ok(motivoClaveInvalida('x'.repeat(LARGO_MINIMO - 1), 'xe05206'));
    assert.equal(motivoClaveInvalida('x'.repeat(LARGO_MINIMO), 'xe05206'), null);
  });

  it('no puede ser el propio usuario, ni cambiando mayúsculas', () => {
    assert.ok(motivoClaveInvalida('xe05206ab', 'xe05206ab'));
    assert.ok(motivoClaveInvalida('XE05206AB', 'xe05206ab'));
  });

  it('una contraseña larguísima se rechaza: derivarla es trabajo gratis para quien ataca', () => {
    assert.ok(motivoClaveInvalida('x'.repeat(201), 'xe05206'));
  });
});

describe('la contraseña provisional', () => {
  it('tiene el largo pedido y no repite', () => {
    const a = generarClaveProvisional();
    const b = generarClaveProvisional();
    assert.equal(a.length, 12);
    assert.notEqual(a, b);
  });

  it('no lleva caracteres que se confunden al dictarla', () => {
    for (let i = 0; i < 50; i += 1) {
      const clave = generarClaveProvisional(32);
      assert.ok(!/[il1O0]/.test(clave), clave);
    }
  });

  it('vale como contraseña sin más trámite', () => {
    assert.equal(motivoClaveInvalida(generarClaveProvisional(), 'xe05206'), null);
  });
});

describe('la comparación no filtra por tiempo', () => {
  it('acertar el principio no vale de nada', () => {
    assert.equal(igualSinFiltrar('aaaaaa', 'aaaaab'), false);
    assert.equal(igualSinFiltrar('abc', 'abcd'), false);
    assert.equal(igualSinFiltrar('abc', 'abc'), true);
  });
});
