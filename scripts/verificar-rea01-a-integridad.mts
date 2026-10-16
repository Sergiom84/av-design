/** Integridad física y de cierre. Único destino admitido: fixture5552. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { conectarRevisiones } from './rea01-fixture.mjs';
import { borradorDesde,cambiarMedidasSala,construirPatch,type PatchPlano } from '../src/lib/plano-editor';
import { COOKIE_SESION,firmarSesion } from '../src/lib/sesion';
if(!process.env.REA_DATABASE_URL)throw new Error('REA_DATABASE_URL explícita obligatoria.');
const db=await conectarRevisiones(process.env.REA_DATABASE_URL);
process.env.DATABASE_URL=process.env.REA_DATABASE_URL;process.env.SESION_SECRETO='';
const mod=Module as unknown as {_load:(r:string,...args:unknown[])=>unknown},old=mod._load;
mod._load=(r,...args)=>r==='server-only'?{}:r==='next/cache'?{revalidatePath:()=>{}}:old.call(Module,r,...args);
const {guardarDiagramaSala}=await import('../src/app/acciones-diagrama');
const {crearSala}=await import('../src/app/acciones');
const {registrarHitoProyecto}=await import('../src/app/acciones-ciclo');
const {asignarSalaALocalizacion}=await import('../src/app/acciones-proyectos');
const {obtenerDatosPlanoSala}=await import('../src/lib/datos-plano');
const {leerDiseno,duplicarSalaDiseno}=await import('../src/lib/revisiones-diseno-repositorio');
const f=JSON.parse(await readFile(resolve('output/rea-integracion/rea01/a/fixture.json'),'utf8'));
const salida=resolve('output/rea-integracion/rea01/a/integridad-final/green');await mkdir(salida,{recursive:true});
const prefijo=`REA01 integridad ${Date.now().toString(36)}`,tecnico=randomUUID();
await db`insert into tecnicos(id,nombre,fuente)values(${tecnico},${prefijo+' TEI'},'app')`;await db`insert into tecnico_roles(tecnico_id,rol)values(${tecnico},'inicio')`;
const form=(valores:Record<string,unknown>)=>{const d=new FormData();for(const[k,v]of Object.entries(valores))if(v!=null)d.set(k,String(v));return d;};
const dims={unidad_dimensiones:'m',entrada_largo:6,entrada_ancho:4,entrada_alto:3};
const hito=(id:string)=>form({proyecto_id:id,tipo:'cierre',tecnico_id:tecnico,notas:'Nota original que debe sobrevivir al reintento',fecha:'2026-10-15'});
const resultados:Array<{caso:string;ok:true;detalle:unknown}>=[];
async function caso(nombre:string,fn:()=>Promise<unknown>){const detalle=await fn();resultados.push({caso:nombre,ok:true,detalle:detalle??null});console.log('OK',nombre,JSON.stringify(detalle??null));}
async function sala(){const id=randomUUID();await db`insert into salas(id,nombre,largo_m,ancho_m,alto_m,diagrama_iniciado_en,diagrama_origen)values(${id},${prefijo+' '+id},6,4,3,now(),'desde_cero')`;return id;}
async function obra(){const p=randomUUID(),l=randomUUID();await db`insert into proyectos(id,nombre)values(${p},${prefijo+' obra '+p})`;await db`insert into localizaciones(id,proyecto_id,nombre)values(${l},${p},'Sintética')`;await db`insert into hitos_proyecto(proyecto_id,tipo)values(${p},'inicio')`;return{p,l};}
async function patch(id:string){const real=(await obtenerDatosPlanoSala(id))!,b=borradorDesde(real.sala,real.equipos,real.tomas,real.muebles,real.puertas);return construirPatch(id,real.sala.diagrama_version,b,cambiarMedidasSala(b,{largo_m:3.05}));}
async function foto(id:string){const datos:Record<string,unknown>={};for(const t of ['salas','sala_equipos','sala_mobiliario','tomas_red','puertas','conexiones'])datos[t]=await db.unsafe(`select to_jsonb(t)fila from ${t} t where ${t==='salas'?'id':'sala_id'}=$1 order by id`,[id]);datos.puntos=await db`select to_jsonb(p)fila from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id where c.sala_id=${id} order by p.id`;return JSON.parse(JSON.stringify(datos));}
async function rechaza(id:string,p:PatchPlano){const antes=await foto(id),r=await guardarDiagramaSala(p);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.motivo,'fuera');assert.deepEqual(await foto(id),antes);}
async function espera(pid:number){for(let n=0;n<250;n++){if((await db`select exists(select 1 from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid)))espera`)[0].espera)return;await new Promise(r=>setTimeout(r,15));}throw new Error('No se demostró espera de cerrojo '+pid);}
const maxTiempo=<T,>(p:Promise<T>)=>Promise.race([p,new Promise<never>((_,r)=>{const t=setTimeout(()=>r(new Error('Las operaciones no terminaron; posible ciclo de locks.')),15_000);t.unref();})]);
try{
  for(const tipo of ['equipo','mueble','toma','mesa','puerta','ruta'] as const)await caso('geometría-aislada-'+tipo,async()=>{
    const id=await sala(),obj=randomUUID();
    if(tipo==='equipo')await db`insert into sala_equipos(id,sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)values(${obj},${id},${f.articulo},'Equipo único confirmado','pared',5.5,1,1,true)`;
    if(tipo==='mueble')await db`insert into sala_mobiliario(id,sala_id,mobiliario_id,nombre,forma,largo_m,ancho_m,x_m,y_m,z_m,posicion_confirmada)values(${obj},${id},${f.silla},'Mueble único','rectangulo',.5,.5,5.5,1,0,true)`;
    if(tipo==='toma')await db`insert into tomas_red(id,sala_id,codigo,x_m,y_m,z_m)values(${obj},${id},'Toma única',5.5,1,1)`;
    if(tipo==='mesa')await db`update salas set mesa_x_m=5.5,mesa_y_m=1,mesa_largo_m=1,mesa_ancho_m=1 where id=${id}`;
    if(tipo==='puerta')await db`insert into puertas(id,sala_id,pared,posicion_m,anchura_m,altura_m)values(${obj},${id},'sur',5,.8,2)`;
    if(tipo==='ruta'){
      const uno=randomUUID(),dos=randomUUID();await db`insert into sala_equipos(id,sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)values(${uno},${id},${f.articulo},'Origen','pared',1,1,1,true),(${dos},${id},${f.articulo},'Destino','pared',2,1,1,true)`;
      await db`insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal)values(${obj},${id},${uno},${dos},${f.cable},'hdmi')`;await db`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m)values(${obj},0,5.5,1,1)`;
    }
    const p=await patch(id);assert.equal(p.equipos.length,0);assert.equal(p.mobiliario_cambio.length,0);assert.equal(p.tomas.length,0);await rechaza(id,p);
    if(tipo==='equipo')p.equipos=[{id:obj,x_m:2,y_m:1,z_m:1,posicion_confirmada:true,rotacion_grados:0}];
    if(tipo==='mueble')p.mobiliario_baja=[obj];
    if(tipo==='toma')p.tomas=[{id:obj,x_m:2,y_m:1,z_m:1}];
    if(tipo==='mesa')p.sala!.mesa_x_m=2;
    if(tipo==='puerta')p.puertas_baja=[obj];
    if(tipo==='ruta')p.rutas_cambio=[{conexion_id:obj,puntos:[]}];
    assert.equal((await guardarDiagramaSala(p)).ok,true);assert.equal(Number((await db`select largo_m from salas where id=${id}`)[0].largo_m),3.05);
    return{id,omitidoRechazado:true,movimientoOBajaPermitido:true};
  });
  await caso('altas-fuera-rechazadas-y-ausencias-no-se-inventan',async()=>{
    const id=await sala(),p=await patch(id),obj=randomUUID();p.equipos_alta=[{id:obj,articulo_id:f.articulo,extremo:'pared',x_m:5.5,y_m:1,z_m:1,posicion_confirmada:true,rotacion_grados:0}];await rechaza(id,p);p.equipos_alta[0].x_m=0;assert.equal((await guardarDiagramaSala(p)).ok,true);
    const ausente=await sala();await db`update salas set sillas_modo='manuales' where id=${ausente}`;await db`insert into sala_equipos(sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)values(${ausente},${f.articulo},'Estimado','pared',5.5,1,1,false)`;
    await db`insert into sala_mobiliario(sala_id,mobiliario_id,nombre,forma,x_m,y_m,z_m,posicion_confirmada)values(${ausente},${f.silla},'Sin situar','rectangulo',null,null,null,false)`;await db`insert into tomas_red(sala_id,codigo)values(${ausente},'Sin situar')`;
    assert.equal((await guardarDiagramaSala(await patch(ausente))).ok,true);assert.equal((await db`select posicion_confirmada from sala_equipos where sala_id=${ausente}`)[0].posicion_confirmada,false);assert.equal((await db`select x_m from tomas_red where sala_id=${ausente}`)[0].x_m,null);return{ceroConfirmado:true,ausenciaConservada:true};
  });
  await caso('altas-mueble-y-puerta-se-validan-aisladas',async()=>{
    const s=await sala(),m=await patch(s);m.mobiliario_alta=[{id:randomUUID(),mobiliario_id:f.silla,nombre:'Mueble alta',forma:'rectangulo',largo_m:.5,ancho_m:.5,alto_m:null,x_m:5.5,y_m:1,z_m:0,rotacion_grados:0,posicion_confirmada:true,orden:100}];m.sillas_modo='manuales';await rechaza(s,m);m.mobiliario_alta[0].x_m=0;assert.equal((await guardarDiagramaSala(m)).ok,true);
    const t=await sala(),p=await patch(t);p.puertas_alta=[{id:randomUUID(),pared:'sur',posicion_m:5,anchura_m:.8,altura_m:2,orden:100}];await rechaza(t,p);p.puertas_alta[0].posicion_m=1;assert.equal((await guardarDiagramaSala(p)).ok,true);return{fueraRechazado:true,altasValidas:true};
  });

  // Se intercalan altas REALES justo antes de pedir proyecto para comprobar
  // el reintento acotado. El proxy sólo programa esta carrera en este proceso;
  // todas las consultas, transacciones y rollbacks son del Postgres real.
  for(const interferencias of [2,3])await caso('reintento-completo-'+interferencias,async()=>{
    const x=await obra(),original=global.__sql!;let intercaladas=0,inyectando=false;
    global.__sql=new Proxy(original,{get(target,prop,receptor){
      if(prop!=='begin')return Reflect.get(target,prop,receptor);
      return (...args:unknown[])=>{const cb=args.at(-1) as (tx:unknown)=>Promise<unknown>;const opciones=args.slice(0,-1);
        return Reflect.apply(target.begin,target,[...opciones,(tx:CallableFunction)=>cb(new Proxy(tx,{apply(t,este,a){
          if(Array.isArray(a[0]) && 'raw'in a[0] && a[0].join('').includes('select id from proyectos where id=') && a.includes(x.p) && !inyectando && intercaladas<interferencias){
            return(async()=>{inyectando=true;intercaladas++;try{await crearSala({error:null},form({...dims,nombre:prefijo+' intercalada '+randomUUID(),localizacion_id:x.l}));}catch(e){if(!String((e as {digest?:string}).digest).startsWith('NEXT_REDIRECT'))throw e;}finally{inyectando=false;}return Reflect.apply(t,este,a);})();
          }return Reflect.apply(t,este,a);
        }}))]);};
    }}) as typeof original;
    let resultado;try{resultado=await registrarHitoProyecto(hito(x.p));}finally{global.__sql=original;}
    const cierres=await db`select tecnico_id,fecha::text,notas from hitos_proyecto where proyecto_id=${x.p} and tipo='cierre'`;
    assert.equal(intercaladas,interferencias);
    if(interferencias===3){assert.match(resultado?.error ?? '',/siguen cambiando/);assert.equal(cierres.length,0);}else{assert.equal(resultado,undefined);assert.equal(cierres.length,1);assert.equal(cierres[0].tecnico_id,tecnico);assert.equal(cierres[0].fecha,'2026-10-15');assert.equal(cierres[0].notas,'Nota original que debe sobrevivir al reintento');}
    return{intercaladas,resultado:resultado??null,cierres:JSON.parse(JSON.stringify(cierres))};
  });

  for(const primero of ['adopcion','cierre'] as const)await caso('adopcion-'+primero+'-gana',async()=>{
    const x=await obra(),s=await sala(),nombre='rea01_integridad_'+randomUUID().replaceAll('-',''),clave=Number.parseInt(s.slice(0,8),16),lock=await db.reserve();
    const tabla=primero==='adopcion'?'salas':'hitos_proyecto';
    try{
      const filtro=primero==='adopcion'?`new.id='${s}'::uuid`:`new.proyecto_id='${x.p}'::uuid and new.tipo='cierre'`;
      await db.unsafe(`create function ${nombre}()returns trigger language plpgsql as $$begin if ${filtro} then perform pg_advisory_xact_lock(${clave}::bigint);end if;return new;end$$`);await db.unsafe(`create trigger ${nombre} before ${primero==='adopcion'?'update':'insert'} on ${tabla} for each row execute function ${nombre}()`);
      const[{pid}]=await lock`select pg_backend_pid()pid`;await lock`select pg_advisory_lock(${clave}::bigint)`;
      const adoptar=()=>asignarSalaALocalizacion(form({sala_id:s,localizacion_id:x.l}));
      const primera=primero==='adopcion'?adoptar():registrarHitoProyecto(hito(x.p));await espera(Number(pid));
      const[{pid:actor}]=await db`select pid from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))`;
      const segunda=primero==='adopcion'?registrarHitoProyecto(hito(x.p)):adoptar();await espera(Number(actor));await lock`select pg_advisory_unlock(${clave}::bigint)`;
      await maxTiempo(Promise.all([primera,segunda]));
      const[r]=await db`select localizacion_id from salas where id=${s}`;assert.equal(r.localizacion_id,primero==='adopcion'?x.l:null);assert.equal((await db`select id from hitos_proyecto where proyecto_id=${x.p} and tipo='cierre'`).length,1);return{esperaDemostrada:true,localizacion:r.localizacion_id,sinDeadlock:true};
    }finally{await lock`select pg_advisory_unlock_all()`;lock.release();await db.unsafe(`drop trigger if exists ${nombre} on ${tabla}`);await db.unsafe(`drop function if exists ${nombre}()`);}
  });

  await caso('duplicacion-E3-y-cierre-sin-invertir-locks-ni-deadlock',async()=>{
    const x=await obra(),s=await sala();await asignarSalaALocalizacion(form({sala_id:s,localizacion_id:x.l}));const actual=await leerDiseno(db,s),nombreSala=prefijo+' alternativa E3',funcion='rea01_integridad_'+randomUUID().replaceAll('-',''),clave=Number.parseInt(s.slice(0,8),16),lock=await db.reserve();
    try{
      await db.unsafe(`create function ${funcion}()returns trigger language plpgsql as $$begin if new.nombre='${nombreSala}' then perform pg_advisory_xact_lock(${clave}::bigint);end if;return new;end$$`);await db.unsafe(`create trigger ${funcion} before insert on salas for each row execute function ${funcion}()`);
      const[{pid}]=await lock`select pg_backend_pid()pid`;await lock`select pg_advisory_lock(${clave}::bigint)`;
      const duplicacion=duplicarSalaDiseno(db,s,nombreSala,null,f.admin,actual.base);await espera(Number(pid));const[{pid:actor}]=await db`select pid from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))`;
      const cierre=registrarHitoProyecto(hito(x.p));await espera(Number(actor));await lock`select pg_advisory_unlock(${clave}::bigint)`;
      const[copia]=await maxTiempo(Promise.all([duplicacion,cierre]));assert.ok(copia.salaId);assert.equal((await db`select id from hitos_proyecto where proyecto_id=${x.p} and tipo='cierre'`).length,1);assert.equal((await db`select id from salas where localizacion_id=${x.l}`).length,2);return{copia:copia.salaId,esperaDemostrada:true,sinDeadlock:true};
    }finally{await lock`select pg_advisory_unlock_all()`;lock.release();await db.unsafe(`drop trigger if exists ${funcion} on salas`);await db.unsafe(`drop function if exists ${funcion}()`);}
  });

  // Navegador: categorías físicamente aisladas, escritorio antes del móvil.
  const navegador=await chromium.launch({channel:'chrome',headless:true});
  try{
    const contexto=await navegador.newContext({baseURL:'http://localhost:3111',viewport:{width:1440,height:1000}}),page=await contexto.newPage();await contexto.addCookies([{name:COOKIE_SESION,value:await firmarSesion('rea01-local-prueba-integracion-secreto-2026',Date.now()+3600000,f.admin),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
    for(const tipo of ['equipo','mueble','toma'] as const)await caso('navegador-aislado-'+tipo,async()=>{
      const id=await sala();
      if(tipo==='equipo')await db`insert into sala_equipos(sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)values(${id},${f.articulo},'Único medido','pared',5.5,1,1,true)`;
      if(tipo==='mueble')await db`insert into sala_mobiliario(sala_id,mobiliario_id,nombre,forma,largo_m,ancho_m,x_m,y_m,z_m,posicion_confirmada)values(${id},${f.silla},'Único mueble','rectangulo',.5,.5,5.5,1,0,true)`;
      if(tipo==='toma')await db`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m)values(${id},'Única roseta',5.5,1,1)`;
      const antes=await foto(id);await page.goto(`/salas/${id}/plano`);await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('10');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByText('Hay elementos colocados fuera de la sala.',{exact:true}).waitFor();assert.deepEqual(await foto(id),antes);await page.screenshot({path:resolve(salida,'escritorio-'+tipo+'.png'),fullPage:true});return{id,rechazadoSinEscrituras:true};
    });
    await caso('movil-final-formulario-hito-real-y-recinto',async()=>{
      const x=await obra();await page.setViewportSize({width:390,height:844});await page.goto(`/proyectos/${x.p}`);await page.getByLabel('Quién').selectOption(tecnico);await page.getByLabel('Fecha',{exact:true}).fill('2026-10-15');await page.getByRole('button',{name:'Registrar cierre',exact:true}).click();await page.getByRole('link',{name:'Borrar cierre',exact:true}).waitFor();assert.equal((await db`select tecnico_id from hitos_proyecto where proyecto_id=${x.p} and tipo='cierre'`)[0].tecnico_id,tecnico);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(salida,'movil-hito-real.png'),fullPage:true});return{ancho:390,hitoReal:true};
    });
  }finally{await navegador.close();}
  await writeFile(resolve(salida,'integridad-resultados.json'),JSON.stringify({prefijo,resultados},null,2));console.log(`${resultados.length}/${resultados.length} escenarios de integridad aprobados.`);
}finally{await db.end();await global.__sql?.end();}
