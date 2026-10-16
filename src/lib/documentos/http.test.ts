import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

class ErrorSeleccionDocumentos extends Error {}
let fallo: unknown;
let falloSesion: unknown;
let sesion: { id: string; debeCambiarClave: boolean; permisos: object } | null = { id: 'persona', debeCambiarClave: false, permisos: {} };
const dobles: Record<string, unknown> = {
  '@/lib/db': { hayConfiguracion: () => true },
  '@/lib/sesion-servidor': { sesionActual: async () => { if (falloSesion) throw falloSesion; return sesion; } },
  '@/lib/documentos/datos': { ErrorSeleccionDocumentos, cargarSnapshot: async () => { throw fallo; } },
  '@/lib/documentos/seleccion': { seleccionDocumentos: { safeParse: () => ({ success: true, data: { salaIds: ['sala'], documentos: ['plano'] } }) }, permisoExportacion: () => true },
  '@/lib/documentos/paquete': { generarPaquete: () => { throw new Error('No debe generar si falla la lectura'); },
    leerPaquete: async () => ({ manifiesto: { documentos: ['plano'] }, esObra: false }), leerArchivo: async () => new Uint8Array([1]) },
  '@/lib/documentos/pdf': { generarPdfTecnico: () => { throw new Error('No debe generar PDF si falla la lectura'); } },
};
type Cargador = { _load: (request: string, parent?: { filename?: string }, ...resto: unknown[]) => unknown };
const cargador = Module as unknown as Cargador;
const original = cargador._load;
let ruta: typeof import('../../app/api/documentos/route');
let manifiesto: typeof import('../../app/api/documentos/[id]/route');
let descarga: typeof import('../../app/api/documentos/[id]/descarga/route');
try {
  cargador._load = (request, parent, ...resto) => parent?.filename?.includes('/app/api/documentos/') && parent.filename.endsWith('/route.ts') && request in dobles
    ? dobles[request] : original.call(Module, request, parent, ...resto);
  ruta = createRequire(import.meta.url)('../../app/api/documentos/route.ts') as typeof import('../../app/api/documentos/route');
  manifiesto = createRequire(import.meta.url)('../../app/api/documentos/[id]/route.ts') as typeof import('../../app/api/documentos/[id]/route');
  descarga = createRequire(import.meta.url)('../../app/api/documentos/[id]/descarga/route.ts') as typeof import('../../app/api/documentos/[id]/descarga/route');
} finally { cargador._load = original; }

describe('la API de documentos diferencia entrada inválida y servicio no disponible', () => {
  it('una selección inválida devuelve 400 y su explicación segura', async () => {
    fallo = new ErrorSeleccionDocumentos('La selección contiene una sala ajena a esta obra.');
    const respuesta = await ruta.POST(new Request('http://localhost/api/documentos', { method: 'POST', body: '{}' }));
    assert.equal(respuesta.status, 400);
    assert.deepEqual(await respuesta.json(), { error: 'La selección contiene una sala ajena a esta obra.' });
  });
  it('un error interno devuelve 503 sin detalles de SQL ni infraestructura', async () => {
    for (fallo of [new Error('relation sala_material_bom does not exist; host privado'), 'fallo interno']) {
      const respuesta = await ruta.POST(new Request('http://localhost/api/documentos', { method: 'POST', body: '{}' }));
      assert.equal(respuesta.status, 503);
      assert.deepEqual(await respuesta.json(), { error: 'No se pudieron leer los datos. Prueba una nueva generación.' });
    }
  });
  it('un fallo interno al leer la sesión se convierte en 503 seguro en generación y descargas', async () => {
    falloSesion = new Error('relation usuarios does not exist; host privado');
    const contexto = { params: Promise.resolve({ id: 'e1000000-0000-4000-8000-000000000010' }) };
    try {
      const llamadas = [
        () => ruta.POST(new Request('http://localhost/api/documentos', { method: 'POST', body: '{}' })),
        () => manifiesto.GET(new Request('http://localhost/api/documentos/id'), contexto),
        () => descarga.GET(new Request('http://localhost/api/documentos/id/descarga'), contexto),
      ];
      for (const llamar of llamadas) {
        const respuesta = await llamar();
        assert.equal(respuesta.status, 503);
        assert.doesNotMatch(await respuesta.text(), /usuarios|host privado|relation/);
      }
    } finally { falloSesion = undefined; }
  });
  it('la frontera de sesión conserva 401 sin sesión y 403 con contraseña provisional', async () => {
    const contexto = { params: Promise.resolve({ id: 'e1000000-0000-4000-8000-000000000010' }) };
    try {
      for (const estado of [401, 403]) {
        sesion = estado === 401 ? null : { id: 'persona', debeCambiarClave: true, permisos: {} };
        assert.equal((await ruta.POST(new Request('http://localhost/api/documentos', { method: 'POST', body: '{}' }))).status, estado);
        assert.equal((await manifiesto.GET(new Request('http://localhost/api/documentos/id'), contexto)).status, estado);
        assert.equal((await descarga.GET(new Request('http://localhost/api/documentos/id/descarga'), contexto)).status, estado);
      }
    } finally { sesion = { id: 'persona', debeCambiarClave: false, permisos: {} }; }
  });
});
