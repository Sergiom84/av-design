import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Module, { createRequire } from 'node:module';
import type postgres from 'postgres';

const cargador = Module as unknown as { _load: (s: string, ...args: unknown[]) => unknown };
const original = cargador._load;
let modulo: typeof import('./db');
try {
  cargador._load = (s, ...args) => s === 'server-only' ? {} : original.call(Module, s, ...args);
  modulo = createRequire(import.meta.url)('./db.ts');
} finally { cargador._load = original; }

function conexion(nombre: string) {
  const c = Object.assign(async () => [{ nombre }], {
    begin: () => { throw new Error('No abrir otra transacción desde el adaptador.'); },
  });
  return c as unknown as ReturnType<typeof postgres>;
}
const leer = async () => (await modulo.sql`select contexto_de_prueba`)[0].nombre;

describe('conexión compartida de lectores: aislamiento por operación', () => {
  it('un lector anidado vuelve a su conexión anterior, sin abrir begin', async () => {
    const previa = global.__sql;
    global.__sql = conexion('fuera');
    try {
      const valores = await modulo.conConexionDeLectura(conexion('exterior'), async () => [
        await leer(),
        await modulo.conConexionDeLectura(conexion('interior'), leer),
        await leer(),
      ]);
      assert.deepEqual(valores, ['exterior', 'interior', 'exterior']);
      assert.equal(await leer(), 'fuera');
    } finally { global.__sql = previa; }
  });

  it('dos capturas simultáneas conservan sus conexiones al cruzarse los await', async () => {
    let liberar!: () => void;
    const barrera = new Promise<void>(resolve => { liberar = resolve; });
    const primera = modulo.conConexionDeLectura(conexion('capturaA'), async () => {
      const antes = await leer();
      await barrera;
      return [antes, await leer()];
    });
    const segunda = modulo.conConexionDeLectura(conexion('capturaB'), async () => {
      const antes = await leer();
      liberar();
      return [antes, await leer()];
    });
    assert.deepEqual(await Promise.all([primera, segunda]), [
      ['capturaA', 'capturaA'], ['capturaB', 'capturaB'],
    ]);
  });

  it('un rechazo no deja su conexión activa para la petición siguiente', async () => {
    const previa = global.__sql;
    global.__sql = conexion('siguiente');
    try {
      await assert.rejects(modulo.conConexionDeLectura(conexion('fallida'), async () => {
        assert.equal(await leer(), 'fallida');
        throw new Error('Fallo sintético de captura.');
      }), /Fallo sintético/);
      assert.equal(await leer(), 'siguiente');
    } finally { global.__sql = previa; }
  });
});
