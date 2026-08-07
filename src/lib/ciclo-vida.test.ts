import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisosDeEntrega,
  estadoDeProyecto,
  resumenCicloVida,
  tecnicosDeRol,
  type HitoProyecto,
  type HitoSala,
  type Recepcion,
  type Tecnico,
  type TecnicoRol,
} from './ciclo-vida';

const tecnico = (id: string, nombre: string, activo = true): Tecnico => ({
  id,
  nombre,
  activo,
});

const hitoProyecto = (
  tipo: HitoProyecto['tipo'],
  extra: Partial<HitoProyecto> = {},
): HitoProyecto => ({
  id: `hp-${tipo}`,
  proyecto_id: 'p1',
  tipo,
  tecnico_id: 't1',
  tecnico: 'Daniel',
  fecha: '2026-08-01',
  notas: null,
  ...extra,
});

const hitoSala = (tipo: HitoSala['tipo'], extra: Partial<HitoSala> = {}): HitoSala => ({
  id: `hs-${tipo}`,
  sala_id: 's1',
  tipo,
  tecnico_id: 't2',
  tecnico: 'Diego',
  fecha: '2026-08-05',
  notas: null,
  ...extra,
});

describe('tecnicosDeRol', () => {
  const tecnicos = [
    tecnico('t1', 'Roberto'),
    tecnico('t2', 'Diego'),
    tecnico('t3', 'Miguel'),
    tecnico('t4', 'Ana', false),
  ];
  const roles: TecnicoRol[] = [
    { tecnico_id: 't1', rol: 'recepcion' },
    { tecnico_id: 't2', rol: 'instalacion' },
    { tecnico_id: 't3', rol: 'recepcion' },
    { tecnico_id: 't3', rol: 'instalacion' },
    { tecnico_id: 't4', rol: 'recepcion' },
  ];

  test('filtra por rol y ordena por nombre', () => {
    const r = tecnicosDeRol(tecnicos, roles, 'recepcion');
    assert.deepEqual(
      r.map((t) => t.nombre),
      ['Miguel', 'Roberto'],
    );
  });

  test('una persona puede tener dos roles', () => {
    const inst = tecnicosDeRol(tecnicos, roles, 'instalacion');
    assert.deepEqual(
      inst.map((t) => t.nombre),
      ['Diego', 'Miguel'],
    );
  });

  test('un técnico inactivo no sale aunque tenga el rol', () => {
    const r = tecnicosDeRol(tecnicos, roles, 'recepcion');
    assert.ok(!r.some((t) => t.nombre === 'Ana'));
  });

  test('sin nadie con el rol devuelve vacío', () => {
    assert.deepEqual(tecnicosDeRol(tecnicos, roles, 'inicio'), []);
  });
});

describe('estadoDeProyecto', () => {
  test('sin hitos, sin iniciar', () => {
    assert.equal(estadoDeProyecto([]), 'sin_iniciar');
  });

  test('con inicio, en curso', () => {
    assert.equal(estadoDeProyecto([hitoProyecto('inicio')]), 'en_curso');
  });

  test('con cierre, cerrado, aunque falte el inicio', () => {
    assert.equal(estadoDeProyecto([hitoProyecto('cierre')]), 'cerrado');
    assert.equal(
      estadoDeProyecto([hitoProyecto('inicio'), hitoProyecto('cierre')]),
      'cerrado',
    );
  });
});

describe('resumenCicloVida', () => {
  const recepcion: Recepcion = {
    pedido_id: 'pe1',
    referencia: 'Sala · Comm-Tec',
    fecha: '2026-08-03',
    quien: 'Roberto',
  };

  test('todo sin registrar: cuatro pasos pendientes', () => {
    const r = resumenCicloVida({ hitosProyecto: [], hitosSala: [], recepciones: [] });
    assert.equal(r.pasos.length, 4);
    assert.ok(r.pasos.every((p) => !p.hecho));
    assert.equal(r.pendiente.length, 4);
  });

  test('el inicio lo hereda del proyecto', () => {
    const r = resumenCicloVida({
      hitosProyecto: [hitoProyecto('inicio')],
      hitosSala: [],
      recepciones: [],
    });
    const inicio = r.pasos.find((p) => p.clave === 'inicio');
    assert.ok(inicio?.hecho);
    assert.match(inicio!.detalle, /Daniel/);
    assert.match(inicio!.detalle, /2026-08-01/);
  });

  test('las recepciones se derivan de los pedidos, con quién y referencia', () => {
    const r = resumenCicloVida({
      hitosProyecto: [],
      hitosSala: [],
      recepciones: [recepcion],
    });
    const paso = r.pasos.find((p) => p.clave === 'recepciones');
    assert.ok(paso?.hecho);
    assert.match(paso!.detalle, /Roberto/);
    assert.match(paso!.detalle, /Comm-Tec/);
  });

  test('ciclo completo: nada pendiente', () => {
    const r = resumenCicloVida({
      hitosProyecto: [hitoProyecto('inicio')],
      hitosSala: [hitoSala('instalacion'), hitoSala('entrega')],
      recepciones: [recepcion],
    });
    assert.deepEqual(r.pendiente, []);
  });

  test('un hito con técnico ya fuera de la lista no pierde la fecha', () => {
    const r = resumenCicloVida({
      hitosProyecto: [],
      hitosSala: [hitoSala('instalacion', { tecnico_id: null, tecnico: null })],
      recepciones: [],
    });
    const paso = r.pasos.find((p) => p.clave === 'instalacion');
    assert.ok(paso?.hecho);
    assert.equal(paso!.detalle, '2026-08-05');
  });

  test('la nota de la entrega sale en el detalle', () => {
    const r = resumenCicloVida({
      hitosProyecto: [],
      hitosSala: [hitoSala('entrega', { notas: 'Se entrega sin el cable HDMI' })],
      recepciones: [],
    });
    const paso = r.pasos.find((p) => p.clave === 'entrega');
    assert.match(paso!.detalle, /Se entrega sin el cable HDMI/);
  });
});

describe('avisosDeEntrega', () => {
  const punto = (
    estado: 'listo' | 'aviso' | 'bloqueo' | 'no_aplica',
    titulo: string,
  ) => ({ estado, titulo, detalle: `detalle de ${titulo}` });

  test('todo listo: sin avisos y sin nota obligatoria', () => {
    const r = avisosDeEntrega([punto('listo', 'Medidas'), punto('no_aplica', 'Carga')]);
    assert.deepEqual(r.avisos, []);
    assert.equal(r.exigeNota, false);
  });

  test('un aviso se enseña pero no exige nota', () => {
    const r = avisosDeEntrega([punto('aviso', 'Puertos')]);
    assert.equal(r.avisos.length, 1);
    assert.equal(r.exigeNota, false);
  });

  test('un bloqueo exige nota: la entrega avisa, no bloquea', () => {
    const r = avisosDeEntrega([punto('bloqueo', 'Material'), punto('aviso', 'Puertos')]);
    assert.equal(r.exigeNota, true);
    // Los bloqueos van primero: es lo que hay que leer antes de firmar.
    assert.match(r.avisos[0], /Material/);
  });
});
