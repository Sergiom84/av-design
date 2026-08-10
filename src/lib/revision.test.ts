import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  resumirMontaje,
  revisarMontaje,
  type EntradaRevision,
  type FaltaDeSala,
  type PuntoMontaje,
  type Semaforo,
} from './revision';
import type { ResultadoCable } from './calculo-cable';
import type { FilaCable } from './cable-schedule';
import type { LineaFaltante } from './compras';
import type { Conexion, EquipoEnSala, Sala } from './tipos';

const sala = (extra: Partial<Sala> = {}): Sala => ({
  id: 's1',
  sede_id: null,
  sede: null,
  localizacion_id: null,
  edificio: null,
  nivel: null,
  codigo: null,
  nombre: 'Sala de Batería 006',
  tipologia: 'Telepresencia 8',
  aforo: 8,
  plantilla_id: null,
  largo_m: 4.7,
  ancho_m: 2.5,
  alto_m: 2.7,
  alto_falso_techo_m: null,
  alto_canaleta_m: null,
  alto_suelo_tecnico_m: null,
  ruta_por_defecto: 'falso_techo',
  notas: null,
  mesa_largo_m: 2.4,
  mesa_ancho_m: 1.21,
  mesa_alto_cm: 73,
  mesa_x_m: null,
  mesa_y_m: null,
  mesa_rotacion_grados: 0,
  diagrama_version: 0,
  sillas_modo: 'derivadas',
  ...extra,
});

