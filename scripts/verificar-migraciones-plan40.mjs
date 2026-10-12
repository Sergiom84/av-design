/** PostgreSQL local efímero. No lee .env ni DATABASE_URL; no modifica la base compartida. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const referencia = 'f38baa805a1868b7cad55bb97064386e9b5f8555';
const opciones = process.argv.slice(2);
assert.ok(opciones.every((x) => ['--plan', '--mutaciones'].includes(x)), 'Opciones: --plan, --mutaciones');
console.log(`Destino fijo local 127.0.0.1:5433; solo bases qa_plan40_migracion_<UUID> creadas por esta ejecución. Base anterior: ${referencia}.`);
if (opciones.includes('--plan')) process.exit(0);
const anterior = execFileSync('git', ['show', `${referencia}:db/schema.sql`], { cwd: raiz, encoding: 'utf8' });
const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const actual = leer('db/schema.sql');
const compras = leer('db/migraciones/2026-09-trazabilidad-compras.sql');
const seguimiento = leer('db/migraciones/2026-09-seguimiento-instalacion.sql');
for (const [nombre, texto] of Object.entries({ anterior, actual, compras, seguimiento })) {
  console.log(`SHA256 ${nombre}: ${createHash('sha256').update(texto).digest('hex')}`);
}
const conectar = (database) => postgres({ host: '127.0.0.1', port: 5433, username: 'av_design', password: 'av_design_local', database, max: 1, onnotice: () => {} });
const admin = conectar('postgres');
let verificaciones = 0;
function igual(a, b, mensaje) { assert.deepEqual(a, b, mensaje); verificaciones++; }
async function filas(sql, tabla) {
  return Array.from(await sql.unsafe(`select to_jsonb(t) as fila from ${tabla} t order by id`), (r) => r.fila);
}
async function escenario(nombre, esquema, migracionCompras = compras, conHistoricos = false) {
  const database = `qa_plan40_migracion_${randomUUID().replaceAll('-', '')}`;
  let creada = false;
  let sql;
  try {
    await admin.unsafe(`create database "${database}"`);
    creada = true;
    sql = conectar(database);
    await sql.unsafe(esquema);
    const tablas = ['salas', 'tecnicos', 'usuarios', 'articulos', 'ubicaciones', 'pedidos', 'pedido_lineas', 'movimientos', 'revisiones', 'hitos_sala'];
    let antes;
    if (conHistoricos) {
      igual((await sql`select count(*)::int as n from information_schema.columns where table_name='pedido_lineas' and column_name='comprado_en'`)[0].n, 0, 'El fixture debe partir del esquema anterior real');
      await sql`insert into salas(nombre) values ('Sala histórica')`;
      await sql`insert into tecnicos(nombre) values ('Técnico histórico')`;
      await sql`insert into usuarios(usuario,nombre,clave_hash) values ('qa','Registro histórico','fixture sin acceso')`;
      await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Equipo histórico')`;
      await sql`insert into pedidos(estado,fecha,creado_en,sala_id) select e::estado_pedido, case when e='recibido_parcial' then null else date '2024-03-01' end, timestamptz '2024-02-20 12:00:00+00', s.id from salas s cross join unnest(array['borrador','pedido','recibido_parcial','recibido']) e`;
      await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,cantidad_recibida,precio_unitario) select p.id,a.id,5,2,123.4567 from pedidos p cross join articulos a`;
      await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad,sala_id,quien,motivo) select a.id,u.id,'entrada',2,s.id,'Autor original','Recepción antigua' from articulos a cross join salas s cross join (select id from ubicaciones limit 1) u`;
      await sql`insert into revisiones(sala_id,nombre,cerrada,quien) select id,'Visita anterior',true,'Visitante original' from salas`;
      await sql`insert into hitos_sala(sala_id,tipo,tecnico_id,fecha,notas) select s.id,'instalacion',t.id,'2024-03-10','Instalación previa' from salas s cross join tecnicos t`;
      antes = Object.fromEntries(await Promise.all(tablas.map(async (t) => [t, await filas(sql,t)])));
    }
    await sql.unsafe(migracionCompras);
    await sql.unsafe(seguimiento);
    const columnasDestino = await sql`select column_name, data_type, is_nullable
      from information_schema.columns where table_schema='public' and table_name='pedidos'
      and column_name in ('entrega_prevista','ubicacion_prevista_id') order by column_name`;
    igual(Array.from(columnasDestino), [
      {column_name:'entrega_prevista',data_type:'date',is_nullable:'YES'},
      {column_name:'ubicacion_prevista_id',data_type:'uuid',is_nullable:'YES'},
    ], 'Contrato destino de pedido: columnas, tipos y nulabilidad');
    const clavesDestino = await sql`select a.attname as columna, destino.relname as tabla_destino,
      b.attname as columna_destino, c.confdeltype as borrado
      from pg_constraint c
      join pg_class origen on origen.oid=c.conrelid
      join pg_namespace n on n.oid=origen.relnamespace
      join pg_class destino on destino.oid=c.confrelid
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
      where n.nspname='public' and origen.relname='pedidos' and c.contype='f'
      and a.attname='ubicacion_prevista_id' and cardinality(c.conkey)=1 and cardinality(c.confkey)=1`;
    igual(Array.from(clavesDestino), [{columna:'ubicacion_prevista_id',tabla_destino:'ubicaciones',columna_destino:'id',borrado:'a'}], 'Contrato destino de pedido: FK a ubicación con NO ACTION');
    if (conHistoricos) {
      for (const tabla of tablas) {
        const despues = await filas(sql,tabla);
        const originales = antes[tabla];
        igual(despues.map((r) => Object.fromEntries(Object.keys(originales.find((o) => o.id===r.id) ?? {}).map((k) => [k,r[k]]))), originales, `Preserva filas y columnas anteriores: ${tabla}`);
      }
      const fechas = await sql`select p.estado, l.comprado_en::text as fecha, l.comprado_por from pedido_lineas l join pedidos p on p.id=l.pedido_id order by p.estado`;
      igual(Array.from(fechas), [
        {estado:'borrador',fecha:null,comprado_por:null},
        {estado:'pedido',fecha:'2024-03-01',comprado_por:null},
        {estado:'recibido_parcial',fecha:'2024-02-20',comprado_por:null},
        {estado:'recibido',fecha:'2024-03-01',comprado_por:null},
      ], 'Backfill respeta borradores, fechas y ausencia de autoría');
      igual((await sql`select count(*)::int as n from movimientos where pedido_linea_id is not null or recepcion_compra_id is not null`)[0].n,0,'No inventa trazabilidad histórica');
      for (const tabla of ['seguimiento_instalacion_sala','prueba_final_sala','auditoria_instalacion_sala','recepciones_compra']) {
        igual((await sql.unsafe(`select count(*)::int as n from ${tabla}`))[0].n,0,`No convierte históricos: ${tabla}`);
      }
      await sql`insert into seguimiento_instalacion_sala(sala_id,fecha_prevista,instalador_id,nota,version) select s.id,'2026-09-09',t.id,'Plan medido',3 from salas s cross join tecnicos t`;
      await sql`insert into prueba_final_sala(sala_id,puntos,version,fecha,tecnico_id) select s.id,'[true,true,true,true,true,true]'::jsonb,2,'2026-09-10',t.id from salas s cross join tecnicos t`;
      await sql`insert into auditoria_instalacion_sala(sala_id,autor_id,autor,operacion,datos) select s.id,u.id,u.nombre,'plan','{"antes":null,"despues":{"version":3}}'::jsonb from salas s cross join usuarios u`;
      const [linea] = await sql`select id,pedido_id,articulo_id from pedido_lineas limit 1`;
      const token = randomUUID();
      await sql`insert into recepciones_compra(id,pedido_id,solicitud) values (${token},${linea.pedido_id},'{"cantidad":1}')`;
      await sql`insert into movimientos(articulo_id,tipo,cantidad,pedido_linea_id,recepcion_compra_id) values (${linea.articulo_id},'entrada',1,${linea.id},${token})`;
      await assert.rejects(sql`delete from pedido_lineas where id=${linea.id}`, {code:'23503'}); verificaciones++;
      await assert.rejects(sql`delete from recepciones_compra where id=${token}`, {code:'23503'}); verificaciones++;
      await assert.rejects(sql`insert into movimientos(articulo_id,tipo,cantidad,pedido_linea_id,recepcion_compra_id) values (${linea.articulo_id},'entrada',1,${linea.id},${token})`, {code:'23505'}); verificaciones++;
    }
    const [ubicacion] = await sql`insert into ubicaciones(nombre) values ('Destino previsto sintético') returning id`;
    const [pedidoDestino] = await sql`insert into pedidos(referencia,entrega_prevista,ubicacion_prevista_id)
      values ('QA entrega prevista','2026-09-15',${ubicacion.id}) returning id`;
    const leerDestino = async () => Array.from(await sql`select entrega_prevista::text as fecha, ubicacion_prevista_id as ubicacion
      from pedidos where id=${pedidoDestino.id}`);
    const esperadoDestino = [{fecha:'2026-09-15',ubicacion:ubicacion.id}];
    igual(await leerDestino(), esperadoDestino, 'Guarda y relee fecha y ubicación previstas');
    await assert.rejects(sql`update pedidos set ubicacion_prevista_id=${randomUUID()} where id=${pedidoDestino.id}`, {code:'23503'}); verificaciones++;
    igual(await leerDestino(), esperadoDestino, 'El rechazo de una ubicación inexistente conserva el destino');
    const todas = (await sql`select tablename from pg_tables where schemaname='public' order by tablename`).map((r)=>r.tablename);
    const snapshot = async () => Object.fromEntries(await Promise.all(todas.map(async (t) => [t, Array.from(await sql.unsafe(`select to_jsonb(t)::text as fila from "${t}" t order by to_jsonb(t)::text`), (r)=>r.fila)])));
    const primera = await snapshot();
    await sql.unsafe(migracionCompras);
    await sql.unsafe(seguimiento);
    igual(await snapshot(),primera,'Segunda aplicación preserva todas las tablas, datos, relaciones y auditoría');
    igual(await leerDestino(), esperadoDestino, 'Segunda aplicación conserva fecha y ubicación previstas');
    console.log(`PASS ${nombre}`);
  } finally {
    if(sql) await sql.end();
    // Nunca se descubren ni eliminan bases ajenas: solo el nombre generado y creado aquí.
    if(creada) { await admin.unsafe(`drop database "${database}"`); console.log(`FIXTURE ELIMINADO ${database}`); }
  }
}
try {
  await escenario('instalación limpia + segunda aplicación',actual);
  await escenario('actualización histórica + segunda aplicación',anterior,compras,true);
  const verificacionesBase = verificaciones;
  console.log(`BASE: ${verificacionesBase} comprobaciones correctas en dos escenarios.`);
  if(opciones.includes('--mutaciones')) {
    const patron = /    update pedido_lineas l set comprado_en = coalesce\(p.fecha, p.creado_en::date\)\s+from pedidos p where p.id = l.pedido_id and p.estado <> 'borrador';/;
    assert.match(compras,patron);
    await assert.rejects(escenario('mutación sin backfill',anterior,compras.replace(patron,''),true), (e)=>e.code==='ERR_ASSERTION' && e.message.includes('Backfill respeta'));
    console.log(`MUTACIÓN DETECTADA: quitar backfill falla en la aserción de fechas históricas; ${verificaciones-verificacionesBase} comprobaciones previas correctas, 1 fallo esperado.`);
    const antesSegundaMutacion = verificaciones;
    const columnas = [
      'alter table pedidos add column if not exists entrega_prevista date;',
      'alter table pedidos add column if not exists ubicacion_prevista_id uuid references ubicaciones(id);',
    ];
    let sinDestino = compras;
    for(const columna of columnas) {
      assert.equal(sinDestino.split(columna).length-1,1,'Cada ALTER de destino aparece una sola vez');
      sinDestino = sinDestino.replace(columna,'');
    }
    await assert.rejects(escenario('mutación sin columnas de destino',anterior,sinDestino,true), (e)=>e.code==='ERR_ASSERTION' && e.message.includes('Contrato destino de pedido: columnas'));
    console.log(`MUTACIÓN DETECTADA: quitar ambas columnas falla en la aserción de contrato antes de escribirlas; ${verificaciones-antesSegundaMutacion} comprobaciones previas correctas, 1 fallo esperado.`);
  }
  console.log(`PASS base=${verificacionesBase}, comprobaciones previas correctas en mutaciones=${verificaciones-verificacionesBase}, mutaciones detectadas=${opciones.includes('--mutaciones') ? 2 : 0}; sin aprobación de revisión implícita.`);
} finally { await admin.end(); }
