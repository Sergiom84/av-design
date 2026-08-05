import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisoDeReserva,
  avisoDeSalida,
  avisosDeMinimo,
  calcularDisponibilidad,
  calcularExistencias,
  calcularReservado,
  construirDisponibilidad,
  efectoMovimiento,
  SIGNO_MOVIMIENTO,
} from './almacen';
import type { Movimiento, Reserva } from './tipos';

/**
 * El almacén arranca vacío a propósito: la hoja "Almacén" del inventario de
 * partida no es un stock, son 104 unidades sueltas con anotaciones libres.
 * Aquí se construye desde cero, movimiento a movimiento, como en la realidad.
 */
const ESTANTE = 'u-estante';
const FURGONETA = 'u-furgoneta';
const HDMI = 'a-hdmi';
const RJ45 = 'a-rj45';

type Apunte = Pick<Movimiento, 'articulo_id' | 'ubicacion_id' | 'tipo' | 'cantidad'>;

const mov = (
  articulo_id: string,
  tipo: Movimiento['tipo'],
  cantidad: number,
  ubicacion_id: string | null = ESTANTE,
): Apunte => ({ articulo_id, ubicacion_id, tipo, cantidad });

describe('signo de cada tipo', () => {
  // Esta prueba existe para que cambiar el signo de un tipo sea deliberado:
  // la vista `existencias` de db/schema.sql repite la misma tabla en SQL.
  test('entrada, devolución y ajuste suman; salida y baja restan', () => {
    assert.deepEqual(SIGNO_MOVIMIENTO, {
      entrada: 1,
      devolucion: 1,
      ajuste: 1,
      salida: -1,
      baja: -1,
    });
  });

  test('el ajuste lleva el signo en la cantidad, porque un recuento corrige en los dos sentidos', () => {
    assert.equal(efectoMovimiento({ tipo: 'ajuste', cantidad: -3 }), -3);
    assert.equal(efectoMovimiento({ tipo: 'ajuste', cantidad: 2 }), 2);
  });

  test('una salida resta aunque la cantidad sea positiva', () => {
    assert.equal(efectoMovimiento({ tipo: 'salida', cantidad: 4 }), -4);
  });
});

describe('existencias a partir de los movimientos', () => {
  test('entrada de 10 y salida de 4 dejan 6', () => {
    const e = calcularExistencias([mov(HDMI, 'entrada', 10), mov(HDMI, 'salida', 4)]);
    assert.equal(e.get(HDMI)?.cantidad, 6);
  });

  test('el mismo artículo cuenta por separado en cada ubicación', () => {
    const e = calcularExistencias([
      mov(HDMI, 'entrada', 10),
      mov(HDMI, 'entrada', 3, FURGONETA),
      mov(HDMI, 'salida', 4),
    ]);
    const hdmi = e.get(HDMI)!;
    assert.equal(hdmi.cantidad, 9);
    assert.deepEqual(hdmi.ubicaciones, [
      { ubicacion_id: ESTANTE, cantidad: 6 },
      { ubicacion_id: FURGONETA, cantidad: 3 },
    ]);
  });

  test('la ubicación que queda a cero se conserva en el desglose', () => {
    const e = calcularExistencias([
      mov(HDMI, 'entrada', 2, FURGONETA),
      mov(HDMI, 'salida', 2, FURGONETA),
    ]);
    assert.deepEqual(e.get(HDMI)?.ubicaciones, [
      { ubicacion_id: FURGONETA, cantidad: 0 },
    ]);
  });

  test('una baja descuenta igual que una salida', () => {
    const e = calcularExistencias([mov(HDMI, 'entrada', 5), mov(HDMI, 'baja', 1)]);
    assert.equal(e.get(HDMI)?.cantidad, 4);
  });

  test('la devolución de un sobrante vuelve a sumar', () => {
    const e = calcularExistencias([
      mov(HDMI, 'entrada', 5),
      mov(HDMI, 'salida', 5),
      mov(HDMI, 'devolucion', 2),
    ]);
    assert.equal(e.get(HDMI)?.cantidad, 2);
  });

  test('los metros de cable no pierden decimales al acumularse', () => {
    const e = calcularExistencias([
      mov('a-cat6a', 'entrada', 100),
      mov('a-cat6a', 'salida', 12.35),
      mov('a-cat6a', 'salida', 7.4),
    ]);
    assert.equal(e.get('a-cat6a')?.cantidad, 80.25);
  });

  test('sin movimientos no hay existencias, no hay ceros de relleno', () => {
    assert.equal(calcularExistencias([]).size, 0);
  });
});

