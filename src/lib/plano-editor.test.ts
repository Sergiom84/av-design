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
  MAXIMO_AFORO_MATERIALIZABLE,
  agruparEquipos,
  seleccionVigente,
  MAXIMO_ALTA_MOBILIARIO,
  MAXIMO_MOBILIARIO_POR_PATCH,
  anadirDelCatalogo,
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
  anadirPuerta,
  aplicarIdsReales,
  desplazarPuerta,
  editarPuerta,
  estadoDeLaPuerta,
  longitudDePared,
  moverPuerta,
  puertasFueraDePared,
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
  rol: 'asiento',
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
  rol: null,
  largo_m_defecto: null,
  ancho_m_defecto: null,
};

/** La mesa de la sala. Existe en el catálogo para poder encontrarla, no para instanciarla. */
const MESA_PRINCIPAL: MuebleCatalogo = {
  ...MESA_AUX,
  id: 'cat-mesa-principal',
  clave: 'mesa-principal',
  nombre: 'Mesa principal',
  rol: 'mesa_principal',
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

/**
 * El alta tal y como la hace la interfaz.
 *
 * Estas pruebas no construyen el borrador a mano ni le ponen
 * `sillas_modo: 'manuales'`: llaman a lo mismo que llama el botón `Añadir`,
 * que es donde estaba el fallo. Una prueba que inyecta el modo que la
 * interfaz nunca manda pasa con el fallo dentro.
 */
describe('añadir desde el buscador de mobiliario', () => {
  /** Un generador determinista: la lógica es pura y no puede inventar uuid. */
  const contador = () => {
    let n = 0;
    return () => `nuevo-${n++}`;
  };

  const sillasQueDibujaElCroquis = (b = base()) =>
    construirEscena(entradaCroquisDe(b, SALA, [])).sillas;

  it('añadir una silla no duplica las del aforo', () => {
    const antes = base();
    const derivadas = sillasQueDibujaElCroquis(antes);
    assert.equal(derivadas.length, 8, 'la sala de partida dibuja las ocho del aforo');

    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: derivadas,
    });

    const escena = construirEscena(entradaCroquisDe(r.borrador, SALA, []));
    assert.equal(escena.sillas.length, 0, 'ya no se derivan del aforo');
    // La nueva todavía no se dibuja: entra en `Por colocar` y se sitúa
    // arrastrándola. Las dibujadas son las ocho de siempre, no dieciséis.
    assert.equal(escena.muebles.length, 8, 'las ocho de antes, ni una más');
    assert.equal(r.borrador.mobiliario.length, 9, 'ocho materializadas y la nueva en la lista');
    assert.equal(r.borrador.sillas_modo, 'manuales');
  });

  it('las ocho que se materializan caen donde ya estaban', () => {
    const antes = base();
    const derivadas = sillasQueDibujaElCroquis(antes);
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: derivadas,
    });

    const colocadas = r.borrador.mobiliario
      .filter((m) => m.posicion_confirmada)
      .map((m) => [m.x_m, m.y_m]);
    assert.deepEqual(
      colocadas,
      derivadas.map((s) => [s.x_m, s.y_m]),
      'el croquis de antes y el de después dibujan las mismas sillas en el mismo sitio',
    );
  });

  it('el patch que sale de ese alta lleva el modo, sin que nadie se lo ponga', () => {
    const antes = base();
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: sillasQueDibujaElCroquis(antes),
    });
    const patch = construirPatch('sala-1', 3, antes, r.borrador);

    assert.equal(patch.sillas_modo, 'manuales');
    assert.equal(patch.mobiliario_alta.length, 9);
    assert.ok(
      patch.mobiliario_alta.every((m) => m.mobiliario_id === SILLA.id),
      'toda alta lleva su referencia de catálogo: el servidor relee por ahí',
    );
  });

  it('un mueble que no es asiento deja el aforo en paz', () => {
    const antes = base();
    const r = anadirDelCatalogo(antes, MESA_AUX, 1, {
      nuevoId: contador(),
      sillasDerivadas: sillasQueDibujaElCroquis(antes),
    });

    assert.equal(r.borrador.sillas_modo, 'derivadas');
    const escena = construirEscena(entradaCroquisDe(r.borrador, SALA, []));
    assert.equal(escena.sillas.length, 8, 'las ocho del aforo siguen dibujándose');
  });

  it('Mesa principal selecciona la que hay y no crea una segunda', () => {
    const antes = base();
    const r = anadirDelCatalogo(antes, MESA_PRINCIPAL, 1, { nuevoId: contador() });

    assert.equal(r.borrador, antes, 'el borrador no se toca siquiera');
    assert.deepEqual(r.seleccion, { tipo: 'mesa' });
    assert.match(r.aviso, /mesa principal/i);
  });

  it('la cantidad se recorta antes de inventar identificadores', () => {
    let pedidos = 0;
    const r = anadirDelCatalogo(base(), MESA_AUX, 5000, {
      nuevoId: () => `nuevo-${pedidos++}`,
    });

    assert.equal(r.borrador.mobiliario.length, MAXIMO_ALTA_MOBILIARIO);
    assert.equal(pedidos, MAXIMO_ALTA_MOBILIARIO, 'cincuenta identificadores, no cinco mil');
  });

  it('una cantidad absurda no rompe: cero, texto o infinito dan uno', () => {
    for (const cantidad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = anadirDelCatalogo(base(), MESA_AUX, cantidad, { nuevoId: contador() });
      assert.equal(r.borrador.mobiliario.length, 1, `cantidad ${cantidad}`);
    }
  });

  it('lo añadido queda seleccionado, que es lo que abre su inspector', () => {
    const r = anadirDelCatalogo(base(), MESA_AUX, 3, { nuevoId: contador() });
    assert.deepEqual(r.seleccion, { tipo: 'mueble', id: r.borrador.mobiliario[0].id });
  });

  it('añadir un asiento a una sala que ya es manual no vuelve a materializar', () => {
    const antes = base();
    const primera = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: sillasQueDibujaElCroquis(antes),
    }).borrador;

    const segunda = anadirDelCatalogo(primera, SILLA, 1, {
      nuevoId: contador(),
      // Aunque se le pasen: con el modo ya en manuales no hay nada que derivar.
      sillasDerivadas: sillasQueDibujaElCroquis(),
    }).borrador;

    assert.equal(segunda.mobiliario.length, 10, 'nueve y una, no nueve y nueve');
  });
});

