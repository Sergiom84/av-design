import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearBorrador, decodificarBoca, prepararGuardado } from './editor-conexiones';
import type { Conexion, Puerto } from './tipos';

const puerto = (id: string, articulo_id: string, total = 1): Puerto => ({
  id, articulo_id, total, nombre: id, sentido: 'bidireccional', senal: 'hdmi',
  conector: null, orden: 1, notas: null, fuente: 'csv',
});
const original: Conexion = {
  id: 'c1', sala_id: 's1', origen_id: 'e1', destino_id: 'e2',
  puerto_origen_id: null, puerto_destino_id: null,
  puerto_origen_ordinal: null, puerto_destino_ordinal: null,
  articulo_cable_id: null, senal: 'otro', ruta: null,
  longitud_manual_m: null, notas: null,
};

describe('borrador del editor de conexiones', () => {
  it('no convierte una conexión legacy incompleta en un cambio inválido', () => {
    const entrada = prepararGuardado({
      salaId: 's1', versionEsperada: 4, originales: [original],
      borrador: crearBorrador([original]), puertos: new Map(),
    });
    assert.deepEqual(entrada, { sala_id: 's1', versionEsperada: 4, altas: [], cambios: [], bajas: [] });
  });

  it('envía juntas alta completa, cambio legacy completado y baja', () => {
    const puertos = new Map([['p1', puerto('p1', 'a1', 2)], ['p2', puerto('p2', 'a2')]]);
    const completada = { ...crearBorrador([original])[0], puerto_origen_id: 'p1', puerto_origen_ordinal: 2, puerto_destino_id: 'p2', puerto_destino_ordinal: 1 };
    const temporal = { ...completada, id: 'tmp-1', temporal: true, senal: 'hdmi' as const };
    const entrada = prepararGuardado({ salaId: 's1', versionEsperada: 4, originales: [original, { ...original, id: 'borrar' }], borrador: [completada, temporal], puertos });
    assert.equal(entrada.altas[0].temporal_id, 'tmp-1');
    assert.equal(entrada.cambios[0].id, 'c1');
    assert.deepEqual(entrada.bajas, ['borrar']);
  });

  it('rechaza bocas codificadas truncadas o con ordinal cero', () => {
    assert.deepEqual(decodificarBoca('e1|p1|2'), { equipo_id: 'e1', puerto_id: 'p1', ordinal: 2 });
    assert.equal(decodificarBoca('e1|p1|0'), null);
    assert.equal(decodificarBoca('e1|p1'), null);
  });
});
