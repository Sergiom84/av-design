import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {exigirBloqueEquivalente} from './bloques-schema.mjs';
import {leerComposiciones,sqlComposiciones} from './sql-composiciones.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const flags=['--plan','--sin-unido-extremo','--sin-incluido-fk','--sin-unicidad','--sin-tipo-libre'];
assert.ok(args.every(a=>flags.includes(a)));
console.log('QA exclusiva qa_cables_UUID en 127.0.0.1:5433, sin .env ni av_design compartida.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_cables_'+randomUUID().replaceAll('-',''),base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql;
const salida=join(raiz,'output',`plan40-l3c-${new Date().toISOString().slice(0,10).replaceAll('-','')}`);
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;
 sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8');
 const migracion=readFileSync(join(raiz,'db/migraciones/2026-09-cables-suministrados.sql'),'utf8');
 exigirBloqueEquivalente(esquema,migracion,'CABLES SUMINISTRADOS L3C','db/migraciones/2026-09-cables-suministrados.sql');
 const bloque=/-- BEGIN CABLES SUMINISTRADOS L3C[\s\S]*?-- END CABLES SUMINISTRADOS L3C/;
 await sql.unsafe(esquema.replace(bloque,''));
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Historico L3C') returning id`;
 const [b]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Historico L3C b') returning id`;
 const [sala]=await sql`insert into salas(nombre) values('Legado cables') returning id`;
 const [e1]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad) values(${sala.id},${a.id},'A',1) returning id`;
 const [e2]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad) values(${sala.id},${b.id},'B',1) returning id`;
 const [p1]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${a.id},'LAN','bidireccional','red',1,'app') returning id`;
 const [p2]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${b.id},'LAN','bidireccional','red',1,'app') returning id`;
 const c=await sql.begin(async tx=>{
  const [n]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal,longitud_manual_m)
   values(${sala.id},${e1.id},${e2.id},${p1.id},${p2.id},'red',12) returning *`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal)
   values(${n.id},'origen',${e1.id},${p1.id},1),(${n.id},'destino',${e2.id},${p2.id},1)`;
  return n;
 });
 await sql.unsafe(migracion);
 await sql.unsafe(migracion);
 const [despues]=await sql`select estado_suministro,decision_heredada,cable_suministrado_id from conexiones where id=${c.id}`;
 assert.equal(despues.estado_suministro,'adicional');
 assert.equal(despues.decision_heredada,true);
 assert.equal(despues.cable_suministrado_id,null);
 assert.equal((await sql`select count(*)::int n from sala_cables_suministrados`)[0].n,0);
 await sql.unsafe(esquema);
 const [otraVez]=await sql`select estado_suministro,decision_heredada from conexiones where id=${c.id}`;
 assert.equal(otraVez.estado_suministro,'adicional');assert.equal(otraVez.decision_heredada,true);
 console.log('Upgrade poblado, repeticion y equivalencia schema: legado adicional heredado, cero cables inventados.');
 await sql.unsafe(readFileSync(join(raiz,'db/seed.sql'),'utf8'));
 await sql.unsafe(sqlComposiciones(leerComposiciones(readFileSync(join(raiz,'data/composiciones.csv'),'utf8'))));
 const cambiar=async(nombreFn,antes,despues)=>{
  const [f]=await sql`select pg_get_functiondef(${nombreFn}::regprocedure) texto`;
  assert.equal(f.texto.split(antes).length,2,`No se encontró el ancla causal en ${nombreFn}`);
  await sql.unsafe(f.texto.replace(antes,despues));
 };
 if(args.includes('--sin-unido-extremo')){
  await cambiar('comprobar_cable_unido_en_conexion()','raise exception \'el cable unido exige el extremo fijo en la conexion\' using errcode=\'23514\';','null;');
 }
 if(args.includes('--sin-incluido-fk')){
  await sql.unsafe('alter table conexiones drop constraint if exists conexiones_estado_suministro_fk');
 }
 if(args.includes('--sin-unicidad')){
  await sql.unsafe('drop index if exists conexiones_cable_suministrado_unico');
 }
 if(args.includes('--sin-tipo-libre')){
  await sql.unsafe('alter table sala_cables_suministrados drop constraint if exists cable_tipo_extremos');
  await cambiar('proteger_cable_suministrado()','raise exception \'Un cable libre exige extremos nulos\' using errcode=\'23514\';','null;');
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-cables-suministrados.mts'],{
  cwd:raiz,encoding:'utf8',timeout:300000,env:{...process.env,DATABASE_URL:base+nombre,NODE_ENV:'test',SESION_SECRETO:''},
 });
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');
 mkdirSync(salida,{recursive:true});
 const etiqueta=args.filter(a=>a!=='--plan').map(a=>a.slice(2)).join('+')||'completo';
 writeFileSync(join(salida,`runner-${etiqueta}.log`),`exit=${r.status}\n${r.stdout??''}\n${r.stderr??''}`);
 if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{
 if(sql)await sql.end();
 if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}
 await admin.end();
}
