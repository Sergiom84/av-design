import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  construirEscena,
  mesaDeLaSala,
  proyectar,
  sillasAlrededor,
  type Rectangulo,
} from './croquis';
import type { Conexion, EquipoEnSala, Sala } from './tipos';

/**
 * La sala de referencia es la Sala de Batería 006, medida a mano por el
 * departamento: 4,70 × 2,50, mesa de 2,40 × 1,21 a 73 cm, aforo 8, pantalla a
 * 74 cm y caja de conexiones a 2,40 m de la pared de la pantalla. Si el croquis
 * de esa sala sale bien, sale el de las 144 salas iguales.
 */
const SALA_BATERIA: Sala = {
  id: 'sala-1',
  sede_id: null,
  localizacion_id: null,
  edificio: null,
  nivel: null,
  codigo: 'BAT-006',
  nombre: 'Sala de Batería 006',
  tipologia: 'SALA TP',
  aforo: 8,
  plantilla_id: null,
  largo_m: 4.7,
  ancho_m: 2.5,
  alto_m: 2.7,
  alto_falso_techo_m: 2.4,
  alto_canaleta_m: 0.3,
  alto_suelo_tecnico_m: 0,
  ruta_por_defecto: 'falso_techo',
  notas: null,
  mesa_largo_m: 2.4,
  mesa_ancho_m: 1.21,
  mesa_alto_cm: 73,
  mesa_x_m: null,
  mesa_y_m: null,
};

const equipo = (
  id: string,
  nombre: string,
  extremo: EquipoEnSala['extremo'],
  posicion = { x_m: 0, y_m: 0, z_m: 0 },
): EquipoEnSala => ({
  id,
  sala_id: 'sala-1',
  articulo_id: `art-${id}`,
  nombre,
  cantidad: 1,
  extremo,
  posicion,
});

const conexion = (id: string, origen: string, destino: string): Conexion => ({
  id,
  sala_id: 'sala-1',
  origen_id: origen,
  destino_id: destino,
  articulo_cable_id: null,
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
});

describe('la mesa del croquis', () => {
  it('sin medidas no hay mesa', () => {
    assert.equal(mesaDeLaSala({ ...SALA_BATERIA, mesa_largo_m: null }), null);
    assert.equal(mesaDeLaSala({ ...SALA_BATERIA, mesa_ancho_m: null }), null);
  });

  it('sin centro escrito va centrada en la sala', () => {
    const mesa = mesaDeLaSala(SALA_BATERIA)!;
    // 4,70 / 2 − 2,40 / 2 = 1,15   ·   2,50 / 2 − 1,21 / 2 = 0,645
    assert.equal(mesa.x_m, 1.15);
    assert.equal(mesa.y_m, 0.65);
    assert.equal(mesa.largo_m, 2.4);
    assert.equal(mesa.ancho_m, 1.21);
  });

  it('el centro escrito manda sobre el centrado', () => {
    const mesa = mesaDeLaSala({ ...SALA_BATERIA, mesa_x_m: 3, mesa_y_m: 1 })!;
    assert.equal(mesa.x_m, 1.8);
    assert.equal(mesa.y_m, 0.4);
  });
});

describe('las sillas alrededor de la mesa', () => {
  const mesa: Rectangulo = { x_m: 1.15, y_m: 0.65, largo_m: 2.4, ancho_m: 1.21 };

  it('aforo 8 se sienta 3 + 3 + 1 + 1, como en el croquis de mano', () => {
    const sillas = sillasAlrededor(mesa, 8);
    assert.equal(sillas.length, 8);

    const arriba = sillas.filter((s) => s.y_m > mesa.y_m + mesa.ancho_m);
    const abajo = sillas.filter((s) => s.y_m < mesa.y_m);
    const cabeceras = sillas.filter(
      (s) => s.x_m < mesa.x_m || s.x_m > mesa.x_m + mesa.largo_m,
    );
    assert.equal(arriba.length, 3);
    assert.equal(abajo.length, 3);
    assert.equal(cabeceras.length, 2);
  });

  it('aforo impar reparte el sobrante arriba, no lo pierde', () => {
    const sillas = sillasAlrededor(mesa, 7);
    assert.equal(sillas.length, 7);
  });

  it('una sala de dos no tiene cabeceras: se sientan enfrentados', () => {
    const sillas = sillasAlrededor(mesa, 2);
    assert.equal(sillas.length, 2);
    const cabeceras = sillas.filter(
      (s) => s.x_m < mesa.x_m || s.x_m > mesa.x_m + mesa.largo_m,
    );
    assert.equal(cabeceras.length, 0);
  });

  it('las sillas no se solapan con la mesa', () => {
    for (const s of sillasAlrededor(mesa, 8)) {
      const dentroX = s.x_m > mesa.x_m && s.x_m < mesa.x_m + mesa.largo_m;
      const dentroY = s.y_m > mesa.y_m && s.y_m < mesa.y_m + mesa.ancho_m;
      assert.ok(!(dentroX && dentroY), `silla dentro de la mesa: ${s.x_m}, ${s.y_m}`);
    }
  });

  it('sin aforo no hay sillas', () => {
    assert.deepEqual(sillasAlrededor(mesa, 0), []);
  });
});

