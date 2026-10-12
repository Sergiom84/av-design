/** L2A: PostgreSQL desechable, sin leer .env ni tocar bases compartidas. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { require as tsRequire } from 'tsx/cjs/api';
import { sqlEtiquetasCable, verificarProyeccion } from './generar-etiquetas-cable.mjs';
const args=process.argv.slice(2);
assert.ok(args.every(x=>['--plan','--sin-inmutabilidad','--sin-atomico','--reiniciar-contador','--sin-truncado'].includes(x)));
console.log('Solo fixtures qa_etiquetas_<UUID> propias en 127.0.0.1:5433.');
if(args.includes('--plan'))process.exit(0);
const esquema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const anterior=esquema.split('-- BEGIN ETIQUETAS CABLE GENERADAS')[0];
const historicoL0=readFileSync(new URL('./fixtures/schema-plan40-l0.sql',import.meta.url),'utf8');
// Instantánea preservada al iniciar L0: output/plan40-20260908-083450/preservado/db/schema.sql.
assert.equal(createHash('sha256').update(historicoL0).digest('hex'),'74b945eb844ffaaa44a742181d9563119a6aac3f113dc903c69ce03fb73511ed');
const fichasL1=readFileSync(new URL('../db/migraciones/2026-09-fichas-tecnicas.sql',import.meta.url),'utf8');
const { identificadoresHistoricosDeCable }=tsRequire('../src/lib/cable-schedule.ts',import.meta.url);
const opciones={host:'127.0.0.1',port:5433,username:'av_design',password:'av_design_local',onnotice:()=>{},max:4};
function mutar(s) {
 if(args.includes('--sin-inmutabilidad'))s=s.replace("if new.etiqueta_cable is distinct from old.etiqueta_cable", "if false and new.etiqueta_cable is distinct from old.etiqueta_cable").replace("or new.serie_cable is distinct", "or false and new.serie_cable is distinct").replace("or new.correlativo_cable is distinct", "or false and new.correlativo_cable is distinct").replace("or new.sala_id is distinct", "or false and new.sala_id is distinct").replace("or new.id is distinct", "or false and new.id is distinct");
 if(args.includes('--reiniciar-contador'))s=s.replace('greatest(series_cable_sala.siguiente,excluded.siguiente)','excluded.siguiente');
 if(args.includes('--sin-truncado'))s=s.replace("date_trunc('milliseconds',c.creado_en)",'c.creado_en');
 if(args.includes('--sin-atomico'))s=s.replace(`insert into series_cable_sala(sala_id,senal,siguiente) values(new.sala_id,new.senal,primero+1)
 on conflict(sala_id,senal) do update set siguiente=series_cable_sala.siguiente+1
 returning siguiente-1 into numero;`, `insert into series_cable_sala(sala_id,senal,siguiente) values(new.sala_id,new.senal,primero) on conflict do nothing;
 select siguiente into numero from series_cable_sala where sala_id=new.sala_id and senal=new.senal;
 perform pg_sleep(0.15);
 update series_cable_sala set siguiente=numero+1 where sala_id=new.sala_id and senal=new.senal;`);
 return s;
}
const migracion=mutar(sqlEtiquetasCable());
async function fixture(fn,modo='limpia') {
 const nombre='qa_etiquetas_'+randomUUID().replaceAll('-','');const admin=postgres({...opciones,database:'postgres',max:1});let sql,paralela,creada=false;
 try {
  await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres({...opciones,database:nombre,max:1});paralela=postgres({...opciones,database:nombre});
  const base=modo==='f38'?execFileSync('git',['show','f38baa805a1868b7cad55bb97064386e9b5f8555:db/schema.sql'],{encoding:'utf8'}):modo==='anterior'?historicoL0:anterior;
  await sql.unsafe(base);if(modo==='anterior')await sql.unsafe(fichasL1);if(modo==='limpia')await sql.unsafe(migracion);
  const [sala]=await sql`insert into salas(nombre) values ('Sala QA etiquetas') returning id`;
  const [articulo]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Etiqueta') returning id`;
  const equipos=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,x_m,y_m,z_m,posicion_confirmada) values (${sala.id},${articulo.id},'A',1,2,0,true),(${sala.id},${articulo.id},'B',3,4,2,true) returning id`;
  const crear=async(senal='hdmi',tx=sql)=>{
   if(modo!=='limpia')return tx`insert into conexiones(sala_id,origen_id,destino_id,senal) values (${sala.id},${equipos[0].id},${equipos[1].id},${senal}) returning *`;
   const insertar=async t=>{
    const [p]=await t`insert into puertos(articulo_id,nombre,total,sentido,senal,fuente) values (${articulo.id},${'QA '+randomUUID()},1,'bidireccional',${senal},'app') returning id`;
    const filas=await t`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal) values (${sala.id},${equipos[0].id},${equipos[1].id},${p.id},${p.id},${senal}) returning *`;
    await t`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${filas[0].id},'origen',${equipos[0].id},${p.id},1),(${filas[0].id},'destino',${equipos[1].id},${p.id},1)`;
    return filas;
   };
   return tx===sql||tx===paralela?tx.begin(insertar):insertar(tx);
  };
  const aplicar=async()=>{try{await sql.unsafe(migracion);}catch(e){await sql`rollback`;throw e;}};
  await fn({sql,paralela,sala,equipos,articulo,crear,aplicar});
 }finally{if(paralela)await paralela.end();if(sql){await sql`rollback`;await sql.end();}if(creada){await admin.unsafe(`drop database "${nombre}"`);console.log('Eliminada',nombre);}await admin.end();}
}
await test('Proyección generada coincide byte a byte con esquema y migración',()=>verificarProyeccion());
for(const modo of ['anterior','f38'])await test(`Backfill ${modo} conserva mapa histórico exacto, bocas y geometría; segunda aplicación`,()=>fixture(async({sql,sala,equipos,articulo,crear,aplicar})=>{
 const [a]=await crear();const [b]=await crear();const [c]=await crear('red');
 const orden=[a,b].sort((x,y)=>x.id.localeCompare(y.id));
 await sql`update conexiones set creado_en='2026-09-08T10:00:00.000900Z' where id=${orden[0].id}`;
 await sql`update conexiones set creado_en='2026-09-08T10:00:00.000100Z' where id=${orden[1].id}`;
 const [p]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${articulo.id},'QA HDMI','bidireccional','hdmi',2,'app') returning id`;
 await sql.begin(async tx=>{
  await tx`update conexiones set puerto_origen_id=${p.id},puerto_destino_id=${p.id} where id=${a.id}`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${a.id},'origen',${equipos[0].id},${p.id},2),(${a.id},'destino',${equipos[1].id},${p.id},1)`;
 });
 await sql`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m) values (${c.id},0,1,2,3)`;
 const snapshot=async()=>({conexiones:Array.from(await sql`select to_jsonb(c)-'etiqueta_cable'-'serie_cable'-'correlativo_cable' v from conexiones c order by id`),bocas:Array.from(await sql`select * from conexion_bocas order by conexion_id,lado`),puntos:Array.from(await sql`select * from conexion_puntos_paso order by id`),equipos:Array.from(await sql`select * from sala_equipos order by id`)});
 const antes=await snapshot();const previas=await sql`select * from conexiones where sala_id=${sala.id}`;
 assert.equal(typeof identificadoresHistoricosDeCable,'function');
 const mapa=identificadoresHistoricosDeCable(previas.map(c=>({...c,creado_en:c.creado_en.toISOString()})));
 await aplicar();assert.deepEqual(await snapshot(),antes);
 const despues=Array.from(await sql`select id,etiqueta_cable from conexiones order by id`);
 assert.ok(despues.length===3);for(const c of despues)assert.equal(c.etiqueta_cable,mapa.get(c.id));
 await aplicar();assert.deepEqual(Array.from(await sql`select id,etiqueta_cable from conexiones order by id`),despues);
},modo));
await test('Borrar primero, intermedio y último no renumera ni recicla; repetición conserva máximo',()=>fixture(async({sql,crear,aplicar})=>{
 const filas=[];for(let i=0;i<5;i++)filas.push((await crear())[0]);
 for(const i of [0,2,4])await sql`delete from conexiones where id=${filas[i].id}`;
 await aplicar();const [nueva]=await crear();assert.equal(nueva.etiqueta_cable,'HD-1005');
 for(const i of [1,3])assert.equal((await sql`select etiqueta_cable from conexiones where id=${filas[i].id}`)[0].etiqueta_cable,filas[i].etiqueta_cable);
 await sql`delete from conexiones`;await aplicar();assert.equal((await crear())[0].etiqueta_cable,'HD-1006');
}));
await test('Cambio de señal conserva brida y asigna las altas en su serie original',()=>fixture(async({sql,crear})=>{
 const [c]=await crear();await sql`update conexiones set senal='red' where id=${c.id}`;
 const [actual]=await sql`select * from conexiones where id=${c.id}`;
 assert.equal(actual.etiqueta_cable,'HD-1000');assert.equal(actual.serie_cable,'hdmi');
 assert.equal((await crear())[0].etiqueta_cable,'HD-1001');assert.equal((await crear('red'))[0].etiqueta_cable,'RED-1000');
}));
await test('SQL directo rechaza cambiar etiqueta, correlativo, serie, identidad y sala',()=>fixture(async({sql,crear})=>{
 const [c]=await crear();const [otra]=await sql`insert into salas(nombre) values ('Otra') returning id`;
 const cambios=[{etiqueta_cable:'HD-9999'},{correlativo_cable:9999},{serie_cable:'red'},{id:randomUUID()},{sala_id:otra.id}];
 for(const cambio of cambios)await assert.rejects(sql`update conexiones set ${sql(cambio)} where id=${c.id}`,/inmutables/);
 assert.deepEqual((await sql`select * from conexiones where id=${c.id}`)[0],c);
}));
await test('INSERT no acepta bridas proporcionadas; copiar recibe identidad independiente',()=>fixture(async({sql,crear,sala,equipos,articulo})=>{
 const [c]=await crear();
 await assert.rejects(sql`insert into conexiones(sala_id,origen_id,destino_id,senal,etiqueta_cable) values (${sala.id},${equipos[0].id},${equipos[1].id},'hdmi','HD-9999')`,/asigna el servidor/);
 for(let i=0;i<2;i++){
  const [otra]=await sql`insert into salas(nombre) values ('Copia') returning id`;
  const es=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${otra.id},${articulo.id},'A'),(${otra.id},${articulo.id},'B') returning id`;
  const copia=await sql.begin(async tx=>{
   const [fila]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal) select ${otra.id},${es[0].id},${es[1].id},puerto_origen_id,puerto_destino_id,senal from conexiones where id=${c.id} returning *`;
   await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${fila.id},'origen',${es[0].id},${fila.puerto_origen_id},1),(${fila.id},'destino',${es[1].id},${fila.puerto_destino_id},1)`;
   return fila;
  });
  assert.notEqual(copia.id,c.id);assert.equal(copia.etiqueta_cable,'HD-1000');
 }
}));
await test('Dos INSERT concurrentes confirman números distintos sin perder incrementos',()=>fixture(async({crear,paralela})=>{
 await crear();const resultados=await Promise.allSettled([crear('hdmi',paralela),crear('hdmi',paralela)]);
 assert.equal(resultados.filter(r=>r.status==='fulfilled').length,2,'Ambas altas concurrentes deben confirmar');
 assert.deepEqual(resultados.map(r=>r.value[0].etiqueta_cable).sort(),['HD-1001','HD-1002']);
 assert.equal((await crear())[0].etiqueta_cable,'HD-1003');
 const iniciales=await Promise.all([crear('red',paralela),crear('red',paralela)]);
 assert.deepEqual(iniciales.map(r=>r[0].etiqueta_cable).sort(),['RED-1000','RED-1001']);
}));
await test('Rollback devuelve solo el número jamás confirmado',()=>fixture(async({sql,crear})=>{
 await crear();await assert.rejects(sql.begin(async tx=>{assert.equal((await crear('hdmi',tx))[0].etiqueta_cable,'HD-1001');throw new Error('fallo posterior medido');}),/fallo posterior medido/);
 assert.equal((await crear())[0].etiqueta_cable,'HD-1001');
}));
await test('Fechas no representables y mezclas parciales abortan toda la migración',()=>fixture(async({sql,crear,aplicar})=>{
 const [c]=await crear();await sql`update conexiones set creado_en='infinity' where id=${c.id}`;
 await assert.rejects(aplicar(),/Fechas fuera/);
 assert.equal((await sql`select count(*)::int n from information_schema.columns where table_name='conexiones' and column_name='etiqueta_cable'`)[0].n,0);
 for(const fecha of ['0001-01-01 BC','10000-01-01']){await sql`update conexiones set creado_en=${fecha}::text::timestamptz where id=${c.id}`;await assert.rejects(aplicar(),/Fechas fuera/);}
 await sql`update conexiones set creado_en='2026-09-08' where id=${c.id}`;
 await sql`alter table conexiones add column etiqueta_cable text`;await sql`update conexiones set etiqueta_cable='HD-1000' where id=${c.id}`;
 await assert.rejects(aplicar(),/mezcladas/);
},'anterior'));
await test('Una configuración divergente no sobrescribe prefijos en una reaplicación',()=>fixture(async({sql,crear,aplicar})=>{
 const [c]=await crear();await sql`update configuracion_series_cable set prefijo='OTRO-HD' where senal='hdmi'`;
 await assert.rejects(aplicar(),/Configuración de series divergente/);
 assert.equal((await sql`select etiqueta_cable from conexiones where id=${c.id}`)[0].etiqueta_cable,'HD-1000');
 assert.equal((await sql`select prefijo from configuracion_series_cable where senal='hdmi'`)[0].prefijo,'OTRO-HD');
}));
