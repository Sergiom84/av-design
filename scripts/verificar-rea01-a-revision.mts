/** Regresiones deterministas de los seis hallazgos. No lee .env.local. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { conectarRevisiones } from './rea01-fixture.mjs';
import { construirEscena } from '../src/lib/croquis';
import { entradaDePlantilla } from '../src/lib/plantilla-preview';
import { COOKIE_SESION,firmarSesion } from '../src/lib/sesion';
import { convertirLongitud,textoEnUnidad } from '../src/lib/longitudes';

if(!process.env.REA_DATABASE_URL)throw new Error('REA_DATABASE_URL explícita obligatoria.');
const db=await conectarRevisiones(process.env.REA_DATABASE_URL);
process.env.DATABASE_URL=process.env.REA_DATABASE_URL;process.env.SESION_SECRETO='';
const mod=Module as unknown as {_load:(r:string,...args:unknown[])=>unknown},old=mod._load;
mod._load=(r,...args)=>r==='server-only'?{}:r==='next/cache'?{revalidatePath:()=>{}}:old.call(Module,r,...args);
const {aplicarPlantillaAlDiagrama}=await import('../src/app/acciones-diagrama');
const {crearSala}=await import('../src/app/acciones');
const {obtenerPlantillaPreview}=await import('../src/lib/datos-plantillas');
const {obtenerDatosPlanoSala}=await import('../src/lib/datos-plano');
const f=JSON.parse(await readFile(resolve('output/rea-integracion/rea01/a/fixture.json'),'utf8'));
const salida=resolve('output/rea-integracion/rea01/a/correccion-revision/green');await mkdir(salida,{recursive:true});
const prefijo=`REA01 corrección ${Date.now().toString(36)}`;
const resultados:Array<{caso:string;ok:true;detalle:unknown}>=[];
async function caso(nombre:string,fn:()=>Promise<unknown>){const detalle=await fn();resultados.push({caso:nombre,ok:true,detalle:detalle??null});console.log('OK',nombre,JSON.stringify(detalle??null));}
async function esperando(pid:number){for(let n=0;n<200;n++){const[b]=await db`select exists(select 1 from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))) esperando`;if(b.esperando)return;await new Promise(r=>setTimeout(r,15));}throw new Error('La operación no llegó al cerrojo determinista.');}
async function nuevaObra(){const p=randomUUID(),l=randomUUID(),s=randomUUID();await db.begin(async tx=>{await tx`insert into proyectos(id,nombre)values(${p},${prefijo+' '+p})`;await tx`insert into localizaciones(id,proyecto_id,nombre)values(${l},${p},'Sintética corrección')`;await tx`insert into salas(id,localizacion_id,nombre,largo_m,ancho_m,alto_m)values(${s},${l},${prefijo+' '+s},6,4,3)`;await tx`insert into hitos_proyecto(proyecto_id,tipo)values(${p},'inicio')`;});return{p,l,s};}
async function fotoSala(id:string){const datos:Record<string,unknown>={};for(const t of ['salas','sala_equipos','sala_mobiliario','tomas_red','puertas','conexiones'])datos[t]=await db.unsafe(`select to_jsonb(t) fila from ${t} t where ${t==='salas'?'id':'sala_id'}=$1 order by id`,[id]);datos.puntos=await db`select to_jsonb(p) fila from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id where c.sala_id=${id} order by p.id`;return JSON.parse(JSON.stringify(datos));}
try{
  await caso('cierre-ya-posee-sala-aplicar-espera-y-rechaza',async()=>{
    const x=await nuevaObra(),v=(await obtenerPlantillaPreview(f.plantilla))!,antes=await fotoSala(x.s),lock=await db.reserve();
    await lock`begin`;const[{pid}]=await lock`select pg_backend_pid()pid`;await lock`select id from salas where id=${x.s} for update`;
    const operacion=aplicarPlantillaAlDiagrama(x.s,f.plantilla,0,v.huella);await esperando(Number(pid));
    await lock`insert into hitos_proyecto(proyecto_id,tipo)values(${x.p},'cierre')`;await lock`commit`;lock.release();
    const r=await operacion;assert.equal(r.ok,false);if(!r.ok)assert.equal(r.motivo,'cerrado');assert.deepEqual(await fotoSala(x.s),antes);return{resultado:r,esperaDemostrada:true};
  });
  await caso('alta-espera-proyecto-y-no-nace-despues-del-cierre',async()=>{
    const x=await nuevaObra(),v=(await obtenerPlantillaPreview(f.plantilla))!,lock=await db.reserve();await lock`begin`;
    const[{pid}]=await lock`select pg_backend_pid()pid`;await lock`select id from salas where id=${x.s} for update`;await lock`select id from proyectos where id=${x.p} for update`;
    const nombre=prefijo+' alta rechazada',d=new FormData();for(const[k,z]of Object.entries({nombre,localizacion_id:x.l,plantilla_id:f.plantilla,huella_plantilla:v.huella,unidad_dimensiones:'m',entrada_largo:6.1,entrada_ancho:4.57,entrada_alto:3.05}))d.set(k,String(z));
    const operacion=crearSala({error:null},d);await esperando(Number(pid));await lock`insert into hitos_proyecto(proyecto_id,tipo)values(${x.p},'cierre')`;await lock`commit`;lock.release();
    const r=await operacion;assert.match(r.error!,/cerrada/);assert.equal((await db`select id from salas where nombre=${nombre}`).length,0);return{resultado:r,esperaDemostrada:true};
  });
  await caso('modificar-origen-durante-copia-rechaza-y-deshace-todas-las-piezas',async()=>{
    const s=randomUUID(),clave=Number.parseInt(s.slice(0,8),16),funcion='rea01_revision_'+s.replaceAll('-','');
    await db`insert into salas(id,nombre)values(${s},${prefijo+' origen'})`;const antes=await fotoSala(s),v=(await obtenerPlantillaPreview(f.plantilla))!,lock=await db.reserve();
    try{
      await db.unsafe(`create function ${funcion}() returns trigger language plpgsql as $$begin if new.sala_id='${s}'::uuid then perform pg_advisory_xact_lock(${clave}::bigint); end if; return new; end$$`);
      await db.unsafe(`create trigger ${funcion} before insert on sala_equipos for each row execute function ${funcion}()`);
      const[{pid}]=await lock`select pg_backend_pid()pid`;await lock`select pg_advisory_lock(${clave}::bigint)`;
      const operacion=aplicarPlantillaAlDiagrama(s,f.plantilla,0,v.huella);await esperando(Number(pid));
      await db`update plantilla_articulos set modelo_texto=${prefijo+' modificación concurrente'},cantidad=3 where id=${f.linea}`;
      await lock`select pg_advisory_unlock(${clave}::bigint)`;
      const r=await operacion;assert.equal(r.ok,false);if(!r.ok)assert.equal(r.motivo,'conflicto');assert.deepEqual(await fotoSala(s),antes);return{resultado:r,esperaDemostrada:true};
    }finally{await lock`select pg_advisory_unlock_all()`;lock.release();await db.unsafe(`drop trigger if exists ${funcion} on sala_equipos`);await db.unsafe(`drop function if exists ${funcion}()`);}
  });
  await caso('preview-efectivo-aforos4-cero-null-y-silla-manual-unica',async()=>{
    await db`update catalogo_mobiliario set rol=null where id=${f.silla}`;const filas=[];
    for(const aforo of [4,0,null]){
      const s=randomUUID();await db`insert into salas(id,nombre,aforo)values(${s},${prefijo+' aforo '+String(aforo)},${aforo})`;
      const v=(await obtenerPlantillaPreview(f.plantilla))!,pre=construirEscena(entradaDePlantilla(v,{aforo}));assert.equal((await aplicarPlantillaAlDiagrama(s,f.plantilla,0,v.huella)).ok,true);
      const real=(await obtenerDatosPlanoSala(s))!;assert.equal(real.sala.aforo,aforo);assert.equal(construirEscena(real).sillas.length,pre.sillas.length);filas.push({aforo,sillas:pre.sillas.length});
    }
    await db`update catalogo_mobiliario set rol='asiento' where id=${f.silla}`;const s=randomUUID();await db`insert into salas(id,nombre,aforo)values(${s},${prefijo+' manual'},4)`;
    const v=(await obtenerPlantillaPreview(f.plantilla))!;assert.equal((await aplicarPlantillaAlDiagrama(s,f.plantilla,0,v.huella)).ok,true);const real=(await obtenerDatosPlanoSala(s))!;assert.equal(real.muebles.length,1);assert.equal(construirEscena(real).sillas.length,0);return filas;
  });
  await caso('maximo-sql-ida-vuelta-y-limite-estricto',async()=>{const t=textoEnUnidad(9999.99,'ft');assert.equal(convertirLongitud(t,'ft')!.metrosPersistidos,9999.99);assert.throws(()=>convertirLongitud('9999.99001','m'));return{pies:t};});

  // Fixture física propia para demostrar que una reducción no mueve nada.
  const sala=randomUUID(),e=randomUUID(),otro=randomUUID(),c=randomUUID();
  await db.begin(async tx=>{
    await tx`insert into salas(id,nombre,largo_m,ancho_m,alto_m,mesa_largo_m,mesa_ancho_m,mesa_x_m,mesa_y_m,diagrama_iniciado_en,diagrama_origen)values(${sala},${prefijo+' navegador'},6,4,3,1,1,5,3,now(),'desde_cero')`;
    await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)values(${e},${sala},${f.articulo},'Medido al borde','pared',5.5,1,1,true),(${otro},${sala},${f.articulo},'Otro equipo','pared',1,1,1,true)`;
    await tx`insert into sala_mobiliario(sala_id,mobiliario_id,nombre,forma,largo_m,ancho_m,x_m,y_m,z_m,posicion_confirmada)values(${sala},${f.silla},'Mueble medido','circulo',.5,.5,5,2,0,true)`;
    await tx`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m)values(${sala},'Roseta medida',5,3,1)`;
    await tx`insert into puertas(sala_id,pared,posicion_m,anchura_m,altura_m)values(${sala},'sur',5,.8,2)`;
    await tx`insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal)values(${c},${sala},${e},${otro},${f.cable},'hdmi')`;
    await tx`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m)values(${c},0,5.2,1,2)`;
  });
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({baseURL:'http://localhost:3111',viewport:{width:1440,height:1000}}),page=await context.newPage();
    await context.addCookies([{name:COOKIE_SESION,value:await firmarSesion('rea01-local-prueba-integracion-secreto-2026',Date.now()+3600000,f.admin),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
    await caso('escritorio-invalido-bloquea-boton-y-atajo-sin-guardar-ultimo-valido',async()=>{
      await page.goto(`/salas/${sala}/plano`);const input=page.getByLabel('Largo (m)',{exact:true}).filter({visible:true}),boton=page.getByRole('button',{name:'Guardar cambios',exact:true});const antes=await fotoSala(sala);
      await input.fill('7');await boton.waitFor({state:'visible'});assert.equal(await boton.isEnabled(),true);await input.fill('-2');assert.equal(await boton.isDisabled(),true);await input.press('Control+s');await page.waitForTimeout(150);assert.deepEqual(await fotoSala(sala),antes);assert.equal(await input.inputValue(),'-2');await page.screenshot({path:resolve(salida,'escritorio-invalido.png'),fullPage:true});return{sinEscrituras:true};
    });
    await caso('escritorio-reducir-recinto-no-mueve-ninguna-medida-fisica',async()=>{
      const antes=await fotoSala(sala);await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');
      // Primero se corrige la entrada inválida: cambiar unidad nunca la borra.
      await page.getByLabel('Largo (m)',{exact:true}).filter({visible:true}).fill('6');await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('10');
      await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByText(/fuera de la sala/).first().waitFor();assert.deepEqual(await fotoSala(sala),antes);await page.screenshot({path:resolve(salida,'escritorio-recinto-rechazado.png'),fullPage:true});return{equipoX:5.5,mesaX:5,muebleX:5,rosetaX:5,puerta:5,rutaX:5.2,sinEscrituras:true};
    });
    await caso('api-sin-cookie-json401-no-store-y-pagina-con-redirect',async()=>{
      await context.clearCookies();const estados=[];for(const ruta of ['/api/plantillas',`/api/plantillas/${f.plantilla}`,'/api/catalogo','/api/documentos','/api/importacion']){const r=await context.request.get(ruta,{maxRedirects:0});assert.equal(r.status(),401);assert.deepEqual(await r.json(),{error:'Sin sesión.'});assert.equal(r.headers()['cache-control'],'no-store');estados.push({ruta,estado:r.status()});}assert.equal((await context.request.get('/salas',{maxRedirects:0})).status(),307);return estados;
    });
    await caso('movil-final-mismos-controles-sin-desbordamiento',async()=>{
      await context.addCookies([{name:COOKIE_SESION,value:await firmarSesion('rea01-local-prueba-integracion-secreto-2026',Date.now()+3600000,f.admin),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);await page.setViewportSize({width:390,height:844});await page.goto(`/salas/${sala}/plano`);await page.locator('summary').filter({hasText:'Medidas de la sala'}).click();await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(salida,'movil-final.png'),fullPage:true});return{ancho:390};
    });
  }finally{await browser.close();}
  await writeFile(resolve(salida,'resultados.json'),JSON.stringify({prefijo,resultados},null,2));console.log(`${resultados.length}/${resultados.length} regresiones aprobadas.`);
}finally{await db.end();await global.__sql?.end();}
