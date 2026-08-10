/**
 * El viaje de ida y vuelta entre sala y plantilla, contra Postgres real.
 *
 *   npm run test:plantillas
 *
 * Una sala terminada se guarda como plantilla y se vuelve a crear una sala
 * desde ella. La sala recreada tiene que dar la MISMA escena y las mismas
 * tiradas, salvo identificadores. Sin esto, «guardar sala como plantilla»
 * conserva la lista de material y pierde el montaje: dónde va la mesa, dónde
 * va cada equipo y qué conecta con qué. Colocar un equipo una vez o colocarlo
 * ciento cuarenta y cuatro veces es la diferencia.
 *
 * Se comprueba además que la ausencia se propaga como ausencia: un equipo sin
 * colocar tiene que llegar sin colocar a la plantilla y volver sin colocar a
 * la sala nueva, en vez de plantarse en (0,0,0) y darse por medido.
 *
 * Mismas reglas que los otros verificadores: se intercepta `server-only` en
 * memoria y se tolera únicamente el `Invariant: static generation store
 * missing` que lanza `revalidatePath()` fuera de una petición real, que en
 * estas dos acciones aparece cuando ya han escrito.
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

const NOMBRE_SALA = 'TEST plantillas origen';
const NOMBRE_PLANTILLA = 'TEST plantillas tipo';
const NOMBRE_RECREADA = 'TEST plantillas recreada';

async function limpiar() {
  await sql`delete from salas where nombre in (${NOMBRE_SALA}, ${NOMBRE_RECREADA})`;
  await sql`delete from plantillas_sala where nombre like ${NOMBRE_PLANTILLA + '%'}`;
}

/** La escena que se compara: todo lo que dibuja el croquis, sin ids. */
async function escenaDe(salaId: string) {
  const [sala] = await sql<Array<Record<string, unknown>>>`
    select largo_m, ancho_m, alto_m, aforo,
           mesa_largo_m, mesa_ancho_m, mesa_alto_cm,
           mesa_x_m, mesa_y_m, mesa_rotacion_grados
    from salas where id = ${salaId}`;

  const equipos = await sql<Array<Record<string, unknown>>>`
    select nombre, cantidad, extremo, x_m, y_m, z_m, posicion_confirmada
    from sala_equipos where sala_id = ${salaId} order by nombre`;

  const tiradas = await sql<Array<Record<string, unknown>>>`
    select o.nombre as origen, d.nombre as destino, c.senal, c.ruta, c.notas
    from conexiones c
    join sala_equipos o on o.id = c.origen_id
    join sala_equipos d on d.id = c.destino_id
    where c.sala_id = ${salaId}
    order by o.nombre, d.nombre, c.senal`;

  return JSON.parse(JSON.stringify({ sala, equipos, tiradas }));
}

