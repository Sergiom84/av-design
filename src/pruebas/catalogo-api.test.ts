import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import type { NextRequest } from 'next/server';
import { PERMISOS_POR_ROL } from '@/lib/usuarios';

let usuario: { permisos: typeof PERMISOS_POR_ROL.admin; debeCambiarClave: boolean } | null;
let configurada = true, falloSesion = false, falloCatalogo = false, consultas = 0;
const cargador = Module as unknown as { _load: (nombre: string, ...args: unknown[]) => unknown };
const original = cargador._load;
let GET: typeof import('../app/api/catalogo/route').GET;
try {
  cargador._load = (nombre, ...args) => nombre === '@/lib/db' ? { hayConfiguracion: () => configurada }
    : nombre === '@/lib/sesion-servidor' ? { sesionActual: async () => {
      if (falloSesion) throw new Error('detalle interno sintético de sesión');
      return usuario;
    } }
    : nombre === '@/lib/datos' ? { buscarArticulos: async (q: string, tipo: string) => {
      consultas++;
      if (falloCatalogo) throw new Error('detalle interno sintético de catálogo');
      return [{ id: 'referencia-sintetica', etiqueta: q, categoria: tipo, unidad: 'ud' }];
    } } : original.call(Module, nombre, ...args);
  GET = createRequire(import.meta.url)('../app/api/catalogo/route.ts').GET;
} finally { cargador._load = original; }

const request = () => ({ nextUrl: new URL('http://localhost/api/catalogo?q=Pantalla&tipo=equipo') }) as unknown as NextRequest;
function reiniciar() {
  usuario = { permisos: { ...PERMISOS_POR_ROL.admin }, debeCambiarClave: false };
  configurada = true; falloSesion = false; falloCatalogo = false; consultas = 0;
}

describe('buscador compartido: permiso actual antes de consultar artículos', () => {
  it('sin sesión responde JSON401/no-store y no busca', async () => {
    reiniciar(); usuario = null;
    const r = await GET(request());
    assert.equal(r.status, 401); assert.equal(consultas, 0);
    assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(typeof (await r.json()).error, 'string');
  });
  it('permiso retirado y contraseña provisional dan403 sin consulta', async () => {
    for (const provisional of [false, true]) {
      reiniciar();
      usuario!.debeCambiarClave = provisional;
      if (!provisional) usuario!.permisos.catalogo = 'oculto';
      const r = await GET(request());
      assert.equal(r.status, 403); assert.equal(consultas, 0);
    }
  });
  it('una lectura autorizada conserva la proyección y parámetros del buscador', async () => {
    reiniciar();
    const r = await GET(request());
    assert.equal(r.status, 200); assert.equal(consultas, 1);
    assert.deepEqual(await r.json(), [{ id: 'referencia-sintetica', etiqueta: 'Pantalla', categoria: 'equipo', unidad: 'ud' }]);
  });
  it('sin configuración no presenta una lista vacía como consulta correcta', async () => {
    reiniciar(); configurada = false;
    const r = await GET(request());
    assert.equal(r.status, 503); assert.equal(consultas, 0);
  });
  it('fallos de sesión o catálogo tienen frontera503 y mensaje genérico', async () => {
    for (const enSesion of [true, false]) {
      reiniciar(); falloSesion = enSesion; falloCatalogo = !enSesion;
      const r = await GET(request());
      assert.equal(r.status, 503);
      assert.doesNotMatch(await r.text(), /detalle interno|sintético/);
    }
  });
});
