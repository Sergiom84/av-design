import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparSalasPorLocalizacion,
  estadoDeSalaEnPortada,
  resumenDeProyecto,
  type SalaDePortada,
} from './proyecto';
import { LOCALIZACION_SIN_ASIGNAR } from './nombres-proyecto';

const sala = (extra: Partial<SalaDePortada> = {}): SalaDePortada => ({
  id: 's1',
  nombre: 'TP8 planta 3 01',
  codigo: null,
  localizacion_id: 'l1',
  largo_m: 4.7,
  ancho_m: 2.5,
  alto_m: 2.7,
  n_conexiones: 4,
  instalada: false,
  entregada: false,
  ...extra,
});

describe('estadoDeSalaEnPortada', () => {
  test('sin medidas', () => {
    assert.equal(estadoDeSalaEnPortada(sala({ largo_m: 0 })), 'sin_medidas');
  });

  test('con medidas y sin hitos, en diseño', () => {
    assert.equal(estadoDeSalaEnPortada(sala()), 'en_diseno');
  });

  test('el hito más avanzado manda', () => {
    assert.equal(estadoDeSalaEnPortada(sala({ instalada: true })), 'instalada');
    assert.equal(
      estadoDeSalaEnPortada(sala({ instalada: true, entregada: true })),
      'entregada',
    );
  });

  test('una sala entregada sin medidas sigue siendo entregada', () => {
    assert.equal(
      estadoDeSalaEnPortada(sala({ largo_m: 0, entregada: true })),
      'entregada',
    );
  });
});

describe('agruparSalasPorLocalizacion', () => {
  const localizaciones = [
    { id: 'l-sin', nombre: LOCALIZACION_SIN_ASIGNAR },
    { id: 'l-b3', nombre: 'Edificio B · Planta 3' },
    { id: 'l-a1', nombre: 'Edificio A · Planta 1' },
  ];

  test('ordena alfabéticamente con "Sin asignar" al final', () => {
    const grupos = agruparSalasPorLocalizacion(localizaciones, []);
    assert.deepEqual(
      grupos.map((g) => g.nombre),
      ['Edificio A · Planta 1', 'Edificio B · Planta 3', LOCALIZACION_SIN_ASIGNAR],
    );
  });

  test('las localizaciones vacías se incluyen', () => {
    const grupos = agruparSalasPorLocalizacion(localizaciones, [
      sala({ localizacion_id: 'l-b3' }),
    ]);
    assert.equal(grupos.length, 3);
    assert.equal(grupos.find((g) => g.id === 'l-a1')?.salas.length, 0);
    assert.equal(grupos.find((g) => g.id === 'l-b3')?.salas.length, 1);
  });

  test('cada sala cae en su grupo', () => {
    const grupos = agruparSalasPorLocalizacion(localizaciones, [
      sala({ id: 'a', localizacion_id: 'l-a1' }),
      sala({ id: 'b', localizacion_id: 'l-b3' }),
      sala({ id: 'c', localizacion_id: 'l-b3' }),
    ]);
    assert.deepEqual(
      grupos.map((g) => g.salas.length),
      [1, 2, 0],
    );
  });
});

describe('resumenDeProyecto', () => {
  test('cuenta salas por estado y pedidos en curso', () => {
    const r = resumenDeProyecto({
      salas: [
        sala(),
        sala({ id: 'b', largo_m: 0 }),
        sala({ id: 'c', instalada: true }),
        sala({ id: 'd', instalada: true, entregada: true }),
      ],
      pedidos: [
        { estado: 'borrador' },
        { estado: 'pedido' },
        { estado: 'recibido_parcial' },
        { estado: 'recibido' },
      ],
    });
    assert.deepEqual(r, {
      salas: 4,
      sin_medidas: 1,
      en_diseno: 1,
      instaladas: 1,
      entregadas: 1,
      pedidos_en_curso: 2,
    });
  });

  test('proyecto vacío no revienta', () => {
    const r = resumenDeProyecto({ salas: [], pedidos: [] });
    assert.equal(r.salas, 0);
    assert.equal(r.pedidos_en_curso, 0);
  });
});
