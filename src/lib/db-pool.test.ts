import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('producción crea un único pool perezoso al cruzar tags y propiedades del Proxy', () => {
  const archivo = fileURLToPath(new URL('./db.ts', import.meta.url));
  const programa = `
    const assert = require('node:assert/strict');
    const Module = require('node:module'), original = Module._load;
    let creados = 0;
    const fabrica = () => {
      const pool = ++creados;
      const cliente = Object.assign(async () => [{pool}], {
        unsafe: async () => [{pool}],
        begin: async (_opciones, trabajo) => trabajo(cliente),
        options: {pool},
      });
      return cliente;
    };
    Module._load = function(id, ...args) {
      return id === 'server-only' ? {} : id === 'postgres' ? fabrica : original.call(this, id, ...args);
    };
    const db = require(${JSON.stringify(archivo)});
    Module._load = original;
    assert.equal(creados, 0, 'importar no crea un cliente');
    assert.equal(db.sql.then, undefined);
    assert.equal(creados, 0, 'comprobar then tampoco crea un cliente');
    (async () => {
      const respuestas = await Promise.all(Array.from({length:40}, () => db.sql(['select pool'])));
      assert.equal(creados, 1, 'todos los tags reutilizan el mismo pool');
      assert.deepEqual(respuestas.flat().map(r => r.pool), Array(40).fill(1));
      assert.equal((await db.sql.unsafe('select pool'))[0].pool, 1);
      assert.equal(db.sql.options.pool, 1);
      assert.equal(await db.conLecturaConsistente(async () => (await db.sql(['select pool']))[0].pool), 1);
      assert.equal(creados, 1, 'get y begin tampoco crean pools adicionales');
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `;
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '-e', programa], {
    encoding: 'utf8', timeout: 15000,
    env: { PATH: process.env.PATH, NODE_ENV: 'production', DATABASE_URL: 'postgres://prueba_local_no_usada@127.0.0.1/base_no_usada' },
  });
  assert.equal(resultado.status, 0, resultado.stderr || resultado.stdout);
});
