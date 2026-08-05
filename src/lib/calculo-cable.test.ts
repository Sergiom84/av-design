import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparMaterialCable,
  ajustarALongitudComercial,
  calcularConexion,
  calcularRecorrido,
  dimensionarCanalizacion,
} from './calculo-cable';
import {
  Articulo,
  Conexion,
  EquipoEnSala,
  PARAMETROS_POR_DEFECTO,
  Sala,
} from './tipos';

/** SALA TP de aforo 8: la plantilla más repetida del inventario. */
const SALA: Sala = {
  id: 's1',
  sede_id: null,
  edificio: 'ÁFRICA',
  nivel: 'NIVEL 0',
  codigo: '001',
  nombre: 'África 001',
  tipologia: 'SALA TP',
  aforo: 8,
  plantilla_id: null,
  largo_m: 6,
  ancho_m: 4,
  alto_m: 3,
  alto_falso_techo_m: 2.7,
  alto_canaleta_m: 0.3,
  alto_suelo_tecnico_m: 0,
  ruta_por_defecto: 'falso_techo',
  notas: null,
};

const PANTALLA: EquipoEnSala = {
  id: 'e-pantalla',
  sala_id: 's1',
  articulo_id: 'a-qb65',
  nombre: 'Samsung QB65R-B',
  cantidad: 1,
  extremo: 'pantalla',
  posicion: { x_m: 3, y_m: 0, z_m: 1.5 },
};

const CAJA: EquipoEnSala = {
  id: 'e-caja',
  sala_id: 's1',
  articulo_id: 'a-topframe',
  nombre: 'Bachmann TopFrame',
  cantidad: 1,
  extremo: 'caja_conexiones',
  posicion: { x_m: 3, y_m: 2, z_m: 0.75 },
};

const HDMI: Articulo = {
  id: 'c-hdmi',
  referencia: null,
  tipo: 'cable',
  categoria: 'CABLE HDMI',
  marca: null,
  modelo: 'HDMI 2.0 4K60 4:4:4',
  descripcion: null,
  caracteristicas: null,
  observaciones: null,
  unidad: 'ud',
  coste: 12,
  coste_orientativo: false,
  pvp: null,
  proveedor: null,
  plazo_dias: null,
  stock_minimo: null,
  senal: 'hdmi',
  conector_a: 'HDMI A',
  conector_b: 'HDMI A',
  longitudes_comerciales_m: [1, 2, 3, 5, 7.5, 10, 15],
  bobina_m: null,
  diametro_mm: 7.3,
  unidades_instaladas: null,
  activo: true,
};

const CAT6A: Articulo = {
  ...HDMI,
  id: 'c-cat6a',
  categoria: 'CABLE RED',
  modelo: 'Cat6A F/UTP LSZH',
  unidad: 'm',
  senal: 'red',
  longitudes_comerciales_m: null,
  bobina_m: 305,
  diametro_mm: 7,
  coste: 1.1,
};

describe('recorrido físico', () => {
  test('por falso techo sube, recorre en ortogonal y baja', () => {
    const r = calcularRecorrido(PANTALLA.posicion, CAJA.posicion, 'falso_techo', SALA);
    // sube 2,7 − 1,5 = 1,2 · horizontal |3−3| + |0−2| = 2 · baja 2,7 − 0,75 = 1,95
    assert.equal(r.subida_m, 1.2);
    assert.equal(r.horizontal_m, 2);
    assert.equal(r.bajada_m, 1.95);
    assert.equal(r.recorrido_m, 5.15);
  });

  test('nunca es la línea recta entre los dos puntos', () => {
    const recta = Math.hypot(0, 2, 0.75);
    const r = calcularRecorrido(PANTALLA.posicion, CAJA.posicion, 'falso_techo', SALA);
    assert.ok(r.recorrido_m > recta);
  });

  test('por suelo técnico baja al suelo en vez de subir al techo', () => {
    const r = calcularRecorrido(PANTALLA.posicion, CAJA.posicion, 'suelo_tecnico', SALA);
    assert.equal(r.subida_m, 1.5);
    assert.equal(r.bajada_m, 0.75);
    assert.equal(r.recorrido_m, 4.25);
  });

  test('la ruta directa es más corta que cualquier canalización', () => {
    const directo = calcularRecorrido(PANTALLA.posicion, CAJA.posicion, 'directo', SALA);
    const techo = calcularRecorrido(PANTALLA.posicion, CAJA.posicion, 'falso_techo', SALA);
    assert.ok(directo.recorrido_m < techo.recorrido_m);
  });

  test('por canaleta rodea por el perímetro, no cruza la sala', () => {
    const oeste = { x_m: 0, y_m: 2, z_m: 1.5 };
    const este = { x_m: 6, y_m: 2, z_m: 1.5 };
    const r = calcularRecorrido(oeste, este, 'canaleta', SALA);
    // pegado a la pared: 2 m hasta la esquina + 6 m de fondo + 2 m hasta el punto
    assert.equal(r.horizontal_m, 10);
    // cruzando por el medio serían 6 m: la canaleta siempre penaliza
    assert.ok(r.horizontal_m > 6);
  });
});

