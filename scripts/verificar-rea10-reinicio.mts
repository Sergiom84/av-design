/** Muerte real del dueño del parser: IPC y locks de sesión no quedan huérfanos. */
import assert from 'node:assert/strict';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import PDFDocument from 'pdfkit';
import {conectarRevisiones,idRequisito,SALIDA_REVISIONES,comprobarUrlRevisiones} from './rea10-fixture.mjs';import {conCuotaParser} from '../src/lib/requisitos/extraccion';import {extraerPdfLocal} from '../src/lib/requisitos/parser';
const url=process.env.REA10_DATABASE_URL;if(!url)throw Error('URL sintética explícita obligatoria');comprobarUrlRevisiones(url);
if(process.argv.includes('--hijo')){
 const db=await conectarRevisiones(url);process.on('message',async(m:{base64:string})=>{await conCuotaParser(db,idRequisito(3),async()=>{process.send?.({tomado:true});await extraerPdfLocal(Buffer.from(m.base64,'base64'));});await db.end();process.exit(0);});
}else{
 await mkdir(SALIDA_REVISIONES,{recursive:true});const bytes=await new Promise<Buffer>(res=>{const d=new PDFDocument({size:[4096,792]}),b:Buffer[]=[];d.on('data',c=>b.push(c));d.on('end',()=>res(Buffer.concat(b)));for(let i=0;i<60;i++){if(i)d.addPage();d.fontSize(.1).text('x'.repeat(18000),10,10,{lineBreak:false});}d.end();});
 const hijo=spawn(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),fileURLToPath(import.meta.url),'--hijo'],{env:{NODE_ENV:'test',PATH:process.env.PATH,REA10_DATABASE_URL:url,REA10_SALIDA:resolve(SALIDA_REVISIONES,'hijo'),NODE_OPTIONS:'--require='+resolve('output/rea-integracion/rea05/tiempos-runtime/sin-env.cjs')},stdio:['ignore','ignore','ignore','ipc']});
 const cerrar=new Promise<{codigo:number|null;senal:string|null}>(res=>hijo.once('close',(codigo,senal)=>res({codigo,senal})));const tomado=new Promise<void>((res,rej)=>{hijo.once('message',()=>res());hijo.once('error',rej);});hijo.send({base64:bytes.toString('base64')});await tomado;
 // El mensaje anterior se emite sólo al tomar cuota; la recepción se arma antes del envío.
 let parserPid:number|undefined;const ps=promisify(execFile);
 for(let i=0;i<100;i++){const {stdout}=await ps('/bin/ps',['-axo','pid=,ppid=,comm=']);for(const l of stdout.trim().split('\n')){const m=/^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(l);if(m&&Number(m[2])===hijo.pid&&m[3].includes('node'))parserPid=Number(m[1]);}if(parserPid)break;await new Promise(r=>setTimeout(r,2));}
 assert.ok(parserPid,'Proceso parser hijo real localizado');hijo.kill('SIGKILL');const salida=await cerrar;assert.equal(salida.senal,'SIGKILL');let vivo=true;for(let i=0;i<200;i++){try{process.kill(parserPid,0);}catch{vivo=false;break;}await new Promise(r=>setTimeout(r,10));}assert.equal(vivo,false,'El parser termina al perder IPC con su dueño');
 const db=await conectarRevisiones(url);try{await conCuotaParser(db,idRequisito(3),async()=>{});}finally{await db.end();}
 await writeFile(resolve(SALIDA_REVISIONES,'resultado.json'),JSON.stringify({estado:'PASS',propietarioPid:hijo.pid,parserPid,propietario:salida,parserTerminado:true,cuotaReutilizableTrasCaida:true},null,2));console.log('PASS caída SIGKILL del dueño, parser termina y cuota reutilizable tras nueva conexión');
}