describe('la escena completa', () => {
  const equipos = [
    equipo('tv', 'Samsung QB65R-B', 'pantalla'),
    equipo('caja', 'Caja de conexiones mesa', 'caja_conexiones'),
  ];

  it('la Sala de Batería sale entera: sala, mesa, ocho sillas y dos equipos', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [conexion('c1', 'tv', 'caja')],
      tomas: [],
    });

    assert.equal(escena.sala.largo_m, 4.7);
    assert.equal(escena.mesa?.largo_m, 2.4);
    assert.equal(escena.sillas.length, 8);
    assert.equal(escena.equipos.length, 2);
    assert.equal(escena.tiradas.length, 1);
  });

  it('un equipo sin posición se coloca donde suele ir y queda marcado', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [],
      tomas: [],
    });

    const tv = escena.equipos.find((e) => e.id === 'tv')!;
    assert.equal(tv.estimada, true);
    assert.equal(tv.x_m, 0, 'la pantalla va en el testero');
    assert.equal(tv.y_m, 1.25);

    const caja = escena.equipos.find((e) => e.id === 'caja')!;
    assert.equal(caja.estimada, true);
    assert.equal(caja.x_m, 2.35, 'la caja va en el centro de la mesa');

    assert.ok(escena.avisos.some((a) => a.includes('posición')));
  });

  it('dos equipos deducidos en el mismo punto se separan, no se pisan', () => {
    // La SALA TP de aforo 8 lleva caja de conexiones y panel táctil, y los dos
    // se deducen al centro de la mesa: uno encima de otro no se lee.
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [
        equipo('caja', 'AMX', 'caja_conexiones'),
        equipo('panel', 'Cisco Room Navigator', 'mesa'),
      ],
      conexiones: [],
      tomas: [],
    });

    const [a, b] = escena.equipos;
    assert.notEqual(a.y_m, b.y_m);
    assert.ok(Math.abs(a.y_m - b.y_m) >= 0.3, 'quedan demasiado juntos');
    // Siguen sobre la mesa: separarlos no puede echarlos fuera.
    const mesa = escena.mesa!;
    for (const e of [a, b]) {
      assert.ok(e.y_m > mesa.y_m && e.y_m < mesa.y_m + mesa.ancho_m);
    }
  });

  it('separarlos no mueve la cota de la tirada, que se mide en x', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [
        equipo('tv', 'Samsung QB65R-B', 'pantalla'),
        equipo('caja', 'AMX', 'caja_conexiones'),
        equipo('panel', 'Cisco Room Navigator', 'mesa'),
      ],
      conexiones: [],
      tomas: [],
    });

    assert.equal(
      escena.cotas.find((c) => c.clave === 'pantalla_caja')?.texto,
      '2,35 m',
    );
  });

  it('separar equipos no mueve al que tiene posición medida', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [
        equipo('caja', 'AMX', 'caja_conexiones'),
        equipo('panel', 'Panel', 'mesa', { x_m: 2.35, y_m: 1.25, z_m: 0.73 }),
      ],
      conexiones: [],
      tomas: [],
    });

    const panel = escena.equipos.find((e) => e.id === 'panel')!;
    assert.equal(panel.x_m, 2.35, 'una posición medida no se toca');
  });

  it('la posición escrita manda y no se marca como estimada', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [equipo('tv', 'Pantalla', 'pantalla', { x_m: 0, y_m: 2, z_m: 0.74 })],
      conexiones: [],
      tomas: [],
    });

    const tv = escena.equipos[0];
    assert.equal(tv.estimada, false);
    assert.equal(tv.y_m, 2);
  });

  it('cota de pantalla a caja: 2,35 m en esta sala, que es la tirada larga', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [],
      tomas: [],
    });

    const cota = escena.cotas.find((c) => c.clave === 'pantalla_caja');
    assert.ok(cota, 'falta la cota de la tirada larga');
    assert.equal(cota!.texto, '2,35 m');
  });

  it('las cotas de la sala se escriben con dos decimales y coma', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [],
      conexiones: [],
      tomas: [],
    });

    assert.equal(escena.cotas.find((c) => c.clave === 'sala_largo')?.texto, '4,70 m');
    assert.equal(escena.cotas.find((c) => c.clave === 'sala_ancho')?.texto, '2,50 m');
  });

  it('las alturas van al pie, porque una planta no las enseña', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [],
      tomas: [],
    });

    assert.ok(escena.anotaciones.some((a) => a.includes('73 cm')));
    assert.ok(escena.anotaciones.some((a) => a.includes('74 cm')));
    assert.ok(escena.anotaciones.some((a) => a.includes('Falso techo')));
  });

  it('la tirada lleva los metros calculados cuando los hay', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [conexion('c1', 'tv', 'caja')],
      tomas: [],
      metrosPorConexion: new Map([['c1', 7.4]]),
    });

    assert.equal(escena.tiradas[0].metros, 7.4);
  });

  it('una conexión a un equipo que ya no está no rompe el dibujo', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos,
      conexiones: [conexion('c1', 'tv', 'fantasma')],
      tomas: [],
    });

    assert.deepEqual(escena.tiradas, []);
  });

  it('una sala sin medir devuelve escena con avisos, no un error', () => {
    const escena = construirEscena({
      sala: { ...SALA_BATERIA, largo_m: 0, ancho_m: 0, mesa_largo_m: null },
      equipos: [],
      conexiones: [],
      tomas: [],
    });

    assert.equal(escena.mesa, null);
    assert.equal(escena.sillas.length, 0);
    assert.ok(escena.avisos.length >= 2);
  });

  it('solo se dibujan las rosetas cuya posición se conoce', () => {
    const escena = construirEscena({
      sala: SALA_BATERIA,
      equipos: [],
      conexiones: [],
      tomas: [
        {
          id: 't1',
          sala_id: 'sala-1',
          codigo: '15',
          ubicacion: 'suelo',
          x_m: 1,
          y_m: 1,
          z_m: 0,
          notas: null,
        },
        {
          id: 't2',
          sala_id: 'sala-1',
          codigo: '16',
          ubicacion: 'pared',
          x_m: null,
          y_m: null,
          z_m: null,
          notas: null,
        },
      ],
    });

    assert.equal(escena.tomas.length, 1);
    assert.equal(escena.tomas[0].codigo, '15');
  });
});

