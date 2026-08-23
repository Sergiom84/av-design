import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  avisosDeConexion,
  construirTablaCables,
  identificadoresDeCable,
  ordenarConexiones,
  tablaCablesACsv,
} from './cable-schedule';
import { calcularConexion, type ResultadoCable } from './calculo-cable';
import {
  Articulo,
  Conexion,
  EquipoEnSala,
  Puerto,
  Sala,
  TomaRed,
} from './tipos';

/**
 * Misma sala que en calculo-cable.test.ts: la SALA TP de aforo 8, que es la
 * plantilla más repetida del inventario.
 */
const SALA: Sala = {
  id: 's1',
  sede_id: null,
  localizacion_id: null,
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
  // La mesa es del croquis, no de la tabla de cables.
  mesa_largo_m: null,
  mesa_ancho_m: null,
  mesa_alto_cm: null,
  mesa_x_m: null,
  mesa_y_m: null,
  mesa_rotacion_grados: 0,
  diagrama_version: 0,
  sillas_modo: 'derivadas',
};

const TOMA: TomaRed = {
  id: 't-12',
  sala_id: 's1',
  codigo: '12',
  ubicacion: 'suelo',
  x_m: 3,
  y_m: 2,
  z_m: 0,
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
  posicion_confirmada: true,
  rotacion_grados: 0,
  toma_red_id: null,
};

