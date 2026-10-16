/** Gate de lectura del mismo corte y adaptador antes/después del restart; no cambia fuente histórica. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {COOKIE_SESION,firmarSesion} from '../src/lib/sesion';
import {conectarRevisiones,URL_REA_PRUEBA} from './rea05-costes-fixture.mjs';
import {sha256} from '../src/lib/costes/servicio';
assert.equal(process.env.REA05_COSTES_DATABASE_URL,URL_REA_PRUEBA);process.env.DATABASE_URL=URL_REA_PRUEBA;
const fase=process.argv.find(x=>x.startsWith('--fase='))?.slice(7);assert(fase==='antes'||fase==='despues');const dir=resolve('output/rea-integracion/rea05/costes-correccion');
const ui=JSON.parse(await readFile(resolve(dir,'chrome-3-final/durabilidad-ids.json'),'utf8')) as {corteNuevo:string;usuario:string};
const puntero=JSON.parse(await readFile(resolve(dir,'sql-actual.json'),'utf8'));const sql=JSON.parse(await readFile(resolve(puntero.dir,'fixture.json'),'utf8')) as {admin:string;corteExcluido:string;legacyAdmin:string;legacyCorte:string};
const require=createRequire(import.meta.url),Module=require('node:module'),original=Module._load;Module._load=function(id:string,...a:unknown[]){return id==='server-only'?{}:original.call(this,id,...a);};
const {leerCorteParaPropuesta}=await import('../src/lib/costes/adaptador-propuestas');
const c=await conectarRevisiones(URL_REA_PRUEBA);
try{const resultados=[];for(const dato of[{id:ui.corteNuevo,usuario:ui.usuario},{id:sql.corteExcluido,usuario:sql.admin},{id:sql.legacyCorte,usuario:sql.legacyAdmin}]){const [bd]=await c`select snapshot,sha256 from coste_cortes where id=${dato.id}`;const cookie=await firmarSesion('rea05-costes-local-prueba-integracion-2026',Date.now()+3600000,dato.usuario);const r=await fetch('http://localhost:3117/api/costes/cortes/'+dato.id,{headers:{Cookie:COOKIE_SESION+'='+cookie}});assert.equal(r.status,200);const body=await r.json() as {sha256:string;snapshot:unknown};assert.equal(body.sha256,bd.sha256);assert.equal(sha256(body.snapshot),sha256(bd.snapshot));const adapter=await c.begin('isolation level repeatable read read only',tx=>leerCorteParaPropuesta(tx,dato.usuario,dato.id));assert.equal(adapter.seleccion.exclusiones.length,4);resultados.push({id:dato.id,hash:body.sha256,snapshot:body.snapshot,adapter,cacheControl:r.headers.get('cache-control')});}if(fase==='despues')assert.deepEqual(resultados,JSON.parse(await readFile(resolve(dir,'durabilidad-antes.json'),'utf8')).resultados);const salida=resolve(dir,'durabilidad-'+fase+'.json');await writeFile(salida,JSON.stringify({fase,fecha:new Date().toISOString(),resultados},null,2));console.log(JSON.stringify({salida,cortes:resultados.map(r=>({id:r.id,hash:r.hash,exclusiones:r.adapter.seleccion.exclusiones.length})),iguales:fase==='despues'}));}finally{await c.end();}
