import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparSalasPorLocalizacion,
  estadoDeSalaEnPortada,
  pasosDeProyecto,
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

describe('pasosDeProyecto', () => {
  const sinAsignar = [{ nombre: LOCALIZACION_SIN_ASIGNAR }];

  test('obra recién creada: nada hecho y el primer paso es la localización', () => {
    const pasos = pasosDeProyecto({ localizaciones: sinAsignar, salas: [] });
    assert.deepEqual(
      pasos.map((p) => p.hecho),
      [false, false, false],
    );
    assert.equal(pasos.find((p) => p.actual)?.clave, 'localizaciones');
  });

  test('"Sin asignar" no cuenta como estructura definida', () => {
    const pasos = pasosDeProyecto({ localizaciones: sinAsignar, salas: [] });
    assert.equal(pasos[0].hecho, false);
    assert.equal(pasos[0].detalle, 'Edificio y planta de la obra');
  });

  test('con localización propia, el paso actual pasa a las salas', () => {
    const pasos = pasosDeProyecto({
      localizaciones: [...sinAsignar, { nombre: 'Edificio B · Planta 3' }],
      salas: [],
    });
    assert.equal(pasos[0].hecho, true);
    assert.equal(pasos[0].detalle, '1 definida');
    assert.equal(pasos.find((p) => p.actual)?.clave, 'salas');
  });

  test('una sala sin medir deja el paso de medidas pendiente y lo dice', () => {
    const pasos = pasosDeProyecto({
      localizaciones: [{ nombre: 'Edificio B · Planta 3' }],
      salas: [sala(), sala({ id: 'b', largo_m: 0 })],
    });
    assert.equal(pasos[1].hecho, true);
    assert.equal(pasos[1].detalle, '2 salas');
    assert.equal(pasos[2].hecho, false);
    assert.equal(pasos[2].detalle, '1 sin medir');
    assert.equal(pasos.find((p) => p.actual)?.clave, 'medidas');
  });

  test('todo hecho: ningún paso queda marcado como actual', () => {
    const pasos = pasosDeProyecto({
      localizaciones: [{ nombre: 'Edificio B · Planta 3' }],
      salas: [sala()],
    });
    assert.deepEqual(
      pasos.map((p) => p.hecho),
      [true, true, true],
    );
    assert.equal(
      pasos.some((p) => p.actual),
      false,
    );
  });

  test('sin salas, las medidas no se dan por hechas', () => {
    const pasos = pasosDeProyecto({
      localizaciones: [{ nombre: 'Edificio B · Planta 3' }],
      salas: [],
    });
    assert.equal(pasos[2].hecho, false);
    assert.equal(pasos[2].detalle, 'Después de crear las salas');
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
