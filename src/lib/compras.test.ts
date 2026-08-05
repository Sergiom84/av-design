import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparPorProveedor,
  calcularFaltante,
  estadoPorRecepcion,
  necesidadDeSala,
  pendienteDeRecibir,
} from './compras';
import type { LineaMaterialCable } from './calculo-cable';
import type { Articulo, EquipoEnSala } from './tipos';

/**
 * Misma sala de referencia que en calculo-cable.test.ts: la SALA TP de aforo 8,
 * que es la plantilla más repetida del inventario. Aquí interesa su lista de
 * material, no su geometría.
 */
const QB65: Pick<Articulo, 'marca' | 'modelo' | 'unidad' | 'proveedor' | 'coste' | 'coste_orientativo'> = {
  marca: 'Samsung',
  modelo: 'QB65R-B',
  unidad: 'ud',
  proveedor: 'Charmex',
  coste: 940,
  coste_orientativo: false,
};

const ROOM_BAR: typeof QB65 = {
  marca: 'Cisco',
  modelo: 'Room Bar',
  unidad: 'ud',
  proveedor: 'Charmex',
  coste: 2600,
  coste_orientativo: false,
};

// Precio de lista sacado de una web americana: sirve para dimensionar, no para pedir.
const SOPORTE: typeof QB65 = {
  marca: 'Vogel',
  modelo: 'PFW 6870',
  unidad: 'ud',
  proveedor: 'Vogel',
  coste: 120,
  coste_orientativo: true,
};

const CAT6A: typeof QB65 = {
  marca: 'Excel',
  modelo: 'Cat6A U/FTP',
  unidad: 'm',
  proveedor: null,
  coste: null,
  coste_orientativo: false,
};

const ARTICULOS = new Map<string, typeof QB65>([
  ['a-qb65', QB65],
  ['a-roombar', ROOM_BAR],
  ['a-soporte', SOPORTE],
  ['a-cat6a', CAT6A],
]);

const equipo = (
  articulo_id: string,
  nombre: string,
  cantidad: number,
): Pick<EquipoEnSala, 'articulo_id' | 'nombre' | 'cantidad'> => ({
  articulo_id,
  nombre,
  cantidad,
});

const cable = (
  articulo_id: string | null,
  descripcion: string,
  unidad: 'ud' | 'm',
  cantidad: number,
  a_pedir: string,
): LineaMaterialCable => ({
  articulo_id,
  descripcion,
  unidad,
  cantidad,
  tiradas: 1,
  a_pedir,
  coste_estimado: null,
});

describe('necesidad de una sala', () => {
  test('junta el equipamiento y el cable calculado', () => {
    const n = necesidadDeSala(
      [equipo('a-qb65', 'Pantalla', 1), equipo('a-roombar', 'Room Bar', 1)],
      [cable('a-cat6a', 'Excel Cat6A U/FTP', 'm', 48.5, '1 bobina de 100 m')],
      ARTICULOS,
    );
    assert.equal(n.length, 3);
    assert.deepEqual(
      n.map((l) => [l.descripcion, l.cantidad]),
      [
        ['Cisco Room Bar', 1],
        ['Excel Cat6A U/FTP', 48.5],
        ['Samsung QB65R-B', 1],
      ],
    );
  });

  test('el mismo artículo puesto dos veces en la sala se suma en una línea', () => {
    const n = necesidadDeSala(
      [equipo('a-qb65', 'Pantalla izquierda', 1), equipo('a-qb65', 'Pantalla derecha', 1)],
      [],
      ARTICULOS,
    );
    assert.equal(n.length, 1);
    assert.equal(n[0].cantidad, 2);
    assert.deepEqual(n[0].detalle, ['1 × Pantalla izquierda', '1 × Pantalla derecha']);
  });

  test('un artículo que es equipo y cable a la vez marca los dos orígenes', () => {
    const n = necesidadDeSala(
      [equipo('a-cat6a', 'Latiguillo suelto', 5)],
      [cable('a-cat6a', 'Excel Cat6A U/FTP', 'm', 10, '10 m')],
      ARTICULOS,
    );
    assert.equal(n[0].cantidad, 15);
    assert.deepEqual(n[0].origenes, ['equipo', 'cable']);
  });

  test('lo que no tiene referencia de catálogo no entra: no se puede pedir', () => {
    const n = necesidadDeSala(
      [equipo('', 'Equipo escrito a mano', 2)],
      [cable(null, 'Sin cable asignado · Pantalla → Rack', 'm', 12, 'Asignar cable')],
      ARTICULOS,
    );
    assert.deepEqual(n, []);
  });

  test('la unidad la manda el catálogo: el cable se cuenta en metros', () => {
    const n = necesidadDeSala([equipo('a-cat6a', 'Cable', 3)], [], ARTICULOS);
    assert.equal(n[0].unidad, 'm');
  });
});