const CAJA: EquipoEnSala = {
  id: 'e-caja',
  sala_id: 's1',
  articulo_id: 'a-topframe',
  nombre: 'Bachmann TopFrame',
  cantidad: 1,
  extremo: 'caja_conexiones',
  posicion: { x_m: 3, y_m: 2, z_m: 0.75 },
  posicion_confirmada: true,
  rotacion_grados: 0,
  toma_red_id: TOMA.id,
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

/** Puertos como los serigrafía el fabricante: el literal, no una traducción. */
const puerto = (p: Partial<Puerto> & Pick<Puerto, 'id' | 'nombre' | 'sentido' | 'senal'>): Puerto => ({
  articulo_id: 'a-qb65',
  total: 1,
  conector: 'HDMI A',
  orden: null,
  notas: null,
  fuente: 'app',
  ...p,
});

const HDMI_OUT = puerto({
  id: 'p-out',
  articulo_id: 'a-topframe',
  nombre: 'HDMI OUT 1',
  sentido: 'salida',
  senal: 'hdmi',
});
const HDMI_IN = puerto({
  id: 'p-in',
  nombre: 'HDMI IN 1',
  sentido: 'entrada',
  senal: 'hdmi',
});
const OTRA_SALIDA = puerto({
  id: 'p-out2',
  nombre: 'HDMI OUT 2',
  sentido: 'salida',
  senal: 'hdmi',
});
const OTRA_ENTRADA = puerto({
  id: 'p-in2',
  articulo_id: 'a-topframe',
  nombre: 'HDMI IN 2',
  sentido: 'entrada',
  senal: 'hdmi',
});
const RJ45 = puerto({
  id: 'p-rj45',
  nombre: 'RJ45',
  sentido: 'bidireccional',
  senal: 'red',
  conector: 'RJ45',
});

/** Una conexión sin detallar. Los tests le cambian lo que necesitan. */
const conexion = (p: Partial<Conexion> & Pick<Conexion, 'id'>): Conexion => ({
  sala_id: 's1',
  origen_id: CAJA.id,
  destino_id: PANTALLA.id,
  articulo_cable_id: HDMI.id,
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  puerto_origen_id: null,
  puerto_destino_id: null,
  creado_en: '2026-08-05T10:00:00.000Z',
  ...p,
});

describe('identificador de cable', () => {
  test('correlativo por señal, arrancando en 1000', () => {
    const ids = identificadoresDeCable([
      conexion({ id: 'c1', senal: 'hdmi', creado_en: '2026-08-05T10:00:00.000Z' }),
      conexion({ id: 'c2', senal: 'hdmi', creado_en: '2026-08-05T10:01:00.000Z' }),
      conexion({ id: 'c3', senal: 'hdmi', creado_en: '2026-08-05T10:02:00.000Z' }),
    ]);
    assert.equal(ids.get('c1'), 'HD-1000');
    assert.equal(ids.get('c2'), 'HD-1001');
    assert.equal(ids.get('c3'), 'HD-1002');
  });

  test('cada señal lleva su propia serie y su propio prefijo', () => {
    const ids = identificadoresDeCable([
      conexion({ id: 'c1', senal: 'hdmi', creado_en: '2026-08-05T10:00:00.000Z' }),
      conexion({ id: 'c2', senal: 'red', creado_en: '2026-08-05T10:01:00.000Z' }),
      conexion({ id: 'c3', senal: 'microfono', creado_en: '2026-08-05T10:02:00.000Z' }),
      conexion({ id: 'c4', senal: 'red', creado_en: '2026-08-05T10:03:00.000Z' }),
    ]);
    // La segunda tirada de red no hereda el número de la primera de HDMI.
    assert.equal(ids.get('c1'), 'HD-1000');
    assert.equal(ids.get('c2'), 'RED-1000');
    assert.equal(ids.get('c3'), 'MIC-1000');
    assert.equal(ids.get('c4'), 'RED-1001');
  });

  test('dar de alta una tirada nueva no renumera las que ya existen', () => {
    // Esto es lo que puede estar ya escrito en una brida: si HD-1000 cambia de
    // número, la etiqueta del cable deja de corresponder con el papel.
    const antes = [
      conexion({ id: 'c1', senal: 'hdmi', creado_en: '2026-08-05T10:00:00.000Z' }),
      conexion({ id: 'c2', senal: 'red', creado_en: '2026-08-05T10:01:00.000Z' }),
    ];
    const ids = identificadoresDeCable(antes);

    const despues = [
      ...antes,
      conexion({ id: 'c3', senal: 'hdmi', creado_en: '2026-08-05T18:30:00.000Z' }),
    ];
    const idsDespues = identificadoresDeCable(despues);

    assert.equal(idsDespues.get('c1'), ids.get('c1'));
    assert.equal(idsDespues.get('c2'), ids.get('c2'));
    assert.equal(idsDespues.get('c3'), 'HD-1001');
  });

  test('con la misma fecha de alta desempata por id, no por el orden de llegada', () => {
    // Las conexiones que ya existían cuando se migró comparten el `now()` de la
    // migración: sin desempate estable, cada consulta podría devolverlas en otro
    // orden y los identificadores bailarían.
    const misma = '2026-08-05T10:00:00.000Z';
    const b = conexion({ id: 'b', senal: 'hdmi', creado_en: misma });
    const a = conexion({ id: 'a', senal: 'hdmi', creado_en: misma });

    assert.equal(identificadoresDeCable([b, a]).get('a'), 'HD-1000');
    assert.equal(identificadoresDeCable([a, b]).get('a'), 'HD-1000');
    assert.equal(identificadoresDeCable([b, a]).get('b'), 'HD-1001');
  });

  test('sin fecha de alta sigue numerando, ordenado por id', () => {
    const ids = identificadoresDeCable([
      conexion({ id: 'z', senal: 'hdmi', creado_en: null }),
      conexion({ id: 'a', senal: 'hdmi', creado_en: null }),
    ]);
    assert.equal(ids.get('a'), 'HD-1000');
    assert.equal(ids.get('z'), 'HD-1001');
  });
});

describe('orden de las conexiones', () => {
  const c = [
    conexion({ id: 'c3', creado_en: '2026-08-05T12:00:00.000Z' }),
    conexion({ id: 'c1', creado_en: '2026-08-05T10:00:00.000Z' }),
    conexion({ id: 'c2', creado_en: '2026-08-05T11:00:00.000Z' }),
  ];

  test('ordena por fecha de alta', () => {
    assert.deepEqual(
      ordenarConexiones(c).map((x) => x.id),
      ['c1', 'c2', 'c3'],
    );
  });

  test('el orden no depende de cómo llegue la lista', () => {
    const alReves = [...c].reverse();
    assert.deepEqual(
      ordenarConexiones(alReves).map((x) => x.id),
      ordenarConexiones(c).map((x) => x.id),
    );
  });

  test('no toca la lista original', () => {
    const original = c.map((x) => x.id);
    ordenarConexiones(c);
    assert.deepEqual(
      c.map((x) => x.id),
      original,
    );
  });
});

describe('avisos de compatibilidad', () => {
  test('una salida contra una entrada de la misma señal no avisa de nada', () => {
    const avisos = avisosDeConexion(
      { senal: 'hdmi' },
      HDMI_OUT,
      HDMI_IN,
      HDMI,
    );
    assert.deepEqual(avisos, []);
  });

  test('salida contra salida', () => {
    const avisos = avisosDeConexion({ senal: 'hdmi' }, HDMI_OUT, OTRA_SALIDA, HDMI);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /Salida contra salida/);
  });

  test('entrada contra entrada', () => {
    const avisos = avisosDeConexion({ senal: 'hdmi' }, OTRA_ENTRADA, HDMI_IN, HDMI);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /Entrada contra entrada/);
  });

  test('de entrada a salida avisa de que puede estar del revés', () => {
    const avisos = avisosDeConexion({ senal: 'hdmi' }, OTRA_ENTRADA, HDMI_OUT, HDMI);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /del revés/);
  });

  test('bidireccional no dispara aviso de sentido', () => {
    // El USB-C y el Dante valen en los dos sentidos: exigirles sentido sería
    // convertir la validación en un estorbo.
    const otroRj45 = { ...RJ45, id: 'p-rj45-b', articulo_id: 'a-topframe' };
    assert.deepEqual(avisosDeConexion({ senal: 'red' }, RJ45, otroRj45, CAT6A), []);
  });

  test('señales que no casan entre los dos puertos', () => {
    const avisos = avisosDeConexion({ senal: 'hdmi' }, HDMI_OUT, RJ45, HDMI);
    assert.ok(avisos.some((a) => /Señales distintas: HDMI en origen y Red en destino/.test(a)));
  });

  test('cable cuya señal no corresponde con la del puerto', () => {
    const avisos = avisosDeConexion({ senal: 'hdmi' }, HDMI_OUT, HDMI_IN, CAT6A);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /El cable elegido es de Red y el puerto es HDMI/);
  });

  test('la señal de la tirada no coincide con la del puerto', () => {
    const avisos = avisosDeConexion({ senal: 'red' }, HDMI_OUT, HDMI_IN, undefined);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /marcada como Red y el puerto es HDMI/);
  });

  test('sin puertos detallados no hay nada que validar', () => {
    assert.deepEqual(avisosDeConexion({ senal: 'hdmi' }, undefined, undefined, HDMI), []);
  });
});

