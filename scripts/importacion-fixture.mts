/** Fixture E2 sintética. Exige identidad exacta antes de cualquier escritura. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { cifrarClave } from '../src/lib/contrasena';

const id = (n: number) => `e2000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
export const FIXTURE_IMPORTACION = {
  proyecto: id(1), localizacion: id(2), sede: id(3), ubicacion: id(4), proveedor: id(5),
  sala: id(10), salaCerrada: id(11), proyectoCerrado: id(12), localizacionCerrada: id(13),
  pantalla: id(20), variante: id(21), ambiguoUno: id(22), ambiguoDos: id(23), cable: id(24),
  sinPrecio: id(25), cero: id(26), equipo: id(30), plantilla: id(40), plantillaArticulo: id(41),
  precioApp: id(50), precioCero: id(51), pedido: id(60), pedidoLinea: id(61), movimiento: id(62), reserva: id(63),
  admin: id(80), lectura: id(81), oculto: id(82), bom: id(83), provisional: id(84), tecnico: id(85),
} as const;
export const URL_IMPORTACION_PRUEBA = 'postgres://av_design_e2:av_design_e2_local@127.0.0.1:5546/av_design_e2_prueba';
export type SqlImportacionPrueba = ReturnType<typeof postgres>;
export const SALIDA_IMPORTACION = resolve('output/e2-importacion/gates');

export function comprobarUrlImportacion(texto: string): URL {
  const url = new URL(texto);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '5546' ||
    url.pathname !== '/av_design_e2_prueba' || decodeURIComponent(url.username) !== 'av_design_e2' || url.search || url.hash) {
    throw new Error('Destino rechazado: E2 sólo escribe en av_design_e2_prueba, usuario av_design_e2, loopback:5546, sin parámetros.');
  }
  return url;
}
export async function conectarImportacion(texto: string): Promise<SqlImportacionPrueba> {
  const url = comprobarUrlImportacion(texto);
  const sql = postgres(url.toString(), { max: 2, ssl: false, onnotice: () => {} });
  try {
    const [destino] = await sql`select current_database() as base, current_user as usuario, inet_server_port() as puerto`;
    if (destino.base !== 'av_design_e2_prueba' || destino.usuario !== 'av_design_e2' || Number(destino.puerto) !== 5432) {
      throw new Error('Identidad real del servidor distinta de av_design_e2_prueba / av_design_e2 / servidor:5432.');
    }
    console.log(`Destino comprobado: ${url.hostname}:${url.port}/${destino.base} (${destino.usuario}), servidor:5432.`);
    return sql;
  } catch (error) { await sql.end(); throw error; }
}
export interface FotoImportacion {
  base: string; sha256: string; tablas: Array<{ tabla: string; filas: number; sha256: string }>;
}
export async function fotografiarImportacion(sql: SqlImportacionPrueba): Promise<FotoImportacion> {
  return sql.begin('isolation level repeatable read read only', async (tx) => {
    const tablas = await tx`select tablename from pg_tables where schemaname = 'public' order by tablename`;
    const fotos: FotoImportacion['tablas'] = [];
    for (const { tablename } of tablas) {
      if (!/^[a-z_]+$/.test(String(tablename))) throw new Error('Nombre de tabla inesperado.');
      const filas = await tx.unsafe(`select to_jsonb(t)::text as fila from "${tablename}" t order by to_jsonb(t)::text`);
      fotos.push({ tabla: String(tablename), filas: filas.length,
        sha256: createHash('sha256').update(JSON.stringify(filas.map((f) => String(f.fila)))).digest('hex') });
    }
    return { base: 'av_design_e2_prueba', sha256: createHash('sha256').update(JSON.stringify(fotos)).digest('hex'), tablas: fotos };
  });
}
export async function crearFixtureImportacion(sql: SqlImportacionPrueba): Promise<void> {
  const f = FIXTURE_IMPORTACION;
  const existe = await sql`select id from proyectos where id = ${f.proyecto}`;
  if (existe.length) {
    const salas = await sql`select id from salas where id in ${sql([f.sala, f.salaCerrada])}`;
    if (salas.length !== 2) throw new Error('Fixture incompleta: no se pisan datos existentes.');
    console.log('PRUEBA-IMPORT-01 existente conservada; ninguna escritura.'); return;
  }
  const [{ n }] = await sql`select count(*)::int as n from proyectos`;
  if (n !== 0) throw new Error('Base con otras obras: no se mezcla fixture ni se resetea.');
  const hash = await cifrarClave('Prueba-import-01-local!');
  await sql.begin(async (tx) => {
    await tx`insert into parametros (clave, valor, unidad, descripcion) values
      ('holgura_pantalla',0.35,'m','Fixture E2'),('holgura_rack',1,'m','Fixture E2'),
      ('holgura_caja_conexiones',0.5,'m','Fixture E2'),('holgura_mesa',0.5,'m','Fixture E2'),
      ('holgura_techo',0.3,'m','Fixture E2'),('holgura_pared',0.3,'m','Fixture E2'),
      ('margen',0,'tanto por uno','Fixture E2'),('cables_por_canalizacion',3,'ud','Fixture E2'),
      ('ocupacion_maxima_canaleta',0.4,'tanto por uno','Fixture E2'),
      ('vigencia_precio_meses',18,'meses','Fixture E2'),('tipo_cambio_usd_eur',0.867,'EUR por USD','Fixture E2')`;
    await tx`insert into sedes(id,nombre,ciudad) values(${f.sede},'SEDE SINTÉTICA E2','Ciudad de prueba')`;
    await tx`insert into proveedores(id,nombre) values(${f.proveedor},'PROVEEDOR SINTÉTICO E2')`;
    await tx`insert into ubicaciones(id,nombre,descripcion) values(${f.ubicacion},'ESTANTE PRUEBA-IMPORT-01','Sólo material sintético')`;
    await tx`insert into proyectos(id,nombre,codigo,sede_id) values
      (${f.proyecto},'OBRA PRUEBA-IMPORT-01','PRUEBA-IMPORT-OBRA',${f.sede}),
      (${f.proyectoCerrado},'OBRA CERRADA E2','PRUEBA-IMPORT-CERRADA',${f.sede})`;
    await tx`insert into localizaciones(id,proyecto_id,nombre) values
      (${f.localizacion},${f.proyecto},'EDIFICIO SINTÉTICO Á'),(${f.localizacionCerrada},${f.proyectoCerrado},'PLANTA CERRADA')`;
    await tx`insert into salas(id,nombre,codigo,sede_id,localizacion_id,largo_m,ancho_m,alto_m,
      mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m,aforo,diagrama_version,
      diagrama_iniciado_en,diagrama_origen) values
      (${f.sala},'PRUEBA-IMPORT-01 · Sala medida','PRUEBA-IMPORT-01',${f.sede},${f.localizacion},8,6,3,3.2,1.2,75,4,3,4,7,'2026-10-13T08:00:00Z','desde_cero'),
      (${f.salaCerrada},'PRUEBA-IMPORT-CERRADA','PRUEBA-IMPORT-CERRADA',${f.sede},${f.localizacionCerrada},5,4,3,null,null,null,null,null,null,0,null,null)`;
    await tx`insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,coste,coste_orientativo,proveedor_id) values
      (${f.pantalla},'E2-QB65R','equipo','PANTALLA','SINTÉTICA','QB65R','ud',800,false,${f.proveedor}),
      (${f.variante},'E2-QB65R-B','equipo','PANTALLA','SINTÉTICA','QB65R-B','ud',null,false,null),
      (${f.ambiguoUno},'E2-AMB-UNO','equipo','MICRÓFONO','SINTÉTICA','Modelo Á ambiguo','ud',null,false,null),
      (${f.ambiguoDos},'E2-AMB-DOS','equipo','ALTAVOZ','SINTÉTICA','Modelo Á ambiguo','ud',null,false,null),
      (${f.cable},'E2-CABLE-M','cable','RED','SINTÉTICA','UTP metros','m',0.74,false,${f.proveedor}),
      (${f.sinPrecio},'E2-SIN-PRECIO','equipo','CÓDEC','SINTÉTICA','Ausente áéíóú','ud',null,false,null),
      (${f.cero},'E2-CERO','consumible','CONSUMIBLE','SINTÉTICA','Cero explícito ajeno a kit','ud',0,false,${f.proveedor})`;
    await tx`insert into precios(id,articulo_id,proveedor_id,presupuesto,fecha,precio,origen,fuente) values
      (${f.precioApp},${f.pantalla},${f.proveedor},'Oferta app anterior E2','2026-10-13',800,'final','app'),
      (${f.precioCero},${f.cero},${f.proveedor},'Oferta cero explícito E2','2026-10-13',0,'final','app')`;
    await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada,rotacion_grados) values
      (${f.equipo},${f.sala},${f.pantalla},'Pantalla medida E2',1,'pantalla',4,0.1,1.45,true,0)`;
    await tx`insert into plantillas_sala(id,nombre,tipologia,largo_m,ancho_m,alto_m) values
      (${f.plantilla},'PLANTILLA SINTÉTICA E2','Prueba',8,6,3)`;
    await tx`insert into plantilla_articulos(id,plantilla_id,articulo_id,categoria,cantidad,x_m,y_m,z_m,posicion_confirmada) values
      (${f.plantillaArticulo},${f.plantilla},${f.pantalla},'PANTALLA',1,4,0.1,1.45,true)`;
    await tx`insert into pedidos(id,proveedor_id,sala_id,referencia,estado,fecha,proyecto_id) values
      (${f.pedido},${f.proveedor},${f.sala},'PEDIDO E2 CONGELADO','borrador','2026-10-13',${f.proyecto})`;
    await tx`insert into pedido_lineas(id,pedido_id,articulo_id,cantidad,precio_unitario,precio_orientativo) values
      (${f.pedidoLinea},${f.pedido},${f.pantalla},1,800,false)`;
    await tx`insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,quien,motivo,fecha) values
      (${f.movimiento},${f.pantalla},${f.ubicacion},'entrada',3,'Fixture E2','Stock sintético','2026-10-13')`;
    await tx`insert into reservas(id,sala_id,articulo_id,cantidad,estado,quien) values
      (${f.reserva},${f.sala},${f.pantalla},1,'activa','Fixture E2')`;
    await tx`insert into tecnicos(id,nombre,fuente) values(${f.tecnico},'Técnico sintético E2','app')`;
    await tx`insert into hitos_proyecto(proyecto_id,tipo,fecha,tecnico_id,notas) values
      (${f.proyectoCerrado},'cierre','2026-10-13',${f.tecnico},'Obra cerrada sintética')`;
    await tx`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo) values
      (${f.admin},'prueba-import-admin','Administrador E2','admin',${hash},false,true),
      (${f.lectura},'prueba-import-lectura','Lectura E2','lectura',${hash},false,true),
      (${f.oculto},'prueba-import-oculto','Catálogo oculto E2','tecnico',${hash},false,true),
      (${f.bom},'prueba-import-bom','BOM E2','tecnico',${hash},false,true),
      (${f.provisional},'prueba-import-provisional','Clave provisional E2','admin',${hash},true,true)`;
    await tx`insert into usuario_permisos(usuario_id,seccion,acceso) values
      (${f.oculto},'catalogo','oculto'),(${f.oculto},'salas','editar'),
      (${f.bom},'catalogo','ver'),(${f.bom},'salas','editar')`;
  });
  console.log('PRUEBA-IMPORT-01 creada: catálogo, variantes, ambigüedad, precios app, pedido, stock y posiciones sintéticos.');
}

async function main(): Promise<void> {
  const url = process.env.IMPORTACION_DATABASE_URL;
  if (!url) throw new Error('Define IMPORTACION_DATABASE_URL explícitamente; no se usa DATABASE_URL ni .env.local.');
  const sql = await conectarImportacion(url);
  try {
    if (process.argv.includes('--schema')) {
      if (!process.argv.includes('--aplicar')) throw new Error('--schema exige --aplicar.');
      const [{ n }] = await sql`select count(*)::int as n from pg_tables where schemaname='public'`;
      if (n !== 0) throw new Error('--schema sólo admite base vacía.');
      await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
      console.log('Schema aplicado exclusivamente a la base vacía E2, sin seed real.');
    }
    if (process.argv.includes('--migraciones')) {
      if (!process.argv.includes('--aplicar')) throw new Error('--migraciones exige --aplicar.');
      for (const nombre of ['2026-10-e2-importacion.sql','2026-10-e2-tecnico.sql','2026-10-e2-favoritos.sql']) {
        const conexion = await sql.reserve();
        try { await conexion.unsafe(await readFile(new URL(`../db/migraciones/${nombre}`,import.meta.url),'utf8')); }
        finally { conexion.release(); }
        console.log(`Migración local E2 aplicada: ${nombre}.`);
      }
    }
    if (process.argv.includes('--aplicar')) await crearFixtureImportacion(sql);
    await mkdir(SALIDA_IMPORTACION, { recursive: true });
    await writeFile(resolve(SALIDA_IMPORTACION,'fixture.json'),JSON.stringify(FIXTURE_IMPORTACION,null,2));
    const foto = process.argv.find((a) => a.startsWith('--foto='))?.slice(7);
    if (foto) {
      if (!/^[a-z0-9-]+$/.test(foto)) throw new Error('Etiqueta de fotografía no válida.');
      const datos = await fotografiarImportacion(sql);
      await writeFile(resolve(SALIDA_IMPORTACION,`bd-${foto}.json`),JSON.stringify(datos,null,2));
      console.log(`Fotografía ${foto}: ${datos.sha256}, ${datos.tablas.length} tablas.`);
    }
  } finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