/**
 * Lo que construye la interfaz tiene que poder guardarse.
 *
 * Estas dos familias de pruebas cierran el círculo: la primera comprueba que
 * las sillas materializadas caen dentro de la sala —y por tanto pasan la misma
 * validación que aplica el servidor—, y la segunda que la interfaz no puede
 * construir un patch que el esquema rechace por cantidad. Un editor que crea
 * borradores irguardables gasta el trabajo de quien los hizo.
 */
describe('el borrador que hace la interfaz lo acepta el servidor', () => {
  const contador = () => {
    let n = 0;
    return () => `nuevo-${n++}`;
  };

  /** Sala de 4 × 4 con la mesa arrimada a la pared izquierda. */
  const SALA_ARRIMADA: Sala = {
    ...SALA,
    largo_m: 4,
    ancho_m: 4,
    aforo: 8,
    mesa_largo_m: 2,
    mesa_ancho_m: 1,
    mesa_x_m: 0,
    mesa_y_m: 2,
  };

  const borradorArrimado = () => borradorDesde(SALA_ARRIMADA, [], [], []);

  const sillasDibujadas = (b: BorradorPlano, sala: Sala) =>
    construirEscena(entradaCroquisDe(b, sala, [])).sillas;

  it('materializar junto a la pared no saca ninguna silla de la sala', () => {
    const antes = borradorArrimado();
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: sillasDibujadas(antes, SALA_ARRIMADA),
    });

    const fuera = r.borrador.mobiliario.filter(
      (m) =>
        m.posicion_confirmada &&
        (m.x_m == null || m.y_m == null || m.x_m < 0 || m.x_m > 4 || m.y_m < 0 || m.y_m > 4),
    );
    assert.deepEqual(fuera, [], 'ninguna silla materializada fuera de la sala');
  });

  it('y el patch resultante pasa la validación del servidor', () => {
    const antes = borradorArrimado();
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: sillasDibujadas(antes, SALA_ARRIMADA),
    });
    const patch = construirPatch('sala-1', 3, antes, r.borrador);

    assert.deepEqual(
      coordenadasFueraDeSala(patch, { largo_m: 4, ancho_m: 4, alto_m: 2.7 }),
      [],
      'lo que dibuja el editor es guardable: la misma función que corre en el servidor',
    );
  });

  it('el dibujo de antes y el de después de materializar es el mismo', () => {
    const antes = borradorArrimado();
    const dibujadasAntes = sillasDibujadas(antes, SALA_ARRIMADA);
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: dibujadasAntes,
    });
    const dibujadasDespues = construirEscena(
      entradaCroquisDe(r.borrador, SALA_ARRIMADA, []),
    ).muebles;

    assert.equal(dibujadasDespues.length, dibujadasAntes.length, 'el mismo número de sillas');
    assert.deepEqual(
      dibujadasDespues.map((m) => [m.x_m, m.y_m]),
      dibujadasAntes.map((s) => [s.x_m, s.y_m]),
      'y en las mismas coordenadas',
    );
  });
});

