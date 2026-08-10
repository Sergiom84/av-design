import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MARGEN_FUERA_M,
  PASO_FINO_M,
  PASO_REJILLA_M,
  acercar,
  afectaAlCalculo,
  ajustarARejilla,
  avisosDelBorrador,
  borradorDesde,
  cambiarMedidasSala,
  comoViewBox,
  confirmarEstimadas,
  construirPatch,
  dentroDeLaSala,
  desplazamientoDeTecla,
  desplazarEquipo,
  desplazarMesa,
  desplazarToma,
  editarEquipo,
  editarToma,
  girarMesa,
  hayCambios,
  limitar,
  limitarALaSala,
  moverEquipo,
  moverMesa,
  moverToma,
  vistaCompleta,
  zoomDe,
  type BorradorPlano,
} from './plano-editor';
import type { EquipoEnSala, Sala, TomaRed } from './tipos';

/**
 * La misma Sala de Batería 006 del croquis: 4,70 × 2,50 × 2,70, mesa de
 * 2,40 × 1,21 y aforo 8. Si el editor se porta bien con ella se porta bien con
 * las 144 salas iguales del inventario.
 */
const SALA: Sala = {
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
  mesa_rotacion_grados: 0,
  diagrama_version: 3,
};

const equipo = (
  id: string,
  posicion = { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada = false,
): EquipoEnSala => ({
  id,
  sala_id: 'sala-1',
  articulo_id: `art-${id}`,
  nombre: id,
  cantidad: 1,
  extremo: 'pared',
  posicion,
  posicion_confirmada,
  toma_red_id: null,
});

const toma = (id: string, x: number | null = null, y: number | null = null): TomaRed => ({
  id,
  sala_id: 'sala-1',
  codigo: id,
  ubicacion: 'suelo',
  x_m: x,
  y_m: y,
  z_m: null,
  notas: null,
});

const base = (): BorradorPlano =>
  borradorDesde(
    SALA,
    [equipo('tv'), equipo('caja', { x_m: 2.35, y_m: 1.25, z_m: 0.73 }, true)],
    [toma('12', 3, 2), toma('13')],
  );

describe('el borrador de partida', () => {
  it('copia la sala, sus equipos y sus rosetas sin tocar nada', () => {
    const b = base();
    assert.equal(b.largo_m, 4.7);
    assert.equal(b.mesa_x_m, null, 'la mesa centrada sigue sin centro escrito');
    assert.equal(b.equipos.length, 2);
    assert.equal(b.equipos[0].posicion_confirmada, false);
    assert.equal(b.equipos[1].posicion_confirmada, true);
    assert.equal(b.tomas[1].x_m, null, 'una roseta sin situar sigue sin situar');
  });

  it('normaliza el giro de la mesa al entrar', () => {
    assert.equal(borradorDesde({ ...SALA, mesa_rotacion_grados: -90 }, [], []).mesa_rotacion_grados, 270);
  });
});

describe('la rejilla', () => {
  it('ajusta al múltiplo más cercano', () => {
    assert.equal(ajustarARejilla(2.34), 2.3);
    assert.equal(ajustarARejilla(2.36), 2.4);
    assert.equal(ajustarARejilla(2.35), 2.4, 'el medio paso sube');
  });

  it('el cero se queda en cero, no se desplaza medio paso', () => {
    assert.equal(ajustarARejilla(0), 0);
    assert.equal(ajustarARejilla(0.04), 0);
  });

  it('los negativos ajustan hacia su lado, y el cero es cero', () => {
    assert.equal(ajustarARejilla(-0.16), -0.2);
    // Sin normalizar, esto devolvía `-0`: se guarda igual pero rompe cualquier
    // comparación y mandaría al servidor un cambio que no cambia nada.
    assert.ok(Object.is(ajustarARejilla(-0.04), 0));
  });

  it('el paso fino llega al centímetro', () => {
    assert.equal(ajustarARejilla(2.347, PASO_FINO_M), 2.35);
  });

  it('un paso imposible no devuelve NaN: redondea al centímetro', () => {
    assert.equal(ajustarARejilla(2.347, 0), 2.35);
    assert.equal(ajustarARejilla(2.347, -1), 2.35);
    assert.equal(ajustarARejilla(2.347, Number.NaN), 2.35);
  });

  it('un valor no finito cae a cero y no se propaga', () => {
    assert.equal(ajustarARejilla(Number.NaN), 0);
    assert.equal(ajustarARejilla(Number.POSITIVE_INFINITY), 0);
  });
});

describe('los límites de la sala', () => {
  it('recorta lo que se sale por cada lado', () => {
    assert.deepEqual(limitarALaSala({ x_m: -3, y_m: 9 }, SALA), { x_m: 0, y_m: 2.5, z_m: 0 });
    assert.deepEqual(limitarALaSala({ x_m: 99, y_m: -1 }, SALA), { x_m: 4.7, y_m: 0, z_m: 0 });
  });

  it('el borde es válido: una pantalla va pegada al testero', () => {
    assert.deepEqual(limitarALaSala({ x_m: 0, y_m: 2.5, z_m: 2.7 }, SALA), {
      x_m: 0,
      y_m: 2.5,
      z_m: 2.7,
    });
    assert.equal(dentroDeLaSala({ x_m: 0, y_m: 0 }, SALA), true);
    assert.equal(dentroDeLaSala({ x_m: 4.7, y_m: 2.5 }, SALA), true);
  });

  it('el margen es cero: el ancla no sale de la sala aunque el símbolo sí', () => {
    assert.equal(MARGEN_FUERA_M, 0);
    assert.equal(dentroDeLaSala({ x_m: -0.01, y_m: 1 }, SALA), false);
    assert.equal(dentroDeLaSala({ x_m: 4.71, y_m: 1 }, SALA), false);
  });

  it('la z se recorta al alto de la sala', () => {
    assert.equal(limitarALaSala({ x_m: 1, y_m: 1, z_m: 9 }, SALA).z_m, 2.7);
    assert.equal(limitarALaSala({ x_m: 1, y_m: 1, z_m: -4 }, SALA).z_m, 0);
  });

  it('una sala sin medir no recorta: amontonarlo todo en la esquina es peor', () => {
    const sinMedir = { largo_m: 0, ancho_m: 0, alto_m: 0 };
    assert.deepEqual(limitarALaSala({ x_m: 3, y_m: 4, z_m: 2 }, sinMedir), {
      x_m: 3,
      y_m: 4,
      z_m: 2,
    });
    assert.equal(dentroDeLaSala({ x_m: 30, y_m: 40 }, sinMedir), true);
  });

  it('un no finito cae al mínimo en vez de propagarse', () => {
    assert.deepEqual(limitarALaSala({ x_m: Number.NaN, y_m: 1 }, SALA), {
      x_m: 0,
      y_m: 1,
      z_m: 0,
    });
    assert.equal(dentroDeLaSala({ x_m: Number.NaN, y_m: 1 }, SALA), false);
    assert.equal(limitar(Number.NaN, 2, 5), 2);
  });
});

describe('mover un equipo', () => {
  it('lo coloca ajustado a rejilla y lo da por confirmado', () => {
    const b = moverEquipo(base(), 'tv', { x_m: 1.23, y_m: 0.77 });
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.equal(tv.x_m, 1.2);
    assert.equal(tv.y_m, 0.8);
    assert.equal(tv.posicion_confirmada, true, 'arrastrarlo es colocarlo');
  });

  it('el origen queda confirmado: la esquina es un sitio, no un hueco', () => {
    const b = moverEquipo(base(), 'tv', { x_m: 0.02, y_m: -1 });
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.deepEqual([tv.x_m, tv.y_m], [0, 0]);
    assert.equal(tv.posicion_confirmada, true);
  });

  it('sin ajuste respeta el centímetro exacto que se pidió', () => {
    const b = moverEquipo(base(), 'tv', { x_m: 1.23, y_m: 0.77 }, { ajustar: false });
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.deepEqual([tv.x_m, tv.y_m], [1.23, 0.77]);
  });

  it('no toca los demás equipos ni el borrador original', () => {
    const antes = base();
    const b = moverEquipo(antes, 'tv', { x_m: 1, y_m: 1 });
    assert.notEqual(b, antes);
    assert.equal(antes.equipos.find((e) => e.id === 'tv')!.x_m, 0, 'el original no se muta');
    assert.equal(
      b.equipos.find((e) => e.id === 'caja'),
      antes.equipos.find((e) => e.id === 'caja'),
      'el equipo que no se movió es la misma referencia',
    );
  });

  it('un id que no existe devuelve el mismo borrador', () => {
    const antes = base();
    assert.equal(moverEquipo(antes, 'no-existe', { x_m: 1, y_m: 1 }), antes);
  });
});

describe('el teclado', () => {
  it('cada flecha mueve un paso de rejilla, y arriba suma en y', () => {
    assert.deepEqual(desplazamientoDeTecla('ArrowUp'), { dx_m: 0, dy_m: PASO_REJILLA_M });
    assert.deepEqual(desplazamientoDeTecla('ArrowDown'), { dx_m: 0, dy_m: -PASO_REJILLA_M });
    assert.deepEqual(desplazamientoDeTecla('ArrowLeft'), { dx_m: -PASO_REJILLA_M, dy_m: 0 });
    assert.deepEqual(desplazamientoDeTecla('ArrowRight'), { dx_m: PASO_REJILLA_M, dy_m: 0 });
  });

  it('con modificador el paso es fino', () => {
    assert.deepEqual(desplazamientoDeTecla('ArrowRight', true), { dx_m: PASO_FINO_M, dy_m: 0 });
  });

  it('lo que no es flecha no se consume', () => {
    assert.equal(desplazamientoDeTecla('Enter'), null);
    assert.equal(desplazamientoDeTecla('a'), null);
  });

  it('el paso fino no se pierde contra la rejilla', () => {
    const b = desplazarEquipo(base(), 'caja', { dx_m: PASO_FINO_M, dy_m: 0 }, {
      ajustar: false,
    });
    assert.equal(b.equipos.find((e) => e.id === 'caja')!.x_m, 2.36);
  });

  it('la flecha horizontal no toca la y, aunque esté fuera de rejilla', () => {
    // La caja está en (2,35 · 1,25). Ajustar los dos ejes le corría 5 cm la y
    // en cada pulsación horizontal: un movimiento que nadie pidió sobre un
    // dato que alguien midió.
    const b = desplazarEquipo(base(), 'caja', { dx_m: PASO_REJILLA_M, dy_m: 0 });
    const caja = b.equipos.find((e) => e.id === 'caja')!;
    assert.equal(caja.y_m, 1.25, 'la y se queda exactamente donde estaba');
    // 2,35 + 0,10 = 2,45, que ajusta a 2,50: la rejilla se aplica al destino.
    assert.equal(caja.x_m, 2.5, 'la x sí se ajusta a la rejilla');
  });

  it('la flecha vertical, al revés', () => {
    const caja = desplazarEquipo(base(), 'caja', { dx_m: 0, dy_m: PASO_REJILLA_M })
      .equipos.find((e) => e.id === 'caja')!;
    assert.equal(caja.x_m, 2.35);
    assert.equal(caja.y_m, 1.4);
  });

  it('la mesa y las rosetas se desplazan con la misma regla', () => {
    const b = desplazarMesa(base(), { dx_m: PASO_REJILLA_M, dy_m: 0 });
    assert.equal(b.mesa_x_m, 2.5);
    assert.equal(b.mesa_y_m, 1.25, 'el centro de la mesa conserva su y');

    const t = desplazarToma(base(), '12', { dx_m: 0, dy_m: PASO_REJILLA_M })
      .tomas.find((x) => x.id === '12')!;
    assert.deepEqual([t.x_m, t.y_m], [3, 2.1]);
  });

  it('una roseta sin situar no se mueve: no está en ningún sitio', () => {
    const antes = base();
    assert.equal(desplazarToma(antes, '13', { dx_m: PASO_REJILLA_M, dy_m: 0 }), antes);
  });

  it('contra la pared el equipo se para, no se sale', () => {
    let b = moverEquipo(base(), 'tv', { x_m: 4.7, y_m: 1 });
    for (let i = 0; i < 5; i += 1) b = desplazarEquipo(b, 'tv', { dx_m: PASO_REJILLA_M, dy_m: 0 });
    assert.equal(b.equipos.find((e) => e.id === 'tv')!.x_m, 4.7);
  });
});

describe('confirmar las posiciones estimadas', () => {
  it('adopta lo que dibuja el croquis y deja de estimarlas', () => {
    const b = confirmarEstimadas(
      base(),
      new Map([['tv', { x_m: 0, y_m: 1.25, z_m: 0.74 }]]),
    );
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.deepEqual([tv.x_m, tv.y_m, tv.z_m], [0, 1.25, 0.74]);
    assert.equal(tv.posicion_confirmada, true);
  });

  it('no toca las que ya estaban confirmadas', () => {
    const b = confirmarEstimadas(
      base(),
      new Map([['caja', { x_m: 9, y_m: 9, z_m: 9 }]]),
    );
    assert.equal(b.equipos.find((e) => e.id === 'caja')!.x_m, 2.35);
  });

  it('un equipo sin posición dibujada se queda como estaba', () => {
    const b = confirmarEstimadas(base(), new Map());
    assert.equal(b.equipos.find((e) => e.id === 'tv')!.posicion_confirmada, false);
  });
});

describe('las rosetas', () => {
  it('se sitúan como un equipo', () => {
    const b = moverToma(base(), '13', { x_m: 1.24, y_m: 0.31 });
    const t = b.tomas.find((x) => x.id === '13')!;
    assert.deepEqual([t.x_m, t.y_m], [1.2, 0.3]);
  });

  it('borrar la coordenada la saca del plano sin borrar la roseta', () => {
    const b = editarToma(base(), '12', { x_m: null });
    const t = b.tomas.find((x) => x.id === '12')!;
    assert.equal(t.x_m, null);
    assert.equal(t.y_m, null, 'media roseta situada no se dibuja');
    assert.equal(t.codigo, '12', 'la roseta sigue existiendo');
  });
});

describe('la mesa', () => {
  it('se mueve por su centro y se ajusta a rejilla', () => {
    const b = moverMesa(base(), { x_m: 2.37, y_m: 1.22 });
    assert.deepEqual([b.mesa_x_m, b.mesa_y_m], [2.4, 1.2]);
  });

  it('sin medidas de mesa no hay nada que mover', () => {
    const sinMesa = { ...base(), mesa_largo_m: null };
    assert.equal(moverMesa(sinMesa, { x_m: 1, y_m: 1 }), sinMesa);
  });

  it('el giro se normaliza a [0, 360)', () => {
    assert.equal(girarMesa(base(), -90).mesa_rotacion_grados, 270);
    assert.equal(girarMesa(base(), 360).mesa_rotacion_grados, 0);
    assert.equal(girarMesa(base(), Number.NaN).mesa_rotacion_grados, 0);
  });
});

describe('cambiar las medidas de la sala', () => {
  it('encogerla arrastra dentro lo que se queda fuera', () => {
    const b = cambiarMedidasSala(
      moverEquipo(base(), 'tv', { x_m: 4.5, y_m: 2.4 }),
      { largo_m: 3, ancho_m: 2 },
    );
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.deepEqual([tv.x_m, tv.y_m], [3, 2]);
    const t = b.tomas.find((x) => x.id === '12')!;
    assert.deepEqual([t.x_m, t.y_m], [3, 2]);
  });

  it('una roseta sin situar sigue sin situar al cambiar las medidas', () => {
    const b = cambiarMedidasSala(base(), { largo_m: 3 });
    assert.equal(b.tomas.find((x) => x.id === '13')!.x_m, null);
  });

  it('una medida imposible es cero, no NaN', () => {
    assert.equal(cambiarMedidasSala(base(), { largo_m: Number.NaN }).largo_m, 0);
    assert.equal(cambiarMedidasSala(base(), { largo_m: -4 }).largo_m, 0);
  });

  it('el aforo se puede vaciar sin que vuelva al anterior', () => {
    assert.equal(cambiarMedidasSala(base(), { aforo: null }).aforo, null);
    assert.equal(cambiarMedidasSala(base(), {}).aforo, 8);
  });
});

describe('los avisos', () => {
  it('avisan de lo que falta por medir', () => {
    const avisos = avisosDelBorrador({ ...base(), largo_m: 0, alto_m: 0 });
    assert.ok(avisos.some((a) => a.includes('largo')));
    assert.ok(avisos.some((a) => a.includes('alto')));
  });

  it('cuentan los equipos que siguen estimados', () => {
    assert.ok(avisosDelBorrador(base()).some((a) => a.includes('estimada')));
  });

  it('la sala medida y colocada no tiene nada que decir', () => {
    const b = moverEquipo(base(), 'tv', { x_m: 1, y_m: 1 });
    assert.deepEqual(avisosDelBorrador(b), []);
  });

  it('un equipo que quedó fuera se nombra', () => {
    const b = { ...base(), equipos: base().equipos.map((e) => ({ ...e, x_m: 99, posicion_confirmada: true })) };
    assert.ok(avisosDelBorrador(b).some((a) => a.includes('fuera de la sala')));
  });
});

describe('el patch que viaja al servidor', () => {
  it('sin cambios no manda nada y el botón se queda apagado', () => {
    const original = base();
    const patch = construirPatch('sala-1', 3, original, original);
    assert.equal(patch.sala, null);
    assert.deepEqual(patch.equipos, []);
    assert.deepEqual(patch.tomas, []);
    assert.equal(hayCambios(patch), false);
  });

  it('solo viaja lo que cambió', () => {
    const original = base();
    const patch = construirPatch('sala-1', 3, original, moverEquipo(original, 'tv', { x_m: 1, y_m: 1 }));
    assert.equal(patch.equipos.length, 1);
    assert.equal(patch.equipos[0].id, 'tv');
    assert.equal(patch.sala, null, 'no se tocó la sala');
    assert.equal(hayCambios(patch), true);
  });

  it('lleva la versión que se leyó, que es la guarda contra la otra pestaña', () => {
    assert.equal(construirPatch('sala-1', 3, base(), base()).versionEsperada, 3);
  });

  it('confirmar una posición estimada viaja aunque no cambien las coordenadas', () => {
    const original = base();
    const b = confirmarEstimadas(original, new Map([['tv', { x_m: 0, y_m: 0, z_m: 0 }]]));
    const patch = construirPatch('sala-1', 3, original, b);
    assert.equal(patch.equipos.length, 1);
    assert.equal(patch.equipos[0].posicion_confirmada, true);
    assert.deepEqual([patch.equipos[0].x_m, patch.equipos[0].y_m], [0, 0]);
  });

  it('mover la mesa manda la sala entera del plano', () => {
    const original = base();
    const patch = construirPatch('sala-1', 3, original, moverMesa(original, { x_m: 2, y_m: 1 }));
    assert.equal(patch.sala?.mesa_x_m, 2);
    assert.equal(patch.sala?.largo_m, 4.7);
  });

  it('quitar la coordenada de una roseta viaja como nulo', () => {
    const original = base();
    const patch = construirPatch('sala-1', 3, original, editarToma(original, '12', { x_m: null }));
    assert.deepEqual(patch.tomas, [{ id: '12', x_m: null, y_m: null, z_m: null }]);
  });
});

describe('qué cambia los metros de cable', () => {
  it('mover un equipo, sí', () => {
    const original = base();
    assert.equal(afectaAlCalculo(original, moverEquipo(original, 'tv', { x_m: 1, y_m: 1 })), true);
  });

  it('cambiar el alto de la sala, sí: cambia la subida al falso techo', () => {
    const original = base();
    assert.equal(afectaAlCalculo(original, cambiarMedidasSala(original, { alto_m: 3 })), true);
  });

  it('mover la mesa o cambiar el aforo, no', () => {
    const original = base();
    assert.equal(afectaAlCalculo(original, moverMesa(original, { x_m: 2, y_m: 1 })), false);
    assert.equal(afectaAlCalculo(original, cambiarMedidasSala(original, { aforo: 4 })), false);
  });
});

describe('el inspector numérico', () => {
  it('escribir una coordenada equivale a arrastrar', () => {
    const b = editarEquipo(base(), 'tv', { x_m: 2 });
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.equal(tv.x_m, 2);
    assert.equal(tv.posicion_confirmada, true);
  });

  it('escribir fuera de la sala se recorta igual que arrastrando', () => {
    assert.equal(editarEquipo(base(), 'tv', { x_m: 40 }).equipos[0].x_m, 4.7);
  });

  it('cambiar el extremo no confirma la posición por su cuenta', () => {
    const b = editarEquipo(base(), 'tv', { extremo: 'rack' });
    const tv = b.equipos.find((e) => e.id === 'tv')!;
    assert.equal(tv.extremo, 'rack');
    assert.equal(tv.posicion_confirmada, false, 'sigue estimada hasta que se coloque');
  });

  it('se puede devolver un equipo a estimado a propósito', () => {
    const b = editarEquipo(base(), 'caja', { posicion_confirmada: false });
    assert.equal(b.equipos.find((e) => e.id === 'caja')!.posicion_confirmada, false);
  });
});

describe('la vista del lienzo', () => {
  const BASE = { ancho_px: 900, alto_px: 500 };

  it('encajada es la escena entera y su zoom es 1', () => {
    const v = vistaCompleta(BASE.ancho_px, BASE.alto_px);
    assert.equal(comoViewBox(v), '0 0 900 500');
    assert.equal(zoomDe(v, BASE.ancho_px), 1);
  });

  it('acercar al doble deja el punto de referencia quieto', () => {
    const v = acercar(vistaCompleta(900, 500), 2, BASE, { x: 450, y: 250 });
    assert.equal(zoomDe(v, BASE.ancho_px), 2);
    // El centro sigue siendo el centro: 225 + 450/2 = 450.
    assert.equal(v.x + v.ancho / 2, 450);
    assert.equal(v.y + v.alto / 2, 250);
  });

  it('acercar bajo el puntero deja quieto lo que hay bajo el puntero', () => {
    const v = acercar(vistaCompleta(900, 500), 2, BASE, { x: 100, y: 100 });
    // El punto (100, 100) sigue a la misma fracción de la vista.
    assert.equal((100 - v.x) / v.ancho, (100 - 0) / 900);
  });

  it('el zoom tiene tope por los dos lados', () => {
    let v = vistaCompleta(900, 500);
    for (let i = 0; i < 20; i += 1) v = acercar(v, 2, BASE);
    assert.equal(zoomDe(v, BASE.ancho_px), 8);
    for (let i = 0; i < 40; i += 1) v = acercar(v, 0.5, BASE);
    assert.equal(zoomDe(v, BASE.ancho_px), 0.25);
  });
});
