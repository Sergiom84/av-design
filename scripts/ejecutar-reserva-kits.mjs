import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {esquemaAnteriorA,exigirBloqueEquivalente} from './bloques-schema.mjs';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);assert.ok(args.every(a=>['--plan','--sin-cota','--sin-vinculo','--sin-idempotencia','--sin-entrada-temprana'].includes(a)));
console.log('QA exclusiva qa_reserva_UUID en 127.0.0.1:5433, sin .env.');if(args.includes('--plan'))process.exit(0);
const nombre='qa_reserva_'+randomUUID().replaceAll('-',''),base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql,copia,modulo;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres(base+nombre,{max:1,onnotice(){}});
 const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8'),migracion=readFileSync(join(raiz,'db/migraciones/2026-09-reserva-kits.sql'),'utf8');
 const bloque=/-- BEGIN RESERVA KITS B2B[\s\S]*?-- END RESERVA KITS B2B/;
 exigirBloqueEquivalente(esquema,migracion,'RESERVA KITS B2B','db/migraciones/2026-09-reserva-kits.sql');
 // «Antes de B2b» retira B2b y lo que se apoya en ella (B2c usa sus tablas).
 const previo=esquemaAnteriorA(esquema,'RESERVA KITS B2B',{
  'ROSETAS CONEXIONES L2B':false,'TIRADAS DOCUMENTALES L2B':false,'SUMINISTROS KIT L3A':false,
  'ATRIBUCIONES SUMINISTRO L3B':false,'RECEPCION KITS B2A':false,'RESERVA KITS B2B':true,'CARGA KITS B2C':true,
  'ETIQUETAS CABLE GENERADAS':false,'REVISION DISENO L5':false,'CABLES SUMINISTRADOS L3C':false});
 assert.doesNotMatch(previo,bloque);
 await sql.unsafe(previo);
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Historico deficit') returning id`;
 const [m]=await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',-3) returning *`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA') returning id`;
 await sql.unsafe(migracion);
 // Reaplicar también limpia la ampliación descartada en el ensayo local.
 await sql.unsafe('create trigger aa_control_statement before insert or update or delete on sala_equipos for each statement execute function entrar_escritura_kit()');
 await sql.unsafe('create trigger aa_control_fila before insert or update or delete on sala_equipos for each row execute function entrar_escritura_kit()');
 await sql.unsafe(migracion);await sql.unsafe(esquema);
 assert.equal((await sql`select count(*)::int n from pg_trigger where tgrelid='sala_equipos'::regclass and tgname in('aa_control_statement','aa_control_fila')`)[0].n,0);
 assert.deepEqual((await sql`select * from movimientos where id=${m.id}`)[0],m);
 assert.equal((await sql`select count(*)::int n from articulos_stock_kit where articulo_id=${a.id}`)[0].n,1);
 assert.equal(Number((await sql`select disponible_stock_kit(${a.id}) d`)[0].d),-3);
 console.log('Upgrade negativo conserva historial, perimetro y repeticion correctos.',c.id);
 const cambiar=async(nombre,antes,despues)=>{const [f]=await sql`select pg_get_functiondef(${nombre}::regprocedure) texto`;
  assert.equal(f.texto.split(antes).length,2);await sql.unsafe(f.texto.replace(antes,despues));};
 if(args.includes('--sin-cota')){
  await cambiar('preparar_operacion_reserva()','if new.disponible_previo<1 then','if false then');
  await cambiar('materializar_operacion_reserva()','or disponible_stock_kit(new.articulo_id)<0','');
  await cambiar('validar_deficit_stock()','if greatest(0,-disponible_stock_kit(b.articulo_id))>greatest(0,-b.disponible) then','if false then');
 }
 if(args.includes('--sin-vinculo'))await cambiar('proteger_logistica_kit()',"if tg_table_name='reservas' then","if tg_table_name='reservas' then return new; end if;\n if tg_table_name='reservas' then");
 if(args.includes('--sin-entrada-temprana')){
  const tablas=await sql`select tgrelid::regclass::text tabla from pg_trigger where tgname='aa_control_statement'`;
  assert.ok(tablas.length>0);for(const t of tablas)await sql.unsafe(`drop trigger aa_control_statement on ${t.tabla}`);
 }
 if(args.includes('--sin-idempotencia')){
  copia=mkdtempSync(join(tmpdir(),'av-b2b-causal-'));
  let fuente=readFileSync(join(raiz,'src/lib/operaciones-reserva.ts'),'utf8');
  const objetivo='  const solicitud=';assert.equal(fuente.split(objetivo).length,2);
  fuente=fuente.replace(objetivo,'  entrada={...entrada,operacionId:globalThis.crypto.randomUUID()};\n'+objetivo);
  for(const archivo of ['control-escritura','operaciones-compras'])fuente=fuente.replace(`'./${archivo}'`,JSON.stringify(pathToFileURL(join(raiz,`src/lib/${archivo}.ts`)).href));
  const archivo=join(copia,'operaciones-reserva.ts');writeFileSync(archivo,fuente);modulo=pathToFileURL(archivo).href;
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-reserva-kits.mts'],{cwd:raiz,encoding:'utf8',timeout:240000,
  env:{...process.env,DATABASE_URL:base+nombre,NODE_ENV:'test',SESION_SECRETO:'',...(modulo?{RESERVA_MODULO:modulo}:{})}});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){assert.equal(dirname(realpathSync(copia)),realpathSync(tmpdir()));assert.ok(basename(copia).startsWith('av-b2b-causal-'));rmSync(copia,{recursive:true});}}
