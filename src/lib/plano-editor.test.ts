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
  MAXIMO_ALTA_MOBILIARIO,
  anadirEquipo,
  anadirMuebles,
  colocarEnElCentro,
  construirPatch,
  coordenadasFueraDeSala,
  desplazarMueble,
  editarMueble,
  entradaCroquisDe,
  estadoDelMueble,
  girar,
  iniciarDiagrama,
  materializarSillas,
  moverMueble,
  quitarAlta,
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
  type PatchEquipoPlano,
} from './plano-editor';
import { construirEscena, sillasAlrededor, mesaDeLaSala } from './croquis';
import type { EquipoEnSala, MuebleCatalogo, Sala, TomaRed } from './tipos';

/** La silla del catálogo: medio metro, que es el círculo que ya dibuja el croquis. */
const SILLA: MuebleCatalogo = {
  id: 'cat-silla',
  clave: 'silla',
  nombre: 'Silla',
  categoria: 'Asientos',
  palabras_clave: 'silla asiento butaca',
  forma: 'circulo',
  largo_m_defecto: 0.5,
  ancho_m_defecto: 0.5,
  alto_m_defecto: null,
};

/** Una mesa auxiliar sin medidas del departamento: nace «Sin medir». */
const MESA_AUX: MuebleCatalogo = {
  ...SILLA,
  id: 'cat-mesa',
  clave: 'mesa-rectangular',
  nombre: 'Mesa rectangular',
  categoria: 'Mesas',
  forma: 'rectangulo',
  largo_m_defecto: null,
  ancho_m_defecto: null,
};

const ids = (n: number, prefijo = 'tmp') =>
  Array.from({ length: n }, (_, i) => `${prefijo}-${i}`);

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
  sillas_modo: 'derivadas',
};

