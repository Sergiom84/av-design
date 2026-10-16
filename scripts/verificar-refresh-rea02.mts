/** Repro focal del refresh RSC: sólo usa una identidad sintética propia. */
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { chromium,expect,type Page } from '@playwright/test';
import { comprobarUrlRevisiones,URL_REA_PRUEBA } from './rea02-fixture.mjs';
import { COOKIE_SESION,firmarSesion } from '../src/lib/sesion';
const salida=resolve('output/rea-integracion/rea02/correccion-revision');
const fase=process.env.REA02_FASE??'green';
if(!['red','green'].includes(fase))throw new Error('Fase inválida.');
assert.equal(process.env.REA_DATABASE_URL,URL_REA_PRUEBA);
comprobarUrlRevisiones(process.env.REA_DATABASE_URL!);
const c=postgres(process.env.REA_DATABASE_URL!,{max:2,onnotice:()=>{}});
const [identidad]=await c`select current_database() base,current_user rol,inet_server_port() puerto`;
assert.equal(identidad.base,'av_design_rea02_prueba');assert.equal(identidad.rol,'av_design_rea02');assert.equal(identidad.puerto,5432);
const usuario='d2000000-0000-4000-8000-000000008001';
const origen='http://localhost:3112';
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;let liberarPendiente=()=>{};
const resultados:{identidad:unknown;casos:Record<string,unknown>[];eventos?:Record<string,unknown>[];error?:string}={identidad,casos:[]};
async function retenerRefresh(page:Page,metodo:'PUT'|'DELETE'){
 let mutacionRespondida=false;
 const respuesta=(r:import('@playwright/test').Response)=>{if(new URL(r.url()).pathname==='/api/preferencias'&&r.request().method()===metodo&&r.status()===200)mutacionRespondida=true;};
 page.on('response',respuesta);
 let liberar:()=>void=()=>{},recibida:()=>void=()=>{};
 const retenida=new Promise<void>(r=>liberar=r),inicio=new Promise<void>(r=>recibida=r);let pendiente=true;
 await page.route('**/*',async route=>{const req=route.request();if(pendiente&&mutacionRespondida&&req.headers()['next-router-prefetch']!=='1'&&req.method()==='GET'&&new URL(req.url()).pathname==='/'&&req.headers()['rsc']==='1'){pendiente=false;recibida();await retenida;}await route.continue();});
 return {inicio,liberar:()=>{page.off('response',respuesta);liberar();}};
}
try{
 await mkdir(salida,{recursive:true});
 await c`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo) values(${usuario},'rea02-refresh-ejecutor','REA02 refresh ejecutor','lectura','SINTETICO-SIN-LOGIN',false,true)`;
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([{name:COOKIE_SESION,value:await firmarSesion('rea02-local-prueba-integracion-secreto-2026',Date.now()+3600000,usuario),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();resultados.eventos=[];
 page.on('request',r=>{const url=new URL(r.url());if(url.pathname==='/'||url.pathname==='/api/preferencias')resultados.eventos!.push({tipo:'peticion',metodo:r.method(),ruta:url.pathname,rsc:r.headers()['rsc']??null,prefetch:r.headers()['next-router-prefetch']??null});});
 page.on('response',r=>{const url=new URL(r.url());if(url.pathname==='/'||url.pathname==='/api/preferencias')resultados.eventos!.push({tipo:'respuesta',metodo:r.request().method(),ruta:url.pathname,status:r.status()});});
 await page.goto(origen+'/');
 for(const accion of ['guardar','restablecer']as const){
  const retencion=await retenerRefresh(page,accion==='guardar'?'PUT':'DELETE');liberarPendiente=retencion.liberar;
  const campo=page.getByLabel(accion==='guardar'?'Cargas abiertas':'Pedidos en curso',{exact:true});
  if(accion==='guardar')await page.getByRole('button',{name:'Bajar Equipos en catálogo',exact:true}).click();
  await page.getByRole('button',{name:accion==='guardar'?'Guardar preferencias':'Restablecer Panel',exact:true}).click();await Promise.race([retencion.inicio,new Promise<never>((_,rechazar)=>{const timer=setTimeout(()=>rechazar(new Error('No llegó el GET RSC posterior al200 en30s.')),30000);timer.unref();})]);
  const mensaje=accion==='guardar'?'Preferencias guardadas.':'Preferencias restablecidas.';
  await expect(page.getByRole('status')).toHaveText(mensaje,{timeout:20000});await campo.uncheck();
  const antes={marcada:await campo.isChecked(),mensaje:await page.getByRole('status').textContent()};
  await page.screenshot({path:resolve(salida,`${fase}-${accion}-rsc-pendiente.png`),fullPage:true});
  retencion.liberar();await page.waitForLoadState('networkidle');
  if(accion==='guardar')await expect(page.locator('[data-tarjeta]').first()).toHaveAttribute('data-tarjeta','cables');
  else await expect(page.locator('[data-tarjeta]')).toHaveCount(9);
  const despues={marcada:await campo.isChecked(),mensaje:await page.getByRole('status').textContent()};
  resultados.casos.push({accion,antes,despues});
  await page.screenshot({path:resolve(salida,`${fase}-${accion}-rsc-recibido.png`),fullPage:true});
  assert.equal(despues.marcada,false,'El refresh RSC no puede borrar la nueva edición local.');
  assert.equal(despues.mensaje,mensaje,'El refresh RSC conserva el mensaje accesible confirmado.');
  await page.getByRole('button',{name:'Guardar preferencias',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Preferencias guardadas.',{timeout:20000});
  const r=await context.request.get(origen+'/api/preferencias?grupo=panel');expect(r.status()).toBe(200);const p=await r.json();
  assert.equal(p.version,accion==='guardar'?2:4,'La siguiente escritura usa la versión CAS confirmada.');
  assert(p.valor.ocultas.includes(accion==='guardar'?'cargas':'pedidos'));
  resultados.casos[resultados.casos.length-1].segundaEscritura={version:p.version,ocultas:p.valor.ocultas};
  await page.unroute('**/*');await page.waitForLoadState('networkidle');
 }
 console.log('2 casos UI: guardar y restablecer con GET RSC retenido, borrador/mensaje preservados y segunda escritura CAS correcta.');
}catch(e){resultados.error=e instanceof Error?e.message:String(e);throw e;}
finally{
 await writeFile(resolve(salida,`${fase}-ui.json`),JSON.stringify(resultados,null,2));
 liberarPendiente();await browser?.close();
 await c`delete from usuarios where id=${usuario}`;
 assert.equal((await c`select id from usuarios where id=${usuario}`).length,0);
 await c.end();
}