describe('tabla de cables', () => {
  const equipos = new Map([
    [PANTALLA.id, PANTALLA],
    [CAJA.id, CAJA],
  ]);
  const articulos = new Map([
    [HDMI.id, HDMI],
    [CAT6A.id, CAT6A],
  ]);
  const puertos = new Map([
    [HDMI_OUT.id, HDMI_OUT],
    [HDMI_IN.id, HDMI_IN],
  ]);
  const tomas = new Map([[TOMA.id, TOMA]]);

  const tirada = conexion({
    id: 'c1',
    puerto_origen_id: HDMI_OUT.id,
    puerto_destino_id: HDMI_IN.id,
  });

  /** Los metros los pone `calcularConexion()`, que no se toca: aquí solo se presenta. */
  const resultados = (cs: Conexion[]) =>
    new Map(
      cs
        .map((c) => calcularConexion(c, SALA, equipos, articulos))
        .filter((r): r is ResultadoCable => r != null)
        .map((r) => [r.conexion_id, r]),
    );

  const construir = (cs: Conexion[]) =>
    construirTablaCables({
      conexiones: cs,
      equipos,
      tomas,
      puertos,
      articulos,
      resultados: resultados(cs),
    });

  test('lleva los puertos, los conectores y los metros calculados', () => {
    const [fila] = construir([tirada]);
    assert.equal(fila.identificador, 'HD-1000');
    assert.equal(fila.origen, 'Bachmann TopFrame');
    assert.equal(fila.puerto_origen, 'HDMI OUT 1');
    assert.equal(fila.conector_origen, 'HDMI A');
    assert.equal(fila.destino, 'Samsung QB65R-B');
    assert.equal(fila.puerto_destino, 'HDMI IN 1');
    // 5,15 de recorrido + 0,5 de caja de conexiones + 0,35 de pantalla
    assert.equal(fila.metros, 6);
    assert.equal(fila.recorrido_m, 5.15);
    assert.equal(fila.longitud_comercial_m, 7.5);
    assert.deepEqual(fila.avisos, []);
  });

  test('la toma de red dice de qué extremo es', () => {
    const [fila] = construir([tirada]);
    // La roseta la tiene la caja de conexiones, que aquí es el origen.
    assert.equal(fila.toma_red, '12 (origen)');
  });

  test('sin cálculo los metros salen nulos, no cero', () => {
    // Cero metros es una tirada de longitud cero; nulo es "no se ha podido
    // calcular". Confundirlos haría que una sala sin medidas pareciera resuelta.
    const filas = construirTablaCables({
      conexiones: [tirada],
      equipos,
      tomas,
      puertos,
      articulos,
      resultados: new Map(),
    });
    assert.equal(filas[0].metros, null);
    assert.equal(filas[0].recorrido_m, null);
    assert.equal(filas[0].identificador, 'HD-1000');
  });

  test('las filas salen en el mismo orden que los identificadores', () => {
    const filas = construir([
      conexion({ id: 'c2', creado_en: '2026-08-05T11:00:00.000Z' }),
      tirada,
    ]);
    assert.deepEqual(
      filas.map((f) => f.identificador),
      ['HD-1000', 'HD-1001'],
    );
    assert.equal(filas[0].conexion_id, 'c1');
  });
});

