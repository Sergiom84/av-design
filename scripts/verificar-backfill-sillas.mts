/**
 * El backfill de sillas, contra Postgres real.
 *
 *   npm run test:backfill-sillas
 *
 * Lo que de verdad hay que demostrar de una migración de datos no es que
 * escriba filas: es que el dibujo de antes y el de después sean el mismo. Una
 * sala de ocho sillas tiene que seguir teniendo ocho círculos, en las mismas
 * coordenadas y del mismo tamaño, antes de que nadie toque nada. Si el backfill
 * las mueve un centímetro, ha borrado una medida.
 *
 * Por eso aquí no se comparan recuentos de `sala_mobiliario`: se construye la
 * escena entera con `construirEscena()` antes y después, y se comparan las
 * sillas dibujadas vengan de donde vengan —del aforo o de las filas—.
 *
 * Y se ejecuta DOS VECES. Reejecutar un backfill es lo normal: alguien no sabe
 * si se llegó a lanzar, o el despliegue se repite. La segunda pasada tiene que
 * escribir cero filas, y eso se comprueba ejecutándolo, no leyendo un
 * `where not exists`.
 *
 * Todo pasa en una base EFÍMERA que se crea y se destruye aquí: la base de
 * desarrollo tiene salas de verdad en modo `derivadas` y un verificador no
 * puede migrarlas por la espalda.
 *
 * Y se comprueba también lo que el backfill le hace al CONTROL DE VERSIÓN. Una
 * migración de datos que cambia el plano sin mover `salas.diagrama_version`
 * deja a cualquier pestaña de Diagrama abierta creyendo vigente su número: al
 * guardar volvería a materializar las mismas sillas y la sala pasaría a tener
 * el doble. Por eso aquí se llama a `guardarDiagramaSala` de verdad, con la
 * versión de antes, y se exige conflicto. Para eso el guardado tiene que
 * apuntar a la base efímera, así que se le pone `DATABASE_URL` antes de
 * importarlo y se intercepta `server-only` como en el resto de verificadores.
 */

import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { construirEscena, type EscenaCroquis } from '../src/lib/croquis';
import type { MuebleEnSala, Sala } from '../src/lib/tipos';
import {
  asientoCanonico,
  esBaseLocal,
  escrituraAutorizada,
  migrarSillas,
  nombreDeLaBase,
  SQL_ROLLBACK_BACKFILL,
} from './migrar-sillas.mjs';

type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const moduloInterno = Module as unknown as ModuloConLoad;
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  return cargarOriginal.call(Module, request, ...resto);
};

const URL_BASE =
  process.env.DATABASE_URL ?? 'postgres://av_design:av_design_local@localhost:5433/av_design';

const nombreEfimera = `av_design_sillas_${Math.floor(Math.random() * 1e9).toString(36)}`;
const urlEfimera = URL_BASE.replace(/\/[^/?]+(\?|$)/, `/${nombreEfimera}$1`);

// `src/lib/db.ts` lee la dirección al cargarse, así que se cambia ANTES de
// importar nada que la use. El guardado del plano tiene que escribir en la base
// efímera, no en la de desarrollo.
process.env.DATABASE_URL = urlEfimera;

const PREFIJO_SEÑAL_REVALIDATE = 'Invariant: static generation store missing in ';

