/**
 * Las capas apagan lo que se ve, y solo eso.
 *
 * Lo que se comprueba aquí no es que el mobiliario desaparezca del dibujo —eso
 * se ve mirando la pantalla— sino lo contrario: que apagarlo no toca ningún
 * dato. Un filtro de vista que se cuela en el borrador convierte «quiero ver
 * la sala sin sillas» en «guarda la sala sin sillas», y eso solo se descubre
 * cuando alguien vuelve al día siguiente y no están.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EscenaCroquis } from '@/lib/croquis';
import {
  CAPAS_INICIALES,
  alternarCapa,
  capaDeSeleccion,
  escenaVisible,
  seleccionOculta,
} from './capas-plano';

const ESCENA: EscenaCroquis = {
  titulo: 'Sala 1',
  sala: { x_m: 0, y_m: 0, largo_m: 6, ancho_m: 4 },
  mesa: null,
  sillas: [
    { x_m: 1, y_m: 1, radio_m: 0.25 },
    { x_m: 2, y_m: 1, radio_m: 0.25 },
  ],
  muebles: [{ id: 'm1' } as EscenaCroquis['muebles'][number]],
  puertas: [
    {
      id: 'p1',
      pared: 'sur',
      desde: { x_m: 2, y_m: 0 },
      hasta: { x_m: 2.9, y_m: 0 },
      medida: true,
    },
  ],
  equipos: [
    { id: 'e1', extremo: 'pantalla' } as EscenaCroquis['equipos'][number],
    { id: 'e2', extremo: 'caja_conexiones' } as EscenaCroquis['equipos'][number],
  ],
  tomas: [{ id: 't1' } as EscenaCroquis['tomas'][number]],
  tiradas: [{ id: 'c1' } as EscenaCroquis['tiradas'][number]],
  cotas: [
    { clave: 'sala_largo', desde: { x_m: 0, y_m: 4 }, hasta: { x_m: 6, y_m: 4 }, texto: '6 m', lado: 'arriba' },
    { clave: 'mesa_largo', desde: { x_m: 1, y_m: 3 }, hasta: { x_m: 3, y_m: 3 }, texto: '2 m', lado: 'arriba' },
    { clave: 'pantalla_caja', desde: { x_m: 0, y_m: 2 }, hasta: { x_m: 3, y_m: 2 }, texto: '3 m', lado: 'abajo' },
  ],
  anotaciones: [
    { clave: 'sala_alto', texto: 'Alto de la sala 3 m' },
    { clave: 'mesa_alto', texto: 'Altura de la mesa 73 cm' },
    { clave: 'equipo_altura:e1', texto: 'Pantalla a 120 cm del suelo' },
  ],
  avisos: [],
};

describe('las capas del plano', () => {
  it('entran las dos encendidas', () => {
    assert.deepEqual(CAPAS_INICIALES, { mobiliario: true, equipamiento: true });
  });

  it('con las dos encendidas devuelve la misma escena, sin copiarla', () => {
    // Identidad y no igualdad: si devolviera una copia, cada render daría un
    // objeto nuevo y los `useMemo` de aguas abajo se recalcularían siempre.
    assert.equal(escenaVisible(ESCENA, CAPAS_INICIALES), ESCENA);
  });

  it('apagar el mobiliario quita muebles y sillas, y deja el equipamiento intacto', () => {
    const v = escenaVisible(ESCENA, { mobiliario: false, equipamiento: true });
    assert.deepEqual(v.muebles, []);
    assert.deepEqual(v.sillas, []);
    assert.equal(v.equipos.length, 2);
    assert.equal(v.tomas.length, 1);
    assert.equal(v.tiradas.length, 1);
    assert.equal(v.cotas.length, 3);
  });

  it('apagar el equipamiento quita equipos, tomas y tiradas, y deja el mobiliario intacto', () => {
    const v = escenaVisible(ESCENA, { mobiliario: true, equipamiento: false });
    assert.deepEqual(v.equipos, []);
    assert.deepEqual(v.tomas, []);
    assert.deepEqual(v.tiradas, []);
    assert.equal(v.muebles.length, 1);
    assert.equal(v.sillas.length, 2);
  });

  it('apagar el equipamiento retira la cota que medía entre dos equipos', () => {
    const v = escenaVisible(ESCENA, { mobiliario: true, equipamiento: false });
    const claves = v.cotas.map((c) => c.clave);
    assert.ok(
      !claves.includes('pantalla_caja'),
      'la cota de pantalla a caja mide entre dos equipos que ya no se ven',
    );
    assert.deepEqual(claves, ['sala_largo', 'mesa_largo'], 'las cotas de sala y mesa se quedan');
  });

  it('no muta la escena de entrada', () => {
    const antes = JSON.stringify(ESCENA);
    escenaVisible(ESCENA, { mobiliario: false, equipamiento: false });
    assert.equal(JSON.stringify(ESCENA), antes, 'el filtro escribió en la escena original');
  });

  it('la sala, sus avisos y su título no son una capa', () => {
    const v = escenaVisible(ESCENA, { mobiliario: false, equipamiento: false });
    assert.deepEqual(v.sala, ESCENA.sala);
    assert.deepEqual(v.avisos, ESCENA.avisos);
    assert.equal(v.titulo, ESCENA.titulo);
  });

  it('apagar el equipamiento retira las anotaciones que hablan de un equipo', () => {
    // La primera versión de esta prueba exigía que las anotaciones no se
    // filtraran nunca, y con eso fijaba el error: «Pantalla a 120 cm del
    // suelo» describe algo que ya no se ve. Las de la sala y la mesa se
    // quedan, porque miden la sala y no lo que hay dentro.
    const v = escenaVisible(ESCENA, { mobiliario: true, equipamiento: false });
    assert.deepEqual(
      v.anotaciones.map((a) => a.clave),
      ['sala_alto', 'mesa_alto'],
    );
  });

  it('con el equipamiento encendido no se retira ninguna anotación', () => {
    const v = escenaVisible(ESCENA, { mobiliario: false, equipamiento: true });
    assert.deepEqual(v.anotaciones, ESCENA.anotaciones);
  });

  it('alternar una capa no toca la otra', () => {
    const solo = alternarCapa(CAPAS_INICIALES, 'mobiliario');
    assert.deepEqual(solo, { mobiliario: false, equipamiento: true });
    assert.deepEqual(alternarCapa(solo, 'mobiliario'), CAPAS_INICIALES);
    assert.deepEqual(CAPAS_INICIALES, { mobiliario: true, equipamiento: true }, 'mutó el inicial');
  });

  it('cada selección sabe a qué capa pertenece', () => {
    assert.equal(capaDeSeleccion({ tipo: 'mueble', id: 'm1' }), 'mobiliario');
    assert.equal(capaDeSeleccion({ tipo: 'equipo', id: 'e1' }), 'equipamiento');
    assert.equal(capaDeSeleccion({ tipo: 'toma', id: 't1' }), 'equipamiento');
    assert.equal(capaDeSeleccion({ tipo: 'sala' }), null, 'la sala no está en ninguna capa');
    assert.equal(capaDeSeleccion({ tipo: 'mesa' }), null, 'la mesa no está en ninguna capa');
    assert.equal(capaDeSeleccion(null), null);
  });

  it('sabe cuándo lo seleccionado se ha quedado escondido', () => {
    const sinMobiliario = { mobiliario: false, equipamiento: true };
    assert.equal(seleccionOculta({ tipo: 'mueble', id: 'm1' }, sinMobiliario), true);
    assert.equal(seleccionOculta({ tipo: 'equipo', id: 'e1' }, sinMobiliario), false);
    assert.equal(seleccionOculta({ tipo: 'mesa' }, sinMobiliario), false);
    assert.equal(seleccionOculta(null, sinMobiliario), false);
  });
});

describe('las puertas y las capas', () => {
  it('la puerta no pertenece a ninguna capa: seleccionarla no reenciende nada', () => {
    assert.equal(capaDeSeleccion({ tipo: 'puerta', id: 'p1' }), null);
    assert.equal(
      seleccionOculta({ tipo: 'puerta', id: 'p1' }, { mobiliario: false, equipamiento: false }),
      false,
    );
  });

  it('apagar las dos capas no esconde las puertas: son arquitectura', () => {
    const v = escenaVisible(ESCENA, { mobiliario: false, equipamiento: false });
    assert.deepEqual(v.puertas, ESCENA.puertas);
  });
});
