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
  // `revalidatePath()` lanza fuera de una petición real. Se sustituye por un
  // no-op para poder leer lo que DEVUELVE la acción —el mapa de ids, entre
  // otras cosas— en vez de solo el estado que deja en la base. Lo que se
  // afirma sigue siendo el contenido de las tablas.
  if (request === 'next/cache') {
    return { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f };
  }
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
const salaVaciaId = randomUUID();
/** Vacía salvo por una roseta: aplicar una plantilla le cambiaría las medidas. */
const salaSoloTomaId = randomUUID();
/** Vacía, para la plantilla que solo trae una mesa auxiliar. */
const salaSinAsientosId = randomUUID();
/** Vacía, para la plantilla mal medida. */
const salaPlantillaFueraId = randomUUID();
/** Vacía pero YA iniciada desde cero: el origen se elige una vez. */
const salaDesdeCeroId = randomUUID();
/** Vacía, para la plantilla que trae una mesa principal. */
const salaMesaPrincipalId = randomUUID();
/** Con aforo y sin sillas: para el alta de asiento que debe cambiar de modo. */
const salaAsientosId = randomUUID();
/** Con aforo y sin sillas: para comprobar que un mueble corriente no lo toca. */
const salaMuebleCorrienteId = randomUUID();
/** Con equipos pero SIN iniciar: el único camino que queda al rechazo por ocupada. */
const salaOcupadaSinIniciarId = randomUUID();
/** Vacía: para la mesa principal que aparece DESPUÉS de la comprobación previa. */
const salaCarreraId = randomUUID();

// Catálogo de prueba. Se crea y se borra aquí: el catálogo real cambia y una
// prueba que dependa de que exista tal referencia falla el día que se corrige.
const articuloEquipoId = randomUUID();
const articuloCableId = randomUUID();
const articuloInactivoId = randomUUID();
const nombreArticuloEquipo = 'TESTMARCA TEST-PANTALLA';
const sillaCatalogoId = randomUUID();
const sillaInactivaId = randomUUID();
/** Un mueble corriente: no es asiento, así que no manda sobre las sillas. */
const mesaAuxCatalogoId = randomUUID();
/** La mesa de la sala. Está en el catálogo para encontrarla, no para instanciarla. */
const mesaPrincipalCatalogoId = randomUUID();
const plantillaAId = randomUUID();
const plantillaBId = randomUUID();
/** Solo trae una mesa auxiliar: sin asientos, el aforo sigue repartiendo sillas. */
const plantillaSinAsientosId = randomUUID();
/** Mal medida a propósito: coloca un equipo fuera de la sala que ella misma describe. */
const plantillaFueraId = randomUUID();
/** Trae una fila de mobiliario cuyo catálogo es la mesa principal: no puede instanciarse. */
const plantillaMesaPrincipalId = randomUUID();
/** Sana al mirarla y con mesa principal al copiarla: la carrera. */
const plantillaCarreraId = randomUUID();

