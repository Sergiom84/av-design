import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,cpSync,mkdtempSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {esquemaAnteriorA} from './bloques-schema.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(a=>['--plan','--sin-exclusion'].includes(a)));
console.log('Solo qa_suministros_<UUID> propia en 127.0.0.1:5433; sin .env ni base compartida.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_suministros_'+randomUUID().replaceAll('-','');
const base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql,copia,enlace=false;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;
 sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8');
 const bloque=/-- BEGIN SUMINISTROS KIT L3A[\s\S]*?-- END SUMINISTROS KIT L3A/;
 assert.match(esquema,bloque);
 // Upgrade poblado: todas las tablas anteriores, sin ninguna relación L3A.
 // «Antes de L3A» retira L3A y lo que se apoya en ella; la clasificación se
 // declara aquí y `esquemaAnteriorA` la contrasta con el SQL real, así que un
 // bloque nuevo detiene la prueba en vez de recortarse en silencio.
 const previo=esquemaAnteriorA(esquema,'SUMINISTROS KIT L3A',{
  'ROSETAS CONEXIONES L2B':false,'TIRADAS DOCUMENTALES L2B':false,'SUMINISTROS KIT L3A':true,
  'ATRIBUCIONES SUMINISTRO L3B':true,'RECEPCION KITS B2A':true,'RESERVA KITS B2B':true,'CARGA KITS B2C':true,
  'ETIQUETAS CABLE GENERADAS':false,'REVISION DISENO L5':false,'CABLES SUMINISTRADOS L3C':true});
 assert.doesNotMatch(previo,bloque);
 await sql.unsafe(previo);
 const [historico]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Historico anterior L3A') returning id`;
 const [sala]=await sql`insert into salas(nombre) values ('Historica anterior L3A') returning id`;
 const [equipo]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad,x_m,y_m,z_m,posicion_confirmada) values (${sala.id},${historico.id},'Historico preservado',3,0,0,0,true) returning *`;
 for(let i=0;i<2;i++)await sql.unsafe(readFileSync(join(raiz,'db/migraciones/2026-09-suministros-kit.sql'),'utf8'));
 assert.deepEqual((await sql`select * from sala_equipos where id=${equipo.id}`)[0],equipo);
 assert.equal((await sql`select count(*)::int n from sala_suministros`)[0].n,0);
 console.log('Upgrade poblado y repeticion: equipo historico cantidad3 y XYZ0 intactos; cero conversiones.');
 // Reaplicar el esquema completo comprueba equivalencia migración/proyección.
 await sql.unsafe(esquema);
 await sql.unsafe(readFileSync(join(raiz,'db/seed.sql'),'utf8'));
 await sql.unsafe(readFileSync(join(raiz,'db/migraciones/2026-09-suministros-kit.sql'),'utf8'));
 let cwd=raiz;
 if(args.includes('--sin-exclusion')){
  copia=mkdtempSync(join(tmpdir(),'av-suministros-'));cwd=copia;
  for(const carpeta of ['src','scripts','db','data'])cpSync(join(raiz,carpeta),join(copia,carpeta),{recursive:true});
  for(const fichero of ['package.json','tsconfig.json'])cpSync(join(raiz,fichero),join(copia,fichero));
  symlinkSync(join(raiz,'node_modules'),join(copia,'node_modules'),'junction');enlace=true;
  const p=join(copia,'src/lib/suministros.ts'),s=readFileSync(p,'utf8');
  const punto='equipos.filter((e) => !vinculados.has(e.id))';assert.equal(s.split(punto).length,2);
  writeFileSync(p,s.replace(punto,'equipos.filter(() => true)'));
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-suministros.mts'],{
  cwd,encoding:'utf8',timeout:120000,env:{...process.env,DATABASE_URL:base+nombre,SESION_SECRETO:'',NODE_ENV:'test'},
 });
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{
 if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){const fuera=relative(resolve(tmpdir()),resolve(copia));assert.ok(fuera&&!fuera.startsWith('..'));if(enlace)unlinkSync(join(copia,'node_modules'));rmSync(copia,{recursive:true,force:true});}
}
