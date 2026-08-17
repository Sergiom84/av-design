/** Persistencia, límites, atomicidad y concurrencia de las rutas manuales. */
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';
type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const modulo = Module as unknown as ModuloConLoad;
const cargar = modulo._load;
modulo._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  if (request === 'next/cache') return { revalidatePath: () => {} };
  return cargar.call(Module, request, ...resto);
};

const sql = postgres(process.env.DATABASE_URL, { max: 3, ssl: false });
const salaId = randomUUID();
const articuloId = randomUUID();
const origenId = randomUUID();
const destinoId = randomUUID();
const conexionId = randomUUID();
let total = 0;
let pasadas = 0;
const afirmar = (valor: boolean, texto: string) => {
  total += 1;
  if (valor) pasadas += 1;
  console.log(`${valor ? 'OK   ' : 'FALLO'} ${texto}`);
};

const patch = (versionEsperada: number, puntos: Array<{ orden: number; x_m: number; y_m: number; z_m: number }>) => ({
  sala_id: salaId,
  versionEsperada,
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
  rutas_cambio: [{ conexion_id: conexionId, puntos }],
  inicio_diagrama: null,
  sillas_modo: null,
});

try {
  await sql`insert into articulos (id, tipo, categoria, modelo) values (${articuloId}, 'equipo', 'TEST', 'TEST ruta')`;
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m) values (${salaId}, 'TEST ruta', 6, 4, 3)`;
  await sql`insert into sala_equipos (id, sala_id, articulo_id, nombre, x_m, y_m, z_m)
    values (${origenId}, ${salaId}, ${articuloId}, 'Origen', 0, 0, 0),
           (${destinoId}, ${salaId}, ${articuloId}, 'Destino', 6, 4, 3)`;
  await sql`insert into conexiones (id, sala_id, origen_id, destino_id)
    values (${conexionId}, ${salaId}, ${origenId}, ${destinoId})`;

  const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
  const puntos = [
    { orden: 0, x_m: 1, y_m: 2, z_m: 3 },
    { orden: 1, x_m: 6, y_m: 4, z_m: 0 },
  ];
  const guardado = await guardarDiagramaSala(patch(0, puntos));
  afirmar(guardado.ok && guardado.version === 1, 'la ruta y la versión se guardan juntas');
  const filas = await sql<Array<{ orden: number; x_m: string }>>`
    select orden, x_m from conexion_puntos_paso where conexion_id = ${conexionId} order by orden`;
  afirmar(filas.length === 2 && Number(filas[1].x_m) === 6, 'los puntos persisten completos y ordenados');

  const fuera = await guardarDiagramaSala(patch(1, [{ orden: 0, x_m: 6.001, y_m: 0, z_m: 0 }]));
  afirmar(!fuera.ok && fuera.motivo === 'fuera', 'un punto fuera de las medidas efectivas se rechaza');
  const trasFuera = await sql<Array<{ n: string }>>`select count(*)::text as n from conexion_puntos_paso where conexion_id = ${conexionId}`;
  afirmar(Number(trasFuera[0].n) === 2, 'el rechazo no sustituye la ruta anterior');

  await sql.unsafe(`create function test_ruta_revienta() returns trigger language plpgsql as $$ begin raise exception 'fallo inducido'; end $$`);
  await sql.unsafe(`create trigger test_ruta_revienta before update of diagrama_version on salas for each row when (old.id = '${salaId}') execute function test_ruta_revienta()`);
  let fallo = false;
  try {
    await guardarDiagramaSala(patch(1, [{ orden: 0, x_m: 2, y_m: 2, z_m: 2 }]));
  } catch { fallo = true; }
  afirmar(fallo, 'un fallo posterior a escribir la ruta se propaga');
  const trasFallo = await sql<Array<{ x_m: string }>>`select x_m from conexion_puntos_paso where conexion_id = ${conexionId} order by orden`;
  afirmar(trasFallo.length === 2 && Number(trasFallo[0].x_m) === 1, 'la transacción restaura la ruta previa');
  await sql`drop trigger test_ruta_revienta on salas`;
  await sql`drop function test_ruta_revienta()`;

  const [a, b] = await Promise.all([
    guardarDiagramaSala(patch(1, [{ orden: 0, x_m: 3, y_m: 1, z_m: 1 }])),
    guardarDiagramaSala(patch(1, [{ orden: 0, x_m: 4, y_m: 1, z_m: 1 }])),
  ]);
  afirmar(Number(a.ok) + Number(b.ok) === 1, 'dos pestañas con la misma versión: solo una confirma');
  afirmar((!a.ok && a.motivo === 'conflicto') || (!b.ok && b.motivo === 'conflicto'), 'la perdedora recibe conflicto');

  const [estadoAntes] = await sql<Array<{ diagrama_version: number; largo_m: string }>>`
    select diagrama_version, largo_m from salas where id = ${salaId}`;
  const puntosAntes = await sql<Array<{ orden: number; x_m: string; y_m: string; z_m: string }>>`
    select orden, x_m, y_m, z_m from conexion_puntos_paso
    where conexion_id = ${conexionId} order by orden`;
  const salaReducida = {
    largo_m: 2,
    ancho_m: 4,
    alto_m: 3,
    aforo: null,
    mesa_largo_m: null,
    mesa_ancho_m: null,
    mesa_alto_cm: null,
    mesa_x_m: null,
    mesa_y_m: null,
    mesa_rotacion_grados: 0,
  };
  const reduccionSinRuta = await guardarDiagramaSala({
    ...patch(Number(estadoAntes.diagrama_version), []),
    sala: salaReducida,
    rutas_cambio: [],
  });
  afirmar(
    !reduccionSinRuta.ok && reduccionSinRuta.motivo === 'fuera',
    'reducir sin tocar una ruta persistida que queda fuera se rechaza',
  );
  const [estadoRechazado] = await sql<Array<{ diagrama_version: number; largo_m: string }>>`
    select diagrama_version, largo_m from salas where id = ${salaId}`;
  const puntosRechazados = await sql<Array<{ orden: number; x_m: string; y_m: string; z_m: string }>>`
    select orden, x_m, y_m, z_m from conexion_puntos_paso
    where conexion_id = ${conexionId} order by orden`;
  afirmar(
    Number(estadoRechazado.largo_m) === Number(estadoAntes.largo_m) &&
      estadoRechazado.diagrama_version === estadoAntes.diagrama_version &&
      JSON.stringify(puntosRechazados) === JSON.stringify(puntosAntes),
    'el rechazo conserva medidas, ruta y versión',
  );

  const reduccionCorregida = await guardarDiagramaSala({
    ...patch(Number(estadoAntes.diagrama_version), [{ orden: 0, x_m: 2, y_m: 1, z_m: 1 }]),
    sala: salaReducida,
  });
  afirmar(reduccionCorregida.ok, 'reducir y sustituir la ruta por otra válida entra atómicamente');
  const [estadoFinal] = await sql<Array<{ diagrama_version: number; largo_m: string; x_m: string }>>`
    select s.diagrama_version, s.largo_m, p.x_m
    from salas s join conexiones c on c.sala_id = s.id
    join conexion_puntos_paso p on p.conexion_id = c.id
    where s.id = ${salaId}`;
  afirmar(
    Number(estadoFinal.largo_m) === 2 && Number(estadoFinal.x_m) === 2 &&
      estadoFinal.diagrama_version === Number(estadoAntes.diagrama_version) + 1,
    'medidas, ruta y versión confirman como una sola operación',
  );
} finally {
  await sql.unsafe('drop trigger if exists test_ruta_revienta on salas');
  await sql.unsafe('drop function if exists test_ruta_revienta()');
  await sql`delete from salas where id = ${salaId}`;
  await sql`delete from articulos where id = ${articuloId}`;
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (pasadas !== total) process.exitCode = 1;