describe('la proyección a píxeles', () => {
  const escena = construirEscena({
    sala: SALA_BATERIA,
    equipos: [],
    conexiones: [],
    tomas: [],
  });

  it('el dibujo mantiene la proporción de la sala', () => {
    const p = proyectar(escena, { ancho_px: 900, margen_px: 50 });
    const largoDibujado = p.x(4.7) - p.x(0);
    const anchoDibujado = p.y(0) - p.y(2.5);
    assert.ok(Math.abs(largoDibujado / anchoDibujado - 4.7 / 2.5) < 0.01);
  });

  it('la sala entera cabe dentro del lienzo con su margen', () => {
    const p = proyectar(escena, { ancho_px: 900, margen_px: 50 });
    assert.equal(p.x(0), 50);
    assert.equal(p.x(4.7), 850);
    assert.equal(p.y(2.5), 50);
    assert.ok(p.y(0) <= p.alto_px - 50);
  });

  it('el eje vertical se invierte: el fondo de la sala se dibuja arriba', () => {
    const p = proyectar(escena);
    assert.ok(p.y(2.5) < p.y(0));
  });

  it('una sala sin medidas no divide por cero', () => {
    const vacia = construirEscena({
      sala: { ...SALA_BATERIA, largo_m: 0, ancho_m: 0 },
      equipos: [],
      conexiones: [],
      tomas: [],
    });
    const p = proyectar(vacia);
    assert.ok(Number.isFinite(p.escala));
    assert.ok(p.alto_px > 0);
  });
});