describe('longitud de la tirada', () => {
  const equipos = new Map([
    [PANTALLA.id, PANTALLA],
    [CAJA.id, CAJA],
  ]);
  const articulos = new Map([
    [HDMI.id, HDMI],
    [CAT6A.id, CAT6A],
  ]);

  const conexion: Conexion = {
    id: 'x1',
    sala_id: 's1',
    origen_id: PANTALLA.id,
    destino_id: CAJA.id,
    articulo_cable_id: HDMI.id,
    senal: 'hdmi',
    ruta: null,
    longitud_manual_m: null,
    notas: null,
  };

  test('suma las holguras de cada extremo según su tipo', () => {
    const r = calcularConexion(conexion, SALA, equipos, articulos, PARAMETROS_POR_DEFECTO)!;
    assert.equal(r.holgura_origen_m, 0.35); // pantalla
    assert.equal(r.holgura_destino_m, 0.5); // caja de conexiones
    assert.equal(r.longitud_m, 6); // 5,15 + 0,35 + 0,5
  });

  test('ajusta al latiguillo comercial inmediatamente superior', () => {
    const r = calcularConexion(conexion, SALA, equipos, articulos)!;
    assert.equal(r.longitud_comercial_m, 7.5);
  });

  test('el extremo de proyector deja mucha menos holgura que el de pantalla', () => {
    const proyector: EquipoEnSala = { ...PANTALLA, id: 'e-proy', extremo: 'proyector' };
    const conEquipos = new Map([
      [proyector.id, proyector],
      [CAJA.id, CAJA],
    ]);
    const r = calcularConexion(
      { ...conexion, origen_id: proyector.id },
      SALA,
      conEquipos,
      articulos,
    )!;
    assert.equal(r.holgura_origen_m, 0.1);
    assert.equal(r.longitud_m, 5.75);
  });

  test('la longitud manual manda sobre el cálculo', () => {
    const r = calcularConexion(
      { ...conexion, longitud_manual_m: 12 },
      SALA,
      equipos,
      articulos,
    )!;
    assert.equal(r.longitud_m, 12);
    assert.equal(r.manual, true);
    assert.equal(r.longitud_comercial_m, 15);
  });

  test('el margen porcentual se aplica sobre recorrido más holguras', () => {
    const r = calcularConexion(conexion, SALA, equipos, articulos, {
      ...PARAMETROS_POR_DEFECTO,
      margen: 0.1,
    })!;
    assert.equal(r.longitud_m, 6.6);
  });

  test('devuelve null si falta uno de los extremos', () => {
    assert.equal(
      calcularConexion({ ...conexion, destino_id: 'no-existe' }, SALA, equipos, articulos),
      null,
    );
  });
});

describe('longitudes comerciales', () => {
  test('coge la inmediatamente superior', () => {
    assert.equal(ajustarALongitudComercial(4.2, [1, 2, 3, 5, 10]), 5);
  });
  test('si se pasa de la mayor, devuelve la mayor', () => {
    assert.equal(ajustarALongitudComercial(40, [1, 2, 3, 5, 10]), 10);
  });
  test('sin formatos definidos no ajusta', () => {
    assert.equal(ajustarALongitudComercial(4.2, null), null);
  });
});

