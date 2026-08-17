/**
 * Girar desde el menú y girar desde propiedades tienen que ser lo mismo.
 *
 * El menú contextual y el inspector son dos pantallas distintas sobre las
 * mismas operaciones. Si cada una llama por su cuenta a `girar()` y a
 * `quitarAlta()`, nada impide que dentro de seis meses una redondee, ordene o
 * confirme algo que la otra no, y el fallo aparece como «desde el botón
 * derecho gira distinto», que es de los que cuesta días reproducir.
 *
 * Aquí se comprueba lo que impide eso: que existe un solo despachador, que
 * decide él qué está disponible, y que aplicar una operación que no
 * corresponde no cambia nada —ni siquiera devolviendo una copia igual, porque
 * el historial de deshacer compara por identidad.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { girar, quitarAlta, type BorradorPlano } from '@/lib/plano-editor';
import {
  GIRO_RAPIDO_GRADOS,
  aplicarOperacion,
  giroActual,
  operacionDisponible,
  operacionesOfrecidas,
} from './operaciones-plano';

const EQUIPO_GUARDADO = {
  id: 'e-guardado',
  articulo_id: 'a1',
  nombre: 'Pantalla',
  extremo: 'pantalla' as const,
  cantidad: 1,
  x_m: 0,
  y_m: 2,
  z_m: 1.2,
  posicion_confirmada: true,
  rotacion_grados: 0,
  toma_red_id: null,
  es_nuevo: false,
};

const EQUIPO_NUEVO = { ...EQUIPO_GUARDADO, id: 'e-nuevo', nombre: 'Barra', es_nuevo: true };

const MUEBLE = {
  id: 'm1',
  mobiliario_id: 'cat1',
  nombre: 'Silla',
  forma: 'circulo' as const,
  largo_m: 0.5,
  ancho_m: 0.5,
  alto_m: null,
  x_m: 1,
  y_m: 1,
  z_m: null,
  rotacion_grados: 30,
  posicion_confirmada: true,
  origen_plantilla_mobiliario_id: null,
  orden: 1,
  es_nuevo: false,
};

const BORRADOR: BorradorPlano = {
  largo_m: 6,
  ancho_m: 4,
  alto_m: 3,
  aforo: null,
  mesa_largo_m: 2,
  mesa_ancho_m: 1,
  mesa_alto_cm: 73,
  mesa_x_m: null,
  mesa_y_m: null,
  mesa_rotacion_grados: 15,
  equipos: [EQUIPO_GUARDADO, EQUIPO_NUEVO],
  mobiliario: [MUEBLE],
  tomas: [{ id: 't1', codigo: 'R-01', ubicacion: null, x_m: 1, y_m: 1, z_m: null, notas: null }],
  sillas_modo: 'manuales',
  inicio: null,
};

describe('el despachador de operaciones del plano', () => {
  describe('qué está disponible', () => {
    it('la mesa, un equipo y un mueble giran; la sala y una roseta no', () => {
      assert.equal(operacionDisponible('girar', { tipo: 'mesa' }, BORRADOR), true);
      assert.equal(operacionDisponible('girar', { tipo: 'equipo', id: 'e-guardado' }, BORRADOR), true);
      assert.equal(operacionDisponible('girar', { tipo: 'mueble', id: 'm1' }, BORRADOR), true);
      assert.equal(operacionDisponible('girar', { tipo: 'sala' }, BORRADOR), false);
      assert.equal(operacionDisponible('girar', { tipo: 'toma', id: 't1' }, BORRADOR), false);
    });

    it('un equipo ya guardado no se quita del plano; uno recién añadido sí', () => {
      assert.equal(
        operacionDisponible('eliminar', { tipo: 'equipo', id: 'e-guardado' }, BORRADOR),
        false,
        'quitar del plano un equipo persistido sería darlo de baja del material desde un clic derecho',
      );
      assert.equal(operacionDisponible('eliminar', { tipo: 'equipo', id: 'e-nuevo' }, BORRADOR), true);
      assert.equal(operacionDisponible('eliminar', { tipo: 'mueble', id: 'm1' }, BORRADOR), true);
    });

    it('sin selección no hay ninguna operación', () => {
      for (const clase of ['seleccionar', 'propiedades', 'girar', 'eliminar'] as const) {
        assert.equal(operacionDisponible(clase, null, BORRADOR), false);
      }
    });

    it('sobre algo que ya no está en el borrador no hay ninguna operación', () => {
      // Deshacer un alta, descartar o recargar borran la fila que estaba
      // seleccionada. Sobre ese id, `girar()` devolvía un borrador nuevo
      // aunque idéntico, y el editor lo apilaba como paso de deshacer.
      const fantasmas = [
        { tipo: 'equipo', id: 'no-existe' },
        { tipo: 'mueble', id: 'no-existe' },
        { tipo: 'toma', id: 'no-existe' },
      ] as const;
      for (const sel of fantasmas) {
        for (const clase of ['seleccionar', 'propiedades', 'girar', 'eliminar'] as const) {
          assert.equal(
            operacionDisponible(clase, sel, BORRADOR),
            false,
            `${clase} sobre un ${sel.tipo} inexistente tiene que estar cerrada`,
          );
        }
        assert.deepEqual(operacionesOfrecidas(sel, BORRADOR, { soloLectura: false }), []);
      }
    });

    it('girar algo inexistente no toca el borrador ni apila historial', () => {
      const sel = { tipo: 'equipo', id: 'no-existe' } as const;
      const r = aplicarOperacion(BORRADOR, sel, { tipo: 'girar', grados: 90 });
      // Por referencia: el coordinador decide por identidad si apila un paso
      // de deshacer, así que una copia igual ya sería el fallo.
      assert.equal(r.borrador, BORRADOR);
      assert.equal(r.enfocarPropiedades, false);
    });
  });

  describe('el mismo resultado que la operación pura', () => {
    it('girar por el despachador y girar a pelo dan el mismo borrador', () => {
      for (const sel of [
        { tipo: 'mesa' } as const,
        { tipo: 'equipo', id: 'e-guardado' } as const,
        { tipo: 'mueble', id: 'm1' } as const,
      ]) {
        const grados = giroActual(BORRADOR, sel) + GIRO_RAPIDO_GRADOS;
        const porDespachador = aplicarOperacion(BORRADOR, sel, { tipo: 'girar', grados }).borrador;
        assert.deepEqual(
          porDespachador,
          girar(BORRADOR, sel, grados),
          `girar ${sel.tipo} por el menú no da lo mismo que por propiedades`,
        );
      }
    });

    it('eliminar por el despachador y quitarAlta a pelo dan el mismo borrador', () => {
      for (const sel of [
        { tipo: 'equipo', id: 'e-nuevo' } as const,
        { tipo: 'mueble', id: 'm1' } as const,
      ]) {
        assert.deepEqual(
          aplicarOperacion(BORRADOR, sel, { tipo: 'eliminar' }).borrador,
          quitarAlta(BORRADOR, sel),
        );
      }
    });

    it('el giro parte del ángulo que ya tenía cada cosa', () => {
      assert.equal(giroActual(BORRADOR, { tipo: 'mesa' }), 15);
      assert.equal(giroActual(BORRADOR, { tipo: 'mueble', id: 'm1' }), 30);
      assert.equal(giroActual(BORRADOR, { tipo: 'equipo', id: 'e-guardado' }), 0);
      assert.equal(giroActual(BORRADOR, { tipo: 'sala' }), 0);
      assert.equal(giroActual(BORRADOR, null), 0);
    });
  });

  describe('lo que no corresponde no hace nada', () => {
    it('girar la sala devuelve el mismo borrador por referencia, no una copia', () => {
      // Por referencia y no `deepEqual`: el editor decide por identidad si
      // apila un paso de deshacer. Una copia igual apilaría un paso que no
      // deshace nada, y `Deshacer` dejaría de responder una vez por cada giro
      // fallido.
      const r = aplicarOperacion(BORRADOR, { tipo: 'sala' }, { tipo: 'girar', grados: 90 });
      assert.equal(r.borrador, BORRADOR);
      assert.deepEqual(r.seleccion, { tipo: 'sala' });
      assert.equal(r.enfocarPropiedades, false);
    });

    it('eliminar un equipo ya guardado no lo quita ni suelta la selección', () => {
      const sel = { tipo: 'equipo', id: 'e-guardado' } as const;
      const r = aplicarOperacion(BORRADOR, sel, { tipo: 'eliminar' });
      assert.equal(r.borrador, BORRADOR);
      assert.deepEqual(r.seleccion, sel, 'soltar la selección haría creer que se ha quitado');
    });
  });

  describe('consecuencias de cada operación', () => {
    it('propiedades selecciona y pide el foco, sin tocar el borrador', () => {
      const sel = { tipo: 'mueble', id: 'm1' } as const;
      const r = aplicarOperacion(BORRADOR, sel, { tipo: 'propiedades' });
      assert.equal(r.borrador, BORRADOR);
      assert.deepEqual(r.seleccion, sel);
      assert.equal(r.enfocarPropiedades, true);
    });

    it('seleccionar no pide foco ni toca el borrador', () => {
      const r = aplicarOperacion(BORRADOR, { tipo: 'mueble', id: 'm1' }, { tipo: 'seleccionar' });
      assert.equal(r.borrador, BORRADOR);
      assert.equal(r.enfocarPropiedades, false);
    });

    it('eliminar suelta la selección: el panel no puede seguir enseñando lo que ya no está', () => {
      const r = aplicarOperacion(BORRADOR, { tipo: 'mueble', id: 'm1' }, { tipo: 'eliminar' });
      assert.equal(r.seleccion, null);
      assert.equal(r.borrador.mobiliario.length, 0);
    });
  });

  describe('lo que ofrece el menú', () => {
    it('un mueble ofrece propiedades, girar y quitar', () => {
      assert.deepEqual(operacionesOfrecidas({ tipo: 'mueble', id: 'm1' }, BORRADOR, { soloLectura: false }), [
        'propiedades',
        'girar',
        'eliminar',
      ]);
    });

    it('un equipo guardado ofrece propiedades y girar, pero no quitar', () => {
      assert.deepEqual(
        operacionesOfrecidas({ tipo: 'equipo', id: 'e-guardado' }, BORRADOR, { soloLectura: false }),
        ['propiedades', 'girar'],
      );
    });

    it('una roseta solo ofrece propiedades', () => {
      assert.deepEqual(operacionesOfrecidas({ tipo: 'toma', id: 't1' }, BORRADOR, { soloLectura: false }), [
        'propiedades',
      ]);
    });

    it('con la obra cerrada solo queda mirar la ficha', () => {
      assert.deepEqual(operacionesOfrecidas({ tipo: 'mueble', id: 'm1' }, BORRADOR, { soloLectura: true }), [
        'propiedades',
      ]);
    });

    it('sin selección no ofrece nada', () => {
      assert.deepEqual(operacionesOfrecidas(null, BORRADOR, { soloLectura: false }), []);
    });
  });
});
