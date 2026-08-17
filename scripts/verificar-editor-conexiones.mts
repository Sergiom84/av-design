/** Guardado batch, bocas físicas, rollback y concurrencia del editor visual. */
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';
const destino = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(destino.hostname)) {
  throw new Error('test:editor-conexiones exige Postgres local');
}

type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const modulo = Module as unknown as ModuloConLoad;
const cargar = modulo._load;
modulo._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  if (request === 'next/cache') return { revalidatePath: () => {} };
  return cargar.call(Module, request, ...resto);
};

const sql = postgres(process.env.DATABASE_URL, { max: 4, ssl: false });
const salaId = randomUUID();
const salaAjenaId = randomUUID();
const articuloId = randomUUID();
const cableId = randomUUID();
const equipos = Array.from({ length: 6 }, () => randomUUID());
const equipoAjeno = randomUUID();
const salidaId = randomUUID();
const entradaId = randomUUID();
const proyectoId = randomUUID();
const localizacionId = randomUUID();
let total = 0;
let pasadas = 0;
const afirmar = (valor: boolean, texto: string) => {
  total += 1;
  if (valor) pasadas += 1;
  console.log(`${valor ? 'OK   ' : 'FALLO'} ${texto}`);
};

const conexion = (
  temporal_id: string,
  origen: string,
  destinoEquipo: string,
  ordinal: number,
) => ({
  temporal_id,
  origen_id: origen,
  destino_id: destinoEquipo,
  puerto_origen_id: salidaId,
  puerto_origen_ordinal: ordinal,
  puerto_destino_id: entradaId,
  puerto_destino_ordinal: ordinal,
  senal: 'hdmi' as const,
  articulo_cable_id: cableId,
  ruta: 'canaleta' as const,
});

