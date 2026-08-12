/**
 * El plano es uno y las pestañas son seis, contra Postgres real.
 *
 *   npm run test:concurrencia
 *
 * Dos reglas que se comprueban aquí y en ningún otro sitio:
 *
 * 1. **La versión del plano protege a todas las superficies.** La pestaña
 *    Diagrama guarda con `salas.diagrama_version` optimista, pero Resumen,
 *    Equipamiento y Tomas escriben los mismos datos con acciones sueltas.
 *    Mientras no la tocaban, una pestaña de Diagrama abierta desde antes creía
 *    que su número seguía vigente y sobrescribía en silencio el trabajo de la
 *    otra superficie: el aviso de conflicto no saltaba porque el número no se
 *    había movido. Se reproduce la carrera entera, no solo el incremento.
 *
 *    Y el contraejemplo: lo que no puede pisar el plano —la cantidad de un
 *    equipo, una tirada— NO sube la versión. Sin esta mitad, la regla se
 *    cumpliría subiéndola en cada escritura de la aplicación, y cada «+» de
 *    Equipamiento tumbaría un borrador del plano a medio medir.
 *
 * 2. **Escribir una coordenada en Equipamiento es colocar el equipo.** Se
 *    guardaban `x_m`, `y_m` y `z_m` sin tocar `posicion_confirmada`, así que el
 *    croquis se saltaba la medida recién tecleada y seguía dibujando la
 *    posición deducida del extremo. Con las casillas vacías el equipo tiene que
 *    volver a estar SIN confirmar, y no convertirse en un (0,0,0) dado por
 *    medido, que es el error que la aplicación ya arregló una vez.
 *
 * 3. **Todas las superficies cogen los cerrojos en el mismo orden.** Primero la
 *    fila de `salas` con `for update`, después las tablas hijas, y la versión
 *    dentro de la misma transacción. El plano ya lo hacía; Equipamiento y Tomas
 *    hacían lo contrario, y dos caminos opuestos sobre las mismas filas son un
 *    abrazo mortal esperando a que coincidan. Se comprueba con contendientes
 *    DE VERDAD —dos transacciones vivas a la vez, paradas sobre una barrera— y
 *    mirando con `pg_blocking_pids()` y `pg_locks` quién espera a quién y con
 *    qué cerrojos ya en la mano. Dos `await` seguidos no demuestran nada: se
 *    pueden ejecutar en serie y pasar igual.
 *
 * Mismas reglas que `verificar-diagrama.mts` y `verificar-plantillas.mts`: se
 * intercepta `server-only` en memoria —no se toca `node_modules`—, se tolera
 * únicamente la señal de `revalidatePath()` fuera de una petición real, el
 * catálogo de prueba se siembra aquí y la limpieza va en un `finally`.
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
const DIGEST_REDIRECT = 'NEXT_REDIRECT';

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
/** Sala legado (sin localización): editable, como cualquier sala anterior a la obra. */
const salaId = randomUUID();
/** De una obra cerrada: nada de lo que se rechaza puede mover la versión. */
const salaCerradaId = randomUUID();
/** Vacía y a solas: en ella se mira lo que dibuja el croquis, sin nada que la estorbe. */
const salaCroquisId = randomUUID();
/**
 * Solo para el rack en la esquina. Va aparte porque el croquis separa los
 * símbolos que se amontonan, y con otros equipos alrededor la comprobación de
 * que el rack se dibuja EXACTAMENTE en (0,0) dejaría de medir lo que dice.
 */
const salaRackId = randomUUID();
const articuloEquipoId = randomUUID();

/** Donde se corre la carrera de verdad, con dos transacciones a la vez. */
const salaCarreraId = randomUUID();
/** La obra que se cierra mientras alguien escribe en una de sus salas. */
const proyectoCarreraId = randomUUID();
const localizacionCarreraId = randomUUID();
const salaCierreCarreraId = randomUUID();
const tecnicoId = randomUUID();

async function limpiar() {
  // Por nombre además de por id: una ejecución anterior interrumpida deja filas
  // con OTROS identificadores, y el `unique` del nombre del proyecto tumbaba la
  // preparación de la siguiente con un error que no dice de qué va.
  await sql`delete from salas where nombre like 'TEST concurrencia%'`;
  await sql`delete from proyectos where nombre in ('TEST-concurrencia', 'TEST-cierre-carrera')`;
  await sql`delete from tecnicos where nombre = 'TEST tecnico concurrencia'`;
  await sql`delete from sedes where nombre = 'TEST sede que no debe nacer'`;
  await sql`delete from articulos where modelo = 'TEST-CONCURRENCIA'`;
  await sql`delete from salas where id in (${salaId}, ${salaCerradaId}, ${salaCroquisId}, ${salaRackId}, ${salaCarreraId}, ${salaCierreCarreraId})`;
  await sql`delete from articulos where id = ${articuloEquipoId}`;
  await sql`delete from hitos_proyecto where proyecto_id in (${proyectoId}, ${proyectoCarreraId})`;
  await sql`delete from localizaciones where id in (${localizacionId}, ${localizacionCarreraId})`;
  await sql`delete from proyectos where id in (${proyectoId}, ${proyectoCarreraId})`;
  await sql`delete from tecnicos where id = ${tecnicoId}`;
}