describe('qué falta', () => {
  const NECESIDAD = necesidadDeSala(
    [equipo('a-qb65', 'Pantalla', 2), equipo('a-roombar', 'Room Bar', 1)],
    [cable('a-cat6a', 'Excel Cat6A U/FTP', 'm', 48.5, '1 bobina de 100 m')],
    ARTICULOS,
  );

  test('necesario menos disponible es lo que hay que comprar', () => {
    const f = calcularFaltante(
      NECESIDAD,
      new Map([
        ['a-qb65', 1],
        ['a-cat6a', 100],
      ]),
    );
    const porId = new Map(f.map((l) => [l.articulo_id, l]));
    assert.equal(porId.get('a-qb65')?.falta, 1, 'hacen falta 2 y hay 1');
    assert.equal(porId.get('a-roombar')?.falta, 1, 'no hay ninguno en almacén');
    assert.equal(porId.get('a-cat6a')?.falta, 0, 'con 100 m sobran para 48,5');
  });

  test('sobrar no es faltar: nunca sale negativo', () => {
    const f = calcularFaltante(NECESIDAD, new Map([['a-qb65', 10]]));
    assert.equal(f.find((l) => l.articulo_id === 'a-qb65')?.falta, 0);
  });

  test('lo ya reservado para esta obra no se vuelve a comprar', () => {
    // El fallo original: el material estaba apartado, no se veía, y se pedía otra vez.
    const sinReserva = calcularFaltante(NECESIDAD, new Map([['a-qb65', 0]]));
    assert.equal(sinReserva.find((l) => l.articulo_id === 'a-qb65')?.falta, 2);

    const conReserva = calcularFaltante(
      NECESIDAD,
      new Map([['a-qb65', 0]]),
      new Map([['a-qb65', 2]]),
    );
    assert.equal(conReserva.find((l) => l.articulo_id === 'a-qb65')?.falta, 0);
  });

  test('con el almacén vacío falta todo', () => {
    const f = calcularFaltante(NECESIDAD, new Map());
    assert.deepEqual(
      f.map((l) => [l.articulo_id, l.falta]),
      [
        ['a-roombar', 1],
        ['a-cat6a', 48.5],
        ['a-qb65', 2],
      ],
    );
  });
});

describe('agrupado por proveedor', () => {
  const FALTANTES = calcularFaltante(
    necesidadDeSala(
      [
        equipo('a-qb65', 'Pantalla', 2),
        equipo('a-roombar', 'Room Bar', 1),
        equipo('a-soporte', 'Soporte de pantalla', 2),
      ],
      [cable('a-cat6a', 'Excel Cat6A U/FTP', 'm', 48.5, '1 bobina de 100 m')],
      ARTICULOS,
    ),
    new Map(),
  );

  test('cada proveedor es un pedido', () => {
    const g = agruparPorProveedor(FALTANTES, ARTICULOS);
    assert.deepEqual(g.map((x) => x.proveedor), ['Charmex', 'Vogel', null]);
  });

  test('el total del proveedor sale del coste del catálogo', () => {
    const charmex = agruparPorProveedor(FALTANTES, ARTICULOS)[0];
    // 2 pantallas × 940 + 1 Room Bar × 2600
    assert.equal(charmex.total, 4480);
    assert.equal(charmex.lineas_orientativas, 0);
    assert.equal(charmex.lineas_sin_precio, 0);
  });

  test('el precio orientativo queda marcado: se presupuesta con él, no se pide', () => {
    const vogel = agruparPorProveedor(FALTANTES, ARTICULOS).find(
      (x) => x.proveedor === 'Vogel',
    )!;
    assert.equal(vogel.lineas[0].precio_orientativo, true);
    assert.equal(vogel.total, 240);
    assert.equal(vogel.lineas_orientativas, 1);
  });

  test('sin precio no hay importe, y el grupo lo dice', () => {
    const sinProveedor = agruparPorProveedor(FALTANTES, ARTICULOS).find(
      (x) => x.proveedor === null,
    )!;
    assert.equal(sinProveedor.lineas[0].importe, null);
    assert.equal(sinProveedor.total, null);
    assert.equal(sinProveedor.lineas_sin_precio, 1);
  });

  test('lo que se puede pedir tal cual sale primero; lo que hay que resolver, al final', () => {
    const g = agruparPorProveedor(FALTANTES, ARTICULOS);
    assert.equal(g[0].proveedor, 'Charmex');
    assert.equal(g[g.length - 1].proveedor, null);
  });

  test('lo que no falta no se pide', () => {
    const cubierto = calcularFaltante(
      necesidadDeSala([equipo('a-qb65', 'Pantalla', 2)], [], ARTICULOS),
      new Map([['a-qb65', 2]]),
    );
    assert.deepEqual(agruparPorProveedor(cubierto, ARTICULOS), []);
  });
});

describe('estados de un pedido', () => {
  const linea = (cantidad: number, cantidad_recibida: number) => ({
    cantidad,
    cantidad_recibida,
  });

  test('un borrador no cambia por recibir: primero se manda', () => {
    assert.equal(estadoPorRecepcion('borrador', [linea(2, 2)]), 'borrador');
  });

  test('todo recibido cierra el pedido', () => {
    assert.equal(estadoPorRecepcion('pedido', [linea(2, 2), linea(5, 5)]), 'recibido');
  });

  test('una línea a medias deja el pedido en recibido parcial', () => {
    assert.equal(
      estadoPorRecepcion('pedido', [linea(2, 2), linea(5, 1)]),
      'recibido_parcial',
    );
  });

  test('sin recibir nada sigue siendo pedido', () => {
    assert.equal(estadoPorRecepcion('recibido_parcial', [linea(2, 0)]), 'pedido');
  });

  test('recibir de más también cierra', () => {
    assert.equal(estadoPorRecepcion('pedido', [linea(2, 3)]), 'recibido');
  });

  test('lo pendiente nunca es negativo', () => {
    assert.equal(pendienteDeRecibir(linea(5, 2)), 3);
    assert.equal(pendienteDeRecibir(linea(5, 7)), 0);
  });
});