describe('exportación a CSV', () => {
  const equipos = new Map([
    [PANTALLA.id, PANTALLA],
    [CAJA.id, CAJA],
  ]);
  const articulos = new Map([[HDMI.id, HDMI]]);
  const puertos = new Map([
    [HDMI_OUT.id, HDMI_OUT],
    [HDMI_IN.id, HDMI_IN],
  ]);

  const tirada = conexion({
    id: 'c1',
    puerto_origen_id: HDMI_OUT.id,
    puerto_destino_id: HDMI_IN.id,
  });

  const filas = construirTablaCables({
    conexiones: [tirada],
    equipos,
    tomas: new Map([[TOMA.id, TOMA]]),
    puertos,
    articulos,
    resultados: new Map([
      [tirada.id, calcularConexion(tirada, SALA, equipos, articulos)!],
    ]),
  });

  const csv = tablaCablesACsv(filas);
  const lineas = csv.split('\r\n');

  test('la cabecera nombra las columnas del entregable', () => {
    assert.equal(
      lineas[0],
      'id_cable;equipo_origen;puerto_origen;conector_origen;equipo_destino;' +
        'puerto_destino;conector_destino;toma_red;senal;ruta;metros;recorrido_m;' +
        'holgura_origen_m;holgura_destino_m;margen_m;articulo_cable;' +
        'longitud_comercial_m;avisos',
    );
  });

  test('separa con punto y coma, como el resto de CSV del proyecto', () => {
    assert.equal(lineas[0].split(';').length, 18);
    assert.equal(lineas[1].split(';').length, 18);
  });

  test('los decimales van con coma para que Excel los sume', () => {
    // Con punto decimal y separador `;` los metros llegarían como texto.
    const celdas = lineas[1].split(';');
    assert.equal(celdas[0], 'HD-1000');
    assert.equal(celdas[10], '6,00'); // metros
    assert.equal(celdas[11], '5,15'); // recorrido
    assert.equal(celdas[12], '0,50'); // holgura de la caja de conexiones
    assert.equal(celdas[13], '0,35'); // holgura de la pantalla
    assert.equal(celdas[16], '7,50'); // longitud comercial
    // Ninguna celda numérica lleva punto. El texto sí puede: el modelo del
    // cable es "HDMI 2.0 4K60 4:4:4" y se escribe tal cual.
    const numericas = [10, 11, 12, 13, 14, 16];
    for (const i of numericas) assert.ok(!celdas[i].includes('.'), celdas[i]);
  });

  test('entrecomilla lo que llevaría un punto y coma dentro', () => {
    const conPuntoYComa = filas.map((f) => ({ ...f, origen: 'Rack A; fila 2' }));
    const linea = tablaCablesACsv(conPuntoYComa).split('\r\n')[1];
    assert.ok(linea.includes('"Rack A; fila 2"'));
    assert.equal(linea.split(';').length, 19); // el de dentro de las comillas no parte
  });

  test('una tirada sin detallar deja las celdas vacías, no la palabra null', () => {
    const desnuda = conexion({ id: 'c9' });
    const linea = tablaCablesACsv(
      construirTablaCables({
        conexiones: [desnuda],
        equipos,
        tomas: new Map(),
        puertos,
        articulos,
        resultados: new Map(),
      }),
    ).split('\r\n')[1];
    assert.ok(!linea.toLowerCase().includes('null'));
    assert.ok(linea.startsWith('HD-1000;Bachmann TopFrame;;;'));
  });
});