const equipo = (id: string, extra: Partial<EquipoEnSala> = {}): EquipoEnSala => ({
  id,
  sala_id: 's1',
  articulo_id: `a-${id}`,
  nombre: id,
  cantidad: 1,
  extremo: 'pantalla',
  posicion: { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada: false,
  rotacion_grados: 0,
  toma_red_id: null,
  ...extra,
});

const conexion = (id: string, extra: Partial<Conexion> = {}): Conexion => ({
  id,
  sala_id: 's1',
  origen_id: 'tv',
  destino_id: 'caja',
  articulo_cable_id: 'a-hdmi',
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  puerto_origen_id: 'p1',
  puerto_destino_id: 'p2',
  creado_en: '2026-08-01T00:00:00.000Z',
  ...extra,
});

const resultado = (conexionId: string, metros = 9.2): ResultadoCable => ({
  conexion_id: conexionId,
  etiqueta: 'TV → Caja de conexiones',
  ruta: 'falso_techo',
  detalle: {
    ruta: 'falso_techo',
    subida_m: 2,
    horizontal_m: 6.5,
    bajada_m: 0.7,
    recorrido_m: metros,
  },
  holgura_origen_m: 0.35,
  holgura_destino_m: 0.5,
  margen_m: 0,
  longitud_m: metros,
  longitud_comercial_m: null,
  manual: false,
});

const fila = (identificador: string, avisos: string[] = []): FilaCable => ({
  identificador,
  conexion_id: 'c1',
  origen: 'TV',
  puerto_origen: 'HDMI IN 1',
  conector_origen: 'HDMI A',
  destino: 'Caja de conexiones',
  puerto_destino: 'HDMI OUT',
  conector_destino: 'HDMI A',
  toma_red: null,
  senal: 'hdmi',
  ruta: 'falso_techo',
  metros: 9.2,
  recorrido_m: 8.35,
  holgura_origen_m: 0.35,
  holgura_destino_m: 0.5,
  margen_m: 0,
  manual: false,
  articulo_cable: 'Genérico HDMI 2.0',
  longitud_comercial_m: null,
  avisos,
});

const faltante = (
  articulo_id: string,
  cantidad: number,
  falta: number,
): LineaFaltante => ({
  articulo_id,
  descripcion: articulo_id,
  unidad: 'ud',
  cantidad,
  origenes: ['equipo'],
  detalle: [`${cantidad} × ${articulo_id}`],
  disponible: cantidad - falta,
  falta,
});

const falta = (extra: Partial<FaltaDeSala> = {}): FaltaDeSala => ({
  faltantes: [faltante('a-qb65', 1, 0), faltante('a-hdmi', 2, 0)],
  grupos: [],
  sinCatalogar: [],
  reservas: [
    { articulo_id: 'a-qb65', cantidad: 1, estado: 'activa' },
    { articulo_id: 'a-hdmi', cantidad: 2, estado: 'activa' },
  ],
  disponibilidad: new Map(),
  ...extra,
});

/** Una sala terminada: medidas, equipos, conexiones, material y carga. */
const entradaCompleta = (extra: Partial<EntradaRevision> = {}): EntradaRevision => ({
  sala: sala(),
  equipos: [equipo('tv'), equipo('caja')],
  conexiones: [conexion('c1')],
  tomas: [],
  resultados: [resultado('c1')],
  filasCable: [fila('HD-1000')],
  falta: falta(),
  cargas: [{ estado: 'preparacion' }],
  ...extra,
});

const buscar = (puntos: PuntoMontaje[], clave: string): PuntoMontaje => {
  const p = puntos.find((x) => x.clave === clave);
  assert.ok(p, `no hay punto con clave ${clave}`);
  return p;
};

const estadoDe = (puntos: PuntoMontaje[], clave: string): Semaforo =>
  buscar(puntos, clave).estado;

describe('revisión de montaje', () => {
  test('una sala vacía bloquea por medidas, equipamiento y conexiones', () => {
    const puntos = revisarMontaje({
      sala: sala({ largo_m: 0, ancho_m: 0, alto_m: 0, mesa_largo_m: null, mesa_ancho_m: null }),
      equipos: [],
      conexiones: [],
      tomas: [],
      resultados: [],
      filasCable: [],
      falta: null,
      cargas: [],
    });

    assert.equal(estadoDe(puntos, 'medidas'), 'bloqueo');
    assert.equal(estadoDe(puntos, 'equipamiento'), 'bloqueo');
    assert.equal(estadoDe(puntos, 'conexiones'), 'bloqueo');
    assert.equal(resumirMontaje(puntos).estado, 'bloqueo');
  });

  test('el bloqueo de medidas dice cuáles faltan', () => {
    const puntos = revisarMontaje(
      entradaCompleta({ sala: sala({ ancho_m: 0, alto_m: 0 }) }),
    );
    assert.match(buscar(puntos, 'medidas').detalle, /ancho y alto/);
  });

  test('una sala completa sale lista entera', () => {
    const puntos = revisarMontaje(entradaCompleta());
    const resumen = resumirMontaje(puntos);
    assert.equal(
      resumen.estado,
      'listo',
      puntos
        .filter((p) => p.estado !== 'listo')
        .map((p) => `${p.clave}: ${p.detalle}`)
        .join(' | '),
    );
    assert.equal(resumen.bloqueos, 0);
    assert.equal(resumen.avisos, 0);
  });

  test('sin medidas de mesa avisa, pero no bloquea', () => {
    const puntos = revisarMontaje(
      entradaCompleta({ sala: sala({ mesa_largo_m: null, mesa_ancho_m: null }) }),
    );
    assert.equal(estadoDe(puntos, 'mesa'), 'aviso');
    assert.equal(resumirMontaje(puntos).estado, 'aviso');
    assert.equal(resumirMontaje(puntos).bloqueos, 0);
  });

  test('un equipo sin referencia de catálogo avisa y se nombra', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        equipos: [equipo('tv'), equipo('panel', { articulo_id: '', nombre: 'Panel Cisco' })],
      }),
    );
    const punto = buscar(puntos, 'catalogo');
    assert.equal(punto.estado, 'aviso');
    assert.match(punto.detalle, /1 de 2/);
    assert.match(punto.detalle, /Panel Cisco/);
  });

  test('una conexión sin puerto avisa, pero no bloquea', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        conexiones: [conexion('c1'), conexion('c2', { puerto_destino_id: null })],
        resultados: [resultado('c1'), resultado('c2')],
      }),
    );
    assert.equal(estadoDe(puntos, 'conexiones'), 'listo');
    const punto = buscar(puntos, 'puertos');
    assert.equal(punto.estado, 'aviso');
    assert.match(punto.detalle, /1 de 2 tiradas/);
    assert.equal(resumirMontaje(puntos).bloqueos, 0);
  });

  test('una tirada sin metros calculados avisa con el número', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        conexiones: [conexion('c1'), conexion('c2')],
        resultados: [resultado('c1')],
      }),
    );
    const punto = buscar(puntos, 'cable');
    assert.equal(punto.estado, 'aviso');
    assert.match(punto.detalle, /1 de 2/);
  });

  test('una conexión sin cable del catálogo avisa', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        conexiones: [conexion('c1', { articulo_cable_id: null })],
      }),
    );
    assert.equal(estadoDe(puntos, 'cable_articulo'), 'aviso');
  });

  test('los avisos de compatibilidad se cuentan con su identificador', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        filasCable: [fila('HD-1000'), fila('HD-1001', ['Salida contra salida.'])],
      }),
    );
    const punto = buscar(puntos, 'compatibilidad');
    assert.equal(punto.estado, 'aviso');
    assert.match(punto.detalle, /HD-1001/);
  });

  test('el material que falta bloquea y dice referencias y unidades', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        falta: falta({
          faltantes: [faltante('a-qb65', 1, 1), faltante('a-hdmi', 4, 2), faltante('a-cat6a', 2, 0)],
        }),
      }),
    );
    const punto = buscar(puntos, 'material');
    assert.equal(punto.estado, 'bloqueo');
    assert.match(punto.detalle, /Faltan 2 de 3 referencias/);
    assert.match(punto.detalle, /3 unidades/);
    assert.equal(resumirMontaje(puntos).estado, 'bloqueo');
  });

  test('sin almacén resuelto el material no aplica en vez de mentir', () => {
    const puntos = revisarMontaje(entradaCompleta({ falta: null }));
    assert.equal(estadoDe(puntos, 'material'), 'no_aplica');
    assert.equal(estadoDe(puntos, 'reservas'), 'no_aplica');
  });

  test('material sin reservar avisa: otra obra puede llevárselo', () => {
    const puntos = revisarMontaje(
      entradaCompleta({ falta: falta({ reservas: [] }) }),
    );
    const punto = buscar(puntos, 'reservas');
    assert.equal(punto.estado, 'aviso');
    assert.match(punto.detalle, /2 referencias/);
  });

  test('una reserva a medias no cubre la referencia', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        falta: falta({
          reservas: [
            { articulo_id: 'a-qb65', cantidad: 1, estado: 'activa' },
            { articulo_id: 'a-hdmi', cantidad: 1, estado: 'activa' },
          ],
        }),
      }),
    );
    assert.match(buscar(puntos, 'reservas').detalle, /1 de 2/);
  });

  test('una reserva liberada no cuenta como reservada', () => {
    const puntos = revisarMontaje(
      entradaCompleta({
        falta: falta({
          reservas: [
            { articulo_id: 'a-qb65', cantidad: 1, estado: 'liberada' },
            { articulo_id: 'a-hdmi', cantidad: 2, estado: 'liberada' },
          ],
        }),
      }),
    );
    assert.equal(estadoDe(puntos, 'reservas'), 'aviso');
  });

  test('sin lista de carga se avisa: nadie ha preparado la furgoneta', () => {
    const puntos = revisarMontaje(entradaCompleta({ cargas: [] }));
    assert.equal(estadoDe(puntos, 'carga'), 'aviso');
  });

  test('una carga cerrada no es una carga preparada', () => {
    const puntos = revisarMontaje(entradaCompleta({ cargas: [{ estado: 'cerrada' }] }));
    assert.equal(estadoDe(puntos, 'carga'), 'aviso');
  });

  test('las claves son estables y no se repiten', () => {
    const claves = revisarMontaje(entradaCompleta()).map((p) => p.clave);
    assert.equal(new Set(claves).size, claves.length);
    for (const clave of ['medidas', 'mesa', 'equipamiento', 'catalogo', 'conexiones',
      'cable', 'material', 'reservas', 'carga']) {
      assert.ok(claves.includes(clave), `falta la clave ${clave}`);
    }
  });

  test('todos los detalles llevan un número concreto', () => {
    const puntos = revisarMontaje(entradaCompleta());
    for (const p of puntos.filter((x) => x.estado !== 'no_aplica')) {
      assert.match(p.detalle, /\d/, `${p.clave} no da ningún número`);
    }
  });
});