describe('los límites de alta son uno solo, no tres', () => {
  const contador = () => {
    let n = 0;
    return () => `nuevo-${n++}`;
  };

  const conAforo = (aforo: number): Sala => ({ ...SALA, aforo });

  /** Las sillas que dibujaría el croquis con ese aforo. */
  const derivadasDe = (sala: Sala) =>
    construirEscena(entradaCroquisDe(borradorDesde(sala, [], [], []), sala, [])).sillas;

  it('el máximo del patch cubre el aforo materializable más un alta entera', () => {
    assert.equal(
      MAXIMO_MOBILIARIO_POR_PATCH,
      MAXIMO_AFORO_MATERIALIZABLE + MAXIMO_ALTA_MOBILIARIO,
      'si no, la interfaz puede construir un patch que el esquema rechaza',
    );
  });

  it('un aforo por encima del límite no materializa ni inventa identificadores', () => {
    const sala = conAforo(MAXIMO_AFORO_MATERIALIZABLE + 1);
    const antes = borradorDesde(sala, [], [], []);
    let pedidos = 0;

    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: () => `nuevo-${pedidos++}`,
      sillasDerivadas: derivadasDe(sala),
    });

    assert.equal(r.borrador, antes, 'el borrador no se toca');
    assert.equal(pedidos, 0, 'no se genera ni un identificador');
    assert.equal(r.borrador.sillas_modo, 'derivadas', 'y las sillas del aforo siguen ahí');
  });

  it('y lo explica con el número, no con «datos inválidos»', () => {
    const sala = conAforo(MAXIMO_AFORO_MATERIALIZABLE + 1);
    const r = anadirDelCatalogo(borradorDesde(sala, [], [], []), SILLA, 1, {
      nuevoId: () => 'no-deberia-pedirse',
      sillasDerivadas: derivadasDe(sala),
    });
    assert.match(r.aviso, new RegExp(String(MAXIMO_AFORO_MATERIALIZABLE)));
    assert.doesNotMatch(r.aviso, /inválid/i);
  });

  it('el aforo justo en el límite sí se materializa', () => {
    const sala = conAforo(MAXIMO_AFORO_MATERIALIZABLE);
    const antes = borradorDesde(sala, [], [], []);
    const r = anadirDelCatalogo(antes, SILLA, 1, {
      nuevoId: contador(),
      sillasDerivadas: derivadasDe(sala),
    });
    assert.equal(r.borrador.mobiliario.length, MAXIMO_AFORO_MATERIALIZABLE + 1);
    assert.equal(r.borrador.sillas_modo, 'manuales');
  });

  it('aforo en el límite más un alta de cincuenta cabe en el patch', () => {
    const sala = conAforo(MAXIMO_AFORO_MATERIALIZABLE);
    const antes = borradorDesde(sala, [], [], []);
    const r = anadirDelCatalogo(antes, SILLA, MAXIMO_ALTA_MOBILIARIO, {
      nuevoId: contador(),
      sillasDerivadas: derivadasDe(sala),
    });
    const patch = construirPatch('sala-1', 3, antes, r.borrador);
    assert.ok(
      patch.mobiliario_alta.length <= MAXIMO_MOBILIARIO_POR_PATCH,
      `${patch.mobiliario_alta.length} altas no pueden pasar de ${MAXIMO_MOBILIARIO_POR_PATCH}`,
    );
  });

  it('un mueble corriente no mira el aforo: no materializa nada', () => {
    const sala = conAforo(MAXIMO_AFORO_MATERIALIZABLE + 1);
    const antes = borradorDesde(sala, [], [], []);
    const r = anadirDelCatalogo(antes, MESA_AUX, 1, {
      nuevoId: contador(),
      sillasDerivadas: derivadasDe(sala),
    });
    assert.equal(r.borrador.mobiliario.length, 1, 'la mesa entra aunque el aforo sea enorme');
  });
});

