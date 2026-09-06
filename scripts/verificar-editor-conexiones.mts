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

  const temporalReservado = await guardarEditorConexiones({
    sala_id: salaId, versionEsperada: 0,
    altas: [conexion('__proto__', equipos[0], equipos[1], 1)], cambios: [], bajas: [],
  });
  afirmar(!temporalReservado.ok && temporalReservado.motivo === 'invalido', 'rechaza temporal reservado sin perder su mapa de identificadores');

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

  let [{ diagrama_version: version }] = await sql<Array<{ diagrama_version: number }>>`
    select diagrama_version from salas where id = ${salaId}`;
  const ocupada = await guardarEditorConexiones({
    sala_id: salaId,
    versionEsperada: Number(version),
    altas: [conexion('ocupada', equipos[0], equipos[1], 1)],
    cambios: [],
    bajas: [],
  });
  afirmar(!ocupada.ok && ocupada.motivo === 'invalido', 'la exclusividad física se valida en servidor');

  await sql`update sala_equipos set x_m = 1.2, y_m = 2.3, z_m = 1.5, posicion_confirmada = true where id = ${equipos[0]}`;
  const base = { sala_id: salaId, versionEsperada: Number(version), altas: [], cambios: [], bajas: [] };
  const ajenaPosicion = await guardarEditorConexiones({ ...base, posiciones: [{equipo_id: equipoAjeno, x: 10, y: 20}] });
  afirmar(!ajenaPosicion.ok && ajenaPosicion.motivo === 'ajeno', 'rechaza posición visual ajena');
  const cableEquipo = await guardarEditorConexiones({ ...base, equipos_alta: [{temporal_id: 'nuevo', articulo_id: cableId}] });
  afirmar(!cableEquipo.ok, 'no acepta cable como equipo');
  await sql`update articulos set activo = false where id = ${articuloId}`;
  const inactivo = await guardarEditorConexiones({ ...base, equipos_alta: [{temporal_id: 'nuevo', articulo_id: articuloId}] });
  afirmar(!inactivo.ok, 'no acepta artículo inactivo');
  await sql`update articulos set activo = true where id = ${articuloId}`;
  const huerfano = await guardarEditorConexiones({ ...base, altas: [conexion('huerfana', 'desconocido', equipos[0], 8)] });
  afirmar(!huerfano.ok, 'rechaza temporal no declarado');
  const ordinal = await guardarEditorConexiones({ ...base, equipos_alta: [{temporal_id: 'nuevo', articulo_id: articuloId}], altas: [conexion('ordinal', 'nuevo', equipos[0], 9)] });
  afirmar(!ordinal.ok, 'valida ordinal real en bloque nuevo');
  const visual = await guardarEditorConexiones({ ...base,
    altas: [conexion('visual', 'nuevo', equipos[0], 6)],
    equipos_alta: [{temporal_id: 'nuevo', articulo_id: articuloId}],
    posiciones: [{equipo_id: 'nuevo', x: 120, y: 340}, {equipo_id: equipos[0], x: 800, y: 250}] });
  afirmar(visual.ok && Boolean(visual.equipos_ids.nuevo), 'alta de bloque devuelve UUID');
  if (!visual.ok) throw new Error('No se pudo guardar bloque');
  version = visual.version;
  const [bloque] = await sql<Array<{nombre:string; esquema_x:number; esquema_y:number; posicion_confirmada:boolean; x_m:number; y_m:number; z_m:number}>>`
    select nombre, esquema_x, esquema_y, posicion_confirmada, x_m, y_m, z_m from sala_equipos where id = ${visual.equipos_ids.nuevo}`;
  afirmar(bloque.nombre === 'TEST equipo' && !bloque.posicion_confirmada, 'nombre autoritativo y posición física sin confirmar');
  afirmar(bloque.esquema_x === 120 && bloque.esquema_y === 340, 'guarda coordenadas visuales nuevas');
  afirmar(Number(bloque.x_m) === 0 && Number(bloque.y_m) === 0 && Number(bloque.z_m) === 0, 'esquema no cambia XYZ físicos');
  const [medido] = await sql<Array<{x_m:number; y_m:number; z_m:number; posicion_confirmada:boolean}>>`select x_m, y_m, z_m, posicion_confirmada from sala_equipos where id = ${equipos[0]}`;
  afirmar(Number(medido.x_m) === 1.2 && Number(medido.y_m) === 2.3 && Number(medido.z_m) === 1.5 && medido.posicion_confirmada, 'mover bloque existente conserva medidas confirmadas');
  const [enlace] = await sql<Array<{origen_id:string; bocas:number}>>`
    select c.origen_id, count(b.conexion_id)::int as bocas from conexiones c join conexion_bocas b on b.conexion_id = c.id
    where c.id = ${visual.ids.visual} group by c.origen_id`;
  afirmar(enlace.origen_id === visual.equipos_ids.nuevo && enlace.bocas === 2, 'resuelve temporal y bocas atómicamente');

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
  const equiposAntes = await sql`select id, esquema_x, esquema_y from sala_equipos where sala_id = ${salaId} order by id`;
  let falloInducido = false;
  try {
    await guardarEditorConexiones({
      sala_id: salaId,
      versionEsperada: Number(version),
      altas: [conexion('rollback', 'rollback-equipo', equipos[1], 8)],
      equipos_alta: [{temporal_id: 'rollback-equipo', articulo_id: articuloId}],
      posiciones: [{equipo_id: equipos[0], x: 999, y: 999}],
      cambios: [],
      bajas: [primeraId],
    });
  } catch {
    falloInducido = true;
  }
  const equiposDespues = await sql`select id, esquema_x, esquema_y from sala_equipos where sala_id = ${salaId} order by id`;
  afirmar(JSON.stringify(equiposAntes) === JSON.stringify(equiposDespues), 'rollback restaura equipos nuevos y posiciones');
  afirmar(falloInducido, 'un fallo posterior a altas y bajas se propaga');
  const [salaTrasFallo] = await sql<Array<{diagrama_version:number}>>`select diagrama_version from salas where id = ${salaId}`;
  afirmar(Number(salaTrasFallo.diagrama_version) === Number(version), 'rollback conserva versión anterior');
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
