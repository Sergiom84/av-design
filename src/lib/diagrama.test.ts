import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  columnaDeEquipo,
  construirDiagrama,
  etiquetasDeEquipos,
  ladoDePuerto,
  MEDIDAS_DIAGRAMA,
  type EntradaDiagrama,
} from './diagrama';
import type { Conexion, EquipoEnSala, Puerto } from './tipos';

/**
 * El caso de referencia es la sala de telepresencia: caja de conexiones que
 * emite, códec que recibe y emite, y pantalla que solo recibe. Es el flujo de
 * las 144 salas iguales del inventario.
 */

const equipo = (id: string, nombre: string, articulo_id: string): EquipoEnSala => ({
  id,
  sala_id: 'sala-1',
  articulo_id,
  nombre,
  cantidad: 1,
  extremo: 'mesa',
  posicion: { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada: false,
});

const puerto = (
  id: string,
  articulo_id: string,
  nombre: string,
  sentido: Puerto['sentido'],
  senal: Puerto['senal'] = 'hdmi',
  orden: number | null = null,
): Puerto => ({
  id,
  articulo_id,
  nombre,
  total: 1,
  sentido,
  senal,
  conector: 'HDMI A',
  orden,
  notas: null,
  fuente: 'csv',
});

const conexion = (
  id: string,
  origen_id: string,
  destino_id: string,
  extra: Partial<Conexion> = {},
): Conexion => ({
  id,
  sala_id: 'sala-1',
  origen_id,
  destino_id,
  articulo_cable_id: null,
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  creado_en: `2026-01-0${id.length}`,
  ...extra,
});

/** Caja → códec → pantalla, con puertos conocidos en el tramo códec-pantalla. */
function entradaTipo(): EntradaDiagrama {
  const equipos = [
    equipo('e-caja', 'Caja de conexiones', 'a-caja'),
    equipo('e-codec', 'Codec Cisco', 'a-codec'),
    equipo('e-tv', 'Pantalla', 'a-tv'),
  ];
  const puertos = new Map<string, Puerto[]>([
    ['a-caja', [puerto('p-caja-out', 'a-caja', 'HDMI OUT', 'salida')]],
    [
      'a-codec',
      [
        puerto('p-codec-in', 'a-codec', 'HDMI IN 1', 'entrada', 'hdmi', 1),
        puerto('p-codec-out', 'a-codec', 'HDMI OUT 1', 'salida', 'hdmi', 2),
        puerto('p-codec-lan', 'a-codec', 'LAN PoE', 'bidireccional', 'red', 3),
      ],
    ],
    ['a-tv', [puerto('p-tv-in', 'a-tv', 'HDMI IP1', 'entrada')]],
  ]);
  const conexiones = [
    conexion('c1', 'e-caja', 'e-codec', { puerto_destino_id: 'p-codec-in' }),
    conexion('c22', 'e-codec', 'e-tv', {
      puerto_origen_id: 'p-codec-out',
      puerto_destino_id: 'p-tv-in',
    }),
  ];
  return { equipos, puertosPorArticulo: puertos, conexiones };
}

describe('ladoDePuerto', () => {
  it('entradas y control a la izquierda; salidas y bidireccionales a la derecha', () => {
    assert.equal(ladoDePuerto('entrada'), 'izquierda');
    assert.equal(ladoDePuerto('control'), 'izquierda');
    assert.equal(ladoDePuerto('salida'), 'derecha');
    assert.equal(ladoDePuerto('bidireccional'), 'derecha');
  });
});

describe('etiquetasDeEquipos', () => {
  it('un nombre único se queda como está', () => {
    const etiquetas = etiquetasDeEquipos([equipo('e1', 'Pantalla', 'a-tv')]);
    assert.equal(etiquetas.get('e1'), 'Pantalla');
  });

  it('los repetidos se numeran por orden de id, sin renumerar al borrar', () => {
    const dos = etiquetasDeEquipos([
      equipo('e2', 'Pantalla', 'a-tv'),
      equipo('e1', 'Pantalla', 'a-tv'),
    ]);
    assert.equal(dos.get('e1'), 'Pantalla 1');
    assert.equal(dos.get('e2'), 'Pantalla 2');
  });
});

describe('columnaDeEquipo', () => {
  const cs = [conexion('c1', 'e-caja', 'e-codec'), conexion('c22', 'e-codec', 'e-tv')];

  it('quien solo emite va a la primera columna', () => {
    assert.equal(columnaDeEquipo('e-caja', cs), 0);
  });
  it('quien emite y recibe va en medio', () => {
    assert.equal(columnaDeEquipo('e-codec', cs), 1);
  });
  it('quien solo recibe va a la derecha', () => {
    assert.equal(columnaDeEquipo('e-tv', cs), 2);
  });
  it('el equipo sin conexiones va a la última columna', () => {
    assert.equal(columnaDeEquipo('e-suelto', cs), 3);
  });
});

describe('construirDiagrama', () => {
  it('coloca cada bloque en su columna, de izquierda a derecha', () => {
    const escena = construirDiagrama(entradaTipo());
    const porId = new Map(escena.bloques.map((b) => [b.equipo_id, b]));
    const caja = porId.get('e-caja')!;
    const codec = porId.get('e-codec')!;
    const tv = porId.get('e-tv')!;
    assert.ok(caja.x < codec.x, 'la caja emite: columna anterior al códec');
    assert.ok(codec.x < tv.x, 'la pantalla solo recibe: última columna');
  });

  it('reparte los puertos del bloque entre entradas y salidas', () => {
    const escena = construirDiagrama(entradaTipo());
    const codec = escena.bloques.find((b) => b.equipo_id === 'e-codec')!;
    assert.deepEqual(
      codec.entradas.map((f) => f.nombre),
      ['HDMI IN 1'],
    );
    assert.deepEqual(
      codec.salidas.map((f) => f.nombre),
      ['HDMI OUT 1', 'LAN PoE'],
    );
  });

  it('el alto del bloque crece con las filas del lado más poblado', () => {
    const escena = construirDiagrama(entradaTipo());
    const codec = escena.bloques.find((b) => b.equipo_id === 'e-codec')!;
    const tv = escena.bloques.find((b) => b.equipo_id === 'e-tv')!;
    const m = MEDIDAS_DIAGRAMA;
    assert.equal(codec.alto, m.alto_cabecera + 2 * m.alto_fila + m.alto_pie);
    assert.equal(tv.alto, m.alto_cabecera + 1 * m.alto_fila + m.alto_pie);
  });

  it('con soloConectados desaparecen los puertos sin cable, no los bloques', () => {
    const escena = construirDiagrama({ ...entradaTipo(), soloConectados: true });
    const codec = escena.bloques.find((b) => b.equipo_id === 'e-codec')!;
    // LAN PoE no tiene cable: fuera. HDMI IN 1 y OUT 1 sí.
    assert.deepEqual(
      codec.salidas.map((f) => f.nombre),
      ['HDMI OUT 1'],
    );
    assert.equal(escena.bloques.length, 3);
  });

  it('la línea lleva el identificador de la tabla de cables y sale y entra por los puertos', () => {
    const escena = construirDiagrama(entradaTipo());
    // c1 se creó antes que c22: HD-1000 y HD-1001, como en la tabla de cables.
    const l1 = escena.lineas.find((l) => l.conexion_id === 'c1')!;
    const l2 = escena.lineas.find((l) => l.conexion_id === 'c22')!;
    assert.equal(l1.identificador, 'HD-1000');
    assert.equal(l2.identificador, 'HD-1001');

    const codec = escena.bloques.find((b) => b.equipo_id === 'e-codec')!;
    const tv = escena.bloques.find((b) => b.equipo_id === 'e-tv')!;
    const salida = codec.salidas.find((f) => f.nombre === 'HDMI OUT 1')!;
    const entrada = tv.entradas.find((f) => f.nombre === 'HDMI IP1' || f.nombre === 'HDMI IN 1')!;
    const primero = l2.puntos[0];
    const ultimo = l2.puntos[l2.puntos.length - 1];
    assert.equal(primero.y, salida.y, 'sale a la altura de la fila del puerto de origen');
    assert.equal(ultimo.y, entrada.y, 'entra a la altura de la fila del puerto de destino');
    assert.ok(primero.x > codec.x + codec.ancho, 'sale por el lado derecho del bloque');
    assert.ok(ultimo.x < tv.x, 'entra por el lado izquierdo del bloque');
  });

  it('la ruta es ortogonal: solo tramos horizontales o verticales', () => {
    const escena = construirDiagrama(entradaTipo());
    for (const linea of escena.lineas) {
      for (let i = 1; i < linea.puntos.length; i++) {
        const a = linea.puntos[i - 1];
        const b = linea.puntos[i];
        assert.ok(
          a.x === b.x || a.y === b.y,
          `tramo diagonal en ${linea.identificador}`,
        );
      }
    }
  });

  it('una conexión con un extremo que no está en la sala se cuenta como omitida', () => {
    const entrada = entradaTipo();
    entrada.conexiones.push(conexion('c333', 'e-codec', 'e-fantasma'));
    const escena = construirDiagrama(entrada);
    assert.equal(escena.omitidas, 1);
    assert.equal(escena.lineas.length, 2);
  });

  it('sin equipos la escena queda vacía y con medidas mínimas', () => {
    const escena = construirDiagrama({
      equipos: [],
      puertosPorArticulo: new Map(),
      conexiones: [],
    });
    assert.equal(escena.bloques.length, 0);
    assert.equal(escena.lineas.length, 0);
    assert.ok(escena.ancho > 0 && escena.alto > 0);
  });

  it('un equipo sin puertos en el catálogo sigue teniendo bloque', () => {
    const entrada = entradaTipo();
    entrada.puertosPorArticulo.delete('a-caja');
    const escena = construirDiagrama(entrada);
    const caja = escena.bloques.find((b) => b.equipo_id === 'e-caja')!;
    assert.ok(caja, 'el bloque existe aunque el catálogo no tenga puertos');
    assert.equal(caja.entradas.length + caja.salidas.length, 0);
    // Y su cable sale igualmente, a media cabecera.
    assert.equal(escena.lineas.length, 2);
  });
});
