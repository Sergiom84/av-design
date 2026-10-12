import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularConexion, diagnosticarCalculoConexion } from './calculo-cable';
import { construirTablaCables, tablaCablesACsv } from './cable-schedule';
import { bloquesDelLienzo, bloquesRosetasDelLienzo, conexionesSinDibujar, ocupacionDeBocas, puntoDeExtremo } from './lienzo-conexiones';
import { construirDiagrama } from './diagrama';
import { resolverExtremoConexion } from './extremos-conexion';
import { PARAMETROS_POR_DEFECTO, type Conexion, type EquipoEnSala, type Puerto, type Sala, type TomaRed } from './tipos';

const sala: Sala = {
  id: 's', sede_id: null, localizacion_id: null, codigo: null, nombre: 'Ensayo', tipologia: null,
  aforo: null, plantilla_id: null, largo_m: 6, ancho_m: 4, alto_m: 3, alto_falso_techo_m: 2.7,
  alto_canaleta_m: 0.3, alto_suelo_tecnico_m: 0, ruta_por_defecto: 'directo', notas: null,
  mesa_largo_m: null, mesa_ancho_m: null, mesa_alto_cm: null, mesa_x_m: null, mesa_y_m: null,
  mesa_rotacion_grados: 0, diagrama_version: 0, sillas_modo: 'derivadas',
};
const equipo: EquipoEnSala = { id: 'e', sala_id: 's', articulo_id: 'a', nombre: 'Equipo', cantidad: 1,
  extremo: 'mesa', posicion: { x_m: 3, y_m: 2, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0 };
const puerto: Puerto = { id: 'p', articulo_id: 'a', nombre: 'LAN', total: 2, sentido: 'bidireccional',
  senal: 'red', conector: 'RJ45', orden: 1, notas: null, fuente: 'app' };
const toma: TomaRed = { id: 't', sala_id: 's', codigo: 'R-12', codigo_referencia: null, codigo_confirmado: true,
  capacidad_documentada: 2, esquema_x: null, esquema_y: null, ubicacion: 'suelo', x_m: 0, y_m: 0, z_m: 0, notas: null,
  bocas: [1, 2].map((ordinal) => ({ id: `b${ordinal}`, toma_red_id: 't', ordinal, etiqueta: null, senal: 'red', conector: 'RJ45' })),
};
const conexion: Conexion = { id: 'c', etiqueta_cable: 'RED-1000', sala_id: 's', origen_id: 'e', destino_id: null,
  puerto_origen_id: 'p', puerto_origen_ordinal: 2, puerto_destino_id: null, puerto_destino_ordinal: null,
  detalle: { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'e', puerto_id: 'p', ordinal: 2 },
    destino: { tipo: 'roseta', toma_boca_id: 'b2' } }, articulo_cable_id: null, senal: 'red', ruta: null,
  longitud_manual_m: null, notas: null,
};
const equipos = new Map([[equipo.id, equipo]]);
const articulos = new Map();
const parametros = { ...PARAMETROS_POR_DEFECTO, holgura_roseta: 0.2 };
const contexto = (t = toma) => ({ tomas: new Map([[t.id, t]]), puertos: new Map([[puerto.id, puerto]]) });
const calcular = (c = conexion, t = toma, p = parametros) => calcularConexion(c, sala, equipos, articulos, p, contexto(t));

