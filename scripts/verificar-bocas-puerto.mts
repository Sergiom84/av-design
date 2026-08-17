import { randomUUID } from 'node:crypto';
import Module from 'node:module';
import postgres from 'postgres';

type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const moduloInterno = Module as unknown as ModuloConLoad;
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  if (request === 'next/cache') return { revalidatePath: () => {}, revalidateTag: () => {} };
  return cargarOriginal.call(Module, request, ...resto);
};

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';
const url = process.env.DATABASE_URL;
const destino = new URL(url);
if (!['localhost', '127.0.0.1', '::1'].includes(destino.hostname)) {
  throw new Error('test:bocas exige Postgres local');
}

const sql = postgres(url, { max: 4, ssl: false });
let total = 0;
let pasadas = 0;
const afirmar = (condicion: boolean, mensaje: string) => {
  total += 1;
  if (condicion) pasadas += 1;
  console.log(`${condicion ? 'OK   ' : 'FALLO'} ${mensaje}`);
};
const fallaCon = async (trabajo: () => Promise<unknown>, codigo: string) => {
  try {
    await trabajo();
    return false;
  } catch (error) {
    return (error as { code?: string }).code === codigo;
  }
};

const articuloId = randomUUID();
const salaId = randomUUID();
const salaVecinaId = randomUUID();
const equipos = Array.from({ length: 5 }, () => randomUUID());
const salidaId = randomUUID();
const entradaId = randomUUID();
const conexiones = Array.from({ length: 6 }, () => randomUUID());

