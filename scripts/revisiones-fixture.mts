/** E3: escritores dirigidos únicamente a la nueva base sintética identificada. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { crearFixture, fotografiarBase, FIXTURE_DOCUMENTOS } from './documentos-fixture.mjs';

export const URL_REVISIONES_PRUEBA = 'postgres://av_design_e3:av_design_e3_local@127.0.0.1:5547/av_design_e3_prueba';
export const SALIDA_REVISIONES = resolve('output/e3-revisiones/gates');
const id = (n: number) => `e3000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
export const FIXTURE_REVISIONES = {
  ...FIXTURE_DOCUMENTOS,
  grande: id(1), legado: id(2), cerrada: id(3), proyectoCerrado: id(4), localizacionCerrada: id(5),
  matriz: id(10), periferico: id(11), puertoMatriz: id(12), puertoPeriferico: id(13),
  pedido: id(20), carga: id(21), visita: id(22), bom: id(23),
  equipoGrande: (n: number) => id(100 + n), conexionGrande: (n: number) => id(1000 + n),
} as const;
export type SqlRevisionesPrueba = ReturnType<typeof postgres>;

export function comprobarUrlRevisiones(texto: string): URL {
  const url = new URL(texto);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '5547' || url.pathname !== '/av_design_e3_prueba' || decodeURIComponent(url.username) !== 'av_design_e3' || url.search || url.hash) {
    throw new Error('E3 exige av_design_e3_prueba / av_design_e3 / loopback:5547 sin parámetros.');
  }
  return url;
}
export async function conectarRevisiones(texto: string): Promise<SqlRevisionesPrueba> {
  const url = comprobarUrlRevisiones(texto);
  const sql = postgres(url.toString(), { max: 5, ssl: false, onnotice: () => {} });
  try {
    const [real] = await sql`select current_database() as base, current_user as usuario, inet_server_port() as puerto`;
    if (real.base !== 'av_design_e3_prueba' || real.usuario !== 'av_design_e3' || Number(real.puerto) !== 5432) throw new Error('Identidad real E3 rechazada.');
    console.log(`Destino comprobado: ${url.hostname}:5547/${real.base}, usuario ${real.usuario}, servidor:5432.`);
    return sql;
  } catch (error) { await sql.end(); throw error; }
}
export async function fotografiarRevisiones(sql: SqlRevisionesPrueba) {
  return { ...await fotografiarBase(sql), base: 'av_design_e3_prueba' };
}
export async function crearFixtureRevisiones(sql: SqlRevisionesPrueba) {
  const f = FIXTURE_REVISIONES;
  // Reutiliza exclusivamente los datos sintéticos E1, en esta base nueva.
  await crearFixture(sql);
  const existe = await sql`select id from salas where id=${f.grande}`;
  if (existe.length) { console.log('Fixture PRUEBA-REV-01 existente conservada.'); return; }
  await sql.begin(async tx => {
    await tx`update salas set nombre='PRUEBA-DOC-01 · PRUEBA-REV-01', notas='Fixture E3: diseño e historia, con hechos sintéticos protegidos' where id=${f.sala}`;
    await tx`insert into proyectos(id,nombre,codigo,sede_id) values(${f.proyectoCerrado},'OBRA CERRADA E3','PRUEBA-REV-CERRADA',${f.sede})`;
    await tx`insert into localizaciones(id,proyecto_id,nombre) values(${f.localizacionCerrada},${f.proyectoCerrado},'LOCALIZACIÓN CERRADA E3')`;
    await tx`insert into salas(id,nombre,codigo,sede_id,localizacion_id,largo_m,ancho_m,alto_m,diagrama_iniciado_en,diagrama_origen) values
      (${f.grande},'PRUEBA-REV-01 · Matriz grande','PRUEBA-REV-GRANDE',${f.sede},${f.localizacion},12,8,3,'2026-10-14T08:00:00Z','desde_cero'),
      (${f.legado},'PRUEBA-REV-LEGADO','PRUEBA-REV-LEGADO',${f.sede},null,8,6,3,'2026-10-14T08:00:00Z','desde_cero'),
      (${f.cerrada},'PRUEBA-REV-CERRADA','PRUEBA-REV-CERRADA',${f.sede},${f.localizacionCerrada},8,6,3,'2026-10-14T08:00:00Z','desde_cero')`;
    await tx`insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,coste,fuente) values
      (${f.matriz},'E3-MATRIZ','equipo','MATRIZ','PRUEBA','Matriz de 24 bocas','ud',900,'app'),
      (${f.periferico},'E3-PERIFERICO','equipo','PANTALLA','PRUEBA','Equipo periférico de 24 bocas','ud',100,'app')`;
    await tx`insert into puertos(id,articulo_id,nombre,sentido,senal,conector,total,orden,fuente) values
      (${f.puertoMatriz},${f.matriz},'HDMI MATRIX','bidireccional','hdmi','HDMI A',24,1,'app'),
      (${f.puertoPeriferico},${f.periferico},'HDMI I/O','bidireccional','hdmi','HDMI A',24,1,'app')`;
    for (let n = 0; n < 15; n++) {
      await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada,rotacion_grados,esquema_x,esquema_y,dimensiones_tecnicas) values
        (${f.equipoGrande(n)},${f.grande},${n === 0 ? f.matriz : f.periferico},${n === 0 ? 'Matriz 24 bocas' : `Pantalla ${n}`},1,'pared',${n % 6},${Math.floor(n / 6)},1,${n !== 14},${n * 15},20,20,null)`;
    }
    for (let n = 0; n < 100; n++) {
      const a = n % 15, b = (a + 1) % 15, ordinal = Math.floor(n / 15) * 2 + 1;
      await tx`insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta,longitud_manual_m,puerto_origen_id,puerto_destino_id,creado_en) values
        (${f.conexionGrande(n)},${f.grande},${f.equipoGrande(a)},${f.equipoGrande(b)},${f.hdmi},'hdmi','directo',5,${a === 0 ? f.puertoMatriz : f.puertoPeriferico},${b === 0 ? f.puertoMatriz : f.puertoPeriferico},${new Date(Date.UTC(2026,9,14,8,0,n)).toISOString()})`;
      await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values
        (${f.conexionGrande(n)},'origen',${f.equipoGrande(a)},${a === 0 ? f.puertoMatriz : f.puertoPeriferico},${ordinal}),
        (${f.conexionGrande(n)},'destino',${f.equipoGrande(b)},${b === 0 ? f.puertoMatriz : f.puertoPeriferico},${ordinal + 1})`;
    }
    await tx`insert into sala_material_bom(id,sala_id,articulo_id,cantidad,unidad,nota) values(${f.bom},${f.sala},${f.microfono},2,'ud','BOM adicional sintética E3')`;
    await tx`insert into pedidos(id,sala_id,proveedor_id,referencia,estado,fecha) values(${f.pedido},${f.sala},${f.proveedor},'PEDIDO SINTÉTICO E3','borrador','2026-10-14')`;
    await tx`insert into pedido_lineas(pedido_id,articulo_id,cantidad,cantidad_recibida,precio_unitario) values(${f.pedido},${f.pantalla},1,0,800)`;
    await tx`insert into cargas(id,sala_id,nombre,quien) values(${f.carga},${f.sala},'CARGA SINTÉTICA E3','Técnico sintético')`;
    await tx`insert into carga_lineas(carga_id,articulo_id,cantidad,cargado) values(${f.carga},${f.pantalla},1,false)`;
    await tx`insert into hitos_proyecto(proyecto_id,tipo,fecha,notas) values(${f.proyecto},'inicio','2026-10-14','Hecho sintético protegido'),(${f.proyectoCerrado},'cierre','2026-10-14','Control de obra cerrada')`;
    await tx`insert into hitos_sala(sala_id,tipo,fecha,notas) values(${f.sala},'instalacion','2026-10-14','Hecho sintético protegido')`;
    await tx`insert into revisiones(id,sala_id,nombre,quien) values(${f.visita},${f.sala},'VISITA SINTÉTICA E3','Técnico sintético')`;
    await tx`insert into revision_puntos(revision_id,clave,bloque,titulo,valor) values(${f.visita},'medidas','sala','Medida vista en visita','8 m')`;
  });
  console.log('PRUEBA-REV-01: hechos protegidos, legado, obra cerrada y 15 equipos / 24 bocas / 100 conexiones.');
}
async function main() {
  const url = process.env.REVISIONES_DATABASE_URL;
  if (!url) throw new Error('REVISIONES_DATABASE_URL explícita obligatoria; no se lee .env.local.');
  const sql = await conectarRevisiones(url);
  try {
    await mkdir(SALIDA_REVISIONES, { recursive: true });
    if (process.argv.includes('--schema')) {
      if (!process.argv.includes('--aplicar')) throw new Error('--schema exige --aplicar.');
      const [{ n }] = await sql`select count(*)::int as n from pg_tables where schemaname='public'`;
      if (n !== 0) throw new Error('Schema sólo se aplica en base vacía; no se resetea.');
      const conexion = await sql.reserve();
      try { await conexion.unsafe(await readFile(resolve('db/schema.sql'), 'utf8')); }
      finally { conexion.release(); }
    }
    if (process.argv.includes('--aplicar')) await crearFixtureRevisiones(sql);
    if (process.argv.includes('--migraciones')) {
      if (!process.argv.includes('--aplicar')) throw new Error('--migraciones exige --aplicar.');
      for (const nombre of ['2026-10-e3-anotaciones.sql', '2026-10-e3-revisiones.sql']) {
        const conexion = await sql.reserve();
        try { await conexion.unsafe(await readFile(resolve('db/migraciones', nombre), 'utf8')); }
        finally { conexion.release(); }
        console.log(`Migración exclusivamente E3 prueba: ${nombre}`);
      }
    }
    const foto = process.argv.find(a => a.startsWith('--foto='))?.slice(7);
    if (foto) {
      if (!/^[a-z0-9-]+$/.test(foto)) throw new Error('Etiqueta de foto rechazada.');
      const datos = await fotografiarRevisiones(sql);
      await writeFile(resolve(SALIDA_REVISIONES, `bd-${foto}.json`), JSON.stringify(datos, null, 2));
      console.log(`Foto ${foto}: ${datos.sha256}, ${datos.tablas.length} tablas.`);
    }
  } finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
