import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {esquemaAnteriorA,exigirBloqueEquivalente} from './bloques-schema.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(a=>['--plan','--sin-cota-padre'].includes(a)));
console.log('Solo qa_atribuciones_UUID propia en 127.0.0.1:5433, sin .env ni base compartida.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_atribuciones_'+randomUUID().replaceAll('-','');
const base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;
 sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8');
 const bloque=/-- BEGIN ATRIBUCIONES SUMINISTRO L3B[\s\S]*?-- END ATRIBUCIONES SUMINISTRO L3B/;
 const migracion=readFileSync(join(raiz,'db/migraciones/2026-09-atribuciones-suministro.sql'),'utf8');
 exigirBloqueEquivalente(esquema,migracion,'ATRIBUCIONES SUMINISTRO L3B','db/migraciones/2026-09-atribuciones-suministro.sql');
 // El upgrade parte de antes de L3B: tampoco puede cargar B2a/B2b/B2c, cuyas FK
 // referencian las atribuciones que esta prueba aún no ha migrado.
 const previo=esquemaAnteriorA(esquema,'ATRIBUCIONES SUMINISTRO L3B',{
  'ROSETAS CONEXIONES L2B':false,'TIRADAS DOCUMENTALES L2B':false,'SUMINISTROS KIT L3A':false,
  'ATRIBUCIONES SUMINISTRO L3B':true,'RECEPCION KITS B2A':true,'RESERVA KITS B2B':true,'CARGA KITS B2C':true,
  'ETIQUETAS CABLE GENERADAS':false,'REVISION DISENO L5':false,'CABLES SUMINISTRADOS L3C':false});
 assert.doesNotMatch(previo,bloque);
 await sql.unsafe(previo);
 const [s]=await sql`insert into salas(nombre) values('Anterior B1') returning id`;
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Anterior B1') returning id`;
 const [r]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${a.id},2) returning *`;
 await sql.unsafe(migracion);await sql.unsafe(migracion);await sql.unsafe(esquema);
 assert.deepEqual((await sql`select * from reservas where id=${r.id}`)[0],r);
 assert.equal((await sql`select count(*)::int n from reserva_suministros`)[0].n,0);
 console.log('Upgrade poblado, repetición y equivalencia schema: reserva intacta, cero atribuciones implícitas.');
 if(args.includes('--sin-cota-padre')){
  const [funcion]=await sql`select pg_get_functiondef('comprobar_atribuciones_de_suministro(uuid)'::regprocedure) texto`;
  const original='(select sum(cantidad) from reserva_suministros where reserva_id=r.id)>r.cantidad';
  assert.equal(funcion.texto.split(original).length,2);
  await sql.unsafe(funcion.texto.replace(original,'false'));
  console.log('Mutante solo en BD UUID propia: cota de cantidad del padre reserva retirada.');
 }
 const rtest=spawnSync(process.execPath,['--import','tsx','scripts/verificar-atribuciones.mts'],{cwd:raiz,encoding:'utf8',timeout:180000,
  env:{...process.env,DATABASE_URL:base+nombre,SESION_SECRETO:'',NODE_ENV:'test'}});
 process.stdout.write(rtest.stdout??'');process.stderr.write(rtest.stderr??'');if(rtest.error)throw rtest.error;process.exitCode=rtest.status??1;
}finally{
 if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
}
