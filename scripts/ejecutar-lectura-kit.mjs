import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdtempSync,symlinkSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);assert.ok(args.every(a=>['--plan','--read-committed','--sin-reuso'].includes(a)));
console.log('Nueve fixtures propias qa_lectura_kit_<UUID> en 127.0.0.1:5433, seriales; sin .env.');
if(args.includes('--plan'))process.exit(0);
let cwd=raiz,copia,enlace=false;
try{
 if(args.includes('--read-committed')||args.includes('--sin-reuso')){
  copia=mkdtempSync(join(tmpdir(),'av-lectura-kit-'));cwd=copia;
  for(const carpeta of ['src','scripts','db'])cpSync(join(raiz,carpeta),join(copia,carpeta),{recursive:true});
  for(const fichero of ['package.json','tsconfig.json'])cpSync(join(raiz,fichero),join(copia,fichero));
  symlinkSync(join(raiz,'node_modules'),join(copia,'node_modules'),'junction');enlace=true;
  if(args.includes('--read-committed')){
   const p=join(copia,'src/lib/datos.ts'),s=readFileSync(p,'utf8');
   assert.equal(s.split('isolation level repeatable read read only').length,2);
   writeFileSync(p,s.replace('isolation level repeatable read read only','isolation level read committed read only'));
  }
  if(args.includes('--sin-reuso')){
   const p=join(copia,'src/app/salas/[id]/datos-ficha.ts'),s=readFileSync(p,'utf8');
   assert.equal(s.split('faltaParaSala(id, completa)').length,2);
   writeFileSync(p,s.replace('faltaParaSala(id, completa)','faltaParaSala(id)'));
  }
 }
 let fallos=0;
 for(const lector of ['sala','ficha','logistica'])for(const punto of ['equipos','suministros','componentes']){
  const r=spawnSync(process.execPath,['--import','tsx','scripts/verificar-lectura-kit.mts',lector,punto],{cwd,encoding:'utf8',timeout:30000,env:{...process.env,DATABASE_URL:'',SESION_SECRETO:'',NODE_ENV:'test'}});
  console.log(`CASO ${lector}/${punto} exit=${r.status}`);process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');
  if(r.error)throw r.error;if(r.status!==0)fallos++;
 }
 console.log(`RESULTADO casos=9 fallos=${fallos}`);process.exitCode=fallos?1:0;
}finally{
 if(copia){const fuera=relative(resolve(tmpdir()),resolve(copia));assert.ok(fuera&&!fuera.startsWith('..'));if(enlace)unlinkSync(join(copia,'node_modules'));rmSync(copia,{recursive:true,force:true});}
}