async function preparar() {
  await limpiar();
  await sql`insert into proyectos (id, nombre) values (${proyectoId}, 'TEST-concurrencia')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre)
            values (${localizacionId}, ${proyectoId}, 'TEST')`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo, fecha)
            values (${proyectoId}, 'cierre', now())`;
  await sql`
    insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
    values (${salaId}, 'TEST concurrencia', 6, 4, 3, 8, 2.4, 1.2)`;
  await sql`
    insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
    values (${salaCerradaId}, 'TEST concurrencia cerrada', ${localizacionId}, 6, 4, 3)`;
  await sql`
    insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
    values (${salaCroquisId}, 'TEST concurrencia croquis', 6, 4, 3, 8, 2.4, 1.2)`;
  await sql`
    insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
    values (${salaRackId}, 'TEST concurrencia rack', 6, 4, 3, 8, 2.4, 1.2)`;
  await sql`
    insert into salas (id, nombre, largo_m, ancho_m, alto_m, aforo, mesa_largo_m, mesa_ancho_m)
    values (${salaCarreraId}, 'TEST concurrencia carrera', 6, 4, 3, 8, 2.4, 1.2)`;
  await sql`
    insert into articulos (id, tipo, categoria, marca, modelo, activo)
    values (${articuloEquipoId}, 'equipo', 'PANTALLA', 'TESTMARCA', 'TEST-CONCURRENCIA', true)`;

  // La obra que se cierra a la vez que alguien escribe en una de sus salas.
  // Nace iniciada porque no se cierra lo que no empezó, y con un técnico con
  // rol de inicio porque el hito exige quién lo hizo.
  await sql`insert into proyectos (id, nombre) values (${proyectoCarreraId}, 'TEST-cierre-carrera')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre)
            values (${localizacionCarreraId}, ${proyectoCarreraId}, 'TEST')`;
  await sql`insert into tecnicos (id, nombre, activo, fuente)
            values (${tecnicoId}, 'TEST tecnico concurrencia', true, 'app')`;
  await sql`insert into tecnico_roles (tecnico_id, rol) values (${tecnicoId}, 'inicio')`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo, fecha)
            values (${proyectoCarreraId}, 'inicio', now())`;
  await sql`
    insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
    values (${salaCierreCarreraId}, 'TEST concurrencia cierre', ${localizacionCarreraId}, 6, 4, 3)`;
}

const versionDe = async (id: string): Promise<number> => {
  const [f] = await sql<Array<{ diagrama_version: number }>>`
    select diagrama_version from salas where id = ${id}`;
  return Number(f.diagrama_version);
};

const equipoDe = async (id: string) => {
  const [f] = await sql<
    Array<{ x_m: string; y_m: string; z_m: string; posicion_confirmada: boolean; cantidad: number }>
  >`select x_m, y_m, z_m, posicion_confirmada, cantidad from sala_equipos where id = ${id}`;
  return f;
};

/**
 * Los equipos de una sala. `sala_equipos` no tiene marca de tiempo, así que un
 * alta se localiza comparando el antes y el después, que además es la única
 * forma que no depende del nombre que le ponga el servidor.
 */
const idsDeEquipos = async (sala: string): Promise<string[]> => {
  const filas = await sql<Array<{ id: string }>>`
    select id from sala_equipos where sala_id = ${sala}`;
  return filas.map((f) => String(f.id));
};

const recienCreado = async (sala: string, antes: string[]): Promise<string> => {
  const ahora = await idsDeEquipos(sala);
  const nuevo = ahora.find((id) => !antes.includes(id));
  if (!nuevo) throw new Error('no se creó ningún equipo');
  return nuevo;
};

async function nuevoEquipo(
  sala: string,
  nombre: string,
  extremo = 'pantalla',
): Promise<string> {
  const id = randomUUID();
  await sql`
    insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo,
                              x_m, y_m, z_m, posicion_confirmada)
    values (${id}, ${sala}, ${articuloEquipoId}, ${nombre}, 1, ${extremo}::extremo_cable,
            0, 0, 0, false)`;
  return id;
}

// ---------------------------------------------------------------- ejecución