let ok = true;
let total = 0;
let pasadas = 0;
const afirmar = (cond: boolean, mensaje: string) => {
  total += 1;
  if (cond) pasadas += 1;
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${mensaje}`);
  if (!cond) ok = false;
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Una silla del dibujo, venga del aforo o de una fila de mobiliario. */
interface SillaDibujada {
  x_m: number;
  y_m: number;
  diametro_m: number;
}

/**
 * Las sillas que se ven en el plano.
 *
 * Antes del backfill salen de `escena.sillas`, que son los círculos del aforo.
 * Después salen de `escena.muebles`, que son las filas. Se normalizan a lo
 * mismo —dónde está el círculo y cuánto mide— porque esa es la pregunta: ¿el
 * técnico ve el mismo plano? Se ordenan porque el orden de dibujo no es parte
 * del contrato; la posición sí.
 */
function sillasDibujadas(escena: EscenaCroquis, nombreSilla: string): SillaDibujada[] {
  const delAforo: SillaDibujada[] = escena.sillas.map((s) => ({
    x_m: s.x_m,
    y_m: s.y_m,
    diametro_m: Math.round(s.radio_m * 2 * 100) / 100,
  }));
  const deFilas: SillaDibujada[] = escena.muebles
    .filter((m) => m.nombre === nombreSilla && m.forma === 'circulo')
    .map((m) => ({ x_m: m.x_m, y_m: m.y_m, diametro_m: m.largo_m }));
  return [...delAforo, ...deFilas].sort(
    (a, b) => a.x_m - b.x_m || a.y_m - b.y_m || a.diametro_m - b.diametro_m,
  );
}

const sql = postgres(URL_BASE, { max: 1, ssl: false });
let efimera: postgres.Sql | null = null;

/** De dónde salen hoy las sillas de una sala. */
async function modoSillasDe(db: postgres.Sql, salaId: string): Promise<string> {
  const [f] = await db<Array<{ modo: string }>>`
    select sillas_modo as modo from salas where id = ${salaId}`;
  return f.modo;
}

/** La escena de una sala, leída de la base tal y como la lee la aplicación. */
async function escenaDe(db: postgres.Sql, salaId: string): Promise<EscenaCroquis> {
  const [f] = await db<Array<Record<string, unknown>>>`
    select * from salas where id = ${salaId}`;
  const sala: Sala = {
    id: String(f.id),
    sede_id: null,
    localizacion_id: null,
    codigo: null,
    nombre: String(f.nombre),
    tipologia: null,
    aforo: num(f.aforo),
    plantilla_id: null,
    largo_m: Number(f.largo_m ?? 0),
    ancho_m: Number(f.ancho_m ?? 0),
    alto_m: Number(f.alto_m ?? 0),
    alto_falso_techo_m: null,
    alto_canaleta_m: null,
    alto_suelo_tecnico_m: null,
    ruta_por_defecto: 'falso_techo',
    notas: null,
    mesa_largo_m: num(f.mesa_largo_m),
    mesa_ancho_m: num(f.mesa_ancho_m),
    mesa_alto_cm: num(f.mesa_alto_cm),
    mesa_x_m: num(f.mesa_x_m),
    mesa_y_m: num(f.mesa_y_m),
    mesa_rotacion_grados: Number(f.mesa_rotacion_grados ?? 0),
    diagrama_version: Number(f.diagrama_version ?? 0),
    sillas_modo: f.sillas_modo === 'manuales' ? 'manuales' : 'derivadas',
  };

  const muebles: MuebleEnSala[] = (
    await db<Array<Record<string, unknown>>>`
      select * from sala_mobiliario where sala_id = ${salaId} order by orden, nombre`
  ).map((m) => ({
    id: String(m.id),
    sala_id: salaId,
    mobiliario_id: m.mobiliario_id ? String(m.mobiliario_id) : null,
    nombre: String(m.nombre),
    forma: m.forma === 'circulo' ? 'circulo' : 'rectangulo',
    largo_m: num(m.largo_m),
    ancho_m: num(m.ancho_m),
    alto_m: num(m.alto_m),
    x_m: num(m.x_m),
    y_m: num(m.y_m),
    z_m: num(m.z_m),
    rotacion_grados: Number(m.rotacion_grados ?? 0),
    posicion_confirmada: m.posicion_confirmada === true,
    orden: Number(m.orden ?? 100),
  }));

  return construirEscena({ sala, equipos: [], conexiones: [], tomas: [], muebles });
}

try {
  await sql.unsafe(`create database ${nombreEfimera}`);
  console.log(`base efímera ${nombreEfimera}\n`);
  efimera = postgres(urlEfimera, { max: 1, ssl: false });
  const db = efimera;

  await db.unsafe(readFileSync('db/schema.sql', 'utf8'));
  await db.unsafe(readFileSync('db/seed.sql', 'utf8'));

  const { silla } = await asientoCanonico(db);
  if (!silla) throw new Error('la base efímera no tiene asiento canónico: revisa la siembra');

  // --------------------------------------------------------------- las salas
  // Cada una es un caso del inventario real, no una variación decorativa.
  const salas = {
    // Ocho puestos alrededor de una mesa centrada: la sala más repetida.
    tipica: randomUUID(),
    // Veinte puestos: el reparto llena los dos lados largos.
    aforoGrande: randomUUID(),
    // La mesa pegada al testero: una cabecera se queda fuera de la sala y el
    // reparto sienta a esa persona en otro lado.
    mesaArrimada: randomUUID(),
    // La mesa girada: las sillas giran con ella y no quedan alineadas.
    mesaGirada: randomUUID(),
    // Una mesa que ocupa la sala entera: no cabe ninguna silla.
    sinSitio: randomUUID(),
    // Ya materializada por el editor: el backfill no la vuelve a tocar.
    yaManuales: randomUUID(),
    // Sin medidas de mesa: no hay alrededor de qué colocarlas.
    sinMesa: randomUUID(),
    // Con mesa pero sin aforo: no hay sillas que materializar.
    sinAforo: randomUUID(),
    // Sin medir siquiera: la sala recién dada de alta.
    sinMedir: randomUUID(),
    // En derivadas y con una silla ya escrita: dos fuentes vivas.
    dosFuentes: randomUUID(),
    // Manual desde antes del backfill y SIN ningún asiento: solo una mesa
    // auxiliar. El backfill no la toca, así que el rollback tampoco puede.
    manualVacia: randomUUID(),
  };

  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
           values (${salas.tipica}, 'TEST backfill tipica', 4.7, 2.5, 3, 8, 2.4, 1.21)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
           values (${salas.aforoGrande}, 'TEST backfill aforo grande', 12, 6, 3, 20, 6, 1.6)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m, mesa_x_m, mesa_y_m)
           values (${salas.mesaArrimada}, 'TEST backfill mesa arrimada', 6, 4, 3, 8, 2.4, 1.2, 1.2, 2)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m, mesa_rotacion_grados)
           values (${salas.mesaGirada}, 'TEST backfill mesa girada', 8, 8, 3, 6, 2.4, 1.2, 35)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
           values (${salas.sinSitio}, 'TEST backfill sin sitio', 2.5, 1.2, 3, 6, 2.4, 1.2)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m, sillas_modo)
           values (${salas.yaManuales}, 'TEST backfill ya manuales', 6, 4, 3, 8, 2.4, 1.2, 'manuales')`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo)
           values (${salas.sinMesa}, 'TEST backfill sin mesa', 6, 4, 3, 8)`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, mesa_largo_m, mesa_ancho_m)
           values (${salas.sinAforo}, 'TEST backfill sin aforo', 6, 4, 3, 2.4, 1.2)`;
  await db`insert into salas (id, nombre) values (${salas.sinMedir}, 'TEST backfill sin medir')`;
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
           values (${salas.dosFuentes}, 'TEST backfill dos fuentes', 6, 4, 3, 8, 2.4, 1.2)`;
  await db`
    insert into sala_mobiliario (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, x_m, y_m, z_m, posicion_confirmada)
    values (${salas.dosFuentes}, ${silla.id}, ${silla.nombre}, 'circulo', 0.5, 0.5, 1, 1, 0, true)`;

  // La sala ya materializada trae sus filas, como las dejaría el editor.
  await db`
    insert into sala_mobiliario (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, x_m, y_m, z_m, posicion_confirmada)
    values (${salas.yaManuales}, ${silla.id}, ${silla.nombre}, 'circulo', 0.5, 0.5, 2, 1, 0, true)`;

  // Manual desde antes y sin ningún asiento: alguien la pasó a manuales y solo
  // colocó una mesa auxiliar. Es el caso que el rollback anterior estropeaba.
  await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m, sillas_modo)
           values (${salas.manualVacia}, 'TEST backfill manual vacia', 6, 4, 3, 8, 2.4, 1.2, 'manuales')`;
  await db`
    insert into sala_mobiliario (sala_id, nombre, forma, largo_m, ancho_m, x_m, y_m, z_m, posicion_confirmada)
    values (${salas.manualVacia}, 'Mesa auxiliar', 'rectangulo', 1, 0.6, 5, 3, 0, true)`;

  const ids = Object.values(salas);
  const antes = new Map<string, EscenaCroquis>();
  for (const id of ids) antes.set(id, await escenaDe(db, id));

  /** La versión del plano de una sala, que es lo que ve una pestaña abierta. */
  const versionDe = async (id: string): Promise<number> => {
    const [f] = await db<Array<{ v: number }>>`
      select diagrama_version as v from salas where id = ${id}`;
    return Number(f.v);
  };
  const versiones = async (): Promise<Map<string, number>> => {
    const m = new Map<string, number>();
    for (const id of ids) m.set(id, await versionDe(id));
    return m;
  };
  const sillasDe = async (id: string): Promise<number> => {
    const [f] = await db<Array<{ n: string }>>`
      select count(*)::text as n from sala_mobiliario
       where sala_id = ${id} and mobiliario_id = ${silla.id}`;
    return Number(f.n);
  };

  const versionesAlEmpezar = await versiones();

  // --------------------------------------------------------------- en seco
  const seco = await migrarSillas(db, { aplicar: false });
  afirmar(seco.enDerivadas === 9, 'el informe en seco cuenta las nueve salas en modo derivadas');
  afirmar(
    seco.materializadas === 4,
    'y materializaría las cuatro que tienen mesa, aforo y sitio para todas',
  );
  afirmar(seco.filas === 8 + 20 + 8 + 6, 'con una fila por silla dibujada, no una línea con cantidad');
  afirmar(seco.saltadas.length === 5, 'y deja escritas las cinco que se quedan en derivadas');

  const motivo = (id: string) => seco.saltadas.find((s) => s.id === id)?.motivo ?? '';
  afirmar(/no caben/.test(motivo(salas.sinSitio)), 'la sala donde no cabe ninguna silla se salta por eso');
  afirmar(/mesa/.test(motivo(salas.sinMesa)), 'la sala sin medidas de mesa se salta por eso');
  afirmar(/aforo/.test(motivo(salas.sinAforo)), 'la sala sin aforo se salta por eso');
  afirmar(/mesa/.test(motivo(salas.sinMedir)), 'la sala sin medir se salta por eso');
  afirmar(
    /dos fuentes/.test(motivo(salas.dosFuentes)),
    'la sala que ya tiene sillas escritas y sigue en derivadas se salta y se revisa a mano',
  );

  const [{ cuantas: enSeco }] = await db<Array<{ cuantas: string }>>`
    select count(*)::text as cuantas from sala_mobiliario`;
  afirmar(Number(enSeco) === 3, 'el informe en seco no ha escrito ninguna fila');

  {
    const ahora = await versiones();
    afirmar(
      ids.every((id) => ahora.get(id) === versionesAlEmpezar.get(id)),
      'y en seco tampoco mueve la versión del plano de ninguna sala',
    );
  }

  // -------------------------------------------------------------- aplicando
  const primera = await migrarSillas(db, { aplicar: true });
  afirmar(
    primera.materializadas === seco.materializadas && primera.filas === seco.filas,
    'aplicar escribe exactamente lo que anunció el informe en seco',
  );

  const materializadas = [salas.tipica, salas.aforoGrande, salas.mesaArrimada, salas.mesaGirada];
  for (const id of materializadas) {
    const escena = await escenaDe(db, id);
    const previas = sillasDibujadas(antes.get(id)!, silla.nombre);
    const actuales = sillasDibujadas(escena, silla.nombre);
    afirmar(
      previas.length > 0 && previas.length === actuales.length,
      `${escena.titulo}: el croquis dibuja las mismas ${previas.length} sillas después de materializarlas`,
    );
    afirmar(
      JSON.stringify(previas) === JSON.stringify(actuales),
      `${escena.titulo}: y en las mismas coordenadas y del mismo tamaño`,
    );
    afirmar(
      escena.sillas.length === 0,
      `${escena.titulo}: ya no quedan sillas derivadas, así que ninguna se dibuja dos veces`,
    );
  }

  for (const id of [salas.sinSitio, salas.sinMesa, salas.sinAforo, salas.sinMedir, salas.dosFuentes]) {
    const [{ modo }] = await db<Array<{ modo: string }>>`
      select sillas_modo as modo from salas where id = ${id}`;
    const escena = await escenaDe(db, id);
    afirmar(modo === 'derivadas', `${escena.titulo}: se queda en derivadas, que es el fallback`);
    afirmar(
      JSON.stringify(sillasDibujadas(antes.get(id)!, silla.nombre)) ===
        JSON.stringify(sillasDibujadas(escena, silla.nombre)),
      `${escena.titulo}: y se sigue dibujando exactamente igual que antes`,
    );
  }

  {
    const [{ cuantas }] = await db<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from sala_mobiliario where sala_id = ${salas.yaManuales}`;
    afirmar(Number(cuantas) === 1, 'la sala ya materializada no recibe sillas nuevas');
  }

  // ------------------------------------- la versión del plano tras el backfill
  //
  // Materializar ocho sillas es cambiar el plano. Si la versión no se mueve,
  // una pestaña de Diagrama abierta desde antes guarda con su número intacto.
  const versionesTrasPrimera = await versiones();
  {
    afirmar(
      materializadas.every(
        (id) => versionesTrasPrimera.get(id) === (versionesAlEmpezar.get(id) ?? 0) + 1,
      ),
      'cada sala materializada sube su versión del plano exactamente una vez',
    );
    const intactas = ids.filter((id) => !materializadas.includes(id));
    afirmar(
      intactas.every((id) => versionesTrasPrimera.get(id) === versionesAlEmpezar.get(id)),
      'y las salas saltadas o ya manuales no mueven la suya: nadie les ha cambiado el dibujo',
    );
  }

  // ------------------------------------------------------- la segunda pasada
  const [{ cuantas: trasPrimera }] = await db<Array<{ cuantas: string }>>`
    select count(*)::text as cuantas from sala_mobiliario`;

  const segunda = await migrarSillas(db, { aplicar: true });
  const [{ cuantas: trasSegunda }] = await db<Array<{ cuantas: string }>>`
    select count(*)::text as cuantas from sala_mobiliario`;

  afirmar(segunda.filas === 0, 'ejecutarlo otra vez no materializa ninguna silla');
  afirmar(
    trasSegunda === trasPrimera,
    'y la base tiene exactamente las mismas filas que después de la primera pasada',
  );
  afirmar(
    segunda.enDerivadas === 5,
    'las únicas salas que siguen en derivadas son las cinco del fallback',
  );

  // Y el dibujo tampoco se mueve en la segunda pasada.
  for (const id of materializadas) {
    const escena = await escenaDe(db, id);
    afirmar(
      JSON.stringify(sillasDibujadas(antes.get(id)!, silla.nombre)) ===
        JSON.stringify(sillasDibujadas(escena, silla.nombre)),
      `${escena.titulo}: sigue dibujando lo mismo tras la segunda pasada`,
    );
  }

  {
    const ahora = await versiones();
    afirmar(
      ids.every((id) => ahora.get(id) === versionesTrasPrimera.get(id)),
      'y la segunda pasada no vuelve a subir la versión de ninguna sala: no ha cambiado nada',
    );
  }

  // ------------------------------- la pestaña que llevaba abierta desde antes
  //
  // El fallo entero, no el incremento: una pestaña de Diagrama leyó la versión
  // antes del backfill y guarda después. Su borrador trae `sillas_modo` a
  // manuales y las ocho sillas del aforo como altas, que es exactamente lo que
  // el editor manda al materializarlas. Sin control de versión ese guardado
  // escribiría OTRAS ocho encima de las del backfill.
  {
    const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
    const salaId = salas.tipica;
    const versionQueVeLaPestana = versionesAlEmpezar.get(salaId)!;
    const sillasAntes = await sillasDe(salaId);

    const altas = Array.from({ length: 8 }, (_, i) => ({
      id: randomUUID(),
      mobiliario_id: silla.id,
      nombre: silla.nombre,
      forma: 'circulo' as const,
      largo_m: 0.5,
      ancho_m: 0.5,
      alto_m: 0.9,
      x_m: 0.5 + i * 0.1,
      y_m: 0.5,
      z_m: 0,
      rotacion_grados: 0,
      posicion_confirmada: true,
      orden: 200 + i,
    }));

    let resultado;
    try {
      resultado = await guardarDiagramaSala({
        sala_id: salaId,
        versionEsperada: versionQueVeLaPestana,
        sala: null,
        equipos: [],
        equipos_alta: [],
        mobiliario_alta: altas,
        mobiliario_cambio: [],
        mobiliario_baja: [],
        tomas: [],
        puertas_alta: [],
        puertas_cambio: [],
        puertas_baja: [],
        inicio_diagrama: null,
        sillas_modo: 'manuales',
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
      resultado = { ok: true as const };
    }

    afirmar(
      resultado.ok === false && resultado.motivo === 'conflicto',
      'la pestaña que leyó la versión antes del backfill recibe conflicto al guardar',
    );
    afirmar(
      (await sillasDe(salaId)) === sillasAntes,
      'y ese borrador antiguo no llega a escribir una segunda copia de las sillas',
    );

    // Y con la versión de después sí entra: el conflicto es por el número, no
    // porque el guardado del plano se haya quedado inservible tras el backfill.
    const alDia = await versionDe(salaId);
    let segundoIntento;
    try {
      segundoIntento = await guardarDiagramaSala({
        sala_id: salaId,
        versionEsperada: alDia,
        sala: null,
        equipos: [],
        equipos_alta: [],
        mobiliario_alta: [],
        mobiliario_cambio: [],
        mobiliario_baja: [],
        tomas: [],
        puertas_alta: [],
        puertas_cambio: [],
        puertas_baja: [],
        inicio_diagrama: null,
        sillas_modo: null,
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
      segundoIntento = { ok: true as const };
    }
    afirmar(
      segundoIntento.ok === true,
      'y releyendo la versión de después el mismo guardado entra sin problema',
    );
  }

  // ------------------------------------------- de quién es cada fila
  // El rollback de un backfill de miles de filas no puede adivinar por
  // `creado_en` cuáles puso una persona: eso borra trabajo medido.
  {
    const [{ cuantas: delBackfill }] = await db<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from sala_mobiliario where fuente = 'backfill'`;
    afirmar(
      Number(delBackfill) === primera.filas,
      'todas las filas que escribe el backfill quedan marcadas fuente = backfill',
    );

    // La silla que coloca el técnico desde el editor: el mismo insert de
    // siempre, sin nombrar la columna. El defecto la deja en `app`.
    await db`
      insert into sala_mobiliario (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, x_m, y_m, z_m, posicion_confirmada)
      values (${salas.tipica}, ${silla.id}, ${silla.nombre}, 'circulo', 0.5, 0.5, 4, 2, 0, true)`;
    const [{ fuente }] = await db<Array<{ fuente: string }>>`
      select fuente from sala_mobiliario where sala_id = ${salas.tipica} and x_m = 4`;
    afirmar(
      fuente === 'app',
      'una silla escrita como la escribe la aplicación nace en app sin tocar ningún insert',
    );

    const modoDe = async (id: string) =>
      (
        await db<Array<{ modo: string }>>`select sillas_modo as modo from salas where id = ${id}`
      )[0].modo;

    // El rollback documentado, ejecutado LITERALMENTE: es la misma constante
    // que se pega en la consola, no una copia parecida escrita aquí. Una
    // prueba que ejecuta otro SQL prueba otro rollback.
    const versionesAntesDelRollback = await versiones();
    await db.unsafe(SQL_ROLLBACK_BACKFILL);

    const [{ cuantas: quedan }] = await db<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from sala_mobiliario where fuente = 'backfill'`;
    afirmar(Number(quedan) === 0, 'el rollback por fuente se lleva las filas del backfill');

    const [{ cuantas: aMano }] = await db<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from sala_mobiliario
       where sala_id = ${salas.tipica} and x_m = 4`;
    afirmar(
      Number(aMano) === 1,
      'y deja intacta la silla que colocó una persona en la misma sala y el mismo minuto',
    );

    afirmar(
      (await modoDe(salas.aforoGrande)) === 'derivadas',
      'la sala que solo tenía sillas del backfill vuelve a derivadas',
    );
    afirmar(
      (await modoDe(salas.tipica)) === 'manuales',
      'y la que conserva una silla puesta a mano se queda en manuales, sin volver a repartir el aforo encima',
    );
    afirmar(
      (await modoDe(salas.yaManuales)) === 'manuales',
      'la sala que ya estaba materializada antes del backfill no la toca el rollback',
    );

    // ------------------------- la sala manual que el backfill nunca tocó
    //
    // Aquí es donde el rollback anterior hacía daño: recorría TODAS las salas
    // en `manuales` y devolvía a `derivadas` cualquiera sin asientos. Esta
    // sala la pasó a manuales una persona, solo tiene una mesa auxiliar y el
    // backfill no le escribió ni una fila. El rollback no puede verla.
    afirmar(
      (await modoDe(salas.manualVacia)) === 'manuales',
      'una sala manual preexistente y SIN sillas se queda en manuales: el rollback no la había tocado',
    );
    {
      const [{ n }] = await db<Array<{ n: string }>>`
        select count(*)::text as n from sala_mobiliario where sala_id = ${salas.manualVacia}`;
      afirmar(Number(n) === 1, 'y conserva su mueble');
    }
    {
      const [{ n }] = await db<Array<{ n: string }>>`
        select count(*)::text as n from sala_mobiliario where sala_id = ${salas.yaManuales}`;
      afirmar(
        Number(n) === 1,
        'la sala manual preexistente con una silla de fuente app la conserva entera',
      );
    }

    // --------------------------------------- qué salas mueven su versión
    //
    // Perder las sillas es cambiar el plano, se vuelva a `derivadas` o no. Y
    // no cambiarlo es no moverla: una sala a la que el rollback no borra nada
    // no puede tumbar el borrador de nadie.
    {
      const ahora = await versiones();
      const cambiadas = [salas.tipica, salas.aforoGrande, salas.mesaArrimada, salas.mesaGirada];
      afirmar(
        cambiadas.every((id) => ahora.get(id) === versionesAntesDelRollback.get(id)! + 1),
        'el rollback sube la versión de cada sala cuyo dibujo cambia, incluida la que sigue en manuales',
      );
      const intactas = ids.filter((id) => !cambiadas.includes(id));
      afirmar(
        intactas.every((id) => ahora.get(id) === versionesAntesDelRollback.get(id)),
        'y no toca la versión de ninguna sala que no pierde filas',
      );
    }

    // ------------------------------------------ la pestaña abierta antes
    {
      const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
      let resultado;
      try {
        resultado = await guardarDiagramaSala({
          sala_id: salas.aforoGrande,
          versionEsperada: versionesAntesDelRollback.get(salas.aforoGrande)!,
          sala: null,
          equipos: [],
          equipos_alta: [],
          mobiliario_alta: [],
          mobiliario_cambio: [],
          mobiliario_baja: [],
          tomas: [],
          puertas_alta: [],
          puertas_cambio: [],
          puertas_baja: [],
          inicio_diagrama: null,
          sillas_modo: null,
        });
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
        resultado = { ok: true as const };
      }
      afirmar(
        resultado.ok === false && resultado.motivo === 'conflicto',
        'una pestaña abierta antes del rollback recibe conflicto al guardar después',
      );
    }

    // ------------------------------------------------ la segunda vuelta
    {
      const versionesAntes = await versiones();
      const [{ n: filasAntes }] = await db<Array<{ n: string }>>`
        select count(*)::text as n from sala_mobiliario`;
      const modosAntes = await db<Array<{ id: string; modo: string }>>`
        select id, sillas_modo as modo from salas order by id`;

      await db.unsafe(SQL_ROLLBACK_BACKFILL);

      const [{ n: filasDespues }] = await db<Array<{ n: string }>>`
        select count(*)::text as n from sala_mobiliario`;
      const modosDespues = await db<Array<{ id: string; modo: string }>>`
        select id, sillas_modo as modo from salas order by id`;
      const ahora = await versiones();

      afirmar(filasAntes === filasDespues, 'ejecutar el rollback dos veces no borra nada más');
      afirmar(
        JSON.stringify(modosAntes) === JSON.stringify(modosDespues),
        'ni cambia el modo de ninguna sala',
      );
      afirmar(
        ids.every((id) => ahora.get(id) === versionesAntes.get(id)),
        'ni sube ninguna versión: sin filas que borrar no hay plano que cambie',
      );
    }

    // Se deja como estaba para lo que queda de verificación.
    await db`delete from sala_mobiliario where sala_id = ${salas.tipica}`;
    await db`update salas set sillas_modo = 'derivadas' where id = ${salas.tipica}`;
  }

  // ------------------------------- una sala a medias no se queda a medias
  //
  // El backfill es sala a sala y entero o nada. Se fuerza el fallo con un
  // disparador que rechaza la inserción de una silla en una sala concreta: si
  // la transacción no cubriera las filas Y el cambio de modo, quedarían sillas
  // escritas sin modo, o un modo cambiado con la versión subida y sin sillas.
  {
    const salaFallo = randomUUID();
    await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
             values (${salaFallo}, 'TEST backfill fallo parcial', 4.7, 2.5, 3, 8, 2.4, 1.21)`;
    const versionAntes = await versionDe(salaFallo);

    await db.unsafe(`
      create or replace function test_rompe_backfill() returns trigger as $$
      begin
        if new.sala_id = '${salaFallo}' then
          raise exception 'fallo forzado en la sala de prueba';
        end if;
        return new;
      end;
      $$ language plpgsql;
      create trigger test_rompe_backfill before insert on sala_mobiliario
        for each row execute function test_rompe_backfill();`);

    let lanzo = false;
    try {
      await migrarSillas(db, { aplicar: true });
    } catch {
      lanzo = true;
    } finally {
      await db.unsafe(`
        drop trigger if exists test_rompe_backfill on sala_mobiliario;
        drop function if exists test_rompe_backfill();`);
    }

    afirmar(lanzo, 'un fallo al insertar una silla no se traga: el backfill se para y lo dice');
    const [{ n }] = await db<Array<{ n: string }>>`
      select count(*)::text as n from sala_mobiliario where sala_id = ${salaFallo}`;
    afirmar(Number(n) === 0, 'y la sala que falló no se queda con filas a medias');
    afirmar(
      (await modoSillasDe(db, salaFallo)) === 'derivadas',
      'ni con el modo cambiado sin sus sillas',
    );
    afirmar(
      (await versionDe(salaFallo)) === versionAntes,
      'ni con la versión del plano subida por un cambio que no llegó a existir',
    );

    await db`delete from salas where id = ${salaFallo}`;
  }

  // --------------------------------------- la puerta de la base remota
  // Escribir en una base que no es local exige teclear su nombre. Es lógica
  // pura, así que se comprueba aquí mismo y sin base de por medio.
  {
    const puerta = (
      aplicar: boolean,
      local: boolean,
      confirmo: string | null,
      base = 'av_design_prod',
    ) => escrituraAutorizada({ aplicar, local, base, confirmo });

    afirmar(puerta(true, true, null), 'contra localhost se escribe sin ceremonia');
    afirmar(puerta(false, false, null), 'en seco contra una base remota se permite: leer no rompe nada');
    afirmar(!puerta(true, false, null), 'contra una base remota no se escribe sin confirmación');
    afirmar(!puerta(true, false, 'si'), 'y una confirmación que se teclea por inercia no vale');
    afirmar(
      !puerta(true, false, 'av_design'),
      'ni el nombre de otra base: hay que nombrar la de destino',
    );
    afirmar(
      puerta(true, false, 'av_design_prod'),
      'con el nombre exacto de la base de destino sí se escribe',
    );
    afirmar(
      nombreDeLaBase('postgres://u:p@ep-algo.neon.tech/av_design_prod?sslmode=require') ===
        'av_design_prod',
      'el nombre de la base se lee de la dirección aunque lleve parámetros',
    );

    afirmar(
      esBaseLocal('postgres://av_design:x@localhost:5433/av_design') &&
        esBaseLocal('postgres://av_design:x@127.0.0.1:5433/av_design'),
      'la base de Docker se reconoce como local por localhost y por 127.0.0.1',
    );
    afirmar(
      !esBaseLocal('postgres://u:p@ep-algo.neon.tech/av_design_prod?sslmode=require'),
      'y una base de Neon no',
    );
    // Buscar «127.0.0.1» dentro de la cadena daba por local un host que
    // solamente lo lleva escrito, y ahí es donde se cuela una escritura.
    afirmar(
      !esBaseLocal('postgres://u:p@127.0.0.1.tunel.example:5433/av_design_prod'),
      'un host que solo CONTIENE 127.0.0.1 no es local: se compara el host, no la cadena',
    );
    afirmar(!esBaseLocal('esto no es una dirección'), 'y una dirección ilegible se trata como remota');
  }

  // ============================================== el orden de cerrojos
  //
  // El backfill y el rollback tocan las MISMAS filas que el editor del plano:
  // `salas` y `sala_mobiliario`. Si los cogen en orden contrario a
  // `guardarDiagramaSala` —hija primero, sala después— cada uno se queda con el
  // cerrojo que espera el otro y Postgres mata a uno de los dos. Un backfill
  // que muere a la mitad de 390 salas de madrugada es justo lo que no puede
  // pasar, y no lo cazaba nada: las pruebas de concurrencia cruzan Diagrama con
  // Resumen, Equipamiento y Tomas, pero no con estos dos.
  //
  // Se comprueba igual que allí: una barrera retiene la fila de la sala, se
  // lanza el contendiente sin esperar y se le mira la mano con `pg_locks`. Si
  // llega a la espera con `sala_mobiliario` ya cogida para escribir, el orden
  // está invertido.
  {
    const barrera = postgres(urlEfimera, { max: 1, ssl: false });
    const observador = postgres(urlEfimera, { max: 1, ssl: false });
    // El backfill necesita su propia conexión: la de la verificación tiene una
    // sola y se quedaría esperándose a sí misma.
    const ejecutor = postgres(urlEfimera, { max: 1, ssl: false });
    const abiertas: Array<{ soltar: () => void; fin: Promise<unknown> }> = [];

    async function tomarBarrera(sala: string) {
      let soltar!: () => void;
      let tomada!: () => void;
      const liberada = new Promise<void>((r) => {
        soltar = r;
      });
      const cogida = new Promise<void>((r) => {
        tomada = r;
      });
      let pid = 0;
      const fin = barrera.begin(async (tx) => {
        const [f] = await tx<Array<{ pid: number }>>`select pg_backend_pid() as pid`;
        pid = Number(f.pid);
        await tx`select id from salas where id = ${sala} for update`;
        tomada();
        await liberada;
      });
      await cogida;
      abiertas.push({ soltar, fin });
      return { pid, soltar, fin };
    }

    /** La cadena entera de quien espera, no solo el eslabón inmediato. */
    const bloqueadosPor = async (pid: number): Promise<number[]> => {
      const filas = await observador<Array<{ pid: number; por: number[] }>>`
        select pid, pg_blocking_pids(pid) as por from pg_stat_activity
         where datname = current_database() and pid <> pg_backend_pid()
           and cardinality(pg_blocking_pids(pid)) > 0`;
      const cadena = new Set<number>([pid]);
      for (let vuelta = 0; vuelta < filas.length + 1; vuelta += 1) {
        for (const f of filas) {
          if (f.por.some((p) => cadena.has(Number(p)))) cadena.add(Number(f.pid));
        }
      }
      cadena.delete(pid);
      return [...cadena];
    };

    const esperarBloqueados = async (pid: number, cuantos: number): Promise<number[]> => {
      let lista: number[] = [];
      for (let i = 0; i < 240; i += 1) {
        lista = await bloqueadosPor(pid);
        if (lista.length >= cuantos) return lista;
        await new Promise((r) => setTimeout(r, 25));
      }
      return lista;
    };

    const hijasYaTomadas = async (pids: number[]): Promise<string[]> => {
      if (pids.length === 0) return [];
      const filas = await observador<Array<{ tabla: string }>>`
        select distinct l.relation::regclass::text as tabla
          from pg_locks l
         where l.locktype = 'relation' and l.granted
           and l.mode = 'RowExclusiveLock'
           and l.pid = any(${pids})
           and l.relation::regclass::text in ('sala_mobiliario', 'sala_equipos', 'tomas_red')`;
      return filas.map((f) => String(f.tabla));
    };

    const esAbrazoMortal = (e: unknown) => {
      const codigo = (e as { code?: string })?.code;
      const mensaje = e instanceof Error ? e.message : String(e);
      return codigo === '40P01' || /deadlock/i.test(mensaje);
    };

    try {
      const salaCarrera = randomUUID();
      const salaCruce = randomUUID();
      for (const [id, nombre] of [
        [salaCarrera, 'TEST cerrojos backfill'],
        [salaCruce, 'TEST cerrojos cruce'],
      ] as const) {
        await db`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
                 values (${id}, ${nombre}, 4.7, 2.5, 3, 8, 2.4, 1.21)`;
      }

      // ------------------------------------------------------ el backfill
      {
        const { pid, soltar, fin } = await tomarBarrera(salaCarrera);
        const pBackfill = migrarSillas(ejecutor, { aplicar: true });
        const parados = await esperarBloqueados(pid, 1);
        const hijas = await hijasYaTomadas(parados);
        if (hijas.length > 0) console.log(`      (el backfill ya tenía cogida ${hijas.join(', ')})`);
        afirmar(
          parados.length > 0 && hijas.length === 0,
          'el backfill espera el cerrojo de la sala SIN haber escrito antes en sala_mobiliario',
        );
        soltar();
        await fin;
        await pBackfill;
        afirmar(
          (await sillasDe(salaCarrera)) === 8,
          'y al soltar lo escribe entero: bloquear primero no le quita el trabajo',
        );
      }

      // ------------------------------------------------------- el rollback
      {
        const { pid, soltar, fin } = await tomarBarrera(salaCarrera);
        // `.execute()` y no dejarlo colgando: la consulta de `postgres.js` es
        // perezosa y no se manda hasta que alguien la espera. Sin esto el
        // contendiente no existía todavía cuando se le iba a mirar la mano, y
        // la comprobación medía el vacío.
        const pRollback = ejecutor.unsafe(SQL_ROLLBACK_BACKFILL).execute();
        const parados = await esperarBloqueados(pid, 1);
        const hijas = await hijasYaTomadas(parados);
        if (hijas.length > 0) console.log(`      (el rollback ya tenía cogida ${hijas.join(', ')})`);
        afirmar(
          parados.length > 0 && hijas.length === 0,
          'el rollback espera el cerrojo de la sala SIN haber borrado antes de sala_mobiliario',
        );
        soltar();
        await fin;
        await pRollback;
        afirmar(
          (await sillasDe(salaCarrera)) === 0,
          'y al soltar deshace lo suyo entero',
        );
      }

      // ---------------------- geometría que cambia mientras espera el backfill
      //
      // La consulta inicial del backfill no bloquea: puede leer aforo ocho y
      // quedarse esperando mientras Diagrama, que ya estaba delante en la cola
      // del mismo cerrojo, lo cambia a dos. Cuando el backfill entra tiene que
      // releer TODA la geometría bajo el lock. Releer solo `sillas_modo`
      // materializaba las ocho posiciones obsoletas y las convertía en datos
      // manuales, aunque el estado que acababa de ganar la carrera dibujaba dos.
      {
        const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
        const salaGeometria = randomUUID();
        await db`
          insert into salas
            (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
          values
            (${salaGeometria}, 'AAA TEST geometria concurrente', 4.7, 2.5, 3, 8, 2.4, 1.21)`;
        const version = await versionDe(salaGeometria);
        const { pid, soltar, fin } = await tomarBarrera(salaGeometria);

        // Diagrama entra primero en la cola del lock y cambia el aforo. El
        // backfill se lanza después, pero su SELECT inicial todavía ve ocho.
        const pPlano = guardarDiagramaSala({
          sala_id: salaGeometria,
          versionEsperada: version,
          sala: {
            largo_m: 4.7,
            ancho_m: 2.5,
            alto_m: 3,
            aforo: 2,
            mesa_largo_m: 2.4,
            mesa_ancho_m: 1.21,
            mesa_alto_cm: null,
            mesa_x_m: null,
            mesa_y_m: null,
            mesa_rotacion_grados: 0,
          },
          equipos: [],
          equipos_alta: [],
          mobiliario_alta: [],
          mobiliario_cambio: [],
          mobiliario_baja: [],
          tomas: [],
          puertas_alta: [],
          puertas_cambio: [],
          puertas_baja: [],
          inicio_diagrama: null,
          sillas_modo: null,
        }).catch((e) => {
          const mensaje = e instanceof Error ? e.message : String(e);
          if (esAbrazoMortal(e)) throw e;
          if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
          return { ok: true as const, version: -1, ids: {} };
        });
        afirmar(
          (await esperarBloqueados(pid, 1)).length >= 1,
          'Diagrama espera primero el cerrojo antes de cambiar la geometría',
        );

        const pBackfill = migrarSillas(ejecutor, { aplicar: true });
        afirmar(
          (await esperarBloqueados(pid, 2)).length >= 2,
          'el backfill espera detrás mientras su snapshot inicial aún tiene el aforo anterior',
        );

        soltar();
        await fin;
        const resultados = await Promise.allSettled([pPlano, pBackfill]);
        for (const r of resultados) {
          if (r.status === 'rejected') throw r.reason;
        }

        const [estado] = await db<Array<{ aforo: number; sillas_modo: string; version: number }>>`
          select aforo, sillas_modo, diagrama_version as version
            from salas where id = ${salaGeometria}`;
        afirmar(
          Number(estado.aforo) === 2 && estado.sillas_modo === 'manuales',
          'gana la geometría nueva y el backfill materializa ese estado, no el snapshot obsoleto',
        );
        afirmar(
          (await sillasDe(salaGeometria)) === 2,
          'el backfill relee el aforo bajo el lock: quedan dos sillas y no las ocho anteriores',
        );
        afirmar(
          Number(estado.version) === version + 2,
          'Diagrama y backfill cuentan como dos mutaciones efectivas de la versión',
        );

        await ejecutor.unsafe(SQL_ROLLBACK_BACKFILL);
        await db`delete from salas where id = ${salaGeometria}`;
      }

      // --------------------------------- el cruce: backfill contra Diagrama
      //
      // Los dos contendientes vivos a la vez sobre la misma fila. Con el orden
      // unificado uno espera al otro; con el orden invertido, uno de los dos
      // moría con 40P01.
      {
        const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
        const version = await versionDe(salaCruce);
        const { pid, soltar, fin } = await tomarBarrera(salaCruce);

        const pBackfill = migrarSillas(ejecutor, { aplicar: true });
        await esperarBloqueados(pid, 1);
        const pPlano = guardarDiagramaSala({
          sala_id: salaCruce,
          versionEsperada: version,
          sala: null,
          equipos: [],
          equipos_alta: [],
          mobiliario_alta: [],
          mobiliario_cambio: [],
          mobiliario_baja: [],
          tomas: [],
          puertas_alta: [],
          puertas_cambio: [],
          puertas_baja: [],
          inicio_diagrama: null,
          sillas_modo: null,
        }).catch((e) => {
          const mensaje = e instanceof Error ? e.message : String(e);
          if (esAbrazoMortal(e)) throw e;
          if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
          return { ok: true as const, version: -1, ids: {} };
        });
        const dos = await esperarBloqueados(pid, 2);
        afirmar(
          dos.length >= 2,
          'el backfill y un guardado del plano esperan a la vez el mismo cerrojo de sala',
        );

        soltar();
        await fin;
        const resultados = await Promise.allSettled([pBackfill, pPlano]);
        const muerto = resultados.find(
          (r) => r.status === 'rejected' && esAbrazoMortal(r.reason),
        );
        afirmar(!muerto, 'y ninguno de los dos muere por abrazo mortal');
        for (const r of resultados) {
          if (r.status === 'rejected' && !esAbrazoMortal(r.reason)) throw r.reason;
        }
        afirmar(
          (await sillasDe(salaCruce)) === 8,
          'el backfill termina entero pese al cruce',
        );
        afirmar(
          (await versionDe(salaCruce)) === version + 1,
          'y la versión sube una sola vez: el guardado que llegó tarde ve el número movido',
        );
      }

      // Se deja el terreno como estaba para lo que queda de verificación.
      await ejecutor.unsafe(SQL_ROLLBACK_BACKFILL);
      await db`delete from salas where id in (${salaCarrera}, ${salaCruce})`;
      await db`update salas set sillas_modo = 'derivadas' where id = ${salas.tipica}`;
      await db`delete from sala_mobiliario where sala_id = ${salas.tipica}`;
    } finally {
      for (const b of abiertas) {
        b.soltar();
        await b.fin.catch(() => {});
      }
      await barrera.end();
      await observador.end();
      await ejecutor.end();
    }
  }

  // --------------------------------------------- sin la referencia canónica
  // Sin asiento en el catálogo no se inventa un mueble sin referencia: se
  // saltan todas y se dice por qué.
  await db`update catalogo_mobiliario set activo = false where rol = 'asiento'`;
  await db`update salas set sillas_modo = 'derivadas' where id = ${salas.tipica}`;
  await db`delete from sala_mobiliario where sala_id = ${salas.tipica}`;
  const sinCatalogo = await migrarSillas(db, { aplicar: true });
  afirmar(
    sinCatalogo.materializadas === 0 && sinCatalogo.filas === 0,
    'sin asiento activo en el catálogo no se materializa ninguna sala',
  );
  afirmar(
    sinCatalogo.saltadas.every((s) => /referencia canónica/.test(s.motivo)),
    'y todas se saltan diciendo que falta la referencia canónica del catálogo',
  );
} finally {
  if (efimera) await efimera.end();
  await sql.unsafe(`drop database if exists ${nombreEfimera} with (force)`);
  console.log(`\nbase efímera ${nombreEfimera} eliminada`);
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
