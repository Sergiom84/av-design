/**
 * Datos sintéticos y persistentes de E1. Nunca usa .env.local ni el seed real.
 *
 * Contenedor aislado (no necesita ni toca av_design_db:5433):
 *   docker run -d --name av_design_e1_prueba_db -p 127.0.0.1:5544:5432 \
 *     -e POSTGRES_DB=av_design_e1_prueba -e POSTGRES_USER=av_design_e1 \
 *     -e POSTGRES_PASSWORD=av_design_e1_local postgres:17-alpine
 *
 * Primera ejecución, únicamente en la base vacía de ese contenedor:
 *   DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
 *     npx tsx scripts/documentos-fixture.mts --schema --aplicar
 *
 * Fotografía de todas las tablas antes/después de exportar:
 *   DOCUMENTOS_DATABASE_URL=... npx tsx scripts/documentos-fixture.mts --foto=antes
 *   DOCUMENTOS_DATABASE_URL=... npx tsx scripts/documentos-fixture.mts --foto=despues
 *
 * Sin --aplicar sólo verifica el destino. Repetir --aplicar conserva las filas;
 * no hace reset, no actualiza datos existentes ni borra ninguna base.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { cifrarClave } from '../src/lib/contrasena';

const id = (n: number) => `e1000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

export const FIXTURE_DOCUMENTOS = {
  proyecto: id(1), localizacion: id(2), sede: id(3), ubicacion: id(4), proveedor: id(5),
  sala: id(10), salaDos: id(11), salaIncompleta: id(12), salaAjena: id(13),
  proyectoAjeno: id(14), localizacionAjena: id(15),
  pantalla: id(20), codec: id(21), microfono: id(22), rack: id(23),
  hdmi: id(24), red: id(25),
  equipoPantalla: id(30), equipoCodec: id(31), equipoMicrofono: id(32), equipoRack: id(33),
  equipoPantallaDos: id(34), equipoCodecDos: id(35), equipoSinCatalogo: id(36),
  equipoIncompletoUno: id(37), equipoIncompletoDos: id(38),
  puertoHdmiSalida: id(40), puertoHdmiEntrada: id(41), puertoRedRack: id(42), puertoRedCodec: id(43),
  conexionHdmi: id(50), conexionRed: id(51), conexionIncompleta: id(52), conexionDos: id(53),
  admin: id(80), lectura: id(81), oculto: id(82), sinCompras: id(83),
} as const;

export const URL_DOCUMENTOS_PRUEBA =
  'postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba';

export type SqlPrueba = ReturnType<typeof postgres>;

export function comprobarUrlPrueba(texto: string): URL {
  const url = new URL(texto);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['5544', '5545'].includes(url.port) ||
      url.pathname !== '/av_design_e1_prueba' ||
      decodeURIComponent(url.username) !== 'av_design_e1') {
    throw new Error('Destino rechazado: E1 sólo escribe en av_design_e1_prueba, usuario av_design_e1, loopback:5544/5545.');
  }
  if (url.search || url.hash) throw new Error('La URL de prueba no admite parámetros de conexión adicionales.');
  return url;
}

export async function conectarPrueba(texto: string): Promise<SqlPrueba> {
  const url = comprobarUrlPrueba(texto);
  const sql = postgres(url.toString(), { max: 2, ssl: false, onnotice: () => {} });
  try {
    const [destino] = await sql`select current_database() as base, current_user as usuario, inet_server_port() as puerto`;
    if (destino.base !== 'av_design_e1_prueba' || destino.usuario !== 'av_design_e1' || Number(destino.puerto) !== 5432) {
      throw new Error('La identidad real del servidor no coincide con la base/usuario/puerto de prueba esperados.');
    }
    console.log(`Destino comprobado: ${url.hostname}:${url.port}/${destino.base} (${destino.usuario}), servidor:5432.`);
    return sql;
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export interface FotoBase {
  base: string;
  sha256: string;
  tablas: Array<{ tabla: string; filas: number; sha256: string }>;
}

/** Incluye diseño, catálogo, precios, movimientos, reservas y hechos de obra. */
export async function fotografiarBase(sql: SqlPrueba): Promise<FotoBase> {
  return sql.begin('isolation level repeatable read read only', async (tx) => {
    const tablas = await tx`select tablename from pg_tables where schemaname = 'public' order by tablename`;
    const fotos: FotoBase['tablas'] = [];
    for (const { tablename } of tablas) {
      if (!/^[a-z_]+$/.test(String(tablename))) throw new Error('Nombre de tabla inesperado.');
      const filas = await tx.unsafe(`select to_jsonb(t)::text as fila from "${tablename}" t order by to_jsonb(t)::text`);
      const json = JSON.stringify(filas.map((f) => String(f.fila)));
      fotos.push({ tabla: String(tablename), filas: filas.length, sha256: createHash('sha256').update(json).digest('hex') });
    }
    return { base: 'av_design_e1_prueba', sha256: createHash('sha256').update(JSON.stringify(fotos)).digest('hex'), tablas: fotos };
  });
}