try {
  await preparar();

  const acciones = await import('../src/app/acciones');
  const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
  const { construirEscena } = await import('../src/lib/croquis');
  const { obtenerDatosPlanoSala } = await import('../src/lib/datos-plano');

  /** Tolera la señal de `revalidatePath()` y la de `redirect()`; nada más. */
  const invocar = async (accion: (d: FormData) => Promise<unknown>, datos: FormData) => {
    try {
      return await accion(datos);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const codigo = (e as { ['__NEXT_ERROR_CODE']?: string })?.['__NEXT_ERROR_CODE'];
      const digest = (e as { digest?: string })?.digest ?? '';
      const esperada =
        (mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE) && codigo === CODIGO_SEÑAL_REVALIDATE) ||
        String(digest).startsWith(DIGEST_REDIRECT);
      if (!esperada) throw e;
      return undefined;
    }
  };

  /** El formulario de Resumen: manda la sala entera, medidas incluidas. */
  const formularioSala = (sala: string, campos: Record<string, string> = {}) => {
    const d = new FormData();
    d.set('id', sala);
    d.set('nombre', 'TEST concurrencia');
    d.set('largo_m', '6');
    d.set('ancho_m', '4');
    d.set('alto_m', '3');
    d.set('aforo', '8');
    d.set('mesa_largo_m', '2.4');
    d.set('mesa_ancho_m', '1.2');
    for (const [k, v] of Object.entries(campos)) d.set(k, v);
    return d;
  };

  /** El formulario de Equipamiento, que reenvía siempre lo que está pintando. */
  const formularioEquipo = (
    equipoId: string,
    sala: string,
    campos: Record<string, string> = {},
  ) => {
    const d = new FormData();
    d.set('id', equipoId);
    d.set('sala_id', sala);
    d.set('nombre', 'TEST equipo');
    d.set('cantidad', '1');
    d.set('extremo', 'pantalla');
    for (const [k, v] of Object.entries(campos)) d.set(k, v);
    return d;
  };

  // ============================================================ hallazgo 2
  //
  // Qué mueve la versión del plano y qué no.

  // ------------------------------------------- Resumen (medidas de la sala)
  {
    const antes = await versionDe(salaId);
    await invocar(acciones.guardarSala, formularioSala(salaId, { largo_m: '7' }));
    afirmar(
      (await versionDe(salaId)) === antes + 1,
      'guardar la sala desde Resumen sube la versión del plano',
    );
    const [s] = await sql<Array<{ largo_m: string }>>`
      select largo_m from salas where id = ${salaId}`;
    afirmar(Number(s.largo_m) === 7, 'y la medida se escribe: la versión no sustituye al guardado');
    // Se devuelve a 6 × 4 para que el resto de comprobaciones tenga la sala conocida.
    await invocar(acciones.guardarSala, formularioSala(salaId));
  }

  // ------------------------------------------------- Equipamiento (equipos)
  {
    const antes = await versionDe(salaId);
    const habia = await idsDeEquipos(salaId);
    const d = new FormData();
    d.set('sala_id', salaId);
    d.set('articulo_id', articuloEquipoId);
    d.set('extremo', 'pantalla');
    await invocar(acciones.anadirEquipo, d);
    afirmar(
      (await versionDe(salaId)) === antes + 1,
      'añadir un equipo desde Equipamiento sube la versión del plano',
    );

    const nuevo = { id: await recienCreado(salaId, habia) };

    const antesGuardar = await versionDe(salaId);
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(nuevo.id, salaId, { x_m: '2', y_m: '1', z_m: '1.4' }),
    );
    afirmar(
      (await versionDe(salaId)) === antesGuardar + 1,
      'guardar un equipo desde Equipamiento sube la versión del plano',
    );

    // El contraejemplo: la cantidad no se dibuja y el editor no la manda, así
    // que no puede pisar ni ser pisada. Si esto subiera, cada «+» tumbaría un
    // borrador del plano a medio medir.
    const antesCantidad = await versionDe(salaId);
    const dCantidad = new FormData();
    dCantidad.set('id', nuevo.id);
    dCantidad.set('sala_id', salaId);
    dCantidad.set('paso', '1');
    await invocar(acciones.ajustarCantidadEquipo, dCantidad);
    afirmar(
      (await versionDe(salaId)) === antesCantidad,
      'ajustar la cantidad NO sube la versión: la cantidad no se dibuja',
    );
    afirmar((await equipoDe(nuevo.id)).cantidad === 2, 'pero la cantidad sí cambia');

    const antesBorrar = await versionDe(salaId);
    const dBorrar = new FormData();
    dBorrar.set('id', nuevo.id);
    dBorrar.set('sala_id', salaId);
    await invocar(acciones.borrarEquipo, dBorrar);
    afirmar(
      (await versionDe(salaId)) === antesBorrar + 1,
      'borrar un equipo sube la versión del plano',
    );
  }

  // --------------------------------------------------------- Tomas (rosetas)
  {
    const antes = await versionDe(salaId);
    const alta = new FormData();
    alta.set('sala_id', salaId);
    alta.set('codigo', 'TEST-ROS-1');
    await invocar(acciones.anadirToma, alta);
    afirmar(
      (await versionDe(salaId)) === antes + 1,
      'dar de alta una roseta sube la versión del plano',
    );

    const [toma] = await sql<Array<{ id: string }>>`
      select id from tomas_red where sala_id = ${salaId} and codigo = 'TEST-ROS-1'`;

    const antesGuardar = await versionDe(salaId);
    const cambio = new FormData();
    cambio.set('id', toma.id);
    cambio.set('sala_id', salaId);
    cambio.set('codigo', 'TEST-ROS-1');
    cambio.set('x_m', '1.5');
    cambio.set('y_m', '0.5');
    cambio.set('z_m', '0');
    await invocar(acciones.guardarToma, cambio);
    afirmar(
      (await versionDe(salaId)) === antesGuardar + 1,
      'situar una roseta desde Tomas sube la versión del plano',
    );

    const antesBorrar = await versionDe(salaId);
    const baja = new FormData();
    baja.set('id', toma.id);
    baja.set('sala_id', salaId);
    await invocar(acciones.borrarToma, baja);
    afirmar(
      (await versionDe(salaId)) === antesBorrar + 1,
      'borrar una roseta sube la versión del plano',
    );
  }

  // ----------------------------------------------- Cableado (contraejemplo)
  {
    const origen = await nuevoEquipo(salaId, 'TEST origen', 'caja_conexiones');
    const destino = await nuevoEquipo(salaId, 'TEST destino', 'pantalla');
    const antes = await versionDe(salaId);
    const d = new FormData();
    d.set('sala_id', salaId);
    d.set('origen_id', origen);
    d.set('destino_id', destino);
    d.set('senal', 'hdmi');
    await invocar(acciones.anadirConexion, d);
    const [cuantas] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from conexiones where sala_id = ${salaId}`;
    afirmar(Number(cuantas.n) === 1, 'la tirada se da de alta');
    afirmar(
      (await versionDe(salaId)) === antes,
      'una tirada NO sube la versión: el editor del plano no la escribe, así que no la puede pisar',
    );
  }

  // ------------------------------------------- lo rechazado no mueve nada
  {
    const equipoCerrado = await nuevoEquipo(salaCerradaId, 'TEST equipo cerrado');
    const antes = await versionDe(salaCerradaId);
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoCerrado, salaCerradaId, { x_m: '2', y_m: '2', z_m: '1' }),
    );
    afirmar(
      (await versionDe(salaCerradaId)) === antes,
      'en una obra cerrada no se escribe y la versión tampoco sube',
    );
    afirmar(
      Number((await equipoDe(equipoCerrado)).x_m) === 0,
      'y el equipo se queda como estaba',
    );

    // Lo rechazado no deja rastro NI EN OTRA TABLA. `sedeId()` escribe: da de
    // alta la sede que no existía. Resuelta antes de la transacción, una obra
    // cerrada aceptaba sedes nuevas a cambio de nada, y esa fila se quedaba.
    const nombreSede = 'TEST sede que no debe nacer';
    await sql`delete from sedes where nombre = ${nombreSede}`;
    await invocar(
      acciones.guardarSala,
      formularioSala(salaCerradaId, { sede: nombreSede }),
    );
    const [{ n: sedes }] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from sedes where nombre = ${nombreSede}`;
    afirmar(
      Number(sedes) === 0,
      'y una sede nueva mandada a una obra cerrada tampoco se crea: el rechazo se lleva la transacción entera',
    );
  }

  // ------------------------------------------------- la carrera completa
  //
  // Es el fallo entero, no el incremento: la pestaña Diagrama lee su versión,
  // otra superficie escribe, y el guardado del plano con la versión leída
  // tiene que rechazarse en vez de sobrescribir el trabajo de la otra.
  {
    const equipoId = await nuevoEquipo(salaId, 'TEST equipo carrera');

    // La pestaña Diagrama abre y se queda con la versión que había.
    const versionQueVeElPlano = await versionDe(salaId);

    // Mientras tanto, alguien coloca el equipo desde Equipamiento.
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaId, { x_m: '5', y_m: '3', z_m: '1.4' }),
    );
    const trasEquipamiento = await equipoDe(equipoId);
    afirmar(
      Number(trasEquipamiento.x_m) === 5 && trasEquipamiento.posicion_confirmada,
      'Equipamiento coloca el equipo en (5, 3)',
    );

    // Y la pestaña que llevaba abierta guarda con su versión vieja.
    let resultado;
    try {
      resultado = await guardarDiagramaSala({
        sala_id: salaId,
        versionEsperada: versionQueVeElPlano,
        sala: null,
        equipos: [
          { id: equipoId, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
        ],
        equipos_alta: [],
        mobiliario_alta: [],
        mobiliario_cambio: [],
        mobiliario_baja: [],
        tomas: [],
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
      'el plano guardado con la versión de antes se rechaza por conflicto',
    );
    const despues = await equipoDe(equipoId);
    afirmar(
      Number(despues.x_m) === 5 && Number(despues.y_m) === 3,
      'y no sobrescribe en silencio lo que se colocó desde Equipamiento',
    );
  }

  // ============================================================ hallazgo 3
  //
  // Escribir una coordenada desde Equipamiento es colocar el equipo.

  {
    const equipoId = await nuevoEquipo(salaCroquisId, 'TEST equipo croquis');
    const antes = await equipoDe(equipoId);
    afirmar(!antes.posicion_confirmada, 'el equipo parte sin colocar');

    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, { x_m: '4.5', y_m: '2.5', z_m: '1.4' }),
    );
    const colocado = await equipoDe(equipoId);
    afirmar(
      colocado.posicion_confirmada === true,
      'teclear X e Y en Equipamiento deja el equipo colocado, no estimado',
    );
    afirmar(
      Number(colocado.x_m) === 4.5 && Number(colocado.y_m) === 2.5,
      'con la coordenada que se tecleó',
    );

    const datos = await obtenerDatosPlanoSala(salaCroquisId);
    const escena = construirEscena({
      sala: datos!.sala,
      equipos: datos!.equipos,
      conexiones: datos!.conexiones,
      tomas: datos!.tomas,
      muebles: datos!.muebles,
    });
    const dibujado = escena.equipos.find((e) => e.id === equipoId)!;
    afirmar(
      dibujado.x_m === 4.5 && dibujado.y_m === 2.5 && !dibujado.estimada,
      'y el croquis dibuja ahí el equipo en vez de deducir la posición del extremo',
    );
  }

  {
    // Vaciar las casillas es decir «no lo sé»: el equipo vuelve a estar sin
    // colocar. Lo que NO puede pasar es que se quede en un (0,0,0) confirmado,
    // que es la esquina de la sala dada por medida.
    const equipoId = await nuevoEquipo(salaCroquisId, 'TEST equipo vaciado');
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, { x_m: '3', y_m: '2', z_m: '1.4' }),
    );
    afirmar((await equipoDe(equipoId)).posicion_confirmada === true, 'primero se coloca');

    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, { x_m: '', y_m: '', z_m: '' }),
    );
    const vaciado = await equipoDe(equipoId);
    afirmar(
      vaciado.posicion_confirmada === false,
      'vaciar las casillas devuelve el equipo a sin colocar',
    );
    afirmar(
      !(Number(vaciado.x_m) === 0 && Number(vaciado.y_m) === 0 && vaciado.posicion_confirmada),
      'y no lo deja en un (0,0,0) confirmado, que es la esquina dada por medida',
    );
  }

  {
    // El rack va en la esquina, y la esquina es (0,0).
    //
    // Es el caso que dio origen a `posicion_confirmada`: (0,0,0) significaba a
    // la vez «sin colocar» y «la esquina de la sala», que es justo donde va el
    // rack. Confirmado es una medida aunque valga cero, así que teclear X = 0 e
    // Y = 0 a propósito tiene que colocar el equipo, no dejarlo estimado.
    //
    // `posicionPorDefecto()` deduce el rack en (largo, 0) —la otra esquina—,
    // así que el croquis dice sin ambigüedad si respetó lo tecleado o lo
    // dedujo del extremo.
    const rackId = await nuevoEquipo(salaRackId, 'TEST rack', 'rack');
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(rackId, salaRackId, {
        nombre: 'TEST rack',
        extremo: 'rack',
        x_m: '0',
        y_m: '0',
        z_m: '0',
      }),
    );
    const rack = await equipoDe(rackId);
    afirmar(
      rack.posicion_confirmada === true &&
        Number(rack.x_m) === 0 &&
        Number(rack.y_m) === 0,
      'el rack se coloca en la esquina: cero es una medida, no una ausencia',
    );

    const datosRack = await obtenerDatosPlanoSala(salaRackId);
    const escenaRack = construirEscena({
      sala: datosRack!.sala,
      equipos: datosRack!.equipos,
      conexiones: datosRack!.conexiones,
      tomas: datosRack!.tomas,
      muebles: datosRack!.muebles,
    });
    const rackDibujado = escenaRack.equipos.find((e) => e.id === rackId)!;
    afirmar(
      !rackDibujado.estimada && rackDibujado.x_m === 0 && rackDibujado.y_m === 0,
      'y el croquis lo dibuja ahí en vez de deducirlo del extremo',
    );

    const habiaRack = await idsDeEquipos(salaRackId);
    const altaEnLaEsquina = new FormData();
    altaEnLaEsquina.set('sala_id', salaRackId);
    altaEnLaEsquina.set('articulo_id', articuloEquipoId);
    altaEnLaEsquina.set('extremo', 'rack');
    altaEnLaEsquina.set('x_m', '0');
    altaEnLaEsquina.set('y_m', '0');
    altaEnLaEsquina.set('z_m', '0');
    await invocar(acciones.anadirEquipo, altaEnLaEsquina);
    const altaRack = await equipoDe(await recienCreado(salaRackId, habiaRack));
    afirmar(
      altaRack.posicion_confirmada === true,
      'un alta con la esquina tecleada nace colocada, no estimada',
    );
  }

  {
    // Guardar el nombre de un equipo estimado no lo coloca: el formulario
    // enseña sus casillas VACÍAS —nadie ha medido nada— y un formulario que no
    // manda coordenada no coloca nada.
    const equipoId = await nuevoEquipo(salaCroquisId, 'TEST equipo renombrado');
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, {
        nombre: 'TEST equipo con otro nombre',
        x_m: '',
        y_m: '',
        z_m: '',
      }),
    );
    const renombrado = await equipoDe(equipoId);
    afirmar(
      renombrado.posicion_confirmada === false,
      'guardar el nombre de un equipo sin colocar no lo coloca: sus casillas van vacías',
    );

    // Y un equipo YA colocado no se descoloca por reenviar su propia posición.
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, { x_m: '1', y_m: '1', z_m: '0' }),
    );
    await invocar(
      acciones.guardarEquipo,
      formularioEquipo(equipoId, salaCroquisId, {
        nombre: 'TEST equipo colocado y renombrado',
        x_m: '1',
        y_m: '1',
        z_m: '0',
      }),
    );
    afirmar(
      (await equipoDe(equipoId)).posicion_confirmada === true,
      'y un equipo ya colocado sigue colocado al guardar su nombre',
    );
  }

  {
    // El alta ya no propone coordenadas: nadie ha medido nada todavía. Un alta
    // sin casillas rellenas nace estimada y el croquis la deduce del extremo.
    const habia = await idsDeEquipos(salaCroquisId);
    const sinMedir = new FormData();
    sinMedir.set('sala_id', salaCroquisId);
    sinMedir.set('articulo_id', articuloEquipoId);
    sinMedir.set('extremo', 'pantalla');
    sinMedir.set('x_m', '');
    sinMedir.set('y_m', '');
    sinMedir.set('z_m', '');
    await invocar(acciones.anadirEquipo, sinMedir);
    const reciente = await equipoDe(await recienCreado(salaCroquisId, habia));
    afirmar(
      reciente.posicion_confirmada === false,
      'un alta sin coordenadas nace estimada, no colocada en la esquina',
    );

    const habia2 = await idsDeEquipos(salaCroquisId);
    const medido = new FormData();
    medido.set('sala_id', salaCroquisId);
    medido.set('articulo_id', articuloEquipoId);
    medido.set('extremo', 'pantalla');
    medido.set('x_m', '5.5');
    medido.set('y_m', '3.5');
    medido.set('z_m', '1.2');
    await invocar(acciones.anadirEquipo, medido);
    const conMedida = await equipoDe(await recienCreado(salaCroquisId, habia2));
    afirmar(
      conMedida.posicion_confirmada === true && Number(conMedida.x_m) === 5.5,
      'y un alta con la coordenada tecleada nace colocada',
    );
  }

  // ========================================================== hallazgo 4
  //
  // El orden de cerrojos, con contendientes DE VERDAD.
  //
  // Lo de arriba comprueba qué mueve la versión, pero lo hace en serie: una
  // acción termina y luego empieza la otra. Eso demuestra una versión obsoleta,
  // no una carrera. Aquí las dos transacciones están vivas a la vez, paradas
  // sobre el mismo cerrojo, y se sueltan a la vez.
  //
  // La barrera es una tercera conexión que coge `select ... for update` sobre
  // la fila de la sala y no la suelta. Los contendientes se lanzan sin esperar,
  // se comprueba con `pg_blocking_pids()` que están de verdad parados en ese
  // cerrojo, y solo entonces se suelta. Sin la barrera, dos `await` seguidos se
  // pueden ejecutar en serie y la prueba pasaría igual sin haber medido nada.
  //
  // Y mientras están parados se mira QUÉ cerrojos tienen ya cogidos. Una acción
  // que escribiera en la tabla hija antes de bloquear `salas` llegaría a esa
  // espera con un `RowExclusiveLock` sobre `sala_equipos` o `tomas_red` en la
  // mano: es justo el ciclo que produce el abrazo mortal, y es lo que se busca.

  {
    const barrera = postgres(process.env.DATABASE_URL!, { max: 1, ssl: false });
    const observador = postgres(process.env.DATABASE_URL!, { max: 1, ssl: false });

    /**
     * Las barreras vivas. Si una comprobación falla a mitad, el cerrojo se
     * suelta igual desde el `finally` de abajo: una barrera olvidada deja la
     * fila bloqueada y el propio borrado de la limpieza se queda esperando.
     */
    const barreras: Array<{ soltar: () => void; fin: Promise<unknown> }> = [];

    /** Coge el cerrojo de la sala y no lo suelta hasta que se llame a `soltar`. */
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
      barreras.push({ soltar, fin });
      return { pid, soltar, fin };
    }

    /**
     * Quién está parado esperando, directa o indirectamente, a la barrera.
     *
     * `pg_blocking_pids()` da solo el eslabón inmediato: el segundo contendiente
     * espera al primero, no a la barrera. La cadena se cierra aquí, o la prueba
     * se quedaría esperando para siempre a un segundo bloqueado directo que no
     * va a existir nunca.
     */
    const bloqueadosPor = async (pid: number): Promise<number[]> => {
      const filas = await observador<Array<{ pid: number; por: number[] }>>`
        select pid, pg_blocking_pids(pid) as por from pg_stat_activity
         where datname = current_database() and pid <> pg_backend_pid()
           and cardinality(pg_blocking_pids(pid)) > 0`;
      const cadena = new Set<number>([pid]);
      // Se repite hasta que deja de crecer: la cadena tiene tantos eslabones
      // como contendientes, y son dos o tres.
      for (let vuelta = 0; vuelta < filas.length + 1; vuelta += 1) {
        for (const f of filas) {
          if (f.por.some((p) => cadena.has(Number(p)))) cadena.add(Number(f.pid));
        }
      }
      cadena.delete(pid);
      return [...cadena];
    };

    /**
     * Espera a que haya tantos contendientes parados en el cerrojo, y devuelve
     * lo que haya cuando se acaba el plazo. NO lanza: que no lleguen es un
     * resultado, y el resultado es que la acción no está cogiendo el cerrojo de
     * la sala. Lanzar aquí convertiría ese fallo en un rastro de pila sin
     * ninguna comprobación en rojo, que es exactamente lo que una prueba no
     * puede hacer.
     */
    const esperarBloqueados = async (pid: number, cuantos: number): Promise<number[]> => {
      let lista: number[] = [];
      for (let i = 0; i < 240; i += 1) {
        lista = await bloqueadosPor(pid);
        if (lista.length >= cuantos) return lista;
        await new Promise((r) => setTimeout(r, 25));
      }
      return lista;
    };

    /**
     * Las tablas hijas del plano que esos procesos ya tienen cogidas para
     * escribir. Con el orden correcto la lista está vacía: cuando se espera al
     * cerrojo de la sala todavía no se ha escrito nada.
     */
    const hijasYaTomadas = async (pids: number[]): Promise<string[]> => {
      if (pids.length === 0) return [];
      const filas = await observador<Array<{ tabla: string }>>`
        select distinct l.relation::regclass::text as tabla
          from pg_locks l
         where l.locktype = 'relation' and l.granted
           and l.mode = 'RowExclusiveLock'
           and l.pid = any(${pids})
           and l.relation::regclass::text in ('sala_equipos', 'tomas_red', 'sala_mobiliario')`;
      return filas.map((f) => String(f.tabla));
    };

    const esAbrazoMortal = (e: unknown) => {
      const codigo = (e as { code?: string })?.code;
      const mensaje = e instanceof Error ? e.message : String(e);
      return codigo === '40P01' || /deadlock/i.test(mensaje);
    };

    /** Espera a los dos contendientes sin tragarse un abrazo mortal. */
    async function resolver<A, B>(a: Promise<A>, b: Promise<B>, donde: string) {
      const [ra, rb] = await Promise.allSettled([a, b]);
      for (const r of [ra, rb]) {
        if (r.status === 'rejected' && esAbrazoMortal(r.reason)) {
          afirmar(false, `${donde}: abrazo mortal entre las dos transacciones`);
          return null;
        }
        if (r.status === 'rejected') throw r.reason;
      }
      afirmar(true, `${donde}: las dos transacciones terminan sin abrazo mortal`);
      return [
        (ra as PromiseFulfilledResult<A>).value,
        (rb as PromiseFulfilledResult<B>).value,
      ] as const;
    }

    const guardarPlano = async (patch: Parameters<typeof guardarDiagramaSala>[0]) => {
      try {
        return await guardarDiagramaSala(patch);
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        if (!mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE)) throw e;
        return { ok: true as const, version: -1, ids: {} };
      }
    };

    try {
      // -------------------------------------- el orden, superficie por superficie
      //
      // Cada acción de la ficha que sube la versión del plano se lanza contra la
      // barrera y se le mira la mano: si ya tiene cogida una tabla hija, ha
      // escrito antes de bloquear la sala y el orden está roto.
      const equipoOrden = await nuevoEquipo(salaCarreraId, 'TEST orden de cerrojos');
      await sql`
        insert into tomas_red (sala_id, codigo, x_m, y_m, z_m)
        values (${salaCarreraId}, 'TEST-ORDEN', 1, 1, 0)`;
      const [tomaOrden] = await sql<Array<{ id: string }>>`
        select id from tomas_red where sala_id = ${salaCarreraId} and codigo = 'TEST-ORDEN'`;

      const altaEquipo = new FormData();
      altaEquipo.set('sala_id', salaCarreraId);
      altaEquipo.set('articulo_id', articuloEquipoId);
      altaEquipo.set('extremo', 'pantalla');

      const altaToma = new FormData();
      altaToma.set('sala_id', salaCarreraId);
      altaToma.set('codigo', 'TEST-ORDEN-2');

      const situarToma = new FormData();
      situarToma.set('id', tomaOrden.id);
      situarToma.set('sala_id', salaCarreraId);
      situarToma.set('codigo', 'TEST-ORDEN');
      situarToma.set('x_m', '2');
      situarToma.set('y_m', '1');
      situarToma.set('z_m', '0');

      const superficies: Array<{ nombre: string; lanzar: () => Promise<unknown> }> = [
        {
          nombre: 'Resumen · medidas de la sala',
          lanzar: () => invocar(acciones.guardarSala, formularioSala(salaCarreraId)),
        },
        {
          nombre: 'Equipamiento · alta de equipo',
          lanzar: () => invocar(acciones.anadirEquipo, altaEquipo),
        },
        {
          nombre: 'Equipamiento · guardar equipo',
          lanzar: () =>
            invocar(
              acciones.guardarEquipo,
              formularioEquipo(equipoOrden, salaCarreraId, { x_m: '1', y_m: '1', z_m: '0' }),
            ),
        },
        {
          nombre: 'Tomas · alta de roseta',
          lanzar: () => invocar(acciones.anadirToma, altaToma),
        },
        {
          nombre: 'Tomas · situar roseta',
          lanzar: () => invocar(acciones.guardarToma, situarToma),
        },
      ];

      let mutacionesEfectivas = 0;
      const versionAlEmpezar = await versionDe(salaCarreraId);

      for (const s of superficies) {
        const { pid, soltar, fin } = await tomarBarrera(salaCarreraId);
        const pendiente = s.lanzar();
        try {
          const parados = await esperarBloqueados(pid, 1);
          const hijas = await hijasYaTomadas(parados);
          // El detalle va aparte del mensaje: el nombre de la comprobación no
          // puede cambiar según lo que encuentre, o la matriz de mutaciones no
          // podría reconocer la prueba que cae.
          if (hijas.length > 0) {
            console.log(`      (${s.nombre} ya tenía cogida ${hijas.join(', ')})`);
          }
          if (parados.length === 0) {
            console.log(`      (${s.nombre} no llegó a esperar ningún cerrojo de sala)`);
          }
          afirmar(
            parados.length > 0 && hijas.length === 0,
            `${s.nombre}: espera el cerrojo de la sala SIN haber escrito antes en ninguna tabla hija`,
          );
        } finally {
          soltar();
          await fin;
          await pendiente;
        }
        mutacionesEfectivas += 1;
      }

      afirmar(
        (await versionDe(salaCarreraId)) === versionAlEmpezar + mutacionesEfectivas,
        `la versión sube exactamente una vez por mutación efectiva (${mutacionesEfectivas})`,
      );

      // ------------------------------------ Equipamiento primero, Diagrama detrás
      {
        const equipoId = await nuevoEquipo(salaCarreraId, 'TEST carrera A');
        // La pestaña Diagrama ya estaba abierta y se quedó con este número.
        const versionQueVeElPlano = await versionDe(salaCarreraId);

        const { pid, soltar, fin } = await tomarBarrera(salaCarreraId);

        // Los dos contendientes se lanzan sin esperar el uno al otro, y no se
        // suelta nada hasta comprobar que LOS DOS están parados en el cerrojo.
        const pEquipo = invocar(
          acciones.guardarEquipo,
          formularioEquipo(equipoId, salaCarreraId, { x_m: '5', y_m: '3', z_m: '1.4' }),
        );
        await esperarBloqueados(pid, 1);
        const pPlano = guardarPlano({
          sala_id: salaCarreraId,
          versionEsperada: versionQueVeElPlano,
          sala: null,
          equipos: [
            { id: equipoId, x_m: 1, y_m: 1, z_m: 0, posicion_confirmada: true, rotacion_grados: 0 },
          ],
          equipos_alta: [],
          mobiliario_alta: [],
          mobiliario_cambio: [],
          mobiliario_baja: [],
          tomas: [],
          inicio_diagrama: null,
          sillas_modo: null,
        });
        const aLaVez = await esperarBloqueados(pid, 2);
        afirmar(
          aLaVez.length >= 2,
          'los dos contendientes esperan a la vez el mismo cerrojo de sala',
        );

        soltar();
        await fin;
        const resultado = await resolver(pEquipo, pPlano, 'Equipamiento delante del plano');
        const plano = resultado?.[1];

        afirmar(
          plano?.ok === false && plano.motivo === 'conflicto',
          'si Equipamiento entra primero, el plano con la versión de antes recibe conflicto',
        );
        const e = await equipoDe(equipoId);
        afirmar(
          Number(e.x_m) === 5 && Number(e.y_m) === 3 && Number(e.z_m) === 1.4,
          'y el equipo queda entero como lo dejó Equipamiento: no hay estado a medias',
        );
        afirmar(
          (await versionDe(salaCarreraId)) === versionQueVeElPlano + 1,
          'la versión sube una sola vez: el guardado rechazado no cuenta',
        );
      }

      // ------------------------------------ Diagrama primero, Equipamiento detrás
      {
        const equipoId = await nuevoEquipo(salaCarreraId, 'TEST carrera B');
        const version = await versionDe(salaCarreraId);

        const { pid, soltar, fin } = await tomarBarrera(salaCarreraId);

        const pPlano = guardarPlano({
          sala_id: salaCarreraId,
          versionEsperada: version,
          sala: null,
          equipos: [
            { id: equipoId, x_m: 2, y_m: 2, z_m: 0.5, posicion_confirmada: true, rotacion_grados: 0 },
          ],
          equipos_alta: [],
          mobiliario_alta: [],
          mobiliario_cambio: [],
          mobiliario_baja: [],
          tomas: [],
          inicio_diagrama: null,
          sillas_modo: null,
        });
        await esperarBloqueados(pid, 1);
        const pEquipo = invocar(
          acciones.guardarEquipo,
          formularioEquipo(equipoId, salaCarreraId, { x_m: '4', y_m: '1', z_m: '1.2' }),
        );
        await esperarBloqueados(pid, 2);

        soltar();
        await fin;
        const resultado = await resolver(pPlano, pEquipo, 'el plano delante de Equipamiento');
        const plano = resultado?.[0];

        afirmar(
          plano?.ok === true,
          'si el plano coge el cerrojo primero, termina íntegro con su versión al día',
        );
        const e = await equipoDe(equipoId);
        afirmar(
          Number(e.x_m) === 4 && Number(e.y_m) === 1 && Number(e.z_m) === 1.2,
          'y Equipamiento escribe DESPUÉS, sobre el estado que dejó el plano',
        );
        afirmar(
          (await versionDe(salaCarreraId)) === version + 2,
          'la versión final es exactamente el número de mutaciones efectivas: dos',
        );
      }

      // ------------------------------- cerrar la obra mientras alguien escribe
      //
      // El cierre coge los MISMOS cerrojos y en el mismo orden que las acciones
      // de sala. Si va delante, la escritura de después lo ve y no escribe; si
      // va detrás, espera. Lo que no puede pasar es que la escritura se cuele
      // porque comprobó el cierre antes de tener el cerrojo.
      {
        const ciclo = await import('../src/app/acciones-ciclo');
        const equipoId = await nuevoEquipo(salaCierreCarreraId, 'TEST cierre carrera');
        const antes = await versionDe(salaCierreCarreraId);

        const { pid, soltar, fin } = await tomarBarrera(salaCierreCarreraId);

        const dCierre = new FormData();
        dCierre.set('proyecto_id', proyectoCarreraId);
        dCierre.set('tipo', 'cierre');
        dCierre.set('tecnico_id', tecnicoId);
        dCierre.set('notas', 'TEST cierre con salas sin entregar');
        const pCierre = invocar(ciclo.registrarHitoProyecto, dCierre);
        await esperarBloqueados(pid, 1);

        const pEquipo = invocar(
          acciones.guardarEquipo,
          formularioEquipo(equipoId, salaCierreCarreraId, { x_m: '2', y_m: '2', z_m: '1' }),
        );
        await esperarBloqueados(pid, 2);

        soltar();
        await fin;
        await resolver(pCierre, pEquipo, 'el cierre de la obra contra una escritura de sala');

        const [{ cerrado }] = await sql<Array<{ cerrado: boolean }>>`
          select exists (select 1 from hitos_proyecto
                         where proyecto_id = ${proyectoCarreraId} and tipo = 'cierre') as cerrado`;
        afirmar(cerrado, 'el cierre concurrente se registra');
        afirmar(
          Number((await equipoDe(equipoId)).x_m) === 0,
          'y la escritura que iba detrás no entra: la obra ya estaba cerrada cuando cogió el cerrojo',
        );
        afirmar(
          (await versionDe(salaCierreCarreraId)) === antes,
          'ni sube la versión del plano de una sala que no ha cambiado',
        );
      }
    } finally {
      for (const b of barreras) {
        b.soltar();
        await b.fin.catch(() => {});
      }
      await barrera.end();
      await observador.end();
    }
  }
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
