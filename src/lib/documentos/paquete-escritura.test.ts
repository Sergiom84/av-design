import { it } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import type { SnapshotExportacion } from './modelo';

const escritos: string[] = [];
const dobles: Record<string, unknown> = {
  'node:fs/promises': {
    mkdir: async () => {}, readdir: async () => [],
    writeFile: async (nombre: string) => {
      if (nombre.endsWith('-plano.pdf')) throw new Error('ENOSPC: fallo de escritura de prueba');
      escritos.push(nombre);
    },
  },
};
type Cargador = { _load: (request: string, parent?: { filename?: string }, ...resto: unknown[]) => unknown };
const cargador = Module as unknown as Cargador;
const original = cargador._load;
let modulo: typeof import('./paquete');
try {
  cargador._load = (request, parent, ...resto) => parent?.filename?.endsWith('/documentos/paquete.ts') && request in dobles
    ? dobles[request] : original.call(Module, request, parent, ...resto);
  modulo = createRequire(import.meta.url)('./paquete.ts') as typeof import('./paquete');
} finally { cargador._load = original; }

it('un documento que no se pudo escribir no consume el límite de los documentos siguientes', async () => {
  const snapshot = { revision: 'DOC-escritura', creadoEn: '2026-10-15T10:00:00.000Z', proyecto: null,
    salas: [{ sala: { id: 'e1000000-0000-4000-8000-000000000010', nombre: 'Sala sintética', codigo: 'PRUEBA' } }],
  } as SnapshotExportacion;
  const manifiesto = await modulo.generarPaquete(snapshot, ['plano', 'elevaciones'],
    { papel: 'A4', orientacion: 'horizontal', escala: 50 }, 'persona', () => {},
    async (_snapshot, _sala, documento) => new Uint8Array((documento === 'plano' ? 49 : 2) * 1024 * 1024));
  assert.equal(manifiesto.archivos[0].estado, 'error');
  assert.equal(manifiesto.archivos[1].estado, 'correcto');
  assert.equal(manifiesto.archivos[1].bytes, 2 * 1024 * 1024);
  assert.ok(escritos.some(nombre => nombre.endsWith('-elevaciones.pdf')));
});