describe('material a comprar', () => {
  const equipos = new Map([
    [PANTALLA.id, PANTALLA],
    [CAJA.id, CAJA],
  ]);
  const articulos = new Map([
    [HDMI.id, HDMI],
    [CAT6A.id, CAT6A],
  ]);

  test('agrupa el cable a metros y lo convierte en bobinas', () => {
    const conexiones: Conexion[] = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i}`,
      sala_id: 's1',
      origen_id: PANTALLA.id,
      destino_id: CAJA.id,
      articulo_cable_id: CAT6A.id,
      senal: 'red' as const,
      ruta: null,
      longitud_manual_m: null,
      notas: null,
    }));
    const resultados = conexiones.map(
      (c) => calcularConexion(c, SALA, equipos, articulos)!,
    );
    const lineas = agruparMaterialCable(resultados, conexiones, articulos);

    assert.equal(lineas.length, 1);
    assert.equal(lineas[0].unidad, 'm');
    assert.equal(lineas[0].cantidad, 18); // 3 tiradas de 6 m
    assert.equal(lineas[0].tiradas, 3);
    assert.match(lineas[0].a_pedir, /1 bobina de 305 m/);
    assert.equal(lineas[0].coste_estimado, 19.8);
  });

  test('agrupa los latiguillos por longitud comercial', () => {
    const conexiones: Conexion[] = [
      {
        id: 'c1',
        sala_id: 's1',
        origen_id: PANTALLA.id,
        destino_id: CAJA.id,
        articulo_cable_id: HDMI.id,
        senal: 'hdmi',
        ruta: null,
        longitud_manual_m: null,
        notas: null,
      },
      {
        id: 'c2',
        sala_id: 's1',
        origen_id: PANTALLA.id,
        destino_id: CAJA.id,
        articulo_cable_id: HDMI.id,
        senal: 'hdmi',
        ruta: null,
        longitud_manual_m: null,
        notas: null,
      },
    ];
    const resultados = conexiones.map(
      (c) => calcularConexion(c, SALA, equipos, articulos)!,
    );
    const lineas = agruparMaterialCable(resultados, conexiones, articulos);

    assert.equal(lineas.length, 1);
    assert.equal(lineas[0].unidad, 'ud');
    assert.equal(lineas[0].cantidad, 2);
    assert.match(lineas[0].a_pedir, /2 ud de 7.5 m/);
  });

  test('avisa de las tiradas sin cable asignado', () => {
    const conexion: Conexion = {
      id: 'c1',
      sala_id: 's1',
      origen_id: PANTALLA.id,
      destino_id: CAJA.id,
      articulo_cable_id: null,
      senal: 'hdmi',
      ruta: null,
      longitud_manual_m: null,
      notas: null,
    };
    const lineas = agruparMaterialCable(
      [calcularConexion(conexion, SALA, equipos, articulos)!],
      [conexion],
      articulos,
    );
    assert.match(lineas[0].descripcion, /Sin cable asignado/);
    assert.equal(lineas[0].coste_estimado, null);
  });
});

describe('canalización', () => {
  test('reserva hasta completar los 3 cables del criterio del departamento', () => {
    const d = dimensionarCanalizacion([7.3]);
    assert.equal(d.cables_previstos, 1);
    assert.equal(d.cables_con_reserva, 3);
    assert.match(d.sugerencia, /Canaleta/);
  });

  test('con 3 o más cables ya no añade reserva', () => {
    const d = dimensionarCanalizacion([7.3, 7, 6, 9]);
    assert.equal(d.cables_con_reserva, 4);
  });

  test('a más cables, canaleta mayor', () => {
    const pequena = dimensionarCanalizacion([5]);
    const grande = dimensionarCanalizacion(Array(20).fill(9));
    assert.ok(grande.seccion_minima_canaleta_mm2 > pequena.seccion_minima_canaleta_mm2);
  });
});
