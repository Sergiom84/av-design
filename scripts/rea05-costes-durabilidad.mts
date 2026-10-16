/** Mismo corte por HTTP antes/después de reiniciar3117. Sólo lectura en5559. */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COOKIE_SESION,firmarSesion } from '../src/lib/sesion';
import { conectarRevisiones,URL_REA_PRUEBA } from './rea05-costes-fixture.mjs';
import { sha256 } from '../src/lib/costes/servicio';
assert.equal(process.env.REA05_COSTES_DATABASE_URL,URL_REA_PRUEBA);
const fase=process.argv.find(v=>v.startsWith('--fase='))?.slice(7);assert(['antes','despues'].includes(fase??''));
const dato=JSON.parse(await readFile(resolve('output/rea-integracion/rea05/costes-runtime/ultima-fixture.json'),'utf8')) as {fixture:{admin:string};cortes:{real:string}};
const c=await conectarRevisiones(URL_REA_PRUEBA);
try {
 const [bd]=await c`select sha256,snapshot from coste_cortes where id=${dato.cortes.real}`;
 const cookie=await firmarSesion('rea05-costes-local-prueba-integracion-2026',Date.now()+3600000,dato.fixture.admin);
 const response=await fetch('http://localhost:3117/api/costes/cortes/'+dato.cortes.real,{headers:{Cookie:COOKIE_SESION+'='+cookie}});
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);
 const body=await response.json() as {id:string;sha256:string;snapshot:unknown};assert.equal(body.sha256,bd.sha256);assert.equal(sha256(body.snapshot),sha256(bd.snapshot));
 const resultado={fase,id:body.id,hash:body.sha256,snapshotSha256:sha256(body.snapshot),instante:new Date().toISOString(),estado:response.status,cacheControl:response.headers.get('cache-control')};
 if(fase==='despues'){const archivo=process.argv.find(v=>v.startsWith('--anterior='))?.slice(11);assert(archivo);const anterior=JSON.parse(await readFile(archivo,'utf8'));assert.equal(resultado.id,anterior.id);assert.equal(resultado.hash,anterior.hash);assert.equal(resultado.snapshotSha256,anterior.snapshotSha256);}
 const destino=resolve('output/rea-integracion/rea05/costes-runtime','durabilidad-'+fase+'-'+Date.now()+'.json');await writeFile(destino,JSON.stringify(resultado,null,2));console.log(JSON.stringify({destino,...resultado}));
}finally{await c.end();}