describe('resumen del montaje', () => {
  const punto = (clave: string, estado: Semaforo): PuntoMontaje => ({
    clave,
    titulo: clave,
    estado,
    detalle: '',
  });

  test('el bloqueo manda sobre el aviso', () => {
    const r = resumirMontaje([
      punto('a', 'listo'),
      punto('b', 'aviso'),
      punto('c', 'bloqueo'),
    ]);
    assert.equal(r.estado, 'bloqueo');
    assert.deepEqual({ bloqueos: r.bloqueos, avisos: r.avisos, listos: r.listos }, {
      bloqueos: 1,
      avisos: 1,
      listos: 1,
    });
  });

  test('el aviso manda sobre lo listo', () => {
    assert.equal(
      resumirMontaje([punto('a', 'listo'), punto('b', 'aviso')]).estado,
      'aviso',
    );
  });

  test('los no_aplica no cuentan para nada', () => {
    const r = resumirMontaje([
      punto('a', 'listo'),
      punto('b', 'no_aplica'),
      punto('c', 'no_aplica'),
    ]);
    assert.deepEqual(r, { estado: 'listo', bloqueos: 0, avisos: 0, listos: 1 });
  });

  test('una lista vacía está lista: no hay nada que impida montar', () => {
    assert.deepEqual(resumirMontaje([]), {
      estado: 'listo',
      bloqueos: 0,
      avisos: 0,
      listos: 0,
    });
  });
});
