import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCoberturaSuministro, proyectarCoberturaSuministros,
  type EntradaCoberturaSuministros, type MovimientoParaCobertura } from './cobertura-suministros';

function base(cambios: Partial<EntradaCoberturaSuministros> = {}): EntradaCoberturaSuministros {
  return { suministros: [{ id: 'A', articulo_id: 'kit' }, { id: 'B', articulo_id: 'kit' }],
    asignacionesPedido: [], reservas: [], movimientos: [], ...cambios };
}
function salida(suministro_id = 'A', movimiento_id = 'salida-A'): MovimientoParaCobertura {
  return { suministro_id, movimiento_id, tipo: 'salida', cantidad: 1, salida_movimiento_id: null };
}
function devolucion(suministro_id = 'A', movimiento_id = 'retorno-A'): MovimientoParaCobertura {
  return { suministro_id, movimiento_id, tipo: 'devolucion', cantidad: 1, salida_movimiento_id: 'salida-A' };
}

test('Recepción de A en pedido de dos kits no cubre físicamente A ni B', () => {
  const { porSuministro } = proyectarCoberturaSuministros(base({ asignacionesPedido: [
    { suministro_id: 'A', cantidad: 1, cantidad_recibida: 1 },
    { suministro_id: 'B', cantidad: 1, cantidad_recibida: 0 },
  ], movimientos: [{ ...salida(), movimiento_id: 'entrada', tipo: 'entrada' }] }));
  assert.deepEqual(porSuministro.get('A'), { suministro_id: 'A', articulo_id: 'kit', pedido: 1,
    recibido: 1, pendienteRecibir: 0, reservado: 0, servido: 0, coberturaFisica: 0, pendiente: 1 });
  assert.deepEqual(porSuministro.get('B'), { suministro_id: 'B', articulo_id: 'kit', pedido: 1,
    recibido: 0, pendienteRecibir: 1, reservado: 0, servido: 0, coberturaFisica: 0, pendiente: 1 });
});

test('Reservar A mantiene B pendiente aunque comparta artículo', () => {
  const { porSuministro } = proyectarCoberturaSuministros(base({ reservas: [
    { suministro_id: 'A', cantidad: 1, estado: 'activa' },
    { suministro_id: 'B', cantidad: 1, estado: 'liberada' },
  ] }));
  assert.equal(porSuministro.get('A')?.reservado, 1);
  assert.equal(porSuministro.get('A')?.pendiente, 0);
  assert.equal(porSuministro.get('B')?.coberturaFisica, 0);
  assert.equal(porSuministro.get('B')?.pendiente, 1);
});

test('Salida atribuida A cubre A1 y B0 sin compartir cobertura por artículo', () => {
  const { porSuministro } = proyectarCoberturaSuministros(base({ movimientos: [salida()] }));
  assert.equal(porSuministro.get('A')?.servido, 1);
  assert.equal(porSuministro.get('A')?.coberturaFisica, 1);
  assert.equal(porSuministro.get('B')?.servido, 0);
  assert.equal(porSuministro.get('B')?.coberturaFisica, 0);
});

test('Reserva servida conserva rastro y no vuelve a sumar junto a la salida', () => {
  const { porSuministro } = proyectarCoberturaSuministros(base({ movimientos: [salida()],
    reservas: [{ suministro_id: 'A', cantidad: 1, estado: 'servida' }] }));
  assert.equal(porSuministro.get('A')?.reservado, 0);
  assert.equal(porSuministro.get('A')?.servido, 1);
  assert.equal(porSuministro.get('A')?.coberturaFisica, 1);
});

test('Devolución enlazada A y baja posterior dejan A0/B0, sin descontar dos veces', () => {
  const { porSuministro } = proyectarCoberturaSuministros(base({ movimientos: [
    devolucion(), { ...salida(), movimiento_id: 'baja', tipo: 'baja' }, salida(),
  ] }));
  assert.equal(porSuministro.get('A')?.servido, 0);
  assert.equal(porSuministro.get('A')?.pendiente, 1);
  assert.equal(porSuministro.get('B')?.servido, 0);
});

test('Baja aislada no descuenta servicio ni supone una devolución', () => {
  const p = proyectarCoberturaSuministros(base({ movimientos: [salida(),
    { ...salida(), movimiento_id: 'baja', tipo: 'baja' }] }));
  assert.equal(p.porSuministro.get('A')?.servido, 1);
});

test('Salida legacy del mismo artículo genera aviso cuantitativo, A0/B0', () => {
  const p = proyectarCoberturaSuministros(base({ movimientosSinAtribuir: [
    { movimiento_id: 'legacy', articulo_id: 'kit', tipo: 'salida', cantidad: 2 },
  ] }));
  assert.equal(p.porSuministro.get('A')?.coberturaFisica, 0);
  assert.equal(p.porSuministro.get('B')?.coberturaFisica, 0);
  assert.equal(p.avisosSinAtribuir.length, 1);
  assert.equal(p.avisosSinAtribuir[0].cantidad, 2);
  assert.match(p.avisosSinAtribuir[0].aviso, /no acreditan cobertura/);
});

test('Una devolución B no puede usar salida atribuida exclusivamente a A', () => {
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [salida(), devolucion('B')] })),
    /salida del mismo suministro/);
});

test('Dos devoluciones distintas contra una salida rechazan exceso, no se truncan', () => {
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [salida(), devolucion(), devolucion('A', 'otra')] })),
    /devoluciones superan/);
});

test('Movimiento canónico repartido A/B conserva cada atribución y retorno propio', () => {
  const p = proyectarCoberturaSuministros(base({ movimientos: [salida('A', 'compartida'), salida('B', 'compartida'),
    { ...devolucion(), salida_movimiento_id: 'compartida' }] }));
  assert.equal(p.porSuministro.get('A')?.servido, 0);
  assert.equal(p.porSuministro.get('B')?.servido, 1);
});

