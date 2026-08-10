/**
 * Las guardas de `guardarDiagramaSala` contra Postgres real.
 *
 * No es parte de `npm test`: `npm test` es la lógica pura de `src/lib`
 * (AGENTS.md), y esto necesita base de datos e importa código de servidor.
 * Se ejecuta con:
 *
 *   npm run test:diagrama
 *
 * Qué comprueba:
 *
 * - Guardado completo: sala, equipo y roseta en una sola operación, y la
 *   versión sube.
 * - Fallo a mitad: se inyecta un error real en el último `update` de la
 *   transacción y no queda NADA escrito, ni siquiera la sala, que se escribe
 *   primero. Es la única forma de demostrar que la transacción existe; una
 *   guarda que rechaza antes de escribir no lo demuestra.
 * - Versión obsoleta: el segundo guardado con la versión vieja no sobrescribe.
 * - Equipo o roseta de otra sala: se rechaza el guardado entero.
 * - Id inventado: se rechaza.
 * - Id repetido: se rechaza, en vez de aplicar el último y llamarlo guardado.
 * - Proyecto cerrado: no se escribe nada.
 * - Sala legado (sin `localizacion_id`): SÍ se escribe. Es el control positivo
 *   que impide que la acción se convierta en un no-op permanente y pase todas
 *   las comprobaciones negativas por no hacer nunca nada.
 *
 * Mismas reglas que `verificar-guarda-equipos.mts`:
 *
 * - No se escribe, sobrescribe ni borra `node_modules/server-only`. Se
 *   intercepta en memoria en `Module._load`, para ese único especificador.
 * - El único error tolerado es el `Invariant: static generation store missing`
 *   que lanza `revalidatePath()` de Next fuera de una petición real. En esta
 *   acción se lanza DESPUÉS del commit y solo cuando el guardado salió bien,
 *   así que además es la señal de que se escribió.
 */

import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';

type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const moduloInterno = Module as unknown as ModuloConLoad;
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  return cargarOriginal.call(Module, request, ...resto);
};

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });

const PREFIJO_SEÑAL_REVALIDATE = 'Invariant: static generation store missing in ';
const CODIGO_SEÑAL_REVALIDATE = 'E263';

let ok = true;
let total = 0;
let pasadas = 0;
const afirmar = (cond: boolean, mensaje: string) => {
  total += 1;
  if (cond) pasadas += 1;
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${mensaje}`);
  if (!cond) ok = false;
};

// ------------------------------------------------------------------ datos

const proyectoId = randomUUID();
const localizacionId = randomUUID();
const salaCerradaId = randomUUID();
const salaLegadoId = randomUUID();
const salaVecinaId = randomUUID();

async function limpiar() {
  await sql`delete from salas where id in (${salaCerradaId}, ${salaLegadoId}, ${salaVecinaId})`;
  await sql`delete from hitos_proyecto where proyecto_id = ${proyectoId}`;
  await sql`delete from localizaciones where id = ${localizacionId}`;
  await sql`delete from proyectos where id = ${proyectoId}`;
  await sql`drop trigger if exists test_diagrama_revienta on tomas_red`;
  await sql`drop function if exists test_diagrama_revienta()`;
}

async function preparar() {
  await limpiar();
  await sql`insert into proyectos (id, nombre) values (${proyectoId}, 'TEST-diagrama')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre)
            values (${localizacionId}, ${proyectoId}, 'TEST')`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo, fecha)
            values (${proyectoId}, 'cierre', now())`;
  await sql`insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
            values (${salaCerradaId}, 'TEST diagrama cerrada', ${localizacionId}, 3, 3, 3)`;
  // Sala legado: sin localizacion_id, editable, como cualquier sala anterior a
  // la jerarquía de obra.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo)
            values (${salaLegadoId}, 'TEST diagrama legado', 6, 4, 3, 8)`;
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaVecinaId}, 'TEST diagrama vecina', 6, 4, 3)`;
}

