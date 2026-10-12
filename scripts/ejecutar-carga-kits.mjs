import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {exigirBloqueEquivalente} from './bloques-schema.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(a=>['--plan','--sin-completitud','--sin-vinculo','--sin-idempotencia','--sin-entrada-temprana','--sin-marca','--sin-rr'].includes(a)));
console.log('QA exclusiva qa_carga_UUID en 127.0.0.1:5433, sin .env.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_carga_'+randomUUID().replaceAll('-',''),base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql,copia,modulo;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8'),migracion=readFileSync(join(raiz,'db/migraciones/2026-09-carga-kits.sql'),'utf8');
 const bloque=/-- BEGIN CARGA KITS B2C[\s\S]*?-- END CARGA KITS B2C/;
 // Con `?? ''` en los dos lados, dos ausencias se comparaban iguales: el bloque
 // podía desaparecer de los dos ficheros y el assert seguía pasando.
 exigirBloqueEquivalente(esquema,migracion,'CARGA KITS B2C','db/migraciones/2026-09-carga-kits.sql');
 await sql.unsafe(esquema.replace(bloque,''));
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Historico deficit') returning id`;
 const [m]=await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',-3) returning *`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA') returning id`;
 const [sala]=await sql`insert into salas(nombre) values('Legado carga') returning id`;
 const [carga]=await sql`insert into cargas(sala_id,nombre,estado) values(${sala.id},'Carga histórica', 'preparacion') returning *`;
 const [linea]=await sql`insert into carga_lineas(carga_id,articulo_id,cantidad,cargado) values(${carga.id},${a.id},2,false) returning *`;
 await sql.unsafe(migracion);
 await sql.unsafe(migracion);
 await sql.unsafe(esquema);
 assert.deepEqual((await sql`select * from movimientos where id=${m.id}`)[0],m);
 assert.equal((await sql`select count(*)::int n from articulos_stock_kit where articulo_id=${a.id}`)[0].n,1);
 assert.equal(Number((await sql`select disponible_stock_kit(${a.id}) d`)[0].d),-3);
 const [cargaDespues]=await sql`select * from cargas where id=${carga.id}`;
 const [lineaDespues]=await sql`select * from carga_lineas where id=${linea.id}`;
 assert.equal(cargaDespues.nombre,carga.nombre);assert.equal(cargaDespues.estado,'preparacion');
 assert.equal(Number(lineaDespues.cantidad),2);assert.equal(lineaDespues.cargado,false);
 assert.equal((await sql`select count(*)::int n from operaciones_carga_kit`)[0].n,0);
 console.log('Upgrade poblado conserva historial, carga legado y repeticion correctos.',c.id);
 const cambiar=async(nombreFn,antes,despues)=>{const [f]=await sql`select pg_get_functiondef(${nombreFn}::regprocedure) texto`;
  assert.equal(f.texto.split(antes).length,2,`No se encontró el ancla causal en ${nombreFn}`);await sql.unsafe(f.texto.replace(antes,despues));};
 if(args.includes('--sin-completitud')){
  await cambiar('comprobar_operacion_carga(operaciones_carga_kit)','if c.id is null or l.id is null or r.id is null then raise exception \'Operacion de carga incompleta\' using errcode=\'23514\'; end if;','null;');
 }
 if(args.includes('--sin-vinculo'))await cambiar('proteger_logistica_kit()',"elsif tg_table_name='cargas' then","elsif tg_table_name='cargas' then return new;");
 if(args.includes('--sin-marca'))await cambiar('preparar_operacion_carga()','if not l.cargado then raise exception \'Marca la linea antes de confirmar la salida\' using errcode=\'23514\'; end if;','null;');
 if(args.includes('--sin-entrada-temprana')){
  const tablas=await sql`select tgrelid::regclass::text tabla from pg_trigger where tgname='aa_control_statement'`;
  assert.ok(tablas.length>0);for(const t of tablas)await sql.unsafe(`drop trigger aa_control_statement on ${t.tabla}`);
 }
 if(args.includes('--sin-idempotencia')){
  copia=mkdtempSync(join(tmpdir(),'av-b2c-causal-'));
  let fuente=readFileSync(join(raiz,'src/lib/operaciones-carga.ts'),'utf8');
  const objetivo='  const solicitud=canonica(entrada);';assert.equal(fuente.split(objetivo).length,2);
  fuente=fuente.replace(objetivo,'  entrada={...entrada,operacionId:globalThis.crypto.randomUUID()};\n'+objetivo);
  for(const archivo of ['control-escritura','operaciones-compras'])fuente=fuente.replace(`'./${archivo}'`,JSON.stringify(pathToFileURL(join(raiz,`src/lib/${archivo}.ts`)).href));
  const archivo=join(copia,'operaciones-carga.ts');writeFileSync(archivo,fuente);modulo=pathToFileURL(archivo).href;
 }
 const env={...process.env,DATABASE_URL:base+nombre,NODE_ENV:'test',SESION_SECRETO:'',
  ...(modulo?{CARGA_MODULO:modulo}:{}),
  ...(args.includes('--sin-rr')?{CARGA_LECTOR_AISLAMIENTO:'read committed'}:{})};
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-carga-kits.mts'],{cwd:raiz,encoding:'utf8',timeout:300000,env});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){assert.equal(dirname(realpathSync(copia)),realpathSync(tmpdir()));assert.ok(basename(copia).startsWith('av-b2c-causal-'));rmSync(copia,{recursive:true});}}