const equipo = (
  id: string,
  posicion = { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada = false,
): EquipoEnSala => ({
  id,
  sala_id: 'sala-1',
  articulo_id: `art-${id}`,
  rotacion_grados: 0,
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
    assert.equal(t.z_m, null, 'y la altura suelta se va con ella');
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
    const b = { ...base(), equipos: base().equipos.map((e) => ({ ...e, x_m: 99, posicion_confirmada: true, rotacion_grados: 0 })) };
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

describe('los límites que comprueba el servidor', () => {
  // Las medidas reales de Batería 006. El editor recorta antes de llegar
  // aquí; esto es lo que ve una petición que no pasó por el editor.
  const MEDIDAS = { largo_m: 4.7, ancho_m: 2.5, alto_m: 2.7 };

  const salaDelPatch = () => ({
    largo_m: 4.7,
    ancho_m: 2.5,
    alto_m: 2.7,
    aforo: 8,
    mesa_largo_m: 2.4,
    mesa_ancho_m: 1.21,
    mesa_alto_cm: 73,
    mesa_x_m: null as number | null,
    mesa_y_m: null as number | null,
    mesa_rotacion_grados: 0,
  });

  const equipo = (
    x_m: number,
    y_m: number,
    z_m = 0,
    posicion_confirmada = true,
  ): PatchEquipoPlano => ({ id: 'e1', x_m, y_m, z_m, posicion_confirmada, rotacion_grados: 0 });

  const soloEquipos = (...equipos: PatchEquipoPlano[]) => ({
    sala: null,
    equipos,
    tomas: [],
  });

  it('el borde exacto entra: la pantalla va pegada a la pared', () => {
    assert.deepEqual(coordenadasFueraDeSala(soloEquipos(equipo(0, 0, 0)), MEDIDAS), []);
    assert.deepEqual(coordenadasFueraDeSala(soloEquipos(equipo(4.7, 2.5, 2.7)), MEDIDAS), []);
  });

  it('un centímetro fuera se rechaza en cualquiera de los tres ejes', () => {
    const fuera: Array<[number, number, number]> = [
      [4.71, 1, 1],
      [-0.01, 1, 1],
      [1, 2.51, 1],
      [1, -0.01, 1],
      [1, 1, 2.71],
      [1, 1, -0.01],
    ];
    for (const [x, y, z] of fuera) {
      assert.equal(
        coordenadasFueraDeSala(soloEquipos(equipo(x, y, z)), MEDIDAS).length,
        1,
        `${x}, ${y}, ${z} debería quedar fuera`,
      );
    }
  });

  it('un equipo sin confirmar no se juzga: su posición la deduce el croquis', () => {
    assert.deepEqual(
      coordenadasFueraDeSala(soloEquipos(equipo(99, 99, 99, false)), MEDIDAS),
      [],
    );
  });

  it('una sala sin medir no admite colocación confirmada', () => {
    const sinMedir = { largo_m: 0, ancho_m: 0, alto_m: 0 };
    assert.equal(coordenadasFueraDeSala(soloEquipos(equipo(0, 0, 0)), sinMedir).length, 1);
  });

  it('se valida contra las medidas del propio patch, no contra las viejas', () => {
    // Medir la sala y colocar el equipo en el mismo guardado es el caso
    // normal: validar contra las medidas anteriores lo rechazaría.
    const patch = {
      sala: { ...salaDelPatch(), largo_m: 8, ancho_m: 5, alto_m: 3 },
      equipos: [equipo(7.5, 4.5, 2.9)],
      tomas: [],
    };
    assert.deepEqual(coordenadasFueraDeSala(patch, { largo_m: 8, ancho_m: 5, alto_m: 3 }), []);
    assert.equal(coordenadasFueraDeSala(patch, MEDIDAS).length, 1, 'con las viejas caería');
  });

  it('una roseta sin situar es válida; media roseta situada no', () => {
    const toma = (x: number | null, y: number | null, z: number | null) => ({
      sala: null,
      equipos: [],
      tomas: [{ id: 't1', x_m: x, y_m: y, z_m: z }],
    });
    assert.deepEqual(coordenadasFueraDeSala(toma(null, null, null), MEDIDAS), []);
    assert.equal(coordenadasFueraDeSala(toma(1, null, null), MEDIDAS).length, 1);
    assert.equal(coordenadasFueraDeSala(toma(1, 1, null), MEDIDAS).length, 1);
    assert.deepEqual(coordenadasFueraDeSala(toma(4.7, 2.5, 2.7), MEDIDAS), []);
    assert.equal(coordenadasFueraDeSala(toma(4.71, 1, 1), MEDIDAS).length, 1);
  });

  it('el centro de la mesa es un par y cae dentro de la sala', () => {
    const conMesa = (mesa_x_m: number | null, mesa_y_m: number | null) => ({
      sala: { ...salaDelPatch(), mesa_x_m, mesa_y_m },
      equipos: [],
      tomas: [],
    });
    assert.deepEqual(coordenadasFueraDeSala(conMesa(null, null), MEDIDAS), [], 'centrada');
    assert.deepEqual(coordenadasFueraDeSala(conMesa(2.35, 1.25), MEDIDAS), []);
    assert.equal(coordenadasFueraDeSala(conMesa(2.35, null), MEDIDAS).length, 1);
    assert.equal(coordenadasFueraDeSala(conMesa(null, 1.25), MEDIDAS).length, 1);
    assert.equal(coordenadasFueraDeSala(conMesa(4.71, 1.25), MEDIDAS).length, 1);
  });
});

describe('el alta de mobiliario', () => {
  it('ocho sillas son ocho instancias, no una línea con cantidad 8', () => {
    const b = anadirMuebles(base(), SILLA, ids(8));
    assert.equal(b.mobiliario.length, 8);
    assert.equal(new Set(b.mobiliario.map((m) => m.id)).size, 8, 'cada una con su id');
    assert.ok(
      b.mobiliario.every((m) => m.es_nuevo && m.x_m === null && m.posicion_confirmada === false),
      'nacen sin colocar: la ausencia no se convierte en (0,0,0)',
    );
  });

  it('copia las medidas del catálogo como snapshot', () => {
    const m = anadirMuebles(base(), SILLA, ids(1)).mobiliario[0];
    assert.deepEqual([m.largo_m, m.ancho_m], [0.5, 0.5]);
    assert.equal(estadoDelMueble(m), 'sin_colocar');
  });

  it('un mueble sin medidas por defecto nace Sin medir', () => {
    const m = anadirMuebles(base(), MESA_AUX, ids(1)).mobiliario[0];
    assert.equal(estadoDelMueble(m), 'sin_medir');
    // Y ni siquiera colocarlo lo da por puesto: primero se mide.
    const b = moverMueble(anadirMuebles(base(), MESA_AUX, ids(1)), 'tmp-0', { x_m: 2, y_m: 1 });
    assert.equal(estadoDelMueble(b.mobiliario[0]), 'sin_medir');
  });

  it('el alta tiene tope: un 500 de más no son 500 filas', () => {
    const b = anadirMuebles(base(), SILLA, ids(500));
    assert.equal(b.mobiliario.length, MAXIMO_ALTA_MOBILIARIO);
  });

  it('quitar un alta la saca del borrador; deshacer es volver al anterior', () => {
    const antes = base();
    const conSilla = anadirMuebles(antes, SILLA, ids(1));
    assert.equal(quitarAlta(conSilla, { tipo: 'mueble', id: 'tmp-0' }).mobiliario.length, 0);
    assert.equal(antes.mobiliario.length, 0, 'el borrador de partida no se muta');
  });

  it('un equipo persistido no se borra desde el plano: puede tener tiradas', () => {
    const b = base();
    assert.equal(quitarAlta(b, { tipo: 'equipo', id: 'tv' }), b, 'mismo borrador, sin copia');
  });

  it('un equipo recién añadido sí se puede quitar', () => {
    const b = anadirEquipo(base(), {
      id: 'tmp-eq',
      articulo_id: 'art-9',
      nombre: 'SAMSUNG QB65R',
      extremo: 'pantalla',
    });
    assert.equal(b.equipos.at(-1)!.es_nuevo, true);
    assert.equal(b.equipos.at(-1)!.cantidad, 1);
    assert.equal(b.equipos.at(-1)!.posicion_confirmada, false, 'sin colocar: se deduce');
    assert.equal(quitarAlta(b, { tipo: 'equipo', id: 'tmp-eq' }).equipos.length, 2);
  });
});

describe('la rotación', () => {
  const conSilla = () => anadirMuebles(base(), SILLA, ids(1));

  it('se normaliza a [0, 360)', () => {
    const g = (grados: number) =>
      girar(conSilla(), { tipo: 'mueble', id: 'tmp-0' }, grados).mobiliario[0].rotacion_grados;
    assert.equal(g(-15), 345);
    assert.equal(g(360), 0);
    assert.equal(g(725), 5);
  });

  it('girar no mueve el ancla', () => {
    const colocada = moverMueble(conSilla(), 'tmp-0', { x_m: 1.2, y_m: 0.8 });
    const girada = girar(colocada, { tipo: 'mueble', id: 'tmp-0' }, 90);
    assert.deepEqual(
      [girada.mobiliario[0].x_m, girada.mobiliario[0].y_m, girada.mobiliario[0].z_m],
      [1.2, 0.8, 0],
    );
  });

  it('cada elemento gira por su cuenta', () => {
    let b = anadirMuebles(base(), SILLA, ids(2));
    b = girar(b, { tipo: 'mueble', id: 'tmp-0' }, 90);
    b = girar(b, { tipo: 'equipo', id: 'tv' }, 180);
    assert.equal(b.mobiliario[0].rotacion_grados, 90);
    assert.equal(b.mobiliario[1].rotacion_grados, 0);
    assert.equal(b.equipos.find((e) => e.id === 'tv')!.rotacion_grados, 180);
    assert.equal(b.mesa_rotacion_grados, 0, 'la mesa no se entera');
  });

  it('lo que no tiene orientación visible no gira: nada de controles falsos', () => {
    const b = base();
    assert.equal(girar(b, { tipo: 'sala' }, 90), b);
    assert.equal(girar(b, { tipo: 'toma', id: '12' }, 90), b);
    assert.equal(girar(b, null, 90), b);
  });
});

describe('colocar sin ratón', () => {
  it('coloca en el centro de la sala lo seleccionado', () => {
    const b = colocarEnElCentro(anadirMuebles(base(), SILLA, ids(1)), {
      tipo: 'mueble',
      id: 'tmp-0',
    });
    assert.deepEqual([b.mobiliario[0].x_m, b.mobiliario[0].y_m], [2.4, 1.3]);
    assert.equal(b.mobiliario[0].posicion_confirmada, true);
  });

  it('desde ahí las flechas lo ajustan al decímetro', () => {
    let b = colocarEnElCentro(anadirMuebles(base(), SILLA, ids(1)), {
      tipo: 'mueble',
      id: 'tmp-0',
    });
    b = desplazarMueble(b, 'tmp-0', { dx_m: PASO_REJILLA_M, dy_m: 0 });
    assert.equal(b.mobiliario[0].x_m, 2.5);
  });

  it('borrar la coordenada lo devuelve a Por colocar', () => {
    let b = colocarEnElCentro(anadirMuebles(base(), SILLA, ids(1)), {
      tipo: 'mueble',
      id: 'tmp-0',
    });
    b = editarMueble(b, 'tmp-0', { x_m: null });
    assert.equal(estadoDelMueble(b.mobiliario[0]), 'sin_colocar');
    assert.equal(b.mobiliario[0].y_m, null, 'y no se queda media colocada');
  });
});

describe('las sillas derivadas se materializan sin moverse', () => {
  it('salen exactamente donde las dibujaba el croquis', () => {
    const mesa = mesaDeLaSala(SALA)!;
    const sillas = sillasAlrededor(mesa, SALA.aforo!);
    const b = materializarSillas(base(), sillas, SILLA, ids(sillas.length));

    assert.equal(b.sillas_modo, 'manuales');
    assert.equal(b.mobiliario.length, sillas.length, 'una fila por silla, ni una más');
    assert.deepEqual(
      b.mobiliario.map((m) => [m.x_m, m.y_m]),
      sillas.map((s) => [s.x_m, s.y_m]),
      'el croquis de antes y el de después son el mismo dibujo',
    );
    assert.ok(b.mobiliario.every((m) => m.posicion_confirmada && m.largo_m === 0.5));
  });

  it('no se materializa dos veces', () => {
    const mesa = mesaDeLaSala(SALA)!;
    const sillas = sillasAlrededor(mesa, SALA.aforo!);
    const una = materializarSillas(base(), sillas, SILLA, ids(sillas.length));
    assert.equal(materializarSillas(una, sillas, SILLA, ids(sillas.length, 'otra')), una);
  });

  it('con sillas explícitas el croquis deja de derivarlas', () => {
    const mesa = mesaDeLaSala(SALA)!;
    const sillas = sillasAlrededor(mesa, SALA.aforo!);
    const b = materializarSillas(base(), sillas, SILLA, ids(sillas.length));
    const escena = construirEscena(entradaCroquisDe(b, SALA, []));
    assert.equal(escena.sillas.length, 0, 'ninguna derivada');
    assert.equal(escena.muebles.length, sillas.length, 'y todas explícitas');
    assert.deepEqual(
      escena.muebles.map((m) => [m.x_m, m.y_m]).sort(),
      sillas.map((s) => [s.x_m, s.y_m]).sort(),
    );
  });
});

describe('el patch discriminado', () => {
  const patchDe = (b: BorradorPlano, original = base()) =>
    construirPatch('sala-1', 3, original, b);

  it('separa alta, cambio y baja en vez de mirarle el prefijo al id', () => {
    const original = borradorDesde(
      SALA,
      [equipo('tv'), equipo('caja', { x_m: 2.35, y_m: 1.25, z_m: 0.73 }, true)],
      [toma('12', 3, 2), toma('13')],
      [
        {
          id: 'm-viejo',
          sala_id: 'sala-1',
          mobiliario_id: 'cat-silla',
          nombre: 'Silla',
          forma: 'circulo',
          largo_m: 0.5,
          ancho_m: 0.5,
          alto_m: null,
          x_m: 1,
          y_m: 1,
          z_m: 0,
          rotacion_grados: 0,
          posicion_confirmada: true,
          orden: 0,
        },
      ],
    );

    let b = anadirMuebles(original, SILLA, ids(1));
    b = girar(b, { tipo: 'mueble', id: 'm-viejo' }, 90);
    const patch = patchDe(b, original);

    assert.equal(patch.mobiliario_alta.length, 1);
    assert.equal(patch.mobiliario_alta[0].id, 'tmp-0');
    assert.equal(patch.mobiliario_cambio.length, 1);
    assert.equal(patch.mobiliario_cambio[0].rotacion_grados, 90);
    assert.deepEqual(patch.mobiliario_baja, []);

    const conBaja = patchDe(quitarAlta(b, { tipo: 'mueble', id: 'm-viejo' }), original);
    assert.deepEqual(conBaja.mobiliario_baja, ['m-viejo']);
  });

  it('un equipo nuevo va a equipos_alta con su articulo_id, no a equipos', () => {
    const b = anadirEquipo(base(), {
      id: 'tmp-eq',
      articulo_id: 'art-9',
      nombre: 'SAMSUNG QB65R',
      extremo: 'pantalla',
    });
    const patch = patchDe(b);
    assert.equal(patch.equipos.length, 0);
    assert.equal(patch.equipos_alta.length, 1);
    assert.equal(patch.equipos_alta[0].articulo_id, 'art-9');
  });

  it('el giro de un equipo ya guardado viaja como cambio', () => {
    const patch = patchDe(girar(base(), { tipo: 'equipo', id: 'tv' }, 45));
    assert.equal(patch.equipos.length, 1);
    assert.equal(patch.equipos[0].rotacion_grados, 45);
  });

  it('sin cambios no hay nada que guardar, tampoco en mobiliario', () => {
    assert.equal(hayCambios(patchDe(base())), false);
    assert.equal(hayCambios(patchDe(anadirMuebles(base(), SILLA, ids(1)))), true);
    assert.equal(hayCambios(patchDe(iniciarDiagrama(base(), 'desde_cero'))), true);
  });

  it('el inicio del diagrama viaja una sola vez y con su plantilla', () => {
    const patch = patchDe(iniciarDiagrama(base(), 'plantilla', 'plantilla-7'));
    assert.deepEqual(patch.inicio_diagrama, {
      origen: 'plantilla',
      plantilla_id: 'plantilla-7',
    });
  });

  it('el modo de sillas solo viaja cuando cambia', () => {
    assert.equal(patchDe(base()).sillas_modo, null);
    const mesa = mesaDeLaSala(SALA)!;
    const b = materializarSillas(base(), sillasAlrededor(mesa, 8), SILLA, ids(8));
    assert.equal(patchDe(b).sillas_modo, 'manuales');
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