async function nuevoEquipo(salaId: string, etiqueta: string): Promise<string> {
  const id = randomUUID();
  await sql`
    insert into sala_equipos (id, sala_id, nombre, cantidad, extremo, x_m, y_m, z_m, posicion_confirmada)
    values (${id}, ${salaId}, ${etiqueta}, 1, 'pared', 0, 0, 0, false)`;
  return id;
}

async function nuevaToma(salaId: string, etiqueta: string): Promise<string> {
  const id = randomUUID();
  await sql`insert into tomas_red (id, sala_id, codigo) values (${id}, ${salaId}, ${etiqueta})`;
  return id;
}

const versionDe = async (salaId: string): Promise<number> => {
  const [f] = await sql<Array<{ diagrama_version: number }>>`
    select diagrama_version from salas where id = ${salaId}`;
  return Number(f.diagrama_version);
};

const equipoDe = async (id: string) => {
  const [f] = await sql<Array<{ x_m: string; y_m: string; posicion_confirmada: boolean }>>`
    select x_m, y_m, posicion_confirmada from sala_equipos where id = ${id}`;
  return f;
};

// ---------------------------------------------------------------- ejecución

try {
  await preparar();

  const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
  type Patch = Parameters<typeof guardarDiagramaSala>[0];
  type Resultado = Awaited<ReturnType<typeof guardarDiagramaSala>>;

  /**
   * Invoca la acción tolerando solo la señal esperada de `revalidatePath()`.
   * Esa señal solo se lanza después de un commit correcto, así que aquí
   * equivale a `{ ok: true }`. Cualquier otro error se relanza.
   */
  const invocar = async (patch: Patch): Promise<Resultado> => {
    try {
      return await guardarDiagramaSala(patch);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const codigo = (e as { ['__NEXT_ERROR_CODE']?: string })?.['__NEXT_ERROR_CODE'];
      if (!(mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE) && codigo === CODIGO_SEÑAL_REVALIDATE)) {
        throw e;
      }
      return { ok: true, version: await versionDe(patch.sala_id) };
    }
  };

  const patchBase = (salaId: string, version: number): Patch => ({
    sala_id: salaId,
    versionEsperada: version,
    sala: null,
    equipos: [],
    tomas: [],
  });

  // --------------------------------------------------- 1 · guardado completo
  {
    const equipoId = await nuevoEquipo(salaLegadoId, 'TEST equipo legado');
    const tomaId = await nuevaToma(salaLegadoId, 'TEST-1');
    const antes = await versionDe(salaLegadoId);

    const r = await invocar({
      ...patchBase(salaLegadoId, antes),
      sala: {
        largo_m: 5.2,
        ancho_m: 3.1,
        alto_m: 2.8,
        aforo: 10,
        mesa_largo_m: 2.4,
        mesa_ancho_m: 1.2,
        mesa_alto_cm: 73,
        mesa_x_m: 2.6,
        mesa_y_m: 1.5,
        mesa_rotacion_grados: 450,
      },
      equipos: [{ id: equipoId, x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true }],
      tomas: [{ id: tomaId, x_m: 1.2, y_m: 0.4, z_m: 0 }],
    });

    afirmar(r.ok, 'sala legado: el guardado completo sale bien');

    const [s] = await sql<Array<Record<string, string>>>`
      select largo_m, mesa_x_m, mesa_rotacion_grados from salas where id = ${salaLegadoId}`;
    afirmar(Number(s.largo_m) === 5.2, 'sala legado: se escriben las medidas');
    afirmar(Number(s.mesa_x_m) === 2.6, 'sala legado: se escribe el centro de la mesa');
    afirmar(
      Number(s.mesa_rotacion_grados) === 90,
      'sala legado: el giro se normaliza en el servidor (450° → 90°)',
    );

    const e = await equipoDe(equipoId);
    afirmar(
      e.posicion_confirmada === true,
      'el origen (0,0,0) se puede confirmar: la esquina es un sitio, no un hueco',
    );

    const [t] = await sql<Array<{ x_m: string }>>`select x_m from tomas_red where id = ${tomaId}`;
    afirmar(Number(t.x_m) === 1.2, 'se sitúa la roseta');

    afirmar(await versionDe(salaLegadoId) === antes + 1, 'la versión sube en uno');
  }

  // --------------------------------------------------- 2 · versión obsoleta
  {
    const equipoId = await nuevoEquipo(salaLegadoId, 'TEST equipo version');
    const version = await versionDe(salaLegadoId);

    const primero = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [{ id: equipoId, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true }],
    });
    afirmar(primero.ok, 'la primera pestaña guarda');

    const segundo = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [{ id: equipoId, x_m: 4, y_m: 4, z_m: 0, posicion_confirmada: true }],
    });
    afirmar(
      !segundo.ok && segundo.motivo === 'conflicto',
      'la segunda pestaña con la versión vieja se rechaza',
    );

    const e = await equipoDe(equipoId);
    afirmar(Number(e.x_m) === 1, 'y no sobrescribe lo que guardó la primera');
  }

  // --------------------------------------------------- 3 · pertenencia
  {
    const propio = await nuevoEquipo(salaLegadoId, 'TEST equipo propio');
    const ajeno = await nuevoEquipo(salaVecinaId, 'TEST equipo vecino');
    const tomaAjena = await nuevaToma(salaVecinaId, 'TEST-vecina');
    const version = await versionDe(salaLegadoId);

    const conAjeno = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [
        { id: propio, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true },
        { id: ajeno, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true },
      ],
    });
    afirmar(!conAjeno.ok && conAjeno.motivo === 'ajeno', 'un equipo de otra sala se rechaza');
    afirmar(
      Number((await equipoDe(propio)).x_m) === 0,
      'y el equipo propio del mismo patch tampoco se escribe',
    );
    afirmar(
      Number((await equipoDe(ajeno)).x_m) === 0,
      'el equipo de la otra sala se queda como estaba',
    );

    const conTomaAjena = await invocar({
      ...patchBase(salaLegadoId, version),
      tomas: [{ id: tomaAjena, x_m: 1, y_m: 1, z_m: 0 }],
    });
    afirmar(
      !conTomaAjena.ok && conTomaAjena.motivo === 'ajeno',
      'una roseta de otra sala se rechaza',
    );

    const inventado = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [{ id: randomUUID(), x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true }],
    });
    afirmar(!inventado.ok && inventado.motivo === 'ajeno', 'un id inventado se rechaza');

    const repetido = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [
        { id: propio, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true },
        { id: propio, x_m: 3, y_m: 3, z_m: 0, posicion_confirmada: true },
      ],
    });
    afirmar(!repetido.ok && repetido.motivo === 'ajeno', 'un id repetido se rechaza');

    const noUuid = await invocar({ ...patchBase('no-soy-un-uuid', version) });
    afirmar(!noUuid.ok && noUuid.motivo === 'invalido', 'un sala_id que no es uuid se rechaza');

    const noFinito = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [
        { id: propio, x_m: Number.NaN, y_m: 1, z_m: 0, posicion_confirmada: true },
      ],
    });
    afirmar(!noFinito.ok && noFinito.motivo === 'invalido', 'una coordenada NaN se rechaza');

    afirmar(
      (await versionDe(salaLegadoId)) === version,
      'ningún rechazo ha subido la versión',
    );
  }

  // --------------------------------------------------- 4 · proyecto cerrado
  {
    const equipoId = await nuevoEquipo(salaCerradaId, 'TEST equipo cerrado');
    const version = await versionDe(salaCerradaId);

    const r = await invocar({
      ...patchBase(salaCerradaId, version),
      sala: {
        largo_m: 9,
        ancho_m: 9,
        alto_m: 9,
        aforo: 99,
        mesa_largo_m: null,
        mesa_ancho_m: null,
        mesa_alto_cm: null,
        mesa_x_m: null,
        mesa_y_m: null,
        mesa_rotacion_grados: 0,
      },
      equipos: [{ id: equipoId, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true }],
    });
    afirmar(!r.ok && r.motivo === 'cerrado', 'la obra cerrada rechaza el guardado');

    const [s] = await sql<Array<{ largo_m: string }>>`
      select largo_m from salas where id = ${salaCerradaId}`;
    afirmar(Number(s.largo_m) === 3, 'y no cambia ni las medidas');
    afirmar(Number((await equipoDe(equipoId)).x_m) === 0, 'ni los equipos');
  }

  // --------------------------------------------------- 5 · sala que no existe
  {
    const r = await invocar(patchBase(randomUUID(), 0));
    afirmar(!r.ok && r.motivo === 'no_existe', 'una sala inventada se rechaza');
  }

  // --------------------------------------------------- 6 · fallo a mitad
  //
  // Se inyecta un error real en el ÚLTIMO `update` de la transacción (la
  // roseta) con un trigger temporal. La sala y el equipo se escriben antes,
  // así que si no hay transacción quedarían escritos. Es la única forma de
  // demostrar que la transacción existe: una guarda que rechaza antes de
  // escribir no demuestra nada sobre el rollback.
  {
    const equipoId = await nuevoEquipo(salaLegadoId, 'TEST equipo rollback');
    const tomaId = await nuevaToma(salaLegadoId, 'TEST-rollback');
    const version = await versionDe(salaLegadoId);
    const [salaAntes] = await sql<Array<{ largo_m: string }>>`
      select largo_m from salas where id = ${salaLegadoId}`;

    await sql`
      create or replace function test_diagrama_revienta() returns trigger as $$
      begin
        raise exception 'fallo inyectado a proposito por verificar-diagrama';
      end $$ language plpgsql`;
    await sql`
      create trigger test_diagrama_revienta
      before update on tomas_red
      for each row when (new.codigo = 'TEST-rollback')
      execute function test_diagrama_revienta()`;

    let reventó = false;
    try {
      await invocar({
        ...patchBase(salaLegadoId, version),
        sala: {
          largo_m: 99,
          ancho_m: 99,
          alto_m: 9,
          aforo: 99,
          mesa_largo_m: null,
          mesa_ancho_m: null,
          mesa_alto_cm: null,
          mesa_x_m: null,
          mesa_y_m: null,
          mesa_rotacion_grados: 0,
        },
        equipos: [{ id: equipoId, x_m: 3, y_m: 3, z_m: 0, posicion_confirmada: true }],
        tomas: [{ id: tomaId, x_m: 1, y_m: 1, z_m: 0 }],
      });
    } catch (e) {
      reventó = String(e).includes('fallo inyectado a proposito');
      if (!reventó) throw e;
    } finally {
      await sql`drop trigger if exists test_diagrama_revienta on tomas_red`;
      await sql`drop function if exists test_diagrama_revienta()`;
    }

    afirmar(reventó, 'el fallo a mitad se propaga en vez de tragarse');

    const [salaDespues] = await sql<Array<{ largo_m: string }>>`
      select largo_m from salas where id = ${salaLegadoId}`;
    afirmar(
      salaDespues.largo_m === salaAntes.largo_m,
      'rollback: la sala, que se escribe primero, no se queda escrita',
    );
    afirmar(
      Number((await equipoDe(equipoId)).x_m) === 0,
      'rollback: el equipo tampoco',
    );
    afirmar(
      (await versionDe(salaLegadoId)) === version,
      'rollback: la versión no sube',
    );
  }
  // --------------------------------------------------- 7 · límites de la sala
  //
  // Que el número sea finito no basta. El editor recorta contra la pared, pero
  // eso es comodidad del editor: aquí se llama a la acción directamente, que
  // es exactamente lo que hace una petición fabricada a mano.
  {
    const equipoId = await nuevoEquipo(salaLegadoId, 'TEST equipo limites');
    const medir = {
      largo_m: 6,
      ancho_m: 4,
      alto_m: 3,
      aforo: 8,
      mesa_largo_m: null,
      mesa_ancho_m: null,
      mesa_alto_cm: null,
      mesa_x_m: null,
      mesa_y_m: null,
      mesa_rotacion_grados: 0,
    };

    // Se deja la sala en 6 × 4 × 3 para que los límites sean conocidos.
    await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      sala: medir,
    });

    const enElBorde = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      equipos: [{ id: equipoId, x_m: 6, y_m: 4, z_m: 3, posicion_confirmada: true }],
    });
    afirmar(enElBorde.ok, 'el borde exacto entra: la pantalla va pegada a la pared');
    afirmar(Number((await equipoDe(equipoId)).x_m) === 6, 'y se escribe tal cual');

    for (const [etiqueta, punto] of [
      ['x', { x_m: 6.01, y_m: 2, z_m: 1 }],
      ['x negativa', { x_m: -0.01, y_m: 2, z_m: 1 }],
      ['y', { x_m: 3, y_m: 4.01, z_m: 1 }],
      ['z', { x_m: 3, y_m: 2, z_m: 3.01 }],
    ] as const) {
      const version = await versionDe(salaLegadoId);
      const r = await invocar({
        ...patchBase(salaLegadoId, version),
        equipos: [{ id: equipoId, ...punto, posicion_confirmada: true }],
      });
      afirmar(
        !r.ok && r.motivo === 'fuera',
        `un centímetro fuera en ${etiqueta} se rechaza, no se recorta`,
      );
      afirmar(
        Number((await equipoDe(equipoId)).x_m) === 6,
        `${etiqueta}: y el equipo se queda donde estaba`,
      );
      afirmar((await versionDe(salaLegadoId)) === version, `${etiqueta}: la versión no sube`);
    }

    // Medir la sala y colocar el equipo en el mismo guardado es el caso
    // normal: se valida contra las medidas del patch, no contra las de antes.
    const conMedidasNuevas = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      sala: { ...medir, largo_m: 9, ancho_m: 6 },
      equipos: [{ id: equipoId, x_m: 8.5, y_m: 5.5, z_m: 1, posicion_confirmada: true }],
    });
    afirmar(
      conMedidasNuevas.ok,
      'una coordenada que solo cabe en las medidas NUEVAS del patch entra',
    );
    afirmar(Number((await equipoDe(equipoId)).x_m) === 8.5, 'y se escribe');

    // Y encoger la sala dejando el equipo fuera se rechaza en el mismo patch.
    const encogiendo = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      sala: { ...medir, largo_m: 4, ancho_m: 3 },
      equipos: [{ id: equipoId, x_m: 8.5, y_m: 5.5, z_m: 1, posicion_confirmada: true }],
    });
    afirmar(
      !encogiendo.ok && encogiendo.motivo === 'fuera',
      'encoger la sala dejando el equipo fuera se rechaza',
    );

    // Una roseta a medias no sitúa nada.
    const tomaId = await nuevaToma(salaLegadoId, 'TEST-limites');
    const aMedias = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      tomas: [{ id: tomaId, x_m: 1, y_m: null, z_m: null }],
    });
    afirmar(!aMedias.ok && aMedias.motivo === 'fuera', 'media roseta situada se rechaza');

    const sinSituar = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      tomas: [{ id: tomaId, x_m: null, y_m: null, z_m: null }],
    });
    afirmar(sinSituar.ok, 'una roseta sin situar sigue siendo válida');

    // El centro de la mesa también cae dentro.
    const mesaFuera = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      sala: { ...medir, largo_m: 9, ancho_m: 6, mesa_x_m: 12, mesa_y_m: 3 },
    });
    afirmar(!mesaFuera.ok && mesaFuera.motivo === 'fuera', 'la mesa fuera de la sala se rechaza');

    // Sala sin medir: no hay dónde colocar nada.
    const sinMedir = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      sala: { ...medir, largo_m: 0, ancho_m: 0, alto_m: 0 },
      equipos: [{ id: equipoId, x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true }],
    });
    afirmar(
      !sinMedir.ok && sinMedir.motivo === 'fuera',
      'una sala sin medir no admite colocación confirmada',
    );

    // Control positivo: sin confirmar, la coordenada es un resto y no se juzga.
    const sinConfirmar = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      equipos: [{ id: equipoId, x_m: 99, y_m: 99, z_m: 99, posicion_confirmada: false }],
    });
    afirmar(
      sinConfirmar.ok,
      'un equipo sin confirmar no se juzga: su posición la deduce el croquis',
    );
  }
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
