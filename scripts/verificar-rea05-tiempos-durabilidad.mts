import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firmarSesion, COOKIE_SESION } from '../src/lib/sesion';
import { conectarRevisiones, URL_REA_PRUEBA, SALIDA_TIEMPOS, SECRETO_TIEMPOS, idTR } from './rea05-tiempos-fixture.mjs';
assert.equal(process.env.REA_DATABASE_URL,URL_REA_PRUEBA);
const c=await conectarRevisiones(process.env.REA_DATABASE_URL!);
const cookie=await firmarSesion(SECRETO_TIEMPOS,Date.now()+3600000,idTR(2));
const ruta=resolve(SALIDA_TIEMPOS,'durabilidad-antes.json');
try{
 const previo=process.argv.includes('--despues')?JSON.parse(await readFile(ruta,'utf8')):null;
 const id=previo?.id??(await c`select id from tiempo_registros where titular_usuario_id=${idTR(2)} order by creado_en desc,id limit 1`)[0].id;
 const r=await fetch('http://localhost:3115/api/tiempos/registros/'+id+'/historial',{headers:{Cookie:COOKIE_SESION+'='+cookie}});assert.equal(r.status,200);const respuesta=await r.json();delete respuesta.solicitudId;
 const texto=JSON.stringify(respuesta),sha256=createHash('sha256').update(texto).digest('hex');
 if(previo)assert.equal(sha256,previo.sha256);
 await writeFile(resolve(SALIDA_TIEMPOS,previo?'durabilidad-despues.json':'durabilidad-antes.json'),JSON.stringify({id,sha256,bytes:Buffer.byteLength(texto),respuesta},null,2));
 console.log(JSON.stringify({etapa:previo?'despues':'antes',id,sha256,bytes:Buffer.byteLength(texto),identico:previo?true:undefined}));
}finally{await c.end();}