try {
  await sql`insert into articulos (id, tipo, categoria, modelo) values (${articuloId}, 'equipo', 'TEST BOCAS', 'TEST BOCAS')`;
  await sql`insert into puertos (id, articulo_id, nombre, total, sentido, senal) values
    (${salidaId}, ${articuloId}, 'OUTPUT', 2, 'salida', 'hdmi'),
    (${entradaId}, ${articuloId}, 'INPUT', 2, 'entrada', 'hdmi')`;
  await sql`insert into salas (id, nombre) values (${salaId}, 'TEST bocas fisicas'), (${salaVecinaId}, 'TEST bocas vecina')`;
  for (const id of equipos) {
    await sql`insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad) values (${id}, ${salaId}, ${articuloId}, 'Equipo', 1)`;
  }
  const { anadirConexion, anadirConexionConEstado, guardarConexion } = await import('../src/app/acciones');
  const incompleto = new FormData();
  incompleto.set('sala_id', salaId);
  incompleto.set('origen_id', equipos[0]);
  incompleto.set('destino_id', equipos[1]);
  const estadoIncompleto = await anadirConexionConEstado({ error: null }, incompleto);
  afirmar(Boolean(estadoIncompleto.error?.includes('boca física')),
    'el servidor explica el detalle incompleto en vez de fingir un alta correcta');
  const formulario = new FormData();
  formulario.set('sala_id', salaId);
  formulario.set('origen_id', equipos[0]);
  formulario.set('destino_id', equipos[1]);
  formulario.set('puerto_origen_id', salidaId);
  formulario.set('puerto_origen_ordinal', '1');
  formulario.set('puerto_destino_id', entradaId);
  formulario.set('puerto_destino_ordinal', '1');
  formulario.set('senal', 'hdmi');
  await anadirConexion(formulario);
  const [altaAccion] = await sql<Array<{ id: string; bocas: number }>>`
    select c.id, count(b.conexion_id)::int as bocas
    from conexiones c join conexion_bocas b on b.conexion_id = c.id
    where c.sala_id = ${salaId} group by c.id`;
  afirmar(altaAccion?.bocas === 2, 'la acción guarda conexión y pareja de bocas atómicamente');
  const editar = new FormData();
  editar.set('id', altaAccion.id);
  editar.set('boca_origen', `${salidaId}:2`);
  editar.set('boca_destino', `${entradaId}:1`);
  editar.set('senal', 'hdmi');
  await guardarConexion(editar);
  const [ordinalEditado] = await sql<Array<{ ordinal: number }>>`
    select ordinal from conexion_bocas where conexion_id = ${altaAccion.id} and lado = 'origen'`;
  afirmar(ordinalEditado.ordinal === 2, 'editar solo el ordinal sustituye la pareja sin chocar con su PK');
  await sql`update conexiones set sala_id = ${salaVecinaId} where id = ${altaAccion.id}`;
  const [trasMoverSala] = await sql<Array<{ n: number }>>`
    select count(*)::int as n from conexion_bocas where conexion_id = ${altaAccion.id}`;
  afirmar(trasMoverSala.n === 0, 'cambiar la sala del padre invalida la pareja antes de dejarla incompatible');
  await sql`update conexiones set sala_id = ${salaId} where id = ${altaAccion.id}`;
  await sql`delete from conexiones where id = ${altaAccion.id}`;

  const formularioConcurrente = (destinoId: string, ordinalDestino: number) => {
    const datos = new FormData();
    datos.set('sala_id', salaId);
    datos.set('origen_id', equipos[0]);
    datos.set('destino_id', destinoId);
    datos.set('puerto_origen_id', salidaId);
    datos.set('puerto_origen_ordinal', '1');
    datos.set('puerto_destino_id', entradaId);
    datos.set('puerto_destino_ordinal', String(ordinalDestino));
    datos.set('senal', 'hdmi');
    return datos;
  };
  const carreraAcciones = await Promise.all([
    anadirConexionConEstado({ error: null }, formularioConcurrente(equipos[1], 1)),
    anadirConexionConEstado({ error: null }, formularioConcurrente(equipos[2], 2)),
  ]);
  afirmar(carreraAcciones.filter((r) => r.error == null).length === 1 && carreraAcciones.filter((r) => r.error?.includes('ocupada')).length === 1,
    'dos acciones concurrentes traducen una ganadora y una boca ocupada');
  await sql`delete from conexiones where sala_id = ${salaId}`;
  for (let i = 0; i < conexiones.length; i += 1) {
    await sql`insert into conexiones (id, sala_id, origen_id, destino_id, senal) values
      (${conexiones[i]}, ${salaId}, ${equipos[0]}, ${equipos[(i % 4) + 1]}, 'hdmi')`;
  }

  const legado = await sql`select count(*)::int as n from conexion_bocas where conexion_id = ${conexiones[0]}`;
  afirmar(legado[0].n === 0, 'una conexión histórica sigue válida sin inventar ordinal');

  await sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[0]}, 'origen', ${equipos[0]}, ${salidaId}, 1),
      (${conexiones[0]}, 'destino', ${equipos[1]}, ${entradaId}, 1)`;
  });
  afirmar(true, 'la pareja completa admite el ordinal 1');

  await sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[1]}, 'origen', ${equipos[0]}, ${salidaId}, 2),
      (${conexiones[1]}, 'destino', ${equipos[2]}, ${entradaId}, 2)`;
  });
  afirmar(true, 'OUTPUT 1 y OUTPUT 2 se ocupan independientemente');

  afirmar(await fallaCon(() => sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[2]}, 'origen', ${equipos[0]}, ${salidaId}, 1),
      (${conexiones[2]}, 'destino', ${equipos[3]}, ${entradaId}, 1)`;
  }), '23505'), 'la exclusividad cruza todas las conexiones y lados');

  afirmar(await fallaCon(() => sql`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal)
    values (${conexiones[2]}, 'origen', ${equipos[0]}, ${salidaId}, 0)`, '23514'), 'ordinal cero se rechaza');
  afirmar(await fallaCon(() => sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[2]}, 'origen', ${equipos[0]}, ${salidaId}, 3),
      (${conexiones[2]}, 'destino', ${equipos[3]}, ${entradaId}, 2)`;
  }), '23514'), 'ordinal superior al total se rechaza');
  afirmar(await fallaCon(() => sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[2]}, 'origen', ${equipos[4]}, ${salidaId}, 1),
      (${conexiones[2]}, 'destino', ${equipos[3]}, ${entradaId}, 2)`;
  }), '23514'), 'equipo cruzado con otro extremo se rechaza');
  await sql`delete from conexion_bocas where conexion_id = ${conexiones[0]}`;
  afirmar(await fallaCon(() => sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal)
      values (${conexiones[2]}, 'origen', ${equipos[0]}, ${salidaId}, 1)`;
  }), '23514'), 'una sola boca no puede quedar persistida');
  await sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${conexiones[0]}, 'origen', ${equipos[0]}, ${salidaId}, 1),
      (${conexiones[0]}, 'destino', ${equipos[1]}, ${entradaId}, 1)`;
  });
  afirmar(await fallaCon(() => sql`update puertos set total = 1 where id = ${salidaId}`, '23514'), 'no se reduce total dejando OUTPUT 2 inválido');
  afirmar(await fallaCon(() => sql`update sala_equipos set cantidad = 2 where id = ${equipos[0]}`, '23514'), 'una instancia detallada no se convierte en cantidad agregada');

  await sql`delete from conexion_bocas where conexion_id in (${conexiones[0]}, ${conexiones[1]})`;
  const competir = async (conexionId: string, destinoEquipo: string, ordinalDestino: number) => {
    try {
      await sql.begin(async (tx) => {
        await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
          (${conexionId}, 'origen', ${equipos[0]}, ${salidaId}, 1),
          (${conexionId}, 'destino', ${destinoEquipo}, ${entradaId}, ${ordinalDestino})`;
      });
      return 'gana';
    } catch (error) {
      return (error as { code?: string }).code === '23505' ? 'ocupada' : 'otro';
    }
  };
  const carrera = await Promise.all([
    competir(conexiones[3], equipos[4], 1),
    competir(conexiones[4], equipos[1], 2),
  ]);
  afirmar(carrera.filter((r) => r === 'gana').length === 1 && carrera.filter((r) => r === 'ocupada').length === 1,
    'dos transacciones simultáneas producen una ganadora y una ocupada');

  // El trigger que valida la boca bloquea el puerto: una reducción concurrente
  // espera y, al despertar, ve la boca ya confirmada y se rechaza.
  await sql`delete from conexion_bocas`;
  let liberarInsercion!: () => void;
  const pausaInsercion = new Promise<void>((resolve) => { liberarInsercion = resolve; });
  let bocaInsertada!: () => void;
  const insertoPrimeraBoca = new Promise<void>((resolve) => { bocaInsertada = resolve; });
  const insercionConcurrente = sql.begin(async (tx) => {
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal)
      values (${conexiones[5]}, 'origen', ${equipos[0]}, ${salidaId}, 2)`;
    bocaInsertada();
    await pausaInsercion;
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal)
      values (${conexiones[5]}, 'destino', ${equipos[2]}, ${entradaId}, 2)`;
  });
  await insertoPrimeraBoca;
  let pidReduccion = 0;
  const reduccionConcurrente = sql.begin(async (tx) => {
    const [fila] = await tx<Array<{ pid: number }>>`select pg_backend_pid()::int as pid`;
    pidReduccion = fila.pid;
    await tx`update puertos set total = 1 where id = ${salidaId}`;
  }).then(() => 'entra', (error) => (error as { code?: string }).code === '23514' ? 'rechazada' : 'otro');
  let bloqueada = false;
  for (let intento = 0; intento < 60 && !bloqueada; intento += 1) {
    if (pidReduccion) {
      const [fila] = await sql<Array<{ bloqueada: boolean }>>`
        select cardinality(pg_blocking_pids(${pidReduccion})) > 0 as bloqueada`;
      bloqueada = fila.bloqueada;
    }
    if (!bloqueada) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  afirmar(bloqueada, 'reducir total espera el cerrojo autoritativo tomado por el alta de la boca');
  liberarInsercion();
  await insercionConcurrente;
  afirmar(await reduccionConcurrente === 'rechazada',
    'tras la carrera no queda un ordinal fuera de rango: la reducción se rechaza');
  await sql`delete from conexion_bocas where conexion_id = ${conexiones[5]}`;

  const plantillaId = randomUUID();
  const lineas = Array.from({ length: 3 }, () => randomUUID());
  const tiradaId = randomUUID();
  await sql`insert into plantillas_sala (id, nombre, tipologia) values (${plantillaId}, 'TEST bocas inversa plantilla', 'TEST')`;
  for (const linea of lineas) {
    await sql`insert into plantilla_articulos (id, plantilla_id, articulo_id, categoria, modelo_texto, cantidad)
      values (${linea}, ${plantillaId}, ${articuloId}, 'TEST', 'Equipo', 1)`;
  }
  await sql`insert into plantilla_conexiones (id, plantilla_id, origen_linea_id, destino_linea_id)
    values (${tiradaId}, ${plantillaId}, ${lineas[0]}, ${lineas[1]})`;
  await sql.begin(async (tx) => {
    await tx`insert into plantilla_conexion_bocas
      (plantilla_conexion_id, lado, linea_id, puerto_id, ordinal) values
      (${tiradaId}, 'origen', ${lineas[0]}, ${salidaId}, 1),
      (${tiradaId}, 'destino', ${lineas[1]}, ${entradaId}, 1)`;
  });
  await sql`update plantilla_conexiones set origen_linea_id = ${lineas[2]} where id = ${tiradaId}`;
  const [trasCambiarLinea] = await sql<Array<{ n: number }>>`
    select count(*)::int as n from plantilla_conexion_bocas where plantilla_conexion_id = ${tiradaId}`;
  afirmar(trasCambiarLinea.n === 0, 'cambiar un extremo de plantilla invalida su pareja física');
  await sql`delete from plantillas_sala where id = ${plantillaId}`;
} finally {
  await sql`delete from salas where id in (${salaId}, ${salaVecinaId})`;
  await sql`delete from articulos where id = ${articuloId}`;
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (pasadas !== total) process.exitCode = 1;
