import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,cpSync,copyFileSync,mkdtempSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import postgres from 'postgres';
const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);assert.ok(args.every(x=>['--plan','--sin-version-capacidad','--sin-manual-copia','--sin-pendientes','--sin-manual-formulario','--sin-catalogo-formulario'].includes(x)));
console.log('Solo qa_servidor_rosetas_<UUID> propias en 127.0.0.1:5433.');if(args.includes('--plan'))process.exit(0);
const nombre='qa_servidor_rosetas_'+randomUUID().replaceAll('-',''),base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice:()=>{}});let sql,creada=false,copia;
try{
 await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres(base+nombre,{max:1,onnotice:()=>{}});
 await sql.unsafe(readFileSync(join(raiz,'db/schema.sql'),'utf8'));await sql.unsafe(readFileSync(join(raiz,'db/seed.sql'),'utf8'));
 let cwd=raiz;
 if(args.length){
  copia=mkdtempSync(join(tmpdir(),'av-rosetas-servidor-'));cwd=copia;
  cpSync(join(raiz,'src'),join(copia,'src'),{recursive:true});cpSync(join(raiz,'scripts'),join(copia,'scripts'),{recursive:true});
  for(const p of ['package.json','tsconfig.json'])copyFileSync(join(raiz,p),join(copia,p));
  symlinkSync(join(raiz,'node_modules'),join(copia,'node_modules'),'junction');
  if(args.includes('--sin-version-capacidad')){const p=join(copia,'src/app/acciones.ts');const s=readFileSync(p,'utf8');assert.ok(s.includes('if(Number(sala.diagrama_version)!==version)return'));writeFileSync(p,s.replace('if(Number(sala.diagrama_version)!==version)return','if(false)return'));}
  if(args.includes('--sin-manual-copia')){const p=join(copia,'src/lib/copiar-conexiones.ts');const s=readFileSync(p,'utf8');assert.ok(s.includes('${c.longitud_manual_m}'));writeFileSync(p,s.replaceAll('${c.longitud_manual_m}','${null}'));}
  if(args.includes('--sin-pendientes')){const p=join(copia,'src/lib/copiar-conexiones.ts');const s=readFileSync(p,'utf8');assert.ok(s.includes('if(pendientes.length)'));writeFileSync(p,s.replace('if(pendientes.length)','if(false)'));}
  if(args.includes('--sin-manual-formulario')){const p=join(copia,'src/app/acciones.ts');const s=readFileSync(p,'utf8');const antes='if(entrada!==null&&(manual===null||manual<=0))';assert.ok(s.includes(antes));writeFileSync(p,s.replace(antes,'if(false)'));}
  if(args.includes('--sin-catalogo-formulario')){const p=join(copia,'src/app/acciones.ts');const s=readFileSync(p,'utf8');assert.ok(s.includes('if(cableId){'));writeFileSync(p,s.replace('if(cableId){','if(false){'));}
 }
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-servidor-rosetas.mts'],{cwd,encoding:'utf8',timeout:180000,env:{...process.env,DATABASE_URL:base+nombre,SESION_SECRETO:'',NODE_ENV:'test'}});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{
 if(sql)await sql.end();if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('Eliminada',nombre);}await admin.end();
 if(copia){const fuera=relative(resolve(tmpdir()),resolve(copia));assert.ok(fuera&&!fuera.startsWith('..')&&!resolve(copia).endsWith('node_modules'));unlinkSync(join(copia,'node_modules'));rmSync(copia,{recursive:true,force:true});}
}