test('roseta cero es posición conocida y suma holguras y margen una sola vez', () => {
  assert.equal(calcular()!.longitud_m, 6.7);
  assert.equal(calcular(conexion, toma, { ...parametros, margen: 0.1 })!.longitud_m, 7.37);
  assert.deepEqual(resolverExtremoConexion({ tipo: 'roseta', toma_boca_id: 'b2' }, 's', equipos, contexto(), parametros)!.posicion,
    { estado: 'conocida', punto: { x_m: 0, y_m: 0, z_m: 0 } });
});
for (const eje of ['x_m', 'y_m', 'z_m'] as const) test(`roseta con ${eje} nulo no usa cero ni puntos como sustituto`, () => {
  const parcial = { ...toma, [eje]: null };
  const antes = structuredClone(parcial);
  assert.equal(calcular({ ...conexion, puntos_paso: [{ x_m: 1, y_m: 1, z_m: 1, orden: 0 }] }, parcial), null);
  assert.match(diagnosticarCalculoConexion(conexion, sala, equipos, articulos, parametros, contexto(parcial)).join(' '), /posición completa.*R-12/);
  assert.deepEqual(parcial, antes);
});
test('manual prevalece con identidad válida y posición o holgura desconocidas', () => {
  const resultado = calcularConexion({ ...conexion, longitud_manual_m: 8 }, sala, equipos, articulos,
    PARAMETROS_POR_DEFECTO, contexto({ ...toma, z_m: null }));
  assert.equal(resultado!.longitud_m, 8);
  assert.equal(resultado!.manual, true);
  assert.equal(resultado!.holgura_destino_m, 0);
});
test('manual no legitima boca ajena o inexistente ni ordinal inventado', () => {
  assert.equal(calcular({ ...conexion, longitud_manual_m: 8 }, { ...toma, sala_id: 'otra' }), null);
  assert.equal(calcular({ ...conexion, longitud_manual_m: 8 }, { ...toma, bocas: [] }), null);
  assert.equal(calcular({ ...conexion, longitud_manual_m: 8, detalle: { estado: 'completo',
    origen: { tipo: 'equipo', equipo_id: 'e', puerto_id: 'p', ordinal: 0 }, destino: { tipo: 'roseta', toma_boca_id: 'b2' } } }), null);
  assert.equal(calcular({ ...conexion, longitud_manual_m: Number.NaN }), null);
});
test('holgura sin documentar deja pendiente; cero explícito permite calcular', () => {
  assert.equal(calcularConexion(conexion, sala, equipos, articulos, PARAMETROS_POR_DEFECTO, contexto()), null);
  assert.match(diagnosticarCalculoConexion(conexion, sala, equipos, articulos, PARAMETROS_POR_DEFECTO, contexto()).join(' '), /holgura de roseta/);
  assert.equal(calcular(conexion, toma, { ...parametros, holgura_roseta: 0 })!.longitud_m, 6.5);
});
test('ruta de roseta reutiliza los recorridos históricos y polilínea medida', () => {
  const esperadas = { directo: 6.7, falso_techo: 10.1, suelo_tecnico: 6.7, canaleta: 4.7 };
  for (const ruta of ['directo', 'falso_techo', 'suelo_tecnico', 'canaleta'] as const) {
    assert.equal(calcular({ ...conexion, ruta })!.longitud_m, esperadas[ruta], ruta);
  }
  const puntos_paso = [{ x_m: 3, y_m: 2, z_m: 0, orden: 1 }, { x_m: 0, y_m: 2, z_m: 0, orden: 2 }];
  assert.equal(calcular({ ...conexion, puntos_paso })!.longitud_m, 6.7);
});
test('equipo completo y legado conservan exactamente el cálculo histórico en cada ruta', () => {
  const otro = { ...equipo, id: 'e2', posicion: { x_m: 0, y_m: 0, z_m: 0 } };
  const mapa = new Map([...equipos, [otro.id, otro]]);
  for (const ruta of ['directo', 'falso_techo', 'suelo_tecnico', 'canaleta'] as const) {
    const historica: Conexion = { ...conexion, destino_id: otro.id, ruta, detalle: { estado: 'legacy' } };
    const completa: Conexion = { ...historica, detalle: { estado: 'completo',
      origen: { tipo: 'equipo', equipo_id: 'e', puerto_id: 'p', ordinal: 2 },
      destino: { tipo: 'equipo', equipo_id: 'e2', puerto_id: 'p', ordinal: 1 } } };
    assert.deepEqual(calcularConexion(completa, sala, mapa, articulos, parametros, contexto()),
      calcularConexion(historica, sala, mapa, articulos, parametros, contexto()));
  }
});
test('tabla y CSV conservan boca de roseta, etiqueta y causa pendiente sin doble tirada', () => {
  const avisos = diagnosticarCalculoConexion(conexion, sala, equipos, articulos, PARAMETROS_POR_DEFECTO, contexto());
  const filas = construirTablaCables({ conexiones: [conexion], equipos, ...contexto(), articulos,
    resultados: new Map(), avisosCalculo: new Map([['c', avisos]]) });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].destino, 'R-12'); assert.equal(filas[0].puerto_destino, 'Boca 2');
  assert.equal(filas[0].metros, null); assert.equal(filas[0].identificador, 'RED-1000');
  assert.match(tablaCablesACsv(filas), /holgura de roseta/);
});
test('lienzo conserva boca y ocupación exactas; mover bloque no altera XYZ ni metros', () => {
  const bloques = bloquesDelLienzo([equipo], [puerto], {});
  const rosetas = bloquesRosetasDelLienzo([toma], {});
  assert.deepEqual(conexionesSinDibujar(bloques, [conexion], rosetas), []);
  assert.equal(ocupacionDeBocas([conexion], [puerto]).get('roseta:b2'), 'c');
  assert.equal(ocupacionDeBocas([conexion], [puerto]).has('roseta:b1'), false);
  const movidas = bloquesRosetasDelLienzo([toma], { t: { x: 87, y: 64 } });
  assert.notDeepEqual(puntoDeExtremo(bloques, rosetas, { tipo: 'roseta', toma_boca_id: 'b2' }),
    puntoDeExtremo(bloques, movidas, { tipo: 'roseta', toma_boca_id: 'b2' }));
  assert.equal(calcular()!.longitud_m, 6.7);
  assert.deepEqual([toma.x_m, toma.y_m, toma.z_m], [0, 0, 0]);
  assert.deepEqual(conexionesSinDibujar(bloques, [{ ...conexion, detalle: { estado: 'legacy' } }], rosetas), ['c']);
});
test('esquema impreso ancla en boca de roseta y conserva brida', () => {
  const escena = construirDiagrama({ equipos: [equipo], tomas: [toma], puertosPorArticulo: new Map([['a', [puerto]]]), conexiones: [conexion] });
  assert.equal(escena.bloques.length, 1); assert.equal(escena.rosetas.length, 1);
  assert.equal(escena.lineas.length, 1); assert.equal(escena.omitidas, 0);
  assert.equal(escena.lineas[0].identificador, 'RED-1000');
  assert.equal(escena.lineas[0].puntos.at(-1)!.y, escena.rosetas[0].bocas[1].y);
});