describe('la selección no sobrevive a lo que selecciona', () => {
  const contador = () => {
    let n = 0;
    return () => `nuevo-${n++}`;
  };

  it('deshacer un alta deja la selección sin objeto: vuelve a la sala', () => {
    const antes = base();
    const r = anadirDelCatalogo(antes, MESA_AUX, 1, { nuevoId: contador() });
    const seleccion = r.seleccion;

    assert.deepEqual(seleccionVigente(seleccion, r.borrador), seleccion, 'mientras existe, vale');
    assert.equal(
      seleccionVigente(seleccion, antes),
      null,
      'al deshacer, el inspector no puede seguir apuntando al mueble que ya no está',
    );
  });

  it('vale para equipos y para rosetas, no solo para muebles', () => {
    const conEquipo = anadirEquipo(base(), {
      id: 'eq-1',
      articulo_id: 'art-1',
      nombre: 'TEST',
      extremo: 'pared',
    });
    assert.deepEqual(seleccionVigente({ tipo: 'equipo', id: 'eq-1' }, conEquipo), {
      tipo: 'equipo',
      id: 'eq-1',
    });
    assert.equal(seleccionVigente({ tipo: 'equipo', id: 'eq-1' }, base()), null);
    assert.equal(seleccionVigente({ tipo: 'toma', id: 'no-existe' }, base()), null);
  });

  it('la sala y la mesa siempre están: no se pierden nunca', () => {
    assert.deepEqual(seleccionVigente({ tipo: 'sala' }, base()), { tipo: 'sala' });
    assert.deepEqual(seleccionVigente({ tipo: 'mesa' }, base()), { tipo: 'mesa' });
    assert.equal(seleccionVigente(null, base()), null);
  });
});