try {
  await sql`insert into articulos (id, tipo, categoria, modelo) values
    (${articuloId}, 'equipo', 'TEST EDITOR CONEXIONES', 'TEST equipo'),
    (${cableId}, 'cable', 'TEST EDITOR CONEXIONES', 'TEST cable')`;
  await sql`insert into puertos (id, articulo_id, nombre, total, sentido, senal) values
    (${salidaId}, ${articuloId}, 'OUTPUT', 8, 'salida', 'hdmi'),
    (${entradaId}, ${articuloId}, 'INPUT', 8, 'entrada', 'hdmi')`;
  await sql`insert into salas (id, nombre) values
    (${salaId}, 'TEST editor conexiones'), (${salaAjenaId}, 'TEST editor ajena')`;
  for (const id of equipos) {
    await sql`insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad)
      values (${id}, ${salaId}, ${articuloId}, 'Equipo', 1)`;
  }
  await sql`insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad)
    values (${equipoAjeno}, ${salaAjenaId}, ${articuloId}, 'Ajeno', 1)`;

  const { guardarEditorConexiones } = await import('../src/app/acciones-diagrama');

  const invalido = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: 0,
    altas: [{ ...conexion('rota', equipos[0], equipos[1], 1), puerto_destino_ordinal: 0 }],
    cambios: [],
    bajas: [],
  });
  afirmar(!invalido.ok && invalido.motivo === 'invalido', 'rechaza una pareja física incompleta o inválida');

  const alta = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: 0,
    altas: [conexion('temporal-a', equipos[0], equipos[1], 1)],
    cambios: [],
    bajas: [],
  });
  afirmar(alta.ok && alta.version === 1 && Boolean(alta.ids['temporal-a']), 'el alta devuelve uuid y versión nueva');
  if (!alta.ok) throw new Error('No se pudo preparar la prueba');
  const primeraId = alta.ids['temporal-a'];
  const [persistida] = await sql<Array<{ bocas: number; senal: string }>>`
    select count(b.conexion_id)::int as bocas, min(c.senal::text) as senal
    from conexiones c join conexion_bocas b on b.conexion_id = c.id
    where c.id = ${primeraId}`;
  afirmar(persistida.bocas === 2 && persistida.senal === 'hdmi', 'conexión y dos bocas confirman juntas');

  const ajeno = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: 1,
    altas: [conexion('ajena', equipos[2], equipoAjeno, 2)],
    cambios: [],
    bajas: [],
  });
  afirmar(!ajeno.ok && ajeno.motivo === 'ajeno', 'rechaza un extremo de otra sala');

  const [a, b] = await Promise.all([
    guardarEditorConexiones({
      sala_id: salaId,
      versionEsperada: 1,
      altas: [conexion('carrera-a', equipos[2], equipos[3], 2)],
      cambios: [],
      bajas: [],
    }),
    guardarEditorConexiones({
      sala_id: salaId,
      versionEsperada: 1,
      altas: [conexion('carrera-b', equipos[4], equipos[5], 3)],
      cambios: [],
      bajas: [],
    }),
  ]);
  afirmar(Number(a.ok) + Number(b.ok) === 1, 'dos escritores con la misma versión: solo uno confirma');
  afirmar((!a.ok && a.motivo === 'conflicto') || (!b.ok && b.motivo === 'conflicto'), 'el perdedor recibe conflicto explícito');

  const [{ diagrama_version: version }] = await sql<Array<{ diagrama_version: number }>>`
    select diagrama_version from salas where id = ${salaId}`;
  const ocupada = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: Number(version),
    altas: [conexion('ocupada', equipos[0], equipos[1], 1)],
    cambios: [],
    bajas: [],
  });
  afirmar(!ocupada.ok && ocupada.motivo === 'invalido', 'la exclusividad física se valida en servidor');

  await sql`insert into proyectos (id, nombre) values (${proyectoId}, ${`TEST editor ${proyectoId}`})`;
  await sql`insert into localizaciones (id, proyecto_id, nombre) values
    (${localizacionId}, ${proyectoId}, 'TEST cerrada')`;
  await sql`update salas set localizacion_id = ${localizacionId} where id = ${salaId}`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo) values (${proyectoId}, 'cierre')`;
  const cerrada = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: Number(version),
    altas: [conexion('cerrada', equipos[0], equipos[1], 7)],
    cambios: [],
    bajas: [],
  });
  afirmar(!cerrada.ok && cerrada.motivo === 'cerrado', 'una obra cerrada queda en solo lectura');
  await sql`delete from hitos_proyecto where proyecto_id = ${proyectoId}`;
  await sql`update salas set localizacion_id = null where id = ${salaId}`;

  await sql.unsafe(`create function test_editor_conexiones_revienta() returns trigger language plpgsql as $$ begin raise exception 'fallo inducido'; end $$`);
  await sql.unsafe(`create trigger test_editor_conexiones_revienta before update of diagrama_version on salas for each row when (old.id = '${salaId}') execute function test_editor_conexiones_revienta()`);
  const antes = await sql<Array<{ id: string }>>`select id from conexiones where sala_id = ${salaId}`;
  let falloInducido = false;
  try {
    await guardarEditorConexiones({
      sala_id: salaId,
      versionEsperada: Number(version),
      altas: [conexion('rollback', equipos[0], equipos[1], 8)],
      cambios: [],
      bajas: [primeraId],
    });
  } catch {
    falloInducido = true;
  }
  afirmar(falloInducido, 'un fallo posterior a altas y bajas se propaga');
  const despues = await sql<Array<{ id: string }>>`select id from conexiones where sala_id = ${salaId}`;
  afirmar(
    antes.map((x) => x.id).sort().join(',') === despues.map((x) => x.id).sort().join(','),
    'el fallo inducido restaura altas, bajas y versión como una unidad',
  );
} finally {
  await sql.unsafe('drop trigger if exists test_editor_conexiones_revienta on salas');
  await sql.unsafe('drop function if exists test_editor_conexiones_revienta()');
  await sql`delete from salas where id in (${salaId}, ${salaAjenaId})`;
  await sql`delete from proyectos where id = ${proyectoId}`;
  await sql`delete from articulos where id in (${articuloId}, ${cableId})`;
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (pasadas !== total) process.exitCode = 1;
