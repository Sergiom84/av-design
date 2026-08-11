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
import { MENSAJE_MESA_EN_PLANTILLA } from '../src/lib/tipos';

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
const NOMBRE_SIN_ASIENTOS = 'TEST plantillas sin asientos';
const NOMBRE_MESA_PRINCIPAL = 'TEST plantillas mesa principal';
const NOMBRE_CARRERA = 'TEST plantillas carrera';

async function limpiar() {
  await sql`delete from salas where nombre in (${NOMBRE_SALA}, ${NOMBRE_RECREADA}, ${NOMBRE_SIN_ASIENTOS}, ${NOMBRE_MESA_PRINCIPAL})`;
  await sql`delete from salas where nombre like ${NOMBRE_CARRERA + '%'}`;
  await sql.unsafe(
    'drop trigger if exists test_mesa_tardia on sala_equipos; drop function if exists test_mesa_tardia();',
  );
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
    select nombre, cantidad, extremo, x_m, y_m, z_m, posicion_confirmada, rotacion_grados
    from sala_equipos where sala_id = ${salaId} order by nombre`;

  // El mobiliario entra en la comparación por lo mismo que los equipos: si el
  // viaje pierde una silla o su giro, la sala recreada no es la misma sala.
  const muebles = await sql<Array<Record<string, unknown>>>`
    select nombre, forma, largo_m, ancho_m, alto_m, x_m, y_m, z_m,
           rotacion_grados, posicion_confirmada
    from sala_mobiliario where sala_id = ${salaId} order by orden, nombre`;

  const tiradas = await sql<Array<Record<string, unknown>>>`
    select o.nombre as origen, d.nombre as destino, c.senal, c.ruta, c.notas
    from conexiones c
    join sala_equipos o on o.id = c.origen_id
    join sala_equipos d on d.id = c.destino_id
    where c.sala_id = ${salaId}
    order by o.nombre, d.nombre, c.senal`;

  return JSON.parse(JSON.stringify({ sala, equipos, muebles, tiradas }));
}

try {
  await limpiar();

  const { crearPlantillaDesdeSala, crearSala } = await import('../src/app/acciones');

  /** Tolera la señal de `revalidatePath()` y la de `redirect()`; nada más. */
  const invocar = async (
    accion: (d: FormData) => Promise<unknown>,
    datos: FormData,
  ): Promise<unknown> => {
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

  /**
   * `crearSala` es una accion de `useActionState`: recibe el estado anterior
   * antes del formulario y DEVUELVE el fallo en vez de terminar en silencio.
   * Aqui se le pasa el estado inicial y se recoge lo que devuelve.
   */
  const altaDeSala = (datos: FormData) =>
    invocar((d) => crearSala({ error: null }, d), datos) as Promise<
      { error: string | null } | undefined
    >;

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

  const equipo = async (
    nombre: string,
    extremo: string,
    pos: [number, number, number] | null,
    giro = 0,
  ) => {
    const id = randomUUID();
    await sql`
      insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo,
                                x_m, y_m, z_m, posicion_confirmada, rotacion_grados)
      values (${id}, ${salaId}, ${articulo.id}, ${nombre}, 1, ${extremo}::extremo_cable,
              ${pos?.[0] ?? 0}, ${pos?.[1] ?? 0}, ${pos?.[2] ?? 0}, ${pos != null}, ${giro})`;
    return id;
  };

  // Girada 45 grados: una pantalla en esquina. Si el viaje pierde el giro, el
  // plano de obra manda taladrar en otro sitio.
  const pantalla = await equipo('TEST pantalla', 'pantalla', [0, 2, 1.4], 45);
  const caja = await equipo('TEST caja', 'caja_conexiones', [3, 2, 0.73]);
  // Deliberadamente sin colocar: la ausencia tiene que sobrevivir al viaje.
  await equipo('TEST panel sin colocar', 'mesa', null);

  await sql`
    insert into conexiones (sala_id, origen_id, destino_id, senal, ruta, notas)
    values (${salaId}, ${caja}, ${pantalla}, 'hdmi', 'falso_techo', 'TEST tirada')`;

  // Dos sillas: una colocada y girada, otra sin colocar. Las dos tienen que
  // volver, y la segunda tiene que volver SIN colocar.
  const [sillaCat] = await sql<Array<{ id: string }>>`
    select id from catalogo_mobiliario where clave = 'silla'`;
  await sql`
    insert into sala_mobiliario
      (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${salaId}, ${sillaCat.id}, 'Silla', 'circulo', 0.5, 0.5,
            2.1, 0.8, 0, 135, true, 0)`;
  await sql`
    insert into sala_mobiliario
      (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, orden)
    values (${salaId}, ${sillaCat.id}, 'Silla', 'circulo', 0.5, 0.5, 1)`;

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
  await altaDeSala(aSala);

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
  afirmar(
    JSON.stringify(antes.muebles) === JSON.stringify(despues.muebles),
    'el mobiliario vuelve con sus medidas, su sitio y su giro, y lo no colocado sigue sin colocar',
  );

  // Con mobiliario heredado no puede quedar la fuente derivada activa: el
  // croquis dibujaría las sillas del aforo Y las de la plantilla.
  const [modo] = await sql<Array<{ sillas_modo: string }>>`
    select sillas_modo from salas where id = ${recreada.id}`;
  afirmar(
    modo.sillas_modo === 'manuales',
    'la sala recreada tiene una sola fuente de sillas',
  );

  if (JSON.stringify(antes) !== JSON.stringify(despues)) {
    console.log('\n  antes:  ', JSON.stringify(antes));
    console.log('  después:', JSON.stringify(despues));
  }

  // =====================================================================
  // Crear sala desde plantilla es la SEGUNDA ruta que copia mobiliario
  //
  // La otra es `aplicarPlantillaAlDiagrama`. Las dos deciden lo mismo —qué
  // manda sobre las sillas y qué muebles se pueden instanciar— y las dos
  // tienen que decidirlo igual. Una regla escrita dos veces con una sola
  // prueba es una regla con la mitad de la cobertura: se puede romper la
  // copia sin que caiga nada.
  // =====================================================================
  const [mesaAuxCat] = await sql<Array<{ id: string }>>`
    select id from catalogo_mobiliario where clave = 'mesa-rectangular'`;
  const [mesaPrincipalCat] = await sql<Array<{ id: string }>>`
    select id from catalogo_mobiliario where clave = 'mesa-principal'`;

  const plantillaSoloMesa = randomUUID();
  await sql`
    insert into plantillas_sala (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m,
                                 mesa_largo_m, mesa_ancho_m, mesa_alto_cm)
    values (${plantillaSoloMesa}, ${NOMBRE_PLANTILLA + ' solo mesa'}, 'TEST', 8, 6, 4, 3,
            2.4, 1.2, 73)`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaSoloMesa}, ${mesaAuxCat.id}, 'Mesa rectangular', 'rectangulo', 1, 0.6,
            5, 3, 0, 0, true, 0)`;

  const aSalaSoloMesa = new FormData();
  aSalaSoloMesa.set('plantilla_id', plantillaSoloMesa);
  aSalaSoloMesa.set('nombre', NOMBRE_SIN_ASIENTOS);
  aSalaSoloMesa.set('tipologia', 'TEST');
  aSalaSoloMesa.set('aforo', '8');
  aSalaSoloMesa.set('largo_m', '6');
  aSalaSoloMesa.set('ancho_m', '4');
  aSalaSoloMesa.set('alto_m', '3');
  aSalaSoloMesa.set('mesa_largo_m', '2.4');
  aSalaSoloMesa.set('mesa_ancho_m', '1.2');
  aSalaSoloMesa.set('mesa_alto_cm', '73');
  await altaDeSala(aSalaSoloMesa);

  const [sinAsientos] = await sql<Array<{ id: string; sillas_modo: string; aforo: number }>>`
    select id, sillas_modo, aforo from salas where nombre = ${NOMBRE_SIN_ASIENTOS}`;
  afirmar(Boolean(sinAsientos), 'la sala nace de una plantilla que solo trae una mesa auxiliar');
  afirmar(
    sinAsientos?.sillas_modo === 'derivadas',
    'y el aforo sigue repartiendo sus sillas: una mesa auxiliar no las sustituye',
  );
  afirmar(sinAsientos?.aforo === 8, 'con su aforo intacto');
  const [mueblesSinAsientos] = await sql<Array<{ cuantos: string }>>`
    select count(*)::text as cuantos from sala_mobiliario where sala_id = ${sinAsientos?.id}`;
  afirmar(Number(mueblesSinAsientos.cuantos) === 1, 'y la mesa auxiliar sí se copia');

  // La mesa principal no se instancia por ninguna de las dos rutas.
  const plantillaConMesaPrincipal = randomUUID();
  await sql`
    insert into plantillas_sala (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m)
    values (${plantillaConMesaPrincipal}, ${NOMBRE_PLANTILLA + ' mesa principal'}, 'TEST', 8, 6, 4, 3)`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaConMesaPrincipal}, ${mesaPrincipalCat.id}, 'Mesa principal', 'rectangulo',
            2.4, 1.2, 3, 2, 0, 0, true, 0)`;

  const aSalaMesaPrincipal = new FormData();
  aSalaMesaPrincipal.set('plantilla_id', plantillaConMesaPrincipal);
  aSalaMesaPrincipal.set('nombre', NOMBRE_MESA_PRINCIPAL);
  aSalaMesaPrincipal.set('tipologia', 'TEST');
  aSalaMesaPrincipal.set('aforo', '8');
  aSalaMesaPrincipal.set('largo_m', '6');
  aSalaMesaPrincipal.set('ancho_m', '4');
  aSalaMesaPrincipal.set('alto_m', '3');
  const rechazoMesa = await altaDeSala(aSalaMesaPrincipal);

  const [conMesaPrincipal] = await sql<Array<{ id: string }>>`
    select id from salas where nombre = ${NOMBRE_MESA_PRINCIPAL}`;
  afirmar(
    !conMesaPrincipal,
    'una plantilla con una mesa principal como mueble no crea sala: daría dos mesas',
  );
  afirmar(
    rechazoMesa?.error === MENSAJE_MESA_EN_PLANTILLA,
    'y el alta lo dice en vez de terminar en silencio',
  );
  const [huellaMesaPrincipal] = await sql<Array<{ cuantos: string }>>`
    select (
      (select count(*) from sala_equipos    e where e.origen_plantilla_linea_id in
        (select id from plantilla_articulos where plantilla_id = ${plantillaConMesaPrincipal})) +
      (select count(*) from sala_mobiliario m where m.origen_plantilla_mobiliario_id in
        (select id from plantilla_mobiliario where plantilla_id = ${plantillaConMesaPrincipal}))
    )::text as cuantos`;
  afirmar(
    Number(huellaMesaPrincipal.cuantos) === 0,
    'y no deja ni equipos ni muebles sueltos de esa plantilla',
  );

  // ------------------------------------------ la carrera de la mesa principal
  //
  // La comprobación previa mira `plantilla_mobiliario` ANTES de abrir la
  // transacción. Aquí se reproduce lo que pasa cuando la fila aparece DESPUÉS
  // de esa mirada y antes de la copia: un disparador mete la mesa principal en
  // la plantilla en cuanto se ha insertado el equipo de la segunda sala de la
  // serie. La primera sala ya está escrita, así que además de rechazar tiene
  // que deshacerla: es el rollback posterior a una escritura.
  const plantillaCarrera = randomUUID();
  await sql`
    insert into plantillas_sala (id, nombre, tipologia, aforo, largo_m, ancho_m, alto_m)
    values (${plantillaCarrera}, ${NOMBRE_PLANTILLA + ' carrera'}, 'TEST', 8, 6, 4, 3)`;
  const [lineaCarrera] = await sql<Array<{ id: string }>>`
    insert into plantilla_articulos (plantilla_id, articulo_id, categoria, cantidad, opcional)
    values (${plantillaCarrera}, ${articulo.id}, 'PANTALLAS', 1, false)
    returning id`;
  await sql`
    insert into plantilla_mobiliario
      (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
       x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
    values (${plantillaCarrera}, ${mesaAuxCat.id}, 'Mesa rectangular', 'rectangulo', 1, 0.6,
            5, 3, 0, 0, true, 0)`;

  await sql.unsafe(`
    create or replace function test_mesa_tardia() returns trigger as $$
    begin
      insert into plantilla_mobiliario
        (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m,
         x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
      select '${plantillaCarrera}', '${mesaPrincipalCat.id}', 'Mesa principal', 'rectangulo',
             2.4, 1.2, 3, 2, 0, 0, true, 9
      where (select count(*) from sala_equipos
             where origen_plantilla_linea_id = '${lineaCarrera.id}') >= 2
        and not exists (select 1 from plantilla_mobiliario
                        where plantilla_id = '${plantillaCarrera}'
                          and mobiliario_id = '${mesaPrincipalCat.id}');
      return NEW;
    end $$ language plpgsql;
    create trigger test_mesa_tardia after insert on sala_equipos
      for each row execute function test_mesa_tardia();`);

  let rechazoCarrera: { error: string | null } | undefined;
  try {
    const aSalaCarrera = new FormData();
    aSalaCarrera.set('plantilla_id', plantillaCarrera);
    aSalaCarrera.set('nombre', NOMBRE_CARRERA);
    aSalaCarrera.set('copias', '3');
    aSalaCarrera.set('tipologia', 'TEST');
    aSalaCarrera.set('aforo', '8');
    aSalaCarrera.set('largo_m', '6');
    aSalaCarrera.set('ancho_m', '4');
    aSalaCarrera.set('alto_m', '3');
    rechazoCarrera = await altaDeSala(aSalaCarrera);
  } finally {
    await sql.unsafe(
      'drop trigger if exists test_mesa_tardia on sala_equipos; drop function if exists test_mesa_tardia();',
    );
  }

  const [salasCarrera] = await sql<Array<{ cuantas: string }>>`
    select count(*)::text as cuantas from salas where nombre like ${NOMBRE_CARRERA + '%'}`;
  afirmar(
    Number(salasCarrera.cuantas) === 0,
    'la mesa principal que aparece después de la comprobación previa se rechaza igual: no queda ninguna sala de la serie',
  );
  afirmar(
    rechazoCarrera?.error === MENSAJE_MESA_EN_PLANTILLA,
    'y el alta lo explica en vez de crear la serie a medias',
  );
  const [huellaCarrera] = await sql<Array<{ cuantos: string }>>`
    select (
      (select count(*) from sala_equipos    where origen_plantilla_linea_id = ${lineaCarrera.id}) +
      (select count(*) from sala_mobiliario m
        join plantilla_mobiliario pm on pm.id = m.origen_plantilla_mobiliario_id
        where pm.plantilla_id = ${plantillaCarrera})
    )::text as cuantos`;
  afirmar(
    Number(huellaCarrera.cuantos) === 0,
    'y la sala que ya se había copiado antes del fallo se deshace con el resto',
  );
  const [mesaSobrante] = await sql<Array<{ cuantas: string }>>`
    select count(*)::text as cuantas from plantilla_mobiliario
    where plantilla_id = ${plantillaCarrera} and mobiliario_id = ${mesaPrincipalCat.id}`;
  afirmar(
    Number(mesaSobrante.cuantas) === 0,
    'y el rollback se lleva por delante también la fila que el disparador metió',
  );
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);