describe('el equipamiento se agrupa como el mobiliario', () => {
  // El último de la lista es el que se acaba de añadir: el borrador de partida
  // ya trae dos equipos y coger el primero devolvía otro.
  const nuevo = (id: string) =>
    anadirEquipo(base(), { id, articulo_id: 'a', nombre: id, extremo: 'pared' as const })
      .equipos.at(-1)!;
  const colocado = (id: string) => ({ ...nuevo(id), posicion_confirmada: true });
  const estimado = (id: string) => nuevo(id);

  it('separa por colocar y colocados, en ese orden', () => {
    const grupos = agruparEquipos([colocado('a'), estimado('b'), colocado('c')]);
    assert.deepEqual(
      grupos.map((g) => [g.titulo, g.equipos.map((e) => e.nombre)]),
      [
        ['Por colocar', ['b']],
        ['Colocados', ['a', 'c']],
      ],
    );
  });

  it('un grupo vacío no se enseña', () => {
    assert.deepEqual(
      agruparEquipos([colocado('a')]).map((g) => g.titulo),
      ['Colocados'],
    );
    assert.deepEqual(agruparEquipos([]), []);
  });

  it('no pierde ni duplica ningún equipo', () => {
    const equipos = [colocado('a'), estimado('b'), estimado('c')];
    const repartidos = agruparEquipos(equipos).flatMap((g) => g.equipos);
    assert.equal(repartidos.length, equipos.length);
    assert.deepEqual(new Set(repartidos.map((e) => e.nombre)), new Set(['a', 'b', 'c']));
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

describe('las puertas del plano', () => {
  // La sala de siempre: 4,70 × 2,50 × 2,70.
  const base = () => borradorDesde(SALA, [], []);
  const conPuerta = () => anadirPuerta(base(), 'p1', 'sur');

  it('una puerta nace en mitad de su pared y «Sin medir»', () => {
    const b = conPuerta();
    assert.equal(b.puertas.length, 1);
    const p = b.puertas[0];
    assert.equal(p.posicion_m, 2.35);
    assert.equal(p.anchura_m, null);
    assert.equal(p.altura_m, null);
    assert.equal(p.es_nuevo, true);
    assert.equal(estadoDeLaPuerta(p), 'sin_medir');
  });

  it('la longitud de la pared depende de su orientación', () => {
    assert.equal(longitudDePared('sur', SALA), SALA.largo_m);
    assert.equal(longitudDePared('norte', SALA), SALA.largo_m);
    assert.equal(longitudDePared('este', SALA), SALA.ancho_m);
    assert.equal(longitudDePared('oeste', SALA), SALA.ancho_m);
  });

  it('mover ajusta a la rejilla y no deja salir el hueco de la pared', () => {
    let b = editarPuerta(conPuerta(), 'p1', { anchura_m: 0.9, altura_m: 2.1 });
    b = moverPuerta(b, 'p1', 4.63);
    // 4,63 se ajusta a 4,6, pero 4,6 + 0,9 se sale de 4,7: se recorta a 3,8.
    assert.equal(b.puertas[0].posicion_m, 3.8);
    b = moverPuerta(b, 'p1', -2);
    assert.equal(b.puertas[0].posicion_m, 0);
  });

  it('desplazar solo escucha al eje de su pared', () => {
    const b = conPuerta();
    const movida = desplazarPuerta(b, 'p1', { dx_m: PASO_REJILLA_M, dy_m: 0 });
    assert.equal(movida.puertas[0].posicion_m, 2.5);
    // La flecha vertical no mueve una puerta de la pared sur: devuelve la
    // misma referencia, no un paso de deshacer en blanco.
    assert.equal(desplazarPuerta(b, 'p1', { dx_m: 0, dy_m: PASO_REJILLA_M }), b);
  });

  it('editar limpia medidas no positivas y cambiar de pared recorta la posición', () => {
    let b = editarPuerta(conPuerta(), 'p1', { anchura_m: -1, altura_m: 0 });
    assert.equal(b.puertas[0].anchura_m, null);
    assert.equal(b.puertas[0].altura_m, null);
    // En la pared este la pared mide 2,50: con una anchura de 0,9 el tope es 1,6.
    b = editarPuerta(b, 'p1', { anchura_m: 0.9, altura_m: 2.1 });
    b = editarPuerta(b, 'p1', { pared: 'este' });
    assert.equal(b.puertas[0].pared, 'este');
    assert.equal(b.puertas[0].posicion_m, 1.6);
  });

  it('una medida sin la otra es «a medias» y se avisa', () => {
    const b = editarPuerta(conPuerta(), 'p1', { anchura_m: 0.9 });
    assert.equal(estadoDeLaPuerta(b.puertas[0]), 'a_medias');
    assert.ok(
      avisosDelBorrador(b).some((a) => a.includes('una medida sin la otra')),
    );
  });

  it('quitar una puerta alcanza también a las persistidas', () => {
    const original = base();
    const guardada = { ...conPuerta().puertas[0], es_nuevo: false };
    const b = { ...original, puertas: [guardada] };
    const sin = quitarAlta(b, { tipo: 'puerta', id: 'p1' });
    assert.equal(sin.puertas.length, 0);
  });

  it('el patch distingue alta, cambio y baja, y las bajas encienden hayCambios', () => {
    const original = {
      ...base(),
      puertas: [
        { id: 'p1', pared: 'sur' as const, posicion_m: 1, anchura_m: null, altura_m: null, orden: 1, es_nuevo: false },
        { id: 'p2', pared: 'norte' as const, posicion_m: 2, anchura_m: 0.9, altura_m: 2.1, orden: 2, es_nuevo: false },
      ],
    };
    let borrador = moverPuerta(original, 'p2', 1.5);
    borrador = anadirPuerta(borrador, 'tmp-p', 'este');
    borrador = quitarAlta(borrador, { tipo: 'puerta', id: 'p1' });

    const patch = construirPatch('s1', 3, original, borrador);
    assert.deepEqual(patch.puertas_baja, ['p1']);
    assert.equal(patch.puertas_alta.length, 1);
    assert.equal(patch.puertas_alta[0].id, 'tmp-p');
    assert.equal(patch.puertas_cambio.length, 1);
    assert.equal(patch.puertas_cambio[0].posicion_m, 1.5);
    assert.ok(hayCambios(patch));

    // Solo la baja también es un cambio.
    const soloBaja = construirPatch(
      's1',
      3,
      original,
      quitarAlta(original, { tipo: 'puerta', id: 'p1' }),
    );
    assert.deepEqual(soloBaja.puertas_baja, ['p1']);
    assert.ok(hayCambios(soloBaja));
  });

  it('mover una puerta no afecta al cálculo de cable', () => {
    const original = conPuerta();
    const borrador = moverPuerta(original, 'p1', 1);
    assert.equal(afectaAlCalculo(original, borrador), false);
  });

  it('encoger la sala arrastra la puerta para que el hueco siga cabiendo', () => {
    let b = editarPuerta(conPuerta(), 'p1', { anchura_m: 0.9, altura_m: 2.1 });
    b = moverPuerta(b, 'p1', 3.8);
    const encogida = cambiarMedidasSala(b, { largo_m: 3 });
    assert.equal(encogida.puertas[0].posicion_m, 2.1);
  });

  it('el guardado devuelve ids reales también para puertas', () => {
    const b = conPuerta();
    const conIds = aplicarIdsReales(b, { p1: 'real-1' });
    assert.equal(conIds.puertas[0].id, 'real-1');
    assert.equal(conIds.puertas[0].es_nuevo, false);
  });

  describe('puertasFueraDePared, la guarda compartida con el servidor', () => {
    const medidas = { largo_m: 4.7, ancho_m: 2.5, alto_m: 2.7 };
    const puerta = (extra: Partial<Parameters<typeof puertasFueraDePared>[0][number]>) => [
      { id: 'p1', pared: 'sur' as const, posicion_m: 0, anchura_m: null, altura_m: null, ...extra },
    ];

    it('el hueco exacto contra el final de la pared entra', () => {
      assert.deepEqual(
        puertasFueraDePared(puerta({ posicion_m: 3.8, anchura_m: 0.9, altura_m: 2.7 }), medidas),
        [],
      );
    });

    it('un centímetro más allá no entra', () => {
      assert.equal(
        puertasFueraDePared(puerta({ posicion_m: 3.81, anchura_m: 0.9, altura_m: 2.1 }), medidas)
          .length,
        1,
      );
    });

    it('en la pared corta manda el ancho de la sala', () => {
      const este = [
        { id: 'p1', pared: 'este' as const, posicion_m: 1.7, anchura_m: 0.9, altura_m: 2.1 },
      ];
      assert.equal(puertasFueraDePared(este, medidas).length, 1);
    });

    it('más alta que la sala no entra', () => {
      assert.equal(
        puertasFueraDePared(puerta({ anchura_m: 0.9, altura_m: 2.71 }), medidas).length,
        1,
      );
    });

    it('una medida sin la otra se rechaza entera', () => {
      assert.equal(puertasFueraDePared(puerta({ anchura_m: 0.9 }), medidas).length, 1);
      assert.equal(puertasFueraDePared(puerta({ altura_m: 2.1 }), medidas).length, 1);
    });

    it('sin medir solo exige que el arranque esté en la pared', () => {
      assert.deepEqual(puertasFueraDePared(puerta({ posicion_m: 4.7 }), medidas), []);
      assert.equal(puertasFueraDePared(puerta({ posicion_m: 4.71 }), medidas).length, 1);
    });

    it('una sala sin medir no admite puertas situadas', () => {
      assert.equal(
        puertasFueraDePared(puerta({}), { largo_m: 0, ancho_m: 2.5, alto_m: 2.7 }).length,
        1,
      );
    });

    it('una posición negativa o no finita se rechaza', () => {
      assert.equal(puertasFueraDePared(puerta({ posicion_m: -0.01 }), medidas).length, 1);
      assert.equal(puertasFueraDePared(puerta({ posicion_m: Number.NaN }), medidas).length, 1);
    });
  });
});