test('Volver a salir después de retorno conserva demanda unitaria y no depende del orden', () => {
  const movimientos = [salida(), devolucion(), salida('A', 'segunda')];
  const p = proyectarCoberturaSuministros(base({ movimientos }));
  const inverso = proyectarCoberturaSuministros(base({ movimientos: [...movimientos].reverse() }));
  assert.deepEqual(p, inverso);
  assert.equal(p.porSuministro.get('A')?.servido, 1);
});

test('Devolución conjunta conserva salida original distinta por suministro', () => {
  const movimientos = [salida('A', 'salida-A'), salida('B', 'salida-B'),
    { ...devolucion('A', 'conjunta'), salida_movimiento_id: 'salida-A' },
    { ...devolucion('B', 'conjunta'), salida_movimiento_id: 'salida-B' }];
  const p = proyectarCoberturaSuministros(base({ movimientos }));
  assert.equal(p.porSuministro.get('A')?.servido, 0);
  assert.equal(p.porSuministro.get('B')?.servido, 0);
  assert.deepEqual(proyectarCoberturaSuministros(base({ movimientos: [...movimientos].reverse() })), p);
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [...movimientos, movimientos[2]] })), /duplicada/);
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [movimientos[0], movimientos[1], movimientos[2],
    { ...movimientos[3], salida_movimiento_id: 'salida-A' }] })), /mismo suministro/);
});

test('Un mismo movimiento sigue exigiendo tipo coherente entre atribuciones', () => {
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [salida('A', 'compartida'),
    { ...salida('B', 'compartida'), tipo: 'entrada' }] })), /identidades contradictorias/);
});

test('Reserva activa más salida neta de la misma unidad rechaza doble cobertura', () => {
  assert.throws(() => proyectarCoberturaSuministros(base({ movimientos: [salida()],
    reservas: [{ suministro_id: 'A', cantidad: 1, estado: 'activa' }] })), /exceden la demanda/);
});

test('Entradas inconsistentes se rechazan explícitamente', () => {
  const casos: Partial<EntradaCoberturaSuministros>[] = [
    { suministros: [{ id: 'A', articulo_id: 'kit' }, { id: 'A', articulo_id: 'kit' }] },
    { suministros: [{ id: ' ', articulo_id: 'kit' }] },
    { asignacionesPedido: [{ suministro_id: 'ajeno', cantidad: 1, cantidad_recibida: 0 }] },
    { asignacionesPedido: [{ suministro_id: 'A', cantidad: 1, cantidad_recibida: 2 }] },
    { asignacionesPedido: [{ suministro_id: 'A', cantidad: 1, cantidad_recibida: -1 }] },
    { asignacionesPedido: [{ suministro_id: 'A', cantidad: 2, cantidad_recibida: 0 }] },
    { reservas: [{ suministro_id: 'A', cantidad: 2, estado: 'activa' }] },
    { reservas: [{ suministro_id: 'A', cantidad: 1, estado: 'invalido' as 'activa' }] },
    { movimientos: [salida(), salida()] },
    { movimientos: [devolucion()] },
    { movimientos: [{ ...salida(), salida_movimiento_id: 'otra' }] },
    { movimientos: [salida(), salida('A', 'segunda')] },
    { movimientos: [{ ...salida(), cantidad: NaN }] },
    { movimientos: [{ ...salida(), cantidad: Infinity }] },
    { movimientos: [{ ...salida(), cantidad: -1 }] },
    { movimientos: [{ ...salida(), cantidad: 0.5 }] },
    { movimientos: [{ ...salida(), cantidad: 0 }] },
    { movimientosSinAtribuir: [{ movimiento_id: 'legacy', articulo_id: 'kit', tipo: 'salida', cantidad: -1 }] },
  ];
  for (const [indice, cambios] of casos.entries()) {
    assert.throws(() => proyectarCoberturaSuministros(base(cambios)), ErrorCoberturaSuministro, `Caso ${indice}`);
  }
});

test('No modifica entradas ni fabrica avisos o cobertura cuando están vacías', () => {
  const entrada = base();
  const antes = structuredClone(entrada);
  assert.equal(proyectarCoberturaSuministros(entrada).avisosSinAtribuir.length, 0);
  assert.deepEqual(entrada, antes);
  assert.deepEqual(proyectarCoberturaSuministros({ ...base(), suministros: [] }),
    { porSuministro: new Map(), avisosSinAtribuir: [] });
});

test('Acepta datos no vacíos congelados sin mutarlos, con retorno antes de salida', () => {
  const entrada = base({
    asignacionesPedido: [{ suministro_id: 'A', cantidad: 1, cantidad_recibida: 1 }],
    reservas: [{ suministro_id: 'A', cantidad: 1, estado: 'servida' }],
    movimientos: [devolucion(), salida()],
    movimientosSinAtribuir: [{ movimiento_id: 'legacy', articulo_id: 'kit', tipo: 'salida', cantidad: 2 }],
  });
  const antes = structuredClone(entrada);
  for (const lista of Object.values(entrada)) {
    for (const fila of lista) Object.freeze(fila);
    Object.freeze(lista);
  }
  Object.freeze(entrada);
  const p = proyectarCoberturaSuministros(entrada);
  assert.equal(p.porSuministro.get('A')?.servido, 0);
  assert.equal(p.porSuministro.get('A')?.reservado, 0);
  assert.equal(p.porSuministro.get('A')?.recibido, 1);
  assert.equal(p.avisosSinAtribuir[0].cantidad, 2);
  assert.deepEqual(entrada, antes);
});