export async function crearFixture(sql: SqlPrueba): Promise<void> {
  const existente = await sql`select id from proyectos where id = ${FIXTURE_DOCUMENTOS.proyecto}`;
  if (existente.length) {
    const salas = await sql`select id from salas where id in ${sql([FIXTURE_DOCUMENTOS.sala, FIXTURE_DOCUMENTOS.salaDos, FIXTURE_DOCUMENTOS.salaIncompleta, FIXTURE_DOCUMENTOS.salaAjena])}`;
    if (salas.length !== 4) throw new Error('Fixture incompleta: no se sobreescriben datos existentes. Usa otro contenedor vacío.');
    console.log('Fixture existente conservada; ninguna escritura.');
    return;
  }
  const ajenos = await sql`select count(*)::int as n from proyectos`;
  if (ajenos[0].n !== 0) throw new Error('La base contiene otras obras: no se mezcla la fixture con datos preexistentes.');
  const claveHash = await cifrarClave('Prueba-doc-01-local!');
  const f = FIXTURE_DOCUMENTOS;
  await sql.begin(async (tx) => {
    await tx`insert into parametros (clave, valor, unidad, descripcion) values
      ('holgura_pantalla', 0.35, 'm', 'Fixture E1'), ('holgura_proyector', 0.1, 'm', 'Fixture E1'),
      ('holgura_rack', 1, 'm', 'Fixture E1'), ('holgura_caja_conexiones', 0.5, 'm', 'Fixture E1'),
      ('holgura_mesa', 0.5, 'm', 'Fixture E1'), ('holgura_techo', 0.3, 'm', 'Fixture E1'),
      ('holgura_pared', 0.3, 'm', 'Fixture E1'), ('margen', 0, 'tanto por uno', 'Fixture E1'),
      ('cables_por_canalizacion', 3, 'ud', 'Fixture E1'), ('ocupacion_maxima_canaleta', 0.4, 'tanto por uno', 'Fixture E1'),
      ('vigencia_precio_meses', 18, 'meses', 'Fixture E1'), ('tipo_cambio_usd_eur', 0.867, 'EUR por USD', 'Fixture E1')`;
    await tx`insert into sedes (id, nombre, ciudad) values (${f.sede}, 'SEDE SINTÉTICA E1', 'Ciudad de prueba')`;
    await tx`insert into proveedores (id, nombre) values (${f.proveedor}, 'PROVEEDOR SINTÉTICO E1')`;
    await tx`insert into ubicaciones (id, nombre, descripcion) values (${f.ubicacion}, 'ESTANTE PRUEBA-DOC', 'Stock sintético; ningún inventario real')`;
    await tx`insert into proyectos (id, nombre, codigo, sede_id, notas) values
      (${f.proyecto}, 'OBRA PRUEBA-DOC-01', 'PRUEBA-DOC-OBRA', ${f.sede}, 'Fixture E1: no usar en obra real'),
      (${f.proyectoAjeno}, 'OBRA PRUEBA-DOC-AJENA', 'PRUEBA-DOC-AJENA', ${f.sede}, 'Control de pertenencia a otra obra')`;
    await tx`insert into localizaciones (id, proyecto_id, nombre) values
      (${f.localizacion}, ${f.proyecto}, 'EDIFICIO SINTÉTICO · PLANTA 1'),
      (${f.localizacionAjena}, ${f.proyectoAjeno}, 'LOCALIZACIÓN AJENA')`;
    await tx`insert into salas (id, nombre, codigo, sede_id, localizacion_id, largo_m, ancho_m, alto_m,
      alto_falso_techo_m, aforo, mesa_largo_m, mesa_ancho_m, mesa_alto_cm, mesa_x_m, mesa_y_m,
      sillas_modo, diagrama_version, diagrama_iniciado_en, diagrama_origen, notas) values
      (${f.sala}, 'PRUEBA-DOC-01 · Sala técnica', 'PRUEBA-DOC-01', ${f.sede}, ${f.localizacion}, 8, 6, 3,
       2.7, 4, 3.2, 1.2, 75, 4, 3, 'manuales', 7, '2026-10-13T08:00:00Z', 'desde_cero', 'Ámbito íntegro de la sala; equipos medidos y estimados'),
      (${f.salaDos}, 'PRUEBA-DOC-02 · Sala grande', 'PRUEBA-DOC-02', ${f.sede}, ${f.localizacion}, 12, 8, 3,
       2.7, 6, 4, 1.4, 75, 6, 4, 'derivadas', 3, '2026-10-13T08:00:00Z', 'desde_cero', 'Segunda sala de la misma obra'),
      (${f.salaIncompleta}, 'PRUEBA-DOC-INCOMPLETA', 'PRUEBA-DOC-INCOMPLETA', ${f.sede}, ${f.localizacion}, 0, 0, 0,
       null, null, null, null, null, null, null, 'derivadas', 0, '2026-10-13T08:00:00Z', 'desde_cero', 'Sin medidas; nunca inventarlas'),
      (${f.salaAjena}, 'PRUEBA-DOC-AJENA', 'PRUEBA-DOC-AJENA', ${f.sede}, ${f.localizacionAjena}, 5, 4, 3,
       null, null, null, null, null, null, null, 'derivadas', 0, '2026-10-13T08:00:00Z', 'desde_cero', 'No debe exportarse dentro de PRUEBA-DOC-OBRA')`;
    await tx`insert into articulos (id, referencia, tipo, categoria, marca, modelo, unidad, coste, coste_orientativo,
      proveedor_id, senal, conector_a, conector_b, longitudes_comerciales_m, bobina_m, diametro_mm) values
      (${f.pantalla}, 'E1-PANTALLA', 'equipo', 'PANTALLA', 'PRUEBA', 'Pantalla técnica áéíóú', 'ud', 800, false, ${f.proveedor}, null, null, null, null, null, null),
      (${f.codec}, 'E1-CODEC', 'equipo', 'VIDEOCONFERENCIA', 'PRUEBA', 'Códec orientativo', 'ud', 1250.5, true, ${f.proveedor}, null, null, null, null, null, null),
      (${f.microfono}, 'E1-MICROFONO', 'equipo', 'MICRÓFONO', 'PRUEBA', 'Micrófono sin precio', 'ud', null, false, null, null, null, null, null, null, null),
      (${f.rack}, 'E1-RACK', 'equipo', 'RACK', 'PRUEBA', 'Rack medido en origen', 'ud', 300, false, ${f.proveedor}, null, null, null, null, null, null),
      (${f.hdmi}, 'E1-HDMI', 'cable', 'HDMI', 'PRUEBA', 'Latiguillo HDMI', 'ud', 12.5, false, ${f.proveedor}, 'hdmi', 'HDMI A', 'HDMI A', ARRAY[3,5,10]::numeric[], null, 6),
      (${f.red}, 'E1-RED', 'cable', 'RED', 'PRUEBA', 'Cable UTP', 'm', 0.74, true, ${f.proveedor}, 'red', 'RJ45', 'RJ45', null, 305, 6)`;
    await tx`insert into precios (id, articulo_id, proveedor_id, presupuesto, fecha, precio, origen, fuente) values
      (${id(90)}, ${f.pantalla}, ${f.proveedor}, 'PRUEBA oferta final', '2026-10-13', 800, 'final', 'app'),
      (${id(91)}, ${f.codec}, ${f.proveedor}, 'PRUEBA precio orientativo', '2026-10-13', 1250.5, 'orientativo', 'app'),
      (${id(92)}, ${f.hdmi}, ${f.proveedor}, 'PRUEBA latiguillo', '2026-10-13', 12.5, 'final', 'app'),
      (${id(93)}, ${f.red}, ${f.proveedor}, 'PRUEBA UTP orientativo', '2026-10-13', 0.74, 'orientativo', 'app')`;
    await tx`insert into tomas_red (id, sala_id, codigo, ubicacion, x_m, y_m, z_m) values
      (${id(60)}, ${f.sala}, 'ROSETA-Á01', 'Mesa', 4, 3, 0.75)`;
    await tx`insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m, posicion_confirmada, rotacion_grados) values
      (${f.equipoPantalla}, ${f.sala}, ${f.pantalla}, 'Pantalla frontal', 1, 'pantalla', 4, 0.1, 1.45, true, 0),
      (${f.equipoCodec}, ${f.sala}, ${f.codec}, 'Códec de sala', 1, 'pared', 4, 0.35, 1.2, true, 0),
      (${f.equipoMicrofono}, ${f.sala}, ${f.microfono}, 'Micrófonos estimados', 2, 'mesa', 0, 0, 0, false, 0),
      (${f.equipoRack}, ${f.sala}, ${f.rack}, 'Rack medido (0,0,0)', 1, 'rack', 0, 0, 0, true, 90),
      (${f.equipoPantallaDos}, ${f.salaDos}, ${f.pantalla}, 'Pantalla sala dos', 1, 'pantalla', 6, 0.1, 1.45, true, 0),
      (${f.equipoCodecDos}, ${f.salaDos}, ${f.codec}, 'Códec sala dos', 1, 'pared', 6, 0.4, 1.2, true, 0),
      (${f.equipoSinCatalogo}, ${f.sala}, null, '=1+1 Equipo sin referencia; á', 1, 'pared', 7, 5, 1, true, 0),
      (${f.equipoIncompletoUno}, ${f.salaIncompleta}, ${f.codec}, 'Origen estimado sin medidas', 1, 'mesa', 0, 0, 0, false, 0),
      (${f.equipoIncompletoDos}, ${f.salaIncompleta}, ${f.pantalla}, 'Destino estimado sin medidas', 1, 'pantalla', 0, 0, 0, false, 0)`;
    await tx`update sala_equipos set toma_red_id = ${id(60)} where id = ${f.equipoCodec}`;
    await tx`insert into puertos (id, articulo_id, nombre, sentido, senal, conector, total, orden, fuente) values
      (${f.puertoHdmiSalida}, ${f.codec}, 'HDMI OUT 1', 'salida', 'hdmi', 'HDMI A', 1, 1, 'app'),
      (${f.puertoHdmiEntrada}, ${f.pantalla}, 'HDMI IN 1', 'entrada', 'hdmi', 'HDMI A', 1, 1, 'app'),
      (${f.puertoRedRack}, ${f.rack}, 'LAN PoE', 'bidireccional', 'red', 'RJ45', 4, 1, 'app'),
      (${f.puertoRedCodec}, ${f.codec}, 'LAN PoE', 'bidireccional', 'red', 'RJ45', 1, 2, 'app')`;
    await tx`insert into conexiones (id, sala_id, origen_id, destino_id, articulo_cable_id, senal, ruta,
      longitud_manual_m, puerto_origen_id, puerto_destino_id, creado_en, notas) values
      (${f.conexionHdmi}, ${f.sala}, ${f.equipoCodec}, ${f.equipoPantalla}, ${f.hdmi}, 'hdmi', 'directo', 5,
       ${f.puertoHdmiSalida}, ${f.puertoHdmiEntrada}, '2026-10-13T08:01:00Z', 'Longitud medida; no renumerar HD-1000'),
      (${f.conexionRed}, ${f.sala}, ${f.equipoRack}, ${f.equipoCodec}, ${f.red}, 'red', 'canaleta', null,
       ${f.puertoRedRack}, ${f.puertoRedCodec}, '2026-10-13T08:02:00Z', 'Ruta física con dos puntos de paso'),
      (${f.conexionIncompleta}, ${f.salaIncompleta}, ${f.equipoIncompletoUno}, ${f.equipoIncompletoDos}, null, 'hdmi', null, null,
       null, null, '2026-10-13T08:03:00Z', 'Sin cable y sin extremos de puerto'),
      (${f.conexionDos}, ${f.salaDos}, ${f.equipoCodecDos}, ${f.equipoPantallaDos}, ${f.hdmi}, 'hdmi', 'directo', 3,
       ${f.puertoHdmiSalida}, ${f.puertoHdmiEntrada}, '2026-10-13T08:01:00Z', 'Latiguillo de sala dos')`;
    await tx`insert into conexion_bocas (conexion_id, lado, equipo_id, puerto_id, ordinal) values
      (${f.conexionHdmi}, 'origen', ${f.equipoCodec}, ${f.puertoHdmiSalida}, 1),
      (${f.conexionHdmi}, 'destino', ${f.equipoPantalla}, ${f.puertoHdmiEntrada}, 1),
      (${f.conexionRed}, 'origen', ${f.equipoRack}, ${f.puertoRedRack}, 2),
      (${f.conexionRed}, 'destino', ${f.equipoCodec}, ${f.puertoRedCodec}, 1),
      (${f.conexionDos}, 'origen', ${f.equipoCodecDos}, ${f.puertoHdmiSalida}, 1),
      (${f.conexionDos}, 'destino', ${f.equipoPantallaDos}, ${f.puertoHdmiEntrada}, 1)`;
    await tx`insert into conexion_puntos_paso (id, conexion_id, orden, x_m, y_m, z_m) values
      (${id(61)}, ${f.conexionRed}, 0, 0.2, 0.3, 0.3), (${id(62)}, ${f.conexionRed}, 1, 4, 0.3, 0.3)`;
    await tx`insert into catalogo_mobiliario (id, clave, nombre, categoria, forma, largo_m_defecto, ancho_m_defecto, alto_m_defecto, rol, fuente) values
      (${id(70)}, 'silla-prueba-e1', 'Silla sintética', 'ASIENTO', 'circulo', 0.5, 0.5, 0.9, 'asiento', 'app')`;
    for (let n = 0; n < 4; n++) {
      await tx`insert into sala_mobiliario (id, sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m, x_m, y_m, z_m,
        rotacion_grados, posicion_confirmada, fuente) values
        (${id(71 + n)}, ${f.sala}, ${id(70)}, ${`Silla ${n + 1}`}, 'circulo', 0.5, 0.5, 0.9,
         ${3 + (n % 2) * 2}, ${n < 2 ? 1.9 : 4.1}, 0, ${n < 2 ? 0 : 180}, true, 'app')`;
    }
    await tx`insert into puertas (id, sala_id, pared, posicion_m, anchura_m, altura_m) values
      (${id(75)}, ${f.sala}, 'oeste', 4.5, 0.9, 2.1), (${id(76)}, ${f.salaDos}, 'este', 5, null, null)`;
    await tx`insert into movimientos (id, articulo_id, ubicacion_id, tipo, cantidad, quien, motivo, fecha) values
      (${id(100)}, ${f.pantalla}, ${f.ubicacion}, 'entrada', 1, 'Fixture E1', 'Stock sintético', '2026-10-13'),
      (${id(101)}, ${f.codec}, ${f.ubicacion}, 'entrada', 1, 'Fixture E1', 'Stock sintético', '2026-10-13'),
      (${id(102)}, ${f.hdmi}, ${f.ubicacion}, 'entrada', 2, 'Fixture E1', 'Stock sintético', '2026-10-13'),
      (${id(103)}, ${f.red}, ${f.ubicacion}, 'entrada', 20, 'Fixture E1', 'Stock sintético', '2026-10-13')`;
    await tx`insert into reservas (id, sala_id, articulo_id, cantidad, estado, quien, notas) values
      (${id(110)}, ${f.sala}, ${f.pantalla}, 1, 'activa', 'Fixture E1', 'Reservado para la propia sala'),
      (${id(111)}, ${f.salaDos}, ${f.codec}, 1, 'activa', 'Fixture E1', 'Reservado por otra sala'),
      (${id(112)}, ${f.sala}, ${f.red}, 5, 'activa', 'Fixture E1', 'No sumar dos veces con disponible')`;
    await tx`insert into usuarios (id, usuario, nombre, rol, clave_hash, debe_cambiar_clave, activo) values
      (${f.admin}, 'prueba-doc-admin', 'Administrador E1', 'admin', ${claveHash}, false, true),
      (${f.lectura}, 'prueba-doc-lectura', 'Lectura E1', 'lectura', ${claveHash}, false, true),
      (${f.oculto}, 'prueba-doc-oculto', 'Salas ocultas E1', 'lectura', ${claveHash}, false, true),
      (${f.sinCompras}, 'prueba-doc-sin-compras', 'Sin compras E1', 'lectura', ${claveHash}, false, true)`;
    await tx`insert into usuario_permisos (usuario_id, seccion, acceso) values
      (${f.oculto}, 'salas', 'oculto'), (${f.sinCompras}, 'compras', 'oculto')`;
  });
  console.log('Fixture creada: dos salas, una incompleta y una ajena; catálogo y stock exclusivamente sintéticos.');
}

