import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {esquemaAnteriorA,exigirBloqueEquivalente} from './bloques-schema.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(a=>['--plan','--sin-reparto','--sin-transaccion','--sin-idempotencia','--sin-destino-pedido'].includes(a)));
console.log('Destino exclusivo qa_recepcion_UUID en 127.0.0.1:5433; no carga .env.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_recepcion_'+randomUUID().replaceAll('-','');
const base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql,copia;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8');
 const bloque=/-- BEGIN RECEPCION KITS B2A[\s\S]*?-- END RECEPCION KITS B2A/;
 const migracion=readFileSync(join(raiz,'db/migraciones/2026-09-recepcion-kits.sql'),'utf8');
 exigirBloqueEquivalente(esquema,migracion,'RECEPCION KITS B2A','db/migraciones/2026-09-recepcion-kits.sql');
 // «Antes de B2a» retira B2a y lo que se apoya en ella (B2b y, tras ella, B2c).
 const previo=esquemaAnteriorA(esquema,'RECEPCION KITS B2A',{
  'ROSETAS CONEXIONES L2B':false,'TIRADAS DOCUMENTALES L2B':false,'SUMINISTROS KIT L3A':false,
  'ATRIBUCIONES SUMINISTRO L3B':false,'RECEPCION KITS B2A':true,'RESERVA KITS B2B':true,'CARGA KITS B2C':true,
  'ETIQUETAS CABLE GENERADAS':false,'REVISION DISENO L5':false,'CABLES SUMINISTRADOS L3C':false});
 assert.doesNotMatch(previo,bloque);
 await sql.unsafe(previo);
 const [p]=await sql`insert into pedidos(referencia) values('Historico upgrade') returning id`;
 const [t]=await sql`insert into recepciones_compra(id,pedido_id,solicitud) values(${randomUUID()},${p.id},'{}') returning *`;
 await sql.unsafe(migracion);await sql.unsafe(migracion);await sql.unsafe(esquema);
 const [despues]=await sql`select * from recepciones_compra where id=${t.id}`;
 for(const k of Object.keys(t))assert.deepEqual(despues[k],t[k]);
 assert.equal(despues.protocolo,'legacy');assert.equal(despues.transaccion,null);
 console.log('Upgrade token poblado, repetición y equivalencia schema correctos.');
 if(args.includes('--sin-reparto')){
  const [f]=await sql`select pg_get_functiondef('materializar_linea_recepcion()'::regprocedure) texto`;
  const objetivo='for e in select value from jsonb_array_elements(new.reparto_esperado) loop';
  assert.equal(f.texto.split(objetivo).length,2);
  await sql.unsafe(f.texto.replace(objetivo,"for e in select value from jsonb_array_elements('[]'::jsonb) loop"));
 }
 if(args.includes('--sin-transaccion')){
  const [f]=await sql`select pg_get_functiondef('preparar_token_recepcion()'::regprocedure) texto`;
  const objetivo="new.transaccion=pg_current_xact_id();";
  assert.equal(f.texto.split(objetivo).length,2);await sql.unsafe(f.texto.replace(objetivo,'new.transaccion=null;'));
 }
 let modulo;
 if(args.includes('--sin-destino-pedido')){
  const [f]=await sql`select pg_get_functiondef('exigir_movimiento_pedido_sin_kits(uuid)'::regprocedure) texto`;
  const objetivo='if pedido_tiene_kits(actual.id) then';
  assert.equal(f.texto.split(objetivo).length,2);
  await sql.unsafe(f.texto.replace(objetivo,'if false then'));
 }
 if(args.includes('--sin-idempotencia')){
  copia=mkdtempSync(join(tmpdir(),'av-b2a-causal-'));
  const fuente=readFileSync(join(raiz,'src/lib/operaciones-compras.ts'),'utf8');
  const objetivo='const pedido = await bloquearPedidoCompra(tx, entrada.pedidoId);';assert.equal(fuente.split(objetivo).length,2);
  const archivo=join(copia,'operaciones-compras.ts');writeFileSync(archivo,fuente.replace(objetivo,objetivo+'\n    entrada.recepcionId=globalThis.crypto.randomUUID();').replace("'./control-escritura'",JSON.stringify(pathToFileURL(join(raiz,'src/lib/control-escritura.ts')).href)));
  modulo=pathToFileURL(archivo).href;
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-recepcion-kits.mts'],{cwd:raiz,encoding:'utf8',timeout:240000,
  env:{...process.env,DATABASE_URL:base+nombre,SESION_SECRETO:'',NODE_ENV:'test',...(modulo?{RECEPCION_MODULO:modulo}:{})}});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{
 if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){assert.equal(dirname(realpathSync(copia)),realpathSync(tmpdir()));assert.ok(basename(copia).startsWith('av-b2a-causal-'));rmSync(copia,{recursive:true});}
}