describe('reservado', () => {
  const reserva = (
    articulo_id: string,
    cantidad: number,
    estado: Reserva['estado'] = 'activa',
  ): Pick<Reserva, 'articulo_id' | 'cantidad' | 'estado'> => ({
    articulo_id,
    cantidad,
    estado,
  });

  test('solo cuentan las reservas activas', () => {
    const r = calcularReservado([
      reserva(HDMI, 3),
      reserva(HDMI, 2, 'liberada'),
      reserva(HDMI, 4, 'servida'),
    ]);
    assert.equal(r.get(HDMI), 3);
  });

  test('dos obras que reservan el mismo artículo suman', () => {
    const r = calcularReservado([reserva(HDMI, 3), reserva(HDMI, 2)]);
    assert.equal(r.get(HDMI), 5);
  });
});

describe('disponible', () => {
  test('disponible es existencias menos reservado', () => {
    const d = calcularDisponibilidad(HDMI, 10, 4, null);
    assert.equal(d.existencias, 10);
    assert.equal(d.reservado, 4);
    assert.equal(d.disponible, 6);
  });

  test('quedan cuatro pero cuatro están reservados: disponible cero, existencias cuatro', () => {
    // Las dos cifras a la vez, porque no es lo mismo que no quede ninguno.
    const d = calcularDisponibilidad(HDMI, 4, 4, null);
    assert.equal(d.existencias, 4);
    assert.equal(d.disponible, 0);
    assert.equal(d.sobre_reservado, false);
  });

  test('reservar más de lo que hay queda marcado', () => {
    const d = calcularDisponibilidad(HDMI, 2, 5, null);
    assert.equal(d.disponible, -3);
    assert.equal(d.sobre_reservado, true);
  });

  test('el stock mínimo se mide contra el disponible, no contra las existencias', () => {
    const d = calcularDisponibilidad(HDMI, 10, 8, 5);
    assert.equal(d.disponible, 2);
    assert.equal(d.bajo_minimo, true);
  });

  test('sin stock mínimo no hay aviso', () => {
    assert.equal(calcularDisponibilidad(HDMI, 0, 0, null).bajo_minimo, false);
    assert.equal(calcularDisponibilidad(HDMI, 0, 0, 0).bajo_minimo, false);
  });

  test('la disponibilidad del almacén junta existencias y reservas', () => {
    const existencias = calcularExistencias([
      mov(HDMI, 'entrada', 10),
      mov(RJ45, 'entrada', 4),
    ]);
    const reservado = calcularReservado([
      { articulo_id: HDMI, cantidad: 6, estado: 'activa' },
    ]);
    const d = construirDisponibilidad(
      existencias,
      reservado,
      new Map([
        [HDMI, { stock_minimo: 5 }],
        [RJ45, { stock_minimo: null }],
      ]),
    );
    assert.equal(d.get(HDMI)?.disponible, 4);
    assert.equal(d.get(HDMI)?.bajo_minimo, true);
    assert.equal(d.get(RJ45)?.disponible, 4);
    assert.equal(d.size, 2, 'el catálogo entero no entra: solo lo que se mueve o se reserva');
  });

  test('un artículo solo reservado aparece con existencias a cero', () => {
    const d = construirDisponibilidad(
      new Map(),
      new Map([[HDMI, 2]]),
      new Map(),
    );
    assert.equal(d.get(HDMI)?.existencias, 0);
    assert.equal(d.get(HDMI)?.disponible, -2);
  });
});

describe('avisos', () => {
  test('reservar lo que hay no avisa', () => {
    const d = calcularDisponibilidad(HDMI, 10, 4, null);
    assert.equal(avisoDeReserva(d, 6), null);
  });

  test('reservar de más dice cuánto queda de verdad', () => {
    const d = calcularDisponibilidad(HDMI, 10, 4, null);
    assert.match(avisoDeReserva(d, 8) ?? '', /Solo hay 6 disponibles/);
  });

  test('sin nada disponible se distingue lo que hay de lo que está comprometido', () => {
    const d = calcularDisponibilidad(HDMI, 4, 4, null);
    assert.match(avisoDeReserva(d, 1) ?? '', /4 en almacén y 4 ya reservados/);
  });

  test('un artículo que nunca ha entrado en almacén avisa igual', () => {
    assert.match(avisoDeReserva(undefined, 1) ?? '', /No hay disponible/);
  });

  test('sacar más de lo que hay avisa de que hará falta un ajuste', () => {
    assert.equal(avisoDeSalida(6, 6), null);
    assert.match(avisoDeSalida(6, 9) ?? '', /ajuste de inventario/);
  });

  test('los avisos de mínimo salen de lo más urgente a lo menos', () => {
    const avisos = avisosDeMinimo([
      calcularDisponibilidad('a1', 3, 0, 5),
      calcularDisponibilidad('a2', 9, 0, 5),
      calcularDisponibilidad('a3', 0, 0, 2),
    ]);
    assert.deepEqual(
      avisos.map((a) => a.articulo_id),
      ['a3', 'a1'],
    );
  });
});
