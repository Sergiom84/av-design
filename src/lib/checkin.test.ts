import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOQUES_CHECKIN,
  PUNTOS_CHECKIN,
  agruparPorBloque,
  ayudaDeValor,
  motivoParaNoCerrar,
  pideValor,
  puedeCerrarse,
  puntosDeUnaVisita,
  resumirVisita,
} from './checkin';
import type { EstadoPunto, PuntoRevision } from './tipos';

const punto = (
  clave: string,
  estado: EstadoPunto,
  extra: Partial<PuntoRevision> = {},
): PuntoRevision => ({
  id: `p-${clave}`,
  revision_id: 'r1',
  clave,
  bloque: 'Sala',
  titulo: clave,
  estado,
  valor: null,
  notas: null,
  orden: 0,
  ...extra,
});

describe('plantilla de puntos del check-in', () => {
  test('ninguna clave se repite: es la que identifica el punto en la visita', () => {
    const claves = PUNTOS_CHECKIN.map((p) => p.clave);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('ningún orden se repite: el recorrido de la sala es uno solo', () => {
    const ordenes = PUNTOS_CHECKIN.map((p) => p.orden);
    assert.equal(new Set(ordenes).size, ordenes.length);
  });

  test('están los seis bloques del recorrido', () => {
    assert.deepEqual(
      [...BLOQUES_CHECKIN],
      ['Sala', 'Mesa', 'Pantalla', 'Red', 'Corriente', 'Acceso'],
    );
  });

  test('las tres medidas de la sala piden valor', () => {
    for (const clave of ['sala_largo', 'sala_ancho', 'sala_alto']) {
      assert.equal(pideValor(clave), true, clave);
    }
  });

  test('lo que solo se mira no pide valor', () => {
    assert.equal(pideValor('pantalla_soporte'), false);
    assert.equal(pideValor('acceso_llave'), false);
  });

  test('un punto que ya no está en la plantilla no pide valor ni revienta', () => {
    assert.equal(pideValor('punto_de_una_version_vieja'), false);
    assert.equal(ayudaDeValor('punto_de_una_version_vieja'), undefined);
  });

  test('todo punto que pide valor dice qué se escribe en él', () => {
    for (const p of PUNTOS_CHECKIN.filter((p) => p.pide_valor)) {
      assert.ok(p.ayuda_valor, `${p.clave} pide valor sin decir de qué`);
    }
  });

  test('la visita se abre con todos los puntos y en orden', () => {
    const filas = puntosDeUnaVisita();
    assert.equal(filas.length, PUNTOS_CHECKIN.length);
    const ordenes = filas.map((f) => f.orden);
    assert.deepEqual(ordenes, [...ordenes].sort((a, b) => a - b));
    // Solo las columnas de `revision_puntos`: `pide_valor` es de la plantilla.
    assert.deepEqual(Object.keys(filas[0]).sort(), [
      'bloque',
      'clave',
      'orden',
      'titulo',
    ]);
  });
});

describe('resumen de una visita', () => {
  test('cuenta cada estado por separado', () => {
    const r = resumirVisita([
      punto('sala_largo', 'conforme'),
      punto('sala_ancho', 'conforme'),
      punto('sala_canaleta', 'incidencia'),
      punto('sala_suelo_tecnico', 'no_aplica'),
      punto('red_roseta', 'pendiente'),
    ]);
    assert.deepEqual(r, {
      total: 5,
      pendientes: 1,
      conformes: 2,
      incidencias: 1,
      no_aplica: 1,
      completa: false,
    });
  });

  test('una visita sin puntos no está completa: no se ha mirado nada', () => {
    assert.equal(resumirVisita([]).completa, false);
  });

  test('«no aplica» cuenta como mirado y completa la visita', () => {
    const r = resumirVisita([
      punto('sala_falso_techo', 'no_aplica'),
      punto('sala_largo', 'conforme'),
    ]);
    assert.equal(r.completa, true);
  });
});

describe('cierre de la visita', () => {
  test('no se cierra con puntos sin mirar', () => {
    const puntos = [punto('sala_largo', 'conforme'), punto('red_roseta', 'pendiente')];
    assert.equal(puedeCerrarse(puntos), false);
    assert.match(motivoParaNoCerrar(puntos) ?? '', /Queda 1 punto sin mirar/);
  });

  test('el motivo concuerda en plural', () => {
    const puntos = [punto('a', 'pendiente'), punto('b', 'pendiente')];
    assert.match(motivoParaNoCerrar(puntos) ?? '', /Quedan 2 puntos sin mirar/);
  });

  test('una visita con incidencias sí se cierra: la incidencia es el resultado', () => {
    const puntos = [
      punto('sala_largo', 'conforme'),
      punto('red_enlace', 'incidencia'),
    ];
    assert.equal(puedeCerrarse(puntos), true);
    assert.equal(motivoParaNoCerrar(puntos), null);
  });

  test('una visita sin puntos no se cierra, y dice por qué', () => {
    assert.equal(puedeCerrarse([]), false);
    assert.match(motivoParaNoCerrar([]) ?? '', /no tiene puntos/);
  });
});

describe('agrupar por bloque', () => {
  test('respeta el orden guardado en la fila, no el de la plantilla de hoy', () => {
    const grupos = agruparPorBloque([
      punto('red_roseta', 'pendiente', { bloque: 'Red', orden: 150 }),
      punto('sala_ancho', 'pendiente', { bloque: 'Sala', orden: 20 }),
      punto('sala_largo', 'pendiente', { bloque: 'Sala', orden: 10 }),
    ]);
    assert.deepEqual(
      grupos.map((g) => g.bloque),
      ['Sala', 'Red'],
    );
    assert.deepEqual(
      grupos[0].puntos.map((p) => p.clave),
      ['sala_largo', 'sala_ancho'],
    );
  });

  test('sin puntos no hay bloques', () => {
    assert.deepEqual(agruparPorBloque([]), []);
  });

  test('la plantilla entera se agrupa en los bloques del recorrido', () => {
    const grupos = agruparPorBloque(
      puntosDeUnaVisita().map((f) => punto(f.clave, 'pendiente', f)),
    );
    assert.deepEqual(
      grupos.map((g) => g.bloque),
      [...BLOQUES_CHECKIN],
    );
    assert.equal(
      grupos.reduce((t, g) => t + g.puntos.length, 0),
      PUNTOS_CHECKIN.length,
    );
  });
});
