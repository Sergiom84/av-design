import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,cpSync,mkdtempSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(a=>['--plan','--sin-bloqueo-filas','--sin-bloqueo-mutacion'].includes(a)));
console.log('Solo qa_copia_documental_<UUID> propia en 127.0.0.1:5433; sin .env.');
if(args.includes('--plan'))process.exit(0);
const nombre='qa_copia_documental_'+randomUUID().replaceAll('-','');
const base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});let creada=false,sql,copia,enlace=false;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;
 sql=postgres(base+nombre,{max:1,onnotice(){}});
 await sql.unsafe(readFileSync(join(raiz,'db/schema.sql'),'utf8'));
 let cwd=raiz;
 if(args.length){
  copia=mkdtempSync(join(tmpdir(),'av-copia-documental-'));cwd=copia;
  for(const carpeta of ['src','scripts'])cpSync(join(raiz,carpeta),join(copia,carpeta),{recursive:true});
  for(const fichero of ['package.json','tsconfig.json'])cpSync(join(raiz,fichero),join(copia,fichero));
  symlinkSync(join(raiz,'node_modules'),join(copia,'node_modules'),'junction');enlace=true;
  if(args.includes('--sin-bloqueo-filas')){
   const p=join(copia,'src/lib/copiar-conexiones.ts');const s=readFileSync(p,'utf8');
   const lineas=s.split('\n');const quitadas=lineas.filter(l=>l.trimStart().startsWith('await tx`select id from'));
   assert.equal(quitadas.length,3);
   writeFileSync(p,lineas.filter(l=>!quitadas.includes(l)).join('\n'));
  }
  if(args.includes('--sin-bloqueo-mutacion')){
   const p=join(copia,'src/app/acciones.ts');const s=readFileSync(p,'utf8');
   const punto='select id from plantillas_sala where id=${fila.plantilla_id} for update';
   assert.equal(s.split(punto).length,2);writeFileSync(p,s.replace(punto,'select id from plantillas_sala where id=${fila.plantilla_id}'));
  }
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-copia-documental.mts'],{
  cwd,encoding:'utf8',timeout:90000,env:{...process.env,DATABASE_URL:base+nombre,SESION_SECRETO:'',NODE_ENV:'test'},
 });
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{
 if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){const fuera=relative(resolve(tmpdir()),resolve(copia));assert.ok(fuera&&!fuera.startsWith('..'));if(enlace)unlinkSync(join(copia,'node_modules'));rmSync(copia,{recursive:true,force:true});}
}