async function limpiar() {
  await sql`delete from salas where id in (${salaCerradaId}, ${salaLegadoId}, ${salaVecinaId}, ${salaVaciaId}, ${salaSoloTomaId}, ${salaSinAsientosId}, ${salaPlantillaFueraId}, ${salaDesdeCeroId}, ${salaMesaPrincipalId}, ${salaAsientosId}, ${salaMuebleCorrienteId}, ${salaOcupadaSinIniciarId}, ${salaCarreraId})`;
  await sql`delete from plantillas_sala where id in (${plantillaAId}, ${plantillaBId}, ${plantillaSinAsientosId}, ${plantillaFueraId}, ${plantillaMesaPrincipalId}, ${plantillaCarreraId})`;
  await sql.unsafe(
    'drop trigger if exists test_mesa_tardia on sala_equipos; drop function if exists test_mesa_tardia();',
  );
  await sql`delete from articulos where id in (${articuloEquipoId}, ${articuloCableId}, ${articuloInactivoId})`;
  await sql`delete from catalogo_mobiliario where id in (${sillaCatalogoId}, ${sillaInactivaId}, ${mesaAuxCatalogoId}, ${mesaPrincipalCatalogoId})`;
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
  // Sin medidas, sin equipos y sin tiradas: la sala que puede recibir una
  // plantilla entera.
  await sql`insert into salas (id, nombre) values (${salaVaciaId}, 'TEST diagrama vacia')`;
  // Diez por diez y con una roseta al fondo: la plantilla mide 6 × 4, así que
  // aplicarla dejaría la roseta fuera del plano sin que nadie la mueva.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaSoloTomaId}, 'TEST diagrama solo toma', 10, 10, 3)`;
  await sql`insert into tomas_red (sala_id, codigo, x_m, y_m, z_m)
            values (${salaSoloTomaId}, 'TEST-ROS', 9, 9, 0)`;
  await sql`insert into salas (id, nombre, aforo) values (${salaSinAsientosId}, 'TEST diagrama sin asientos', 8)`;
  await sql`insert into salas (id, nombre) values (${salaPlantillaFueraId}, 'TEST diagrama plantilla fuera')`;
  // Vacía pero ya contestó de dónde sale su plano: la pregunta no se repite y
  // la respuesta no la puede cambiar una llamada directa a la acción.
  await sql`insert into salas (id, nombre, diagrama_iniciado_en, diagrama_origen)
            values (${salaDesdeCeroId}, 'TEST diagrama desde cero', now(), 'desde_cero')`;
  await sql`insert into salas (id, nombre) values (${salaMesaPrincipalId}, 'TEST diagrama mesa principal')`;
  await sql`insert into salas (id, nombre) values (${salaCarreraId}, 'TEST diagrama carrera mesa')`;
  // Con aforo y medidas: aquí se comprueba que un asiento no puede convivir
  // con las sillas derivadas.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
            values (${salaAsientosId}, 'TEST diagrama asientos', 6, 4, 3, 8, 2.4, 1.2)`;
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
            values (${salaMuebleCorrienteId}, 'TEST diagrama mueble corriente', 6, 4, 3, 8, 2.4, 1.2)`;
  // Con equipos y sin iniciar: es el caso que llega al rechazo por ocupada,
  // porque una sala ya iniciada se rechaza antes y por otro motivo.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaOcupadaSinIniciarId}, 'TEST diagrama ocupada sin iniciar', 6, 4, 3)`;

  await sql`
    insert into articulos (id, tipo, categoria, marca, modelo, activo) values
      (${articuloEquipoId},   'equipo', 'PANTALLA', 'TESTMARCA', 'TEST-PANTALLA', true),
      (${articuloCableId},    'cable',  'CABLE',    'TESTMARCA', 'TEST-CABLE',    true),
      (${articuloInactivoId}, 'equipo', 'PANTALLA', 'TESTMARCA', 'TEST-BAJA',     false)`;

  await sql`
    insert into catalogo_mobiliario (id, clave, nombre, categoria, forma, rol, activo, fuente) values
      (${sillaCatalogoId},          'test-silla',   'Silla',          'Asientos', 'circulo',    'asiento',        true,  'app'),
      (${sillaInactivaId},          'test-silla-x', 'Silla',          'Asientos', 'circulo',    'asiento',        false, 'app'),
      (${mesaAuxCatalogoId},        'test-mesa-aux','Mesa auxiliar',  'Mesas',    'rectangulo', null,             true,  'app'),
      (${mesaPrincipalCatalogoId},  'test-mesa-pr', 'Mesa principal', 'Mesas',    'rectangulo', 'mesa_principal', true,  'app')`;

  // Dos plantillas: la que se aplica y la que se intenta aplicar encima.
  for (const [id, nombre] of [
    [plantillaAId, 'TEST plantilla A'],
    [plantillaBId, 'TEST plantilla B'],
  ] as const) {
    await sql`
      insert into plantillas_sala
        (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m,
         mesa_largo_m, mesa_ancho_m, mesa_rotacion_grados)
      values (${id}, ${nombre}, 'TEST', 8, 6, 4, 3, 2.4, 1.2, 90)`;
  }

  const [l1] = await sql<Array<{ id: string }>>`
    insert into plantilla_articulos
      (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional,
       extremo, x_m, y_m, z_m, posicion_confirmada, rotacion_grados)
    values (${plantillaAId}, ${articuloEquipoId}, 'PANTALLA', ${nombreArticuloEquipo}, 1, false,
            'pantalla', 0, 2, 1.4, true, 270)
    returning id`;
  const [l2] = await sql<Array<{ id: string }>>`
    insert into plantilla_articulos
      (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional,
       extremo, posicion_confirmada)
    values (${plantillaAId}, ${articuloEquipoId}, 'CAJA CONEXIONES', 'TEST CAJA', 1, false,
            'caja_conexiones', null)
    returning id`;
  await sql`
    insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal)
    values (${plantillaAId}, ${l2.id}, ${l1.id}, 'hdmi')`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaAId}, ${sillaCatalogoId}, 'Silla', 'circulo', 0.5, 0.5,
            1, 1, 0, 45, true, 0)`;

  // Una plantilla con mobiliario pero SIN asientos: una mesa auxiliar no
  // sustituye a las sillas del aforo, y darla por sustituta dejaba la sala
  // con cero sillas dibujadas.
  await sql`
    insert into plantillas_sala
      (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m, mesa_largo_m, mesa_ancho_m)
    values (${plantillaSinAsientosId}, 'TEST plantilla sin asientos', 'TEST', 8, 6, 4, 3, 2.4, 1.2)`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaSinAsientosId}, ${mesaAuxCatalogoId}, 'Mesa auxiliar', 'rectangulo', 1, 0.6,
            5, 3, 0, 0, true, 0)`;

  // Una plantilla con una fila cuyo catálogo es la mesa principal. No debería
  // existir —el editor no la crea— pero una plantilla antigua o manipulada sí
  // puede tenerla, y copiarla daría la segunda mesa que la guarda del alta
  // manual impide.
  await sql`
    insert into plantillas_sala
      (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m)
    values (${plantillaMesaPrincipalId}, 'TEST plantilla mesa principal', 'TEST', 8, 6, 4, 3)`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaMesaPrincipalId}, ${mesaPrincipalCatalogoId}, 'Mesa principal', 'rectangulo',
            2.4, 1.2, 3, 2, 0, 0, true, 0)`;

  // Sana mientras se la mira: un equipo y un mueble corriente, sin mesa
  // principal por ninguna parte. La mesa se la mete un disparador cuando la
  // copia ya ha empezado, que es la carrera que la comprobación previa no
  // puede ver.
  await sql`
    insert into plantillas_sala
      (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m, mesa_largo_m, mesa_ancho_m)
    values (${plantillaCarreraId}, 'TEST plantilla carrera', 'TEST', 8, 6, 4, 3, 2.4, 1.2)`;
  await sql`
    insert into plantilla_articulos
      (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional,
       extremo, x_m, y_m, z_m, posicion_confirmada)
    values (${plantillaCarreraId}, ${articuloEquipoId}, 'PANTALLA', ${nombreArticuloEquipo}, 1, false,
            'pantalla', 3, 2, 1.4, true)`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaCarreraId}, ${mesaAuxCatalogoId}, 'Mesa auxiliar', 'rectangulo', 1, 0.6,
            5, 3, 0, 0, true, 0)`;

  // Una plantilla mal medida: dice 4 × 4 y coloca el equipo en x = 6.
  await sql`
    insert into plantillas_sala
      (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m)
    values (${plantillaFueraId}, 'TEST plantilla fuera', 'TEST', 4, 4, 4, 3)`;
  await sql`
    insert into plantilla_articulos
      (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional,
       extremo, x_m, y_m, z_m, posicion_confirmada)
    values (${plantillaFueraId}, ${articuloEquipoId}, 'PANTALLA', ${nombreArticuloEquipo}, 1, false,
            'pantalla', 6, 2, 1.4, true)`;
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
      return { ok: true, version: await versionDe(patch.sala_id), ids: {} };
    }
  };

  const patchBase = (salaId: string, version: number): Patch => ({
    sala_id: salaId,
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
      equipos: [{ id: equipoId, x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
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
      equipos: [{ id: equipoId, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
    });
    afirmar(primero.ok, 'la primera pestaña guarda');

    const segundo = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [{ id: equipoId, x_m: 4, y_m: 4, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
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
        { id: propio, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
        { id: ajeno, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
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
      equipos: [{ id: randomUUID(), x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
    });
    afirmar(!inventado.ok && inventado.motivo === 'ajeno', 'un id inventado se rechaza');

    const repetido = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [
        { id: propio, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
        { id: propio, x_m: 3, y_m: 3, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
      ],
    });
    afirmar(!repetido.ok && repetido.motivo === 'ajeno', 'un id repetido se rechaza');

    const noUuid = await invocar({ ...patchBase('no-soy-un-uuid', version) });
    afirmar(!noUuid.ok && noUuid.motivo === 'invalido', 'un sala_id que no es uuid se rechaza');

    const noFinito = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos: [
        { id: propio, x_m: Number.NaN, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
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
      equipos: [{ id: equipoId, x_m: 2, y_m: 2, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
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
        equipos: [{ id: equipoId, x_m: 3, y_m: 3, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
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
      equipos: [{ id: equipoId, x_m: 6, y_m: 4, z_m: 3, posicion_confirmada: true, rotacion_grados: 0 }],
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
        equipos: [{ id: equipoId, ...punto, posicion_confirmada: true, rotacion_grados: 0 }],
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
      equipos: [{ id: equipoId, x_m: 8.5, y_m: 5.5, z_m: 1, posicion_confirmada: true, rotacion_grados: 0 }],
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
      equipos: [{ id: equipoId, x_m: 8.5, y_m: 5.5, z_m: 1, posicion_confirmada: true, rotacion_grados: 0 }],
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
      equipos: [{ id: equipoId, x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 }],
    });
    afirmar(
      !sinMedir.ok && sinMedir.motivo === 'fuera',
      'una sala sin medir no admite colocación confirmada',
    );

    // Control positivo: sin confirmar, la coordenada es un resto y no se juzga.
    const sinConfirmar = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      equipos: [{ id: equipoId, x_m: 99, y_m: 99, z_m: 99, posicion_confirmada: false, rotacion_grados: 0 }],
    });
    afirmar(
      sinConfirmar.ok,
      'un equipo sin confirmar no se juzga: su posición la deduce el croquis',
    );
  }
  // ------------------------------------------------- 8 · altas y catálogos
  //
  // De un alta solo se cree el identificador. Todo lo demás —nombre,
  // categoría, extremo— se relee del catálogo, y se exige artículo activo y
  // de tipo equipo: un cable en el plano falsearía la tabla de cables.
  {
    const version = await versionDe(salaLegadoId);
    const tmp = randomUUID();

    const alta = (id: string, articulo_id: string) => ({
      id,
      articulo_id,
      // Lo que mande el navegador en `extremo` da igual: el servidor lo
      // deduce de la categoría del artículo que relee.
      extremo: 'pared' as const,
      x_m: 1,
      y_m: 1,
      z_m: 0,
      posicion_confirmada: true,
      rotacion_grados: 90,
    });

    const r = await invocar({
      ...patchBase(salaLegadoId, version),
      equipos_alta: [alta(tmp, articuloEquipoId)],
    });
    afirmar(r.ok, 'un equipo del catálogo se da de alta desde el plano');
    afirmar(
      r.ok && typeof r.ids[tmp] === 'string' && r.ids[tmp] !== tmp,
      'y vuelve con el uuid real, no con el id temporal del navegador',
    );

    const [nuevo] = await sql<Array<{ nombre: string; extremo: string; rotacion_grados: string }>>`
      select nombre, extremo, rotacion_grados from sala_equipos
      where id = ${r.ok ? r.ids[tmp] : ''}`;
    afirmar(nuevo?.nombre === nombreArticuloEquipo, 'el nombre lo pone el catálogo');
    afirmar(Number(nuevo?.rotacion_grados) === 90, 'y el giro se guarda');

    // Un nombre manipulado no llega a la base: no hay campo por donde entre.
    const version2 = await versionDe(salaLegadoId);
    const conCable = await invocar({
      ...patchBase(salaLegadoId, version2),
      equipos_alta: [alta(randomUUID(), articuloCableId)],
    });
    afirmar(
      !conCable.ok && conCable.motivo === 'catalogo',
      'un cable no se puede añadir como equipo del plano',
    );

    const inactivo = await invocar({
      ...patchBase(salaLegadoId, version2),
      equipos_alta: [alta(randomUUID(), articuloInactivoId)],
    });
    afirmar(
      !inactivo.ok && inactivo.motivo === 'catalogo',
      'un artículo dado de baja tampoco',
    );

    const inventado = await invocar({
      ...patchBase(salaLegadoId, version2),
      equipos_alta: [alta(randomUUID(), randomUUID())],
    });
    afirmar(!inventado.ok && inventado.motivo === 'catalogo', 'ni uno que no existe');

    afirmar(
      (await versionDe(salaLegadoId)) === version2,
      'ningún rechazo de catálogo ha subido la versión',
    );
  }

  // ---------------------------------------------- 9 · mobiliario
  {
    const version = await versionDe(salaLegadoId);
    const tmpA = randomUUID();
    const tmpB = randomUUID();

    const silla = (id: string, x: number) => ({
      id,
      mobiliario_id: sillaCatalogoId,
      nombre: 'Lo que diga el navegador',
      forma: 'circulo' as const,
      largo_m: 0.5,
      ancho_m: 0.5,
      alto_m: null,
      x_m: x,
      y_m: 2,
      z_m: 0,
      rotacion_grados: 45,
      posicion_confirmada: true,
      orden: 0,
    });

    // El alta de asientos viaja con la transición, que es lo que manda el
    // editor después de materializar las del aforo. Sin ella el guardado se
    // rechaza entero, y eso se comprueba en el bloque 12: dejar aquí un alta
    // de sillas que conserva `derivadas` sería fijar por prueba el estado que
    // dibuja cada silla dos veces.
    const r = await invocar({
      ...patchBase(salaLegadoId, version),
      mobiliario_alta: [silla(tmpA, 1), silla(tmpB, 2)],
      sillas_modo: 'manuales',
    });
    afirmar(r.ok, 'dos sillas se dan de alta a la vez, con su transición de modo');

    const [modoTrasAlta] = await sql<Array<{ sillas_modo: string }>>`
      select sillas_modo from salas where id = ${salaLegadoId}`;
    afirmar(
      modoTrasAlta.sillas_modo === 'manuales',
      'y la sala queda con una sola fuente de sillas',
    );

    const filas = await sql<Array<{ id: string; nombre: string; x_m: string; rotacion_grados: string }>>`
      select id, nombre, x_m, rotacion_grados from sala_mobiliario
      where sala_id = ${salaLegadoId} order by x_m`;
    afirmar(filas.length === 2, 'y son dos filas distintas, no una con cantidad 2');
    afirmar(filas[0].nombre === 'Silla', 'el nombre lo pone el catálogo, no el navegador');
    afirmar(Number(filas[0].rotacion_grados) === 45, 'el giro del mueble se guarda');

    const [s] = await sql<Array<{ sillas_modo: string }>>`
      select sillas_modo from salas where id = ${salaLegadoId}`;
    afirmar(s.sillas_modo === 'manuales', 'y las sillas pasan a ser manuales');

    // Cambio y baja de filas reales.
    const version2 = await versionDe(salaLegadoId);
    const cambio = await invocar({
      ...patchBase(salaLegadoId, version2),
      mobiliario_cambio: [
        {
          id: filas[0].id,
          nombre: 'Silla',
          largo_m: 0.5,
          ancho_m: 0.5,
          alto_m: null,
          x_m: 3,
          y_m: 3,
          z_m: 0,
          rotacion_grados: 180,
          posicion_confirmada: true,
          orden: 5,
        },
      ],
      mobiliario_baja: [filas[1].id],
    });
    afirmar(cambio.ok, 'se puede mover una silla y quitar otra en el mismo guardado');
    const quedan = await sql<Array<{ id: string; x_m: string }>>`
      select id, x_m from sala_mobiliario where sala_id = ${salaLegadoId}`;
    afirmar(quedan.length === 1 && Number(quedan[0].x_m) === 3, 'queda una y en su sitio');

    // Un mueble de otra sala no se toca.
    const version3 = await versionDe(salaLegadoId);
    const [ajena] = await sql<Array<{ id: string }>>`
      insert into sala_mobiliario (sala_id, mobiliario_id, nombre, forma)
      values (${salaVecinaId}, ${sillaCatalogoId}, 'Silla', 'circulo') returning id`;
    const conAjeno = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_baja: [ajena.id],
    });
    afirmar(!conAjeno.ok && conAjeno.motivo === 'ajeno', 'una baja de otra sala se rechaza');
    const [sigue] = await sql<Array<{ id: string }>>`
      select id from sala_mobiliario where id = ${ajena.id}`;
    afirmar(!!sigue, 'y el mueble de la otra sala sigue ahí');

    // Un mueble del catálogo inactivo no entra.
    const inactivo = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_alta: [{ ...silla(randomUUID(), 1), mobiliario_id: sillaInactivaId }],
    });
    afirmar(
      !inactivo.ok && inactivo.motivo === 'catalogo',
      'un mueble dado de baja del catálogo no se puede añadir',
    );

    // La mesa de la sala vive en `salas.mesa_*` y es una sola. El buscador la
    // ofrece para poder encontrarla y seleccionarla; instanciarla daría dos
    // mesas principales dibujadas.
    const dosMesas = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_alta: [{ ...silla(randomUUID(), 1), mobiliario_id: mesaPrincipalCatalogoId }],
    });
    afirmar(
      !dosMesas.ok && dosMesas.motivo === 'catalogo',
      'no se puede instanciar una segunda mesa principal',
    );

    // Sin referencia de catálogo el servidor no tendría de dónde releer el
    // nombre ni la forma, y se quedaría con los que manda el navegador.
    const sinReferencia = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_alta: [{ ...silla(randomUUID(), 1), mobiliario_id: null }],
    });
    afirmar(
      !sinReferencia.ok && sinReferencia.motivo === 'invalido',
      'un alta de mueble sin referencia de catálogo se rechaza entera',
    );

    // El mismo id en un alta y en un cambio es un borrador roto.
    const repetido = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_cambio: [
        {
          id: quedan[0].id,
          nombre: 'Silla',
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
      mobiliario_baja: [quedan[0].id],
    });
    afirmar(!repetido.ok && repetido.motivo === 'ajeno', 'cambiar y borrar lo mismo se rechaza');

    // Coordenadas fuera, también en mobiliario.
    const fuera = await invocar({
      ...patchBase(salaLegadoId, version3),
      mobiliario_alta: [silla(randomUUID(), 99)],
    });
    afirmar(!fuera.ok && fuera.motivo === 'fuera', 'una silla fuera de la sala se rechaza');

    afirmar(
      (await versionDe(salaLegadoId)) === version3,
      'ningún rechazo de mobiliario ha subido la versión',
    );
  }

  // ------------------------------------- 10 · inicio del diagrama
  {
    const version = await versionDe(salaLegadoId);
    const r = await invocar({
      ...patchBase(salaLegadoId, version),
      inicio_diagrama: { origen: 'desde_cero', plantilla_id: null },
    });
    afirmar(r.ok, 'se puede declarar que el plano se hace desde cero');

    const [s1] = await sql<Array<{ diagrama_origen: string; diagrama_iniciado_en: Date }>>`
      select diagrama_origen, diagrama_iniciado_en from salas where id = ${salaLegadoId}`;
    afirmar(s1.diagrama_origen === 'desde_cero', 'y queda registrado');
    afirmar(!!s1.diagrama_iniciado_en, 'con su marca de tiempo');

    // Volver a mandarlo no reescribe la procedencia de una sala ya preparada.
    const antes = s1.diagrama_iniciado_en;
    await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      inicio_diagrama: { origen: 'plantilla', plantilla_id: plantillaAId },
    });
    const [s2] = await sql<Array<{ diagrama_origen: string; diagrama_iniciado_en: Date }>>`
      select diagrama_origen, diagrama_iniciado_en from salas where id = ${salaLegadoId}`;
    afirmar(
      s2.diagrama_origen === 'desde_cero' && +s2.diagrama_iniciado_en === +antes,
      'el inicio se escribe una sola vez: repetirlo no cambia la procedencia',
    );
  }

  // ------------------------------- 11 · aplicar una plantilla al diagrama
  {
    const { aplicarPlantillaAlDiagrama } = await import('../src/app/acciones-diagrama');
    type ResPlantilla = Awaited<ReturnType<typeof aplicarPlantillaAlDiagrama>>;

    const aplicar = async (
      salaId: string,
      plantillaId: string,
      version: number,
    ): Promise<ResPlantilla> => {
      try {
        return await aplicarPlantillaAlDiagrama(salaId, plantillaId, version);
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        const codigo = (e as { ['__NEXT_ERROR_CODE']?: string })?.['__NEXT_ERROR_CODE'];
        if (!(mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE) && codigo === CODIGO_SEÑAL_REVALIDATE)) {
          throw e;
        }
        const [f] = await sql<Array<{ diagrama_version: number }>>`
          select diagrama_version from salas where id = ${salaId}`;
        return { ok: true, version: Number(f.diagrama_version), copiado: true };
      }
    };

    // Sala vacía: se copia todo.
    const r = await aplicar(salaVaciaId, plantillaAId, await versionDe(salaVaciaId));
    afirmar(r.ok, 'una sala vacía acepta la plantilla');

    const contar = async (salaId: string) => {
      const [f] = await sql<Array<{ equipos: string; muebles: string; conexiones: string }>>`
        select
          (select count(*) from sala_equipos    where sala_id = ${salaId})::text as equipos,
          (select count(*) from sala_mobiliario where sala_id = ${salaId})::text as muebles,
          (select count(*) from conexiones      where sala_id = ${salaId})::text as conexiones`;
      return f;
    };

    const c1 = await contar(salaVaciaId);
    afirmar(Number(c1.equipos) === 2, 'copia los dos equipos de la plantilla');
    afirmar(Number(c1.muebles) === 1, 'y su mobiliario');
    afirmar(Number(c1.conexiones) === 1, 'y su tirada');

    // Con mobiliario heredado, las sillas de la sala ya son filas reales: el
    // aforo deja de repartir nada. Sin esto el croquis dibujaba las derivadas
    // del aforo MÁS las de la plantilla, y cada silla salía dos veces.
    const [modo] = await sql<Array<{ sillas_modo: string }>>`
      select sillas_modo from salas where id = ${salaVaciaId}`;
    afirmar(
      modo.sillas_modo === 'manuales',
      'una plantilla con mobiliario deja la sala con una sola fuente de sillas',
    );

    const [medida] = await sql<Array<{ largo_m: string; mesa_rotacion_grados: string }>>`
      select largo_m, mesa_rotacion_grados from salas where id = ${salaVaciaId}`;
    afirmar(Number(medida.largo_m) === 6, 'y las medidas de la tipología');
    afirmar(Number(medida.mesa_rotacion_grados) === 90, 'y el giro de la mesa');

    const [eqGirado] = await sql<Array<{ rotacion_grados: string }>>`
      select rotacion_grados from sala_equipos
      where sala_id = ${salaVaciaId} and rotacion_grados <> 0`;
    afirmar(Number(eqGirado?.rotacion_grados) === 270, 'el giro del equipo viaja plantilla → sala');

    // Repetir la misma plantilla NO duplica.
    const r2 = await aplicar(salaVaciaId, plantillaAId, await versionDe(salaVaciaId));
    afirmar(r2.ok && r2.copiado === false, 'la plantilla ya heredada se reconoce y no se copia');
    const c2 = await contar(salaVaciaId);
    afirmar(
      c2.equipos === c1.equipos && c2.muebles === c1.muebles && c2.conexiones === c1.conexiones,
      'y no aparece nada por duplicado',
    );

    // Otra plantilla sobre una sala ya preparada se bloquea y no muta nada.
    // El motivo es `iniciada` y no `ocupada` porque la sala ya contestó de
    // dónde sale su plano: se rechaza antes de mirar lo que tiene dentro.
    const otra = await aplicar(salaVaciaId, plantillaBId, await versionDe(salaVaciaId));
    afirmar(
      !otra.ok && otra.motivo === 'iniciada',
      'otra plantilla sobre una sala ya preparada se rechaza',
    );
    const c3 = await contar(salaVaciaId);
    afirmar(c3.equipos === c1.equipos && c3.conexiones === c1.conexiones, 'y no borra nada');

    // El rechazo por ocupada sigue vivo para la sala que nunca pasó por
    // Diagrama y a la que alguien ya metió equipos desde Equipamiento.
    await nuevoEquipo(salaOcupadaSinIniciarId, 'TEST equipo suelto');
    const versionOcupada = await versionDe(salaOcupadaSinIniciarId);
    const ocupada = await aplicar(salaOcupadaSinIniciarId, plantillaAId, versionOcupada);
    afirmar(
      !ocupada.ok && ocupada.motivo === 'ocupada',
      'una sala sin iniciar pero con equipos rechaza la plantilla por ocupada',
    );
    const [trasOcupada] = await sql<Array<{ largo_m: string; version: number }>>`
      select largo_m, diagrama_version as version from salas where id = ${salaOcupadaSinIniciarId}`;
    afirmar(
      Number(trasOcupada.largo_m) === 6 && Number(trasOcupada.version) === versionOcupada,
      'y conserva medidas y versión',
    );

    // Obra cerrada y versión obsoleta.
    const cerrada = await aplicar(salaCerradaId, plantillaAId, await versionDe(salaCerradaId));
    afirmar(!cerrada.ok && cerrada.motivo === 'cerrado', 'la obra cerrada rechaza la plantilla');

    const conflicto = await aplicar(salaVaciaId, plantillaAId, 0);
    afirmar(!conflicto.ok && conflicto.motivo === 'conflicto', 'una versión obsoleta se rechaza');

    // ---------------------------------------------------------------------
    // Una plantilla con mobiliario pero sin asientos
    //
    // La regla es «las sillas de la sala ya son filas», no «hay muebles». Una
    // mesa auxiliar heredada apagaba el aforo y dejaba la sala con cero
    // sillas dibujadas, que es peor que dibujar de más: no se ve que falten.
    // ---------------------------------------------------------------------
    const sinAsientos = await aplicar(
      salaSinAsientosId,
      plantillaSinAsientosId,
      await versionDe(salaSinAsientosId),
    );
    afirmar(sinAsientos.ok, 'una plantilla de solo mesa auxiliar se aplica');

    const [modoSinAsientos] = await sql<Array<{ sillas_modo: string; aforo: number }>>`
      select sillas_modo, aforo from salas where id = ${salaSinAsientosId}`;
    afirmar(
      modoSinAsientos.sillas_modo === 'derivadas',
      'y el aforo sigue repartiendo las sillas: una mesa auxiliar no las sustituye',
    );
    const [mueblesSinAsientos] = await sql<Array<{ cuantos: string }>>`
      select count(*)::text as cuantos from sala_mobiliario where sala_id = ${salaSinAsientosId}`;
    afirmar(Number(mueblesSinAsientos.cuantos) === 1, 'la mesa auxiliar sí se copió');

    // ---------------------------------------------------------------------
    // Una sala con roseta no está vacía
    //
    // Aplicar una plantilla sustituye las medidas. Una roseta de 10 × 10 en
    // (9,9) se quedaba fuera de una plantilla de 6 × 4 sin que nadie la
    // moviera, porque la ocupación solo contaba equipos, tiradas y muebles.
    // ---------------------------------------------------------------------
    const conRoseta = await aplicar(
      salaSoloTomaId,
      plantillaAId,
      await versionDe(salaSoloTomaId),
    );
    afirmar(
      !conRoseta.ok && conRoseta.motivo === 'ocupada',
      'una sala con rosetas medidas no acepta una plantilla que le cambie las medidas',
    );
    const [salaRoseta] = await sql<Array<{ largo_m: string }>>`
      select largo_m from salas where id = ${salaSoloTomaId}`;
    afirmar(Number(salaRoseta.largo_m) === 10, 'y conserva sus medidas');
    const [roseta] = await sql<Array<{ x_m: string; y_m: string }>>`
      select x_m, y_m from tomas_red where sala_id = ${salaSoloTomaId}`;
    afirmar(
      Number(roseta.x_m) === 9 && Number(roseta.y_m) === 9,
      'y la roseta sigue dentro de la sala, donde alguien la midió',
    );

    // ---------------------------------------------------------------------
    // Una plantilla mal medida no se aplica a medias
    //
    // Copiar escribe la sala primero y los equipos después, así que el
    // rechazo llega con filas ya insertadas: tiene que deshacerlo todo. Es la
    // misma exigencia que el guardado manual, que no acepta un equipo fuera.
    // ---------------------------------------------------------------------
    const versionFuera = await versionDe(salaPlantillaFueraId);
    const malMedida = await aplicar(salaPlantillaFueraId, plantillaFueraId, versionFuera);
    afirmar(
      !malMedida.ok && malMedida.motivo === 'fuera',
      'una plantilla que coloca un equipo fuera de su propia sala se rechaza',
    );
    const [restos] = await sql<Array<{ equipos: string; largo_m: string | null; version: number }>>`
      select
        (select count(*) from sala_equipos where sala_id = ${salaPlantillaFueraId})::text as equipos,
        (select largo_m from salas where id = ${salaPlantillaFueraId})::text as largo_m,
        (select diagrama_version from salas where id = ${salaPlantillaFueraId}) as version`;
    afirmar(Number(restos.equipos) === 0, 'y no deja ni un equipo escrito');
    afirmar(Number(restos.largo_m ?? 0) === 0, 'ni las medidas de la plantilla');
    afirmar(Number(restos.version) === versionFuera, 'ni sube la versión');

    const [sinIniciar] = await sql<Array<{ diagrama_iniciado_en: Date | null }>>`
      select diagrama_iniciado_en from salas where id = ${salaPlantillaFueraId}`;
    afirmar(
      sinIniciar.diagrama_iniciado_en === null,
      'ni da el diagrama por iniciado: la pregunta sigue sin contestar',
    );

    // ---------------------------------------------------------------------
    // El origen se elige una vez
    //
    // La tarjeta de origen deja de aparecer en cuanto la sala está iniciada,
    // pero ocultar un control no es una guarda: la acción se puede llamar
    // directamente. Una sala que dijo «desde cero» y todavía está vacía no
    // puede recibir una plantilla por la espalda, porque eso le cambiaría las
    // medidas y la procedencia sin que nadie lo decidiera.
    // ---------------------------------------------------------------------
    const versionCero = await versionDe(salaDesdeCeroId);
    const sobreDesdeCero = await aplicar(salaDesdeCeroId, plantillaAId, versionCero);
    afirmar(
      !sobreDesdeCero.ok && sobreDesdeCero.motivo === 'iniciada',
      'una sala que ya eligió Desde cero no acepta una plantilla, aunque esté vacía',
    );
    const [trasIntento] = await sql<Array<{
      diagrama_origen: string | null;
      diagrama_plantilla_id: string | null;
      largo_m: string | null;
      diagrama_version: number;
      equipos: string;
    }>>`
      select diagrama_origen, diagrama_plantilla_id, largo_m, diagrama_version,
             (select count(*) from sala_equipos e where e.sala_id = salas.id)::text as equipos
      from salas where id = ${salaDesdeCeroId}`;
    afirmar(trasIntento.diagrama_origen === 'desde_cero', 'y conserva su origen');
    afirmar(trasIntento.diagrama_plantilla_id === null, 'y no se le apunta ninguna plantilla');
    afirmar(Number(trasIntento.largo_m ?? 0) === 0, 'y no le cambian las medidas');
    afirmar(Number(trasIntento.equipos) === 0, 'y no le entra ningún equipo');
    afirmar(Number(trasIntento.diagrama_version) === versionCero, 'y la versión no sube');

    // ---------------------------------------------------------------------
    // La mesa principal tampoco entra por la puerta de atrás
    //
    // El alta manual ya se rechaza. Una fila de `plantilla_mobiliario` cuyo
    // catálogo sea la mesa principal es la misma segunda mesa por otro
    // camino, y copiarla en silencio dejaría dos mesas dibujadas.
    // ---------------------------------------------------------------------
    const versionMesa = await versionDe(salaMesaPrincipalId);
    const conMesaPrincipal = await aplicar(
      salaMesaPrincipalId,
      plantillaMesaPrincipalId,
      versionMesa,
    );
    afirmar(
      !conMesaPrincipal.ok && conMesaPrincipal.motivo === 'catalogo',
      'una plantilla con una mesa principal como mueble se rechaza entera',
    );
    const [trasMesa] = await sql<Array<{ muebles: string; largo_m: string | null; version: number }>>`
      select
        (select count(*) from sala_mobiliario m where m.sala_id = ${salaMesaPrincipalId})::text as muebles,
        (select largo_m from salas where id = ${salaMesaPrincipalId})::text as largo_m,
        (select diagrama_version from salas where id = ${salaMesaPrincipalId}) as version`;
    afirmar(Number(trasMesa.muebles) === 0, 'y no se crea ninguna segunda mesa');
    afirmar(Number(trasMesa.largo_m ?? 0) === 0, 'ni se copian sus medidas');
    afirmar(Number(trasMesa.version) === versionMesa, 'ni sube la versión');

    // -------------------------------------------------------------------
    // La misma mesa, pero apareciendo DESPUÉS de la comprobación previa
    //
    // La comprobación previa lee `plantilla_mobiliario` y el
    // `insert ... select` lo vuelve a leer. Entre las dos lecturas otra
    // operación puede añadir la mesa principal a la plantilla, y en READ
    // COMMITTED la segunda lectura sí ve esa fila. Aquí lo provoca un
    // disparador que la mete en cuanto se ha insertado el primer equipo: la
    // comprobación previa ya pasó y la copia todavía no ha llegado al
    // mobiliario.
    //
    // Lo que tiene que rechazarlo es la postcondición, y como para entonces
    // ya hay medidas y equipos escritos, tiene que deshacerlo todo.
    // -------------------------------------------------------------------
    await sql.unsafe(`
      create or replace function test_mesa_tardia() returns trigger as $$
      begin
        insert into plantilla_mobiliario
          (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
           x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
        select '${plantillaCarreraId}', '${mesaPrincipalCatalogoId}', 'Mesa principal',
               'rectangulo', 2.4, 1.2, 3, 2, 0, 0, true, 9
        where not exists (select 1 from plantilla_mobiliario
                          where plantilla_id = '${plantillaCarreraId}'
                            and mobiliario_id = '${mesaPrincipalCatalogoId}');
        return NEW;
      end $$ language plpgsql;
      create trigger test_mesa_tardia after insert on sala_equipos
        for each row execute function test_mesa_tardia();`);

    const versionCarrera = await versionDe(salaCarreraId);
    let carrera: ResPlantilla;
    try {
      carrera = await aplicar(salaCarreraId, plantillaCarreraId, versionCarrera);
    } finally {
      await sql.unsafe(
        'drop trigger if exists test_mesa_tardia on sala_equipos; drop function if exists test_mesa_tardia();',
      );
    }
    afirmar(
      !carrera.ok && carrera.motivo === 'catalogo',
      'la mesa principal que aparece después de la comprobación previa se rechaza igual',
    );
    const [trasCarrera] = await sql<
      Array<{
        muebles: string;
        equipos: string;
        largo_m: string | null;
        version: number;
        iniciado: Date | null;
      }>
    >`
      select
        (select count(*) from sala_mobiliario m where m.sala_id = ${salaCarreraId})::text as muebles,
        (select count(*) from sala_equipos e where e.sala_id = ${salaCarreraId})::text as equipos,
        (select largo_m from salas where id = ${salaCarreraId})::text as largo_m,
        (select diagrama_version from salas where id = ${salaCarreraId}) as version,
        (select diagrama_iniciado_en from salas where id = ${salaCarreraId}) as iniciado`;
    afirmar(Number(trasCarrera.muebles) === 0, 'y la sala se queda sin muebles');
    afirmar(Number(trasCarrera.equipos) === 0, 'y sin los equipos que ya se habían copiado');
    afirmar(Number(trasCarrera.largo_m ?? 0) === 0, 'y sin las medidas de la plantilla');
    afirmar(Number(trasCarrera.version) === versionCarrera, 'y la versión no sube');
    afirmar(trasCarrera.iniciado === null, 'y sigue sin haber elegido de dónde sale su plano');
    const [mesaSobrante] = await sql<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from plantilla_mobiliario
      where plantilla_id = ${plantillaCarreraId} and mobiliario_id = ${mesaPrincipalCatalogoId}`;
    afirmar(
      Number(mesaSobrante.cuantas) === 0,
      'y el rollback se lleva también la fila que metió el disparador',
    );
  }

  // ------------------------------- 12 · una sola fuente de sillas, en servidor
  //
  // La decisión de materializar es del editor, pero el estado imposible lo
  // tiene que impedir el servidor: sillas explícitas Y el aforo repartiendo a
  // la vez dibujan cada silla dos veces, y una petición escrita a mano no pasa
  // por el editor.
  {
    const asiento = (id: string, x: number) => ({
      id,
      mobiliario_id: sillaCatalogoId,
      nombre: 'Silla',
      forma: 'circulo' as const,
      largo_m: 0.5,
      ancho_m: 0.5,
      alto_m: null,
      x_m: x,
      y_m: 2,
      z_m: 0,
      rotacion_grados: 0,
      posicion_confirmada: true,
      orden: 0,
    });

    const version = await versionDe(salaAsientosId);
    const sinTransicion = await invocar({
      ...patchBase(salaAsientosId, version),
      mobiliario_alta: [asiento(randomUUID(), 1)],
    });
    afirmar(
      !sinTransicion.ok && sinTransicion.motivo === 'sillas',
      'un asiento que no apaga el aforo se rechaza: serían dos fuentes vivas',
    );

    const [trasRechazo] = await sql<Array<{ muebles: string; modo: string; version: number }>>`
      select
        (select count(*) from sala_mobiliario m where m.sala_id = ${salaAsientosId})::text as muebles,
        (select sillas_modo from salas where id = ${salaAsientosId}) as modo,
        (select diagrama_version from salas where id = ${salaAsientosId}) as version`;
    afirmar(Number(trasRechazo.muebles) === 0, 'y no deja la silla escrita');
    afirmar(trasRechazo.modo === 'derivadas', 'ni cambia el modo por su cuenta');
    afirmar(Number(trasRechazo.version) === version, 'ni sube la versión');

    const conTransicion = await invocar({
      ...patchBase(salaAsientosId, version),
      mobiliario_alta: [asiento(randomUUID(), 1)],
      sillas_modo: 'manuales',
    });
    afirmar(conTransicion.ok, 'con la transición declarada, el asiento entra');
    const [trasAlta] = await sql<Array<{ muebles: string; modo: string }>>`
      select
        (select count(*) from sala_mobiliario m where m.sala_id = ${salaAsientosId})::text as muebles,
        (select sillas_modo from salas where id = ${salaAsientosId}) as modo`;
    afirmar(Number(trasAlta.muebles) === 1 && trasAlta.modo === 'manuales', 'y queda una sola fuente');

    // Un mueble corriente no obliga a nada: la sala sigue derivando sus sillas
    // desde el aforo, que es lo que hacía antes de añadir la mesa.
    const mesaAux = await invocar({
      ...patchBase(salaMuebleCorrienteId, await versionDe(salaMuebleCorrienteId)),
      mobiliario_alta: [
        {
          ...asiento(randomUUID(), 1),
          mobiliario_id: mesaAuxCatalogoId,
          nombre: 'Mesa auxiliar',
          forma: 'rectangulo' as const,
        },
      ],
    });
    afirmar(mesaAux.ok, 'un mueble corriente entra sin declarar transición');
    const [trasMesaAux] = await sql<Array<{ sillas_modo: string; muebles: string }>>`
      select sillas_modo,
             (select count(*) from sala_mobiliario m where m.sala_id = salas.id)::text as muebles
      from salas where id = ${salaMuebleCorrienteId}`;
    afirmar(trasMesaAux.sillas_modo === 'derivadas', 'y el aforo sigue repartiendo las sillas');
    afirmar(Number(trasMesaAux.muebles) === 1, 'con la mesa ya puesta');

    // Una sala que YA está en el estado imposible —sillas de verdad y el aforo
    // repartiendo— no puede guardarse aunque el patch no toque las sillas. Es
    // lo que distingue comprobar el estado final de comprobar el patch: aquí
    // el patch es inocente y la sala no.
    await sql`
      insert into sala_mobiliario (sala_id, mobiliario_id, nombre, forma, x_m, y_m, posicion_confirmada)
      values (${salaMuebleCorrienteId}, ${sillaCatalogoId}, 'Silla', 'circulo', 1, 1, true)`;
    const equipoSuelto = await nuevoEquipo(salaMuebleCorrienteId, 'TEST equipo aparte');
    const versionImposible = await versionDe(salaMuebleCorrienteId);
    const estadoImposible = await invocar({
      ...patchBase(salaMuebleCorrienteId, versionImposible),
      equipos: [
        { id: equipoSuelto, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
      ],
    });
    afirmar(
      !estadoImposible.ok && estadoImposible.motivo === 'sillas',
      'una sala con sillas de verdad y el aforo activo no guarda nada, ni aunque el patch no las toque',
    );
    const [trasImposible] = await sql<Array<{ x_m: string; version: number }>>`
      select
        (select x_m from sala_equipos where id = ${equipoSuelto})::text as x_m,
        (select diagrama_version from salas where id = ${salaMuebleCorrienteId}) as version`;
    afirmar(Number(trasImposible.x_m) === 0, 'y el equipo no se movió: la transacción se deshizo');
    afirmar(Number(trasImposible.version) === versionImposible, 'ni subió la versión');
  }

  // ------------------------------------------------------------ 14 · puertas
  {
    // Alta, cambio y baja en el mismo flujo transaccional que el resto.
    const version = await versionDe(salaLegadoId);
    const tmp = randomUUID();
    const alta = await invocar({
      ...patchBase(salaLegadoId, version),
      puertas_alta: [
        { id: tmp, pared: 'sur', posicion_m: 1, anchura_m: 0.9, altura_m: 2.1, orden: 1 },
      ],
    });
    afirmar(alta.ok, 'puertas: el alta entra');
    const puertaId = alta.ok ? alta.ids[tmp] : '';
    afirmar(Boolean(puertaId) && puertaId !== tmp, 'puertas: el id temporal no se escribe');

    const [fila] = await sql<Array<{ anchura_m: string; sala_id: string }>>`
      select anchura_m, sala_id from puertas where id = ${puertaId}`;
    afirmar(Number(fila.anchura_m) === 0.9, 'puertas: la medida escrita es la medida');
    afirmar(fila.sala_id === salaLegadoId, 'puertas: la fila es de su sala');

    // Sin medir: nula la pareja entera, y el estado se conserva.
    const tmp2 = randomUUID();
    const sinMedir = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_alta: [
        { id: tmp2, pared: 'este', posicion_m: 0.5, anchura_m: null, altura_m: null, orden: 2 },
      ],
    });
    afirmar(sinMedir.ok, 'puertas: una puerta sin medir se guarda sin medir');
    const puerta2Id = sinMedir.ok ? sinMedir.ids[tmp2] : '';
    const [fila2] = await sql<Array<{ anchura_m: string | null; altura_m: string | null }>>`
      select anchura_m, altura_m from puertas where id = ${puerta2Id}`;
    afirmar(
      fila2.anchura_m === null && fila2.altura_m === null,
      'puertas: sin medir no se inventa ninguna dimensión',
    );

    // Una medida a medias no se guarda.
    const aMedias = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_cambio: [
        { id: puertaId, pared: 'sur', posicion_m: 1, anchura_m: 0.9, altura_m: null, orden: 1 },
      ],
    });
    afirmar(
      !aMedias.ok && aMedias.motivo === 'fuera',
      'puertas: una anchura sin altura se rechaza entera',
    );

    // El hueco no puede salirse de la pared. Se leen las medidas reales de la
    // sala en este punto, porque los escenarios anteriores las han ido
    // cambiando y una posición escrita a mano dejaría de sobresalir.
    const [medidasSala] = await sql<Array<{ largo_m: string; alto_m: string }>>`
      select largo_m, alto_m from salas where id = ${salaLegadoId}`;
    const largoSala = Number(medidasSala.largo_m);
    const altoSala = Number(medidasSala.alto_m);
    const excedida = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_cambio: [
        { id: puertaId, pared: 'sur', posicion_m: largoSala - 0.5, anchura_m: 0.9, altura_m: 2.1, orden: 1 },
      ],
    });
    afirmar(
      !excedida.ok && excedida.motivo === 'fuera',
      'puertas: el hueco que se sale de la pared se rechaza',
    );
    const [sinCambiar] = await sql<Array<{ posicion_m: string }>>`
      select posicion_m from puertas where id = ${puertaId}`;
    afirmar(Number(sinCambiar.posicion_m) === 1, 'puertas: y la fila no cambió');

    // Más alta que la sala tampoco.
    const altaDeMas = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_cambio: [
        { id: puertaId, pared: 'sur', posicion_m: 1, anchura_m: 0.9, altura_m: altoSala + 0.1, orden: 1 },
      ],
    });
    afirmar(
      !altaDeMas.ok && altaDeMas.motivo === 'fuera',
      'puertas: más alta que la sala se rechaza',
    );

    // Una puerta de otra sala no se toca desde aquí.
    const ajena = await invocar({
      ...patchBase(salaVecinaId, await versionDe(salaVecinaId)),
      puertas_cambio: [
        { id: puertaId, pared: 'sur', posicion_m: 1, anchura_m: 0.9, altura_m: 2.1, orden: 1 },
      ],
    });
    afirmar(!ajena.ok && ajena.motivo === 'ajeno', 'puertas: la puerta ajena se rechaza');
    const bajaAjena = await invocar({
      ...patchBase(salaVecinaId, await versionDe(salaVecinaId)),
      puertas_baja: [puertaId],
    });
    afirmar(!bajaAjena.ok && bajaAjena.motivo === 'ajeno', 'puertas: la baja ajena también');

    // Rollback: un patch con una puerta buena y un equipo ajeno no deja nada.
    const versionRollback = await versionDe(salaLegadoId);
    const tmp3 = randomUUID();
    const mezcla = await invocar({
      ...patchBase(salaLegadoId, versionRollback),
      puertas_alta: [
        { id: tmp3, pared: 'norte', posicion_m: 2, anchura_m: 0.8, altura_m: 2, orden: 3 },
      ],
      equipos: [
        { id: randomUUID(), x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
      ],
    });
    afirmar(!mezcla.ok, 'puertas: el patch mixto con un equipo ajeno se rechaza');
    const [{ cuantas }] = await sql<Array<{ cuantas: string }>>`
      select count(*)::text as cuantas from puertas where sala_id = ${salaLegadoId}`;
    afirmar(Number(cuantas) === 2, 'puertas: y no se escribió la puerta del patch rechazado');
    afirmar(
      (await versionDe(salaLegadoId)) === versionRollback,
      'puertas: ni subió la versión',
    );

    // La versión obsoleta protege también a las puertas.
    const obsoleta = await invocar({
      ...patchBase(salaLegadoId, versionRollback - 1),
      puertas_baja: [puertaId],
    });
    afirmar(!obsoleta.ok && obsoleta.motivo === 'conflicto', 'puertas: la versión obsoleta choca');

    // La obra cerrada tampoco admite puertas.
    const cerrada = await invocar({
      ...patchBase(salaCerradaId, await versionDe(salaCerradaId)),
      puertas_alta: [
        { id: randomUUID(), pared: 'sur', posicion_m: 1, anchura_m: null, altura_m: null, orden: 1 },
      ],
    });
    afirmar(!cerrada.ok && cerrada.motivo === 'cerrado', 'puertas: la obra cerrada no se toca');

    // Cambiar y borrar la misma puerta en el mismo patch es un borrador roto.
    const contradictorio = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_cambio: [
        { id: puertaId, pared: 'sur', posicion_m: 2, anchura_m: 0.9, altura_m: 2.1, orden: 1 },
      ],
      puertas_baja: [puertaId],
    });
    afirmar(
      !contradictorio.ok && contradictorio.motivo === 'ajeno',
      'puertas: cambiar y borrar la misma puerta se rechaza',
    );

    // La baja de verdad, dentro de la transacción.
    const baja = await invocar({
      ...patchBase(salaLegadoId, await versionDe(salaLegadoId)),
      puertas_baja: [puertaId, puerta2Id],
    });
    afirmar(baja.ok, 'puertas: la baja entra');
    const [{ quedan }] = await sql<Array<{ quedan: string }>>`
      select count(*)::text as quedan from puertas where sala_id = ${salaLegadoId}`;
    afirmar(Number(quedan) === 0, 'puertas: y no queda ninguna');
  }
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
