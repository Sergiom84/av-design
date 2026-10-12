/** Fuente heredada: pruebas de conservación e identidad en PostgreSQL propio. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {leerTiradasDocumentales,sqlTiradasDocumentales} from './sql-tiradas-documentales.mjs';
const args=process.argv.slice(2);
assert.ok(args.every(x=>['--plan','--sin-preservacion','--sin-vinculo'].includes(x)));
console.log('Solo bases qa_documentales_<UUID> propias en 127.0.0.1:5433.');
if(args.includes('--plan'))process.exit(0);
const nl=s=>s.replaceAll('\r\n','\n');
const esquema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const original=readFileSync(new URL('../db/migraciones/2026-09-tiradas-documentales.sql',import.meta.url),'utf8');
const csv=readFileSync(new URL('../data/plantillas-tiradas.csv',import.meta.url),'utf8');
const filas=leerTiradasDocumentales(csv);
let migracion=original;
if(args.includes('--sin-preservacion'))migracion=migracion.replace("if tg_op='UPDATE' and old.conexion_resuelta_id is not null and (","if false and tg_op='UPDATE' and old.conexion_resuelta_id is not null and (");
if(args.includes('--sin-vinculo'))migracion=migracion.replace('if exists(select 1 from plantilla_tiradas_documentales d','if false and exists(select 1 from plantilla_tiradas_documentales d');
const config={host:'127.0.0.1',port:5433,username:'av_design',password:'av_design_local',onnotice:()=>{},max:1};
async function fixture(fn,historica=false){
 const nombre='qa_documentales_'+randomUUID().replaceAll('-',''),admin=postgres({...config,database:'postgres'});let sql,creada=false;
 try{
  await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres({...config,database:nombre});
  let base=esquema.replace(/-- BEGIN TIRADAS DOCUMENTALES L2B[\s\S]*?-- END TIRADAS DOCUMENTALES L2B/,'');
  if(historica)base=base.replace(/-- BEGIN ROSETAS CONEXIONES L2B[\s\S]*?-- END ROSETAS CONEXIONES L2B/,'');
  await sql.unsafe(base);
  const [p,q]=await sql`insert into plantillas_sala(nombre,tipologia,aforo) values ('SALA TP · aforo 8','SALA TP',8),('Otra QA','QA',1) returning id`;
  const [art]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Documental') returning id`;
  const [puerto]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${art.id},'QA','bidireccional','red',10,'app') returning id`;
  const equipos=await sql`insert into plantilla_articulos(plantilla_id,articulo_id,categoria,cantidad) values (${p.id},${art.id},'A',1),(${p.id},${art.id},'B',1),(${q.id},${art.id},'A',1),(${q.id},${art.id},'B',1) returning *`;
  const propias=equipos.filter(e=>e.plantilla_id===p.id),ajenas=equipos.filter(e=>e.plantilla_id===q.id);
  const aplicar=async()=>{try{await sql.unsafe(migracion);}catch(e){await sql`rollback`;throw e;}};
  if(!historica)await aplicar();
  const sembrar=async(datos=filas)=>{try{await sql.unsafe('begin;\n'+sqlTiradasDocumentales(datos)+'\ncommit;');}catch(e){await sql`rollback`;throw e;}};
  const conexion=async(otra=false)=>sql.begin(async tx=>{
   const es=otra?ajenas:propias;
   const [c]=await tx`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id) values (${otra?q.id:p.id},${es[0].id},${es[1].id}) returning *`;
   await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal) values (${c.id},'origen',${es[0].id},${puerto.id},1),(${c.id},'destino',${es[1].id},${puerto.id},1)`;return c;
  });
  await fn({sql,p,q,propias,puerto,sembrar,conexion,aplicar});
 }finally{if(sql){await sql`rollback`;await sql.end();}if(creada){await admin.unsafe(`drop database "${nombre}"`);console.log('Eliminada',nombre);}await admin.end();}
}
await test('CSV estricto: preserva campos; rechaza truncadas, claves repetidas y cabeceras incompletas',()=>{
 assert.equal(filas.length,4);assert.equal(filas[0].origen_categoria,'CAJA CONEXIONES');
 const lineas=csv.trimEnd().split(/\r?\n/);
 assert.throws(()=>leerTiradasDocumentales(''),/cabecera/);
 assert.throws(()=>leerTiradasDocumentales(lineas.slice(1).join('\n')),/cabecera/);
 assert.throws(()=>leerTiradasDocumentales(lineas[0]+'\n'+lineas[1].split(';').slice(0,-1).join(';')),/celdas/);
 assert.throws(()=>leerTiradasDocumentales(csv+'\n'+lineas[1]),/repetida/);
 const espacios=lineas[0]+'\n'+lineas[1]+'  ';
 assert.ok(leerTiradasDocumentales(espacios)[0].notas.endsWith('  '));
});
await test('Cuatro fuentes exactas, cero conexiones nuevas y repeticion conserva UUID',()=>fixture(async({sql,sembrar,aplicar})=>{
 // schema.sql lo sigue Git con core.autocrlf y llega en CRLF; la migración es un
 // fichero nuevo en LF. Se compara el SQL, no el fin de línea del checkout.
 const dentro=nl(esquema).split('-- BEGIN TIRADAS DOCUMENTALES L2B\n')[1];
 assert.ok(dentro,'Falta el bloque TIRADAS DOCUMENTALES L2B en db/schema.sql');
 assert.equal(dentro.split('-- END TIRADAS DOCUMENTALES L2B')[0],nl(original));
 await sembrar();const docs=Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`);
 assert.equal(docs.length,4);assert.equal((await sql`select * from plantilla_conexiones`).length,0);
 for(const [i,d] of docs.entries())for(const campo of Object.keys(filas[i]))assert.equal(d[campo],filas[i][campo]);
 assert.ok(docs.every(d=>d.conexion_resuelta_id===null));
 await aplicar();await sembrar();assert.deepEqual(Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`),docs);
}));
await test('Plantilla inexistente aborta el lote con clave; nombre ambiguo se impide en SQL',()=>fixture(async({sql,p,sembrar})=>{
 await sembrar();
 const antes=Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`);
 await assert.rejects(sembrar(filas.map((f,i)=>i===0?{...f,tipologia:'NO EXISTE QA'}:f)),/sin plantilla univoca: tirada-001/);
 assert.deepEqual(Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`),antes);
 const [plantilla]=await sql`select nombre,tipologia,aforo from plantillas_sala where id=${p.id}`;
 await assert.rejects(sql`insert into plantillas_sala(nombre,tipologia,aforo) values (${plantilla.nombre},${plantilla.tipologia},${plantilla.aforo})`,{code:'23505'});
 assert.equal((await sql`select count(*)::int n from plantillas_sala where nombre=${plantilla.nombre}`)[0].n,1);
}));
await test('Vinculo explicito exige misma plantilla y es unico; seed conserva resolucion',()=>fixture(async({sql,sembrar,conexion})=>{
 await sembrar();const propia=await conexion(),ajena=await conexion(true);
 await assert.rejects(sql`update plantilla_tiradas_documentales set conexion_resuelta_id=${ajena.id} where fuente_clave='tirada-001'`,/misma plantilla/);
 await sql`update plantilla_tiradas_documentales set conexion_resuelta_id=${propia.id} where fuente_clave='tirada-001'`;
 await assert.rejects(sql`update plantilla_tiradas_documentales set conexion_resuelta_id=${propia.id} where fuente_clave='tirada-002'`,/unique constraint/);
 const [antes]=await sql`select * from plantilla_tiradas_documentales where fuente_clave='tirada-001'`;
 await sembrar();assert.deepEqual((await sql`select * from plantilla_tiradas_documentales where fuente_clave='tirada-001'`)[0],antes);
 await sql`delete from plantilla_conexiones where id=${propia.id}`;
 assert.equal((await sql`select conexion_resuelta_id from plantilla_tiradas_documentales where fuente_clave='tirada-001'`)[0].conexion_resuelta_id,null);
 const cables=Array.from(await sql`select * from plantilla_conexiones order by id`);
 await sembrar();
 assert.deepEqual(Array.from(await sql`select * from plantilla_conexiones order by id`),cables);
 assert.equal((await sql`select conexion_resuelta_id from plantilla_tiradas_documentales where fuente_clave='tirada-001'`)[0].conexion_resuelta_id,null);
}));
await test('Cambiar fuente resuelta falla y revierte lote; retirar clave no borra historia',()=>fixture(async({sql,sembrar,conexion})=>{
 await sembrar();const c=await conexion();await sql`update plantilla_tiradas_documentales set conexion_resuelta_id=${c.id} where fuente_clave='tirada-001'`;
 const antes=Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`);
 const cambiadas=filas.map(f=>({...f,notas:f.notas+' cambiado'}));
 await assert.rejects(sembrar(cambiadas),/revision explicita/);
 assert.deepEqual(Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`),antes);
 await assert.rejects(sembrar(filas.slice(1)),/retirada/);
 assert.deepEqual(Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`),antes);
}));
await test('Dos resoluciones concurrentes no vinculan el mismo cable a dos documentales',()=>fixture(async({sql,sembrar,conexion})=>{
 await sembrar();const c=await conexion();
 const [{nombre}]=await sql`select current_database() nombre`;
 const primera=postgres({...config,database:nombre}),segunda=postgres({...config,database:nombre});
 let liberar,avisar;const espera=new Promise(r=>{liberar=r;});const preparada=new Promise(r=>{avisar=r;});
 const escritura=primera.begin(async tx=>{
  await tx`update plantilla_tiradas_documentales set conexion_resuelta_id=${c.id} where fuente_clave='tirada-001'`;
  avisar();await espera;
 });
 let competidora;
 try{
  await Promise.race([preparada,escritura]);
  const [{pid}]=await segunda`select pg_backend_pid() pid`;
  competidora=segunda`update plantilla_tiradas_documentales set conexion_resuelta_id=${c.id} where fuente_clave='tirada-002'`.then(()=>null,e=>e);
  const limite=Date.now()+5000;let bloqueo=false;
  while(Date.now()<limite){bloqueo=(await sql`select wait_event_type from pg_stat_activity where pid=${pid}`)[0]?.wait_event_type==='Lock';if(bloqueo)break;await new Promise(r=>setTimeout(r,20));}
  assert.ok(bloqueo,'La segunda resolución espera un lock real');
  liberar();await escritura;const error=await competidora;assert.equal(error?.code,'23505');
  const vinculadas=await sql`select fuente_clave from plantilla_tiradas_documentales where conexion_resuelta_id=${c.id}`;
  assert.deepEqual(Array.from(vinculadas),[{fuente_clave:'tirada-001'}]);
  assert.equal((await sql`select conexion_resuelta_id from plantilla_tiradas_documentales where fuente_clave='tirada-002'`)[0].conexion_resuelta_id,null);
 }finally{liberar();await escritura;await competidora;await primera.end();await segunda.end();}
}));
await test('Upgrade no enlaza historicas por parecido; no admite resolver con legacy',()=>fixture(async({sql,p,propias,sembrar,aplicar})=>{
 const [c]=await sql`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id,senal) values (${p.id},${propias[0].id},${propias[1].id},'hdmi') returning *`;
 await sql.unsafe(readFileSync(new URL('../db/migraciones/2026-09-rosetas-conexiones.sql',import.meta.url),'utf8'));
 await aplicar();await sembrar();assert.equal((await sql`select * from plantilla_conexiones`).length,1);
 assert.ok((await sql`select * from plantilla_tiradas_documentales`).every(d=>d.conexion_resuelta_id===null));
 await assert.rejects(sql`update plantilla_tiradas_documentales set conexion_resuelta_id=${c.id} where fuente_clave='tirada-001'`,/conexion completa/);
 assert.equal((await sql`select detalle_extremos from plantilla_conexiones where id=${c.id}`)[0].detalle_extremos,'legacy');
},true));
await test('Siembra completa actual funciona y conserva cuatro fuentes sin crear cables',()=>fixture(async({sql})=>{
 await sql.unsafe(readFileSync(new URL('../db/seed.sql',import.meta.url),'utf8'));
 assert.equal((await sql`select * from plantilla_tiradas_documentales`).length,4);
 assert.equal((await sql`select * from plantilla_conexiones`).length,0);
 const antes=Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`);
 await sql.unsafe(readFileSync(new URL('../db/seed.sql',import.meta.url),'utf8'));
 assert.deepEqual(Array.from(await sql`select * from plantilla_tiradas_documentales order by fuente_clave`),antes);
}));