try {
  await limpiar();

  const { crearPlantillaDesdeSala, crearSala } = await import('../src/app/acciones');

  /** Tolera la señal de `revalidatePath()` y la de `redirect()`; nada más. */
  const invocar = async (accion: (d: FormData) => Promise<void>, datos: FormData) => {
    try {
      await accion(datos);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const codigo = (e as { ['__NEXT_ERROR_CODE']?: string })?.['__NEXT_ERROR_CODE'];
      const digest = (e as { digest?: string })?.digest ?? '';
      const esperada =
        (mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE) && codigo === CODIGO_SEÑAL_REVALIDATE) ||
        String(digest).startsWith(DIGEST_REDIRECT);
      if (!esperada) throw e;
    }
  };

  // ------------------------------------------------- la sala de partida
  const salaId = randomUUID();
  await sql`
    insert into salas (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m,
                       mesa_largo_m, mesa_ancho_m, mesa_alto_cm,
                       mesa_x_m, mesa_y_m, mesa_rotacion_grados)
    values (${salaId}, ${NOMBRE_SALA}, 'SALA TP', 8, 6, 4, 3,
            2.4, 1.2, 73, 2.1, 1.4, 30)`;

  const [articulo] = await sql<Array<{ id: string }>>`
    select id from articulos where activo order by modelo limit 1`;

  const equipo = async (nombre: string, extremo: string, pos: [number, number, number] | null) => {
    const id = randomUUID();
    await sql`
      insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo,
                                x_m, y_m, z_m, posicion_confirmada)
      values (${id}, ${salaId}, ${articulo.id}, ${nombre}, 1, ${extremo}::extremo_cable,
              ${pos?.[0] ?? 0}, ${pos?.[1] ?? 0}, ${pos?.[2] ?? 0}, ${pos != null})`;
    return id;
  };

  const pantalla = await equipo('TEST pantalla', 'pantalla', [0, 2, 1.4]);
  const caja = await equipo('TEST caja', 'caja_conexiones', [3, 2, 0.73]);
  // Deliberadamente sin colocar: la ausencia tiene que sobrevivir al viaje.
  await equipo('TEST panel sin colocar', 'mesa', null);

  await sql`
    insert into conexiones (sala_id, origen_id, destino_id, senal, ruta, notas)
    values (${salaId}, ${caja}, ${pantalla}, 'hdmi', 'falso_techo', 'TEST tirada')`;

  const antes = await escenaDe(salaId);

  // ------------------------------------------------- sala -> plantilla
  const aPlantilla = new FormData();
  aPlantilla.set('sala_id', salaId);
  aPlantilla.set('nombre', NOMBRE_PLANTILLA);
  await invocar(crearPlantillaDesdeSala, aPlantilla);

  const [plantilla] = await sql<Array<Record<string, unknown>>>`
    select * from plantillas_sala where nombre like ${NOMBRE_PLANTILLA + '%'} order by creado_en desc limit 1`;
  afirmar(Boolean(plantilla), 'la plantilla se crea desde la sala');

  afirmar(Number(plantilla.mesa_x_m) === 2.1, 'la plantilla guarda el centro X de la mesa');
  afirmar(Number(plantilla.mesa_y_m) === 1.4, 'la plantilla guarda el centro Y de la mesa');
  afirmar(Number(plantilla.mesa_rotacion_grados) === 30, 'la plantilla guarda el giro de la mesa');
  afirmar(Number(plantilla.mesa_largo_m) === 2.4, 'la plantilla guarda las medidas de la mesa');

  const lineas = await sql<Array<Record<string, unknown>>>`
    select modelo_texto, extremo, x_m, y_m, z_m, posicion_confirmada
    from plantilla_articulos where plantilla_id = ${String(plantilla.id)}
    order by modelo_texto`;
  afirmar(lineas.length === 3, 'la plantilla se queda con los tres equipos');
  afirmar(
    lineas.every((l) => l.extremo != null),
    'cada línea conserva su extremo, no se vuelve a deducir de la categoría',
  );
  const sinColocar = lineas.find((l) => String(l.modelo_texto).includes('sin colocar'))!;
  afirmar(
    sinColocar.x_m == null && sinColocar.posicion_confirmada === false,
    'un equipo sin colocar llega a la plantilla sin coordenadas, no en (0,0,0)',
  );

  const tiradasPlantilla = await sql<Array<Record<string, unknown>>>`
    select senal, ruta, notas from plantilla_conexiones where plantilla_id = ${String(plantilla.id)}`;
  afirmar(tiradasPlantilla.length === 1, 'la tirada de la sala pasa a ser tirada tipo');
  afirmar(tiradasPlantilla[0]?.senal === 'hdmi', 'con su señal');
  afirmar(tiradasPlantilla[0]?.ruta === 'falso_techo', 'y con su ruta');

  // ------------------------------------------------- plantilla -> sala
  const aSala = new FormData();
  aSala.set('plantilla_id', String(plantilla.id));
  aSala.set('nombre', NOMBRE_RECREADA);
  aSala.set('tipologia', String(plantilla.tipologia));
  aSala.set('aforo', '8');
  // El formulario de alta trae las medidas de la plantilla ya rellenas y el
  // técnico las confirma: aquí se simula eso, que es el flujo real.
  aSala.set('largo_m', String(plantilla.largo_m));
  aSala.set('ancho_m', String(plantilla.ancho_m));
  aSala.set('alto_m', String(plantilla.alto_m));
  aSala.set('mesa_largo_m', String(plantilla.mesa_largo_m));
  aSala.set('mesa_ancho_m', String(plantilla.mesa_ancho_m));
  aSala.set('mesa_alto_cm', String(plantilla.mesa_alto_cm));
  await invocar(crearSala, aSala);

  const [recreada] = await sql<Array<{ id: string }>>`
    select id from salas where nombre = ${NOMBRE_RECREADA}`;
  afirmar(Boolean(recreada), 'la sala se recrea desde la plantilla');

  const despues = await escenaDe(recreada.id);

  afirmar(
    JSON.stringify(antes.sala) === JSON.stringify(despues.sala),
    'la sala recreada mide igual y tiene la mesa en el mismo sitio y con el mismo giro',
  );
  afirmar(
    JSON.stringify(antes.equipos) === JSON.stringify(despues.equipos),
    'los equipos vuelven con su extremo, sus coordenadas y su marca de colocado',
  );
  afirmar(
    JSON.stringify(antes.tiradas) === JSON.stringify(despues.tiradas),
    'las tiradas vuelven entre los mismos equipos, con su señal y su ruta',
  );

  if (JSON.stringify(antes) !== JSON.stringify(despues)) {
    console.log('\n  antes:  ', JSON.stringify(antes));
    console.log('  después:', JSON.stringify(despues));
  }
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
