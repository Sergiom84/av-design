import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisoDeCierre,
  avisosDeCierre,
  movimientosDeCierre,
  movimientosDeSalida,
  resumenCarga,
} from './carga';
import { calcularExistencias } from './almacen';
import type { LineaCarga, Movimiento } from './tipos';

const linea = (
  articulo_id: string,
  descripcion: string,
  cantidad: number,
  extra: Partial<LineaCarga> = {},
): LineaCarga => ({
  id: `l-${articulo_id}`,
  carga_id: 'c1',
  articulo_id,
  descripcion,
  unidad: 'ud',
  reserva_id: null,
  cantidad,
  cargado: false,
  instalado: 0,
  devuelto: 0,
  roto: 0,
  notas: null,
  ...extra,
});

describe('lista de carga', () => {
  test('el resumen dice qué queda por marcar', () => {
    const r = resumenCarga([
      linea('a-qb65', 'Samsung QB65R-B', 2, { cargado: true }),
      linea('a-roombar', 'Cisco Room Bar', 1),
    ]);
    assert.deepEqual(r, {
      lineas: 2,
      cargadas: 1,
      pendientes: 1,
      unidades: 3,
      completa: false,
    });
  });

  test('una carga vacía no está completa', () => {
    assert.equal(resumenCarga([]).completa, false);
  });

  test('solo sale del almacén lo que se ha metido en la furgoneta', () => {
    const m = movimientosDeSalida(
      [
        linea('a-qb65', 'Samsung QB65R-B', 2, { cargado: true }),
        linea('a-roombar', 'Cisco Room Bar', 1),
      ],
      'África 001',
    );
    assert.equal(m.length, 1);
    assert.deepEqual(
      { ...m[0] },
      {
        articulo_id: 'a-qb65',
        tipo: 'salida',
        cantidad: 2,
        motivo: 'Carga a obra · África 001',
      },
    );
  });
});

describe('cierre de obra', () => {
  test('lo instalado no genera movimiento: ya salió y se quedó puesto', () => {
    const m = movimientosDeCierre(
      [linea('a-qb65', 'Samsung QB65R-B', 2, { instalado: 2 })],
      'África 001',
    );
    assert.deepEqual(m, []);
  });

  test('el sobrante vuelve como devolución', () => {
    const m = movimientosDeCierre(
      [linea('a-hdmi', 'Latiguillo HDMI 3 m', 5, { instalado: 3, devuelto: 2 })],
      'África 001',
    );
    assert.equal(m.length, 1);
    assert.equal(m[0].tipo, 'devolucion');
    assert.equal(m[0].cantidad, 2);
  });

  test('lo roto entra y sale: neto cero en stock y la avería queda registrada', () => {
    // Es lo único que el departamento tenía apuntado a mano ("ROTO",
    // "POSIBLEMENTE NO PUEDA REPARARSE"). Sin este paso, un cierre de obra no
    // dejaría ni rastro de la avería.
    const m = movimientosDeCierre(
      [linea('a-hdmi', 'Latiguillo HDMI 3 m', 5, { instalado: 4, roto: 1 })],
      'África 001',
    );
    assert.deepEqual(m.map((x) => x.tipo), ['devolucion', 'baja']);

    const existencias = calcularExistencias(
      m.map((x) => ({
        articulo_id: x.articulo_id,
        ubicacion_id: 'u-estante',
        tipo: x.tipo,
        cantidad: x.cantidad,
      })) as Array<Pick<Movimiento, 'articulo_id' | 'ubicacion_id' | 'tipo' | 'cantidad'>>,
    );
    assert.equal(existencias.get('a-hdmi')?.cantidad, 0);
  });

  test('un cierre completo deja el sobrante en almacén y la avería fuera', () => {
    // Salen 10, se instalan 6, vuelven 3 y se rompe 1.
    const m = movimientosDeCierre(
      [linea('a-hdmi', 'Latiguillo HDMI 3 m', 10, { instalado: 6, devuelto: 3, roto: 1 })],
      'África 001',
    );
    const efecto = m.reduce(
      (t, x) => t + (x.tipo === 'baja' ? -x.cantidad : x.cantidad),
      0,
    );
    assert.equal(efecto, 3, 'solo el sobrante vuelve a contar como existencia');
  });
});

describe('avisos de cierre', () => {
  test('un reparto que cuadra no avisa', () => {
    assert.equal(
      avisoDeCierre(linea('a-hdmi', 'HDMI', 5, { instalado: 3, devuelto: 1, roto: 1 })),
      null,
    );
  });

  test('si falta material por repartir se dice cuánto', () => {
    const aviso = avisoDeCierre(linea('a-hdmi', 'HDMI', 5, { instalado: 3 }));
    assert.match(aviso ?? '', /faltan 2/);
  });

  test('repartir de más también avisa, pero no bloquea', () => {
    const aviso = avisoDeCierre(linea('a-hdmi', 'HDMI', 5, { instalado: 7 }));
    assert.match(aviso ?? '', /más de lo que se cargó/);
  });

  test('los metros de cable cuadran con decimales', () => {
    assert.equal(
      avisoDeCierre(
        linea('a-cat6a', 'Cat6A', 48.5, { instalado: 46.2, devuelto: 2.3 }),
      ),
      null,
    );
  });

  test('los avisos vienen con la línea a la que se refieren', () => {
    const avisos = avisosDeCierre([
      linea('a-qb65', 'Samsung QB65R-B', 2, { instalado: 2 }),
      linea('a-hdmi', 'Latiguillo HDMI 3 m', 5, { instalado: 1 }),
    ]);
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].descripcion, 'Latiguillo HDMI 3 m');
  });
});