async function main(): Promise<void> {
  const url = process.env.DOCUMENTOS_DATABASE_URL;
  if (!url) throw new Error('Define DOCUMENTOS_DATABASE_URL explícitamente; no se usa DATABASE_URL ni .env.local.');
  const sql = await conectarPrueba(url);
  const directorio = resolve('output/e1-documentos');
  try {
    if (process.argv.includes('--schema')) {
      if (!process.argv.includes('--aplicar')) throw new Error('--schema exige --aplicar.');
      const [{ n }] = await sql`select count(*)::int as n from pg_tables where schemaname = 'public'`;
      if (n !== 0) throw new Error('--schema sólo se admite en una base vacía; no se migra ni resetea una existente.');
      await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
      console.log('db/schema.sql aplicado exclusivamente a la base aislada vacía. No se ha usado db/seed.sql.');
    }
    if (process.argv.includes('--aplicar')) await crearFixture(sql);
    await mkdir(directorio, { recursive: true });
    await writeFile(resolve(directorio, 'fixture.json'), JSON.stringify(FIXTURE_DOCUMENTOS, null, 2));
    const foto = process.argv.find((a) => a.startsWith('--foto='))?.slice(7);
    if (foto) {
      if (!/^[a-z0-9-]+$/.test(foto)) throw new Error('Etiqueta de fotografía no válida.');
      const resultado = await fotografiarBase(sql);
      await writeFile(resolve(directorio, `bd-${foto}.json`), JSON.stringify(resultado, null, 2));
      console.log(`Fotografía ${foto}: ${resultado.sha256}, ${resultado.tablas.length} tablas.`);
    }
  } finally { await sql.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
