import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RepositorioTiempos } from '../src/lib/tiempos/repositorio';
import { ErrorTiempo } from '../src/lib/tiempos/modelo';
import { resolverPermisos } from '../src/lib/usuarios';
import { conectarRevisiones, URL_REA_PRUEBA, SALIDA_TIEMPOS, idTR, fotoTiempos } from './rea05-tiempos-fixture.mjs';
assert.equal(process.env.REA_DATABASE_URL,URL_REA_PRUEBA);
const c=await conectarRevisiones(process.env.REA_DATABASE_URL!),repo=new RepositorioTiempos(c),base=Number(String(Date.now()).slice(-9)),u=idTR(1),trabajador=idTR(2),tecnico=idTR(102),f=(n:number)=>idTR(base+n);
const mod=Module as unknown as {_load:(s:string,...a:unknown[])=>unknown},original=mod._load;
const autor={id:u,usuario:'QA05',nombre:'PRUEBA-REA05-TIEMPOS admin',rol:'admin',permisos:resolverPermisos('admin'),ficticio:false,debeCambiarClave:false};
let ciclo:typeof import('../src/app/acciones-ciclo'),proyectos:typeof import('../src/app/acciones-proyectos'),e3:typeof import('../src/lib/revisiones-diseno-repositorio');
try{
 mod._load=(s,...a)=>s==='server-only'?{}:s==='next/cache'?{revalidatePath:()=>{}}:s==='@/lib/db'||s==='./db'?{sql:c,hayConfiguracion:()=>true}:s==='@/lib/sesion-servidor'?{exigirEdicion:async()=>autor,sesionActual:async()=>autor}:s==='@/app/salas/[id]/datos-ficha'?{fichaConAlmacen:()=>{throw new Error('No leer material para registrar tiempos.');}}:original.call(Module,s,...a);
 const requerir=createRequire(import.meta.url);ciclo=requerir('../src/app/acciones-ciclo.ts');proyectos=requerir('../src/app/acciones-proyectos.ts');e3=requerir('../src/lib/revisiones-diseno-repositorio.ts');
}finally{mod._load=original;}
const resultados:unknown[]=[];
function form(v:Record<string,string>){const d=new FormData();for(const[k,x]of Object.entries(v))d.set(k,x);return d;}
async function obra(n:number){const p=f(n),l=f(n+1),s=f(n+2),plan=f(n+3),t=f(n+4);await c`insert into proyectos(id,nombre) values(${p},${'PRUEBA-REA05-TIEMPOS carrera '+base+'-'+n})`;await c`insert into localizaciones(id,proyecto_id,nombre) values(${l},${p},'PRUEBA-REA05-TIEMPOS carrera')`;await c`insert into salas(id,nombre,localizacion_id,largo_m,ancho_m,alto_m) values(${s},${'PRUEBA-REA05-TIEMPOS carrera '+base+'-'+n},${l},6,4,3)`;await c`insert into hitos_proyecto(proyecto_id,tipo,tecnico_id,notas) values(${p},'inicio',${idTR(101)},'PRUEBA-REA05-TIEMPOS inicio')`;await c`insert into planes(id,proyecto_id,creado_por) values(${plan},${p},${u})`;await c`insert into plan_tareas(id,plan_id,sala_id,titulo,estado,creado_por) values(${t},${plan},${s},'PRUEBA-REA05-TIEMPOS tarea carrera','pendiente',${u})`;await c`insert into plan_asignaciones(tarea_id,tecnico_id,asignado_por) values(${t},${tecnico},${u})`;return{p,l,s,plan,t};}
const entrada=(t:string,n:number)=>({tareaId:t,inicio:{fecha:'2020-01-01',hora:String(n).padStart(2,'0')+':00'},fin:{fecha:'2020-01-01',hora:String(n+1).padStart(2,'0')+':00'},notas:'Carrera '+base,clavePeticion:randomUUID()});
async function esperar(pid:number){for(let n=0;n<400;n++){const r=await c`select pid from pg_stat_activity where ${pid}::int=any(pg_blocking_pids(pid))`;if(r.length)return Number(r[0].pid);await new Promise(r=>setTimeout(r,20));}throw new Error('No se observó la espera real sobre '+pid);}
async function barrera(tabla:string,predicado:string,n:number){const nombre='rea05_tiempos_gate_'+base+'_'+n,key=Number('5'+String(base))+n;await c.unsafe(`create function ${nombre}() returns trigger language plpgsql as $$begin if ${predicado} then perform pg_advisory_xact_lock(${key}::bigint);end if;return new;end $$`);await c.unsafe(`create trigger ${nombre} before insert on ${tabla} for each row execute function ${nombre}()`);const lock=await c.reserve(),[{pid}]=await lock`select pg_backend_pid() pid`;await lock`select pg_advisory_lock(${key}::bigint)`;let abierto=true;return{pid:Number(pid),soltar:async()=>{if(abierto){abierto=false;await lock`select pg_advisory_unlock(${key}::bigint)`;}},limpiar:async()=>{await lock`select pg_advisory_unlock_all()`;lock.release();await c.unsafe(`drop trigger if exists ${nombre} on ${tabla}`);await c.unsafe(`drop function if exists ${nombre}()`);}};}
const cerrar=(p:string)=>ciclo.registrarHitoProyecto(form({proyecto_id:p,tipo:'cierre',tecnico_id:idTR(101),notas:'PRUEBA-REA05-TIEMPOS cierre real',fecha:'2026-10-15'}));
async function intento<T>(p:Promise<T>){return p.then(valor=>({ok:true,valor}),e=>({ok:false,codigo:e.codigo??e.code,status:e.status,error:String(e)}));}
async function sinCambiosFisicos(antes:Awaited<ReturnType<typeof fotoTiempos>>,despues:Awaited<ReturnType<typeof fotoTiempos>>){const tiempos=new Set(['tiempo_registros','tiempo_versiones','tiempo_operaciones']);assert.deepEqual(antes.tablas.filter(t=>!tiempos.has(t.tabla)&&JSON.stringify(t)!==JSON.stringify(despues.tablas.find(d=>d.tabla===t.tabla))),[]);}
try{
 await c`insert into tecnico_roles(tecnico_id,rol) values(${idTR(101)},'inicio') on conflict do nothing`;
 // Orden cierre real → parte: el parte relee el cierre y no escribe nada.
 {
  const x=await obra(10),gate=await barrera('hitos_proyecto',`new.proyecto_id='${x.p}'::uuid and new.tipo='cierre'`,1);let cierre:Promise<unknown>|undefined,parte:Promise<unknown>|undefined;
  try{cierre=cerrar(x.p);const pid=await esperar(gate.pid);parte=intento(repo.crear(trabajador,entrada(x.t,1)));await esperar(pid);await gate.soltar();await cierre;const r=await parte as {ok:boolean;status?:number};assert.equal(r.ok,false);assert.equal(r.status,409);assert.equal((await c`select id from tiempo_registros where tarea_id=${x.t}`).length,0);resultados.push({caso:'cierre real antes de parte',resultado:r,esperaObservada:true});}
  finally{await gate.soltar();await Promise.allSettled([cierre,parte].filter(Boolean));await gate.limpiar();}
 }
 // Orden parte → cierre: se admite el anterior, no otro posterior; el gestor
 // histórico conserva exactamente las79 tablas ajenas a sidecars de tiempos.
 {
  const x=await obra(30),gate=await barrera('tiempo_versiones',`new.autor_usuario_id='${trabajador}'::uuid and new.notas='Carrera ${base}'`,2);let cierre:Promise<unknown>|undefined,parte:Promise<unknown>|undefined;
  try{parte=repo.crear(trabajador,entrada(x.t,3));const pid=await esperar(gate.pid);cierre=cerrar(x.p);await esperar(pid);await gate.soltar();await parte;await cierre;await assert.rejects(()=>repo.crear(trabajador,entrada(x.t,4)),e=>e instanceof ErrorTiempo&&e.codigo==='CONTEXTO_CERRADO');const antes=await fotoTiempos(c,'cerrado-antes-historico');await repo.crear(u,{...entrada(x.t,4),tecnicoId:tecnico,motivo:'Hecho real conocido después del cierre'},x.p);const despues=await fotoTiempos(c,'cerrado-despues-historico');await sinCambiosFisicos(antes,despues);resultados.push({caso:'parte antes de cierre, gestor histórico sólo sidecars',esperaObservada:true,tablasAjenasIdenticas:79});}
  finally{await gate.soltar();await Promise.allSettled([cierre,parte].filter(Boolean));await gate.limpiar();}
 }
 // E3 ya dentro de SERIALIZABLE bloquea sala; el tiempo espera y luego trabaja
 // sobre su tarea explícita sin actualizar sala, plan ni revisión E3.
 {
  const x=await obra(50),nombre='PRUEBA-REA05-TIEMPOS copia '+base,baseE3=(await e3.leerDiseno(c,x.s)).base,gate=await barrera('salas',`new.nombre='${nombre}'`,3);let copia:Promise<unknown>|undefined,parte:Promise<unknown>|undefined;
  try{copia=e3.duplicarSalaDiseno(c,x.s,nombre,null,u,baseE3);const pid=await esperar(gate.pid);parte=repo.crear(trabajador,entrada(x.t,6));await esperar(pid);await gate.soltar();await copia;await parte;const antes=await fotoTiempos(c,'e3-antes-sidecar');await repo.crear(u,{...entrada(x.t,7),tecnicoId:tecnico,motivo:'Intervalo adicional tras copia E3'},x.p);await sinCambiosFisicos(antes,await fotoTiempos(c,'e3-despues-sidecar'));resultados.push({caso:'copia E3 real antes de tiempo, fuente física intacta',esperaObservada:true});}
  finally{await gate.soltar();await Promise.allSettled([copia,parte].filter(Boolean));await gate.limpiar();}
 }
 // Revocación de permiso mientras espera técnico: relectura tras el lock.
 {
  const x=await obra(70),lock=await c.reserve();await lock`begin`;const[{pid}]=await lock`select pg_backend_pid() pid`;await lock`select id from tecnicos where id=${tecnico} for update`;const parte=intento(repo.crear(trabajador,entrada(x.t,9)));await esperar(Number(pid));await c`update usuario_permisos set acceso='oculto' where usuario_id=${trabajador} and seccion='salas'`;await lock`commit`;lock.release();try{const r=await parte as {ok:boolean;status?:number};assert.equal(r.ok,false);assert.equal(r.status,404);resultados.push({caso:'ACL retirada durante espera real',resultado:r});}finally{await c`update usuario_permisos set acceso='ver' where usuario_id=${trabajador} and seccion='salas'`;}
 }
 // Una adopción real que ya posee sala cambia la jerarquía antes del tiempo.
 {
  const x=await obra(90),destino=await obra(100),lock=await c.reserve();await lock`begin`;const[{pid}]=await lock`select pg_backend_pid() pid`;await lock`select id from salas where id=${x.s} for update`;const adopcion=proyectos.asignarSalaALocalizacion(form({sala_id:x.s,localizacion_id:destino.l}));const actor=await esperar(Number(pid));const parte=intento(repo.crear(trabajador,entrada(x.t,10)));await esperar(Number(pid));await lock`commit`;lock.release();await adopcion;const r=await parte as {ok:boolean;status?:number};assert.equal(r.ok,false);assert.equal(r.status,409);resultados.push({caso:'adopción real antes de tiempo invalida ámbito propio',actor,resultado:r});
 }
 // Fallo después de cabecera y versión: la operación entera se revierte.
 {
  const x=await obra(120),clave=randomUUID(),fn='rea05_tiempos_fallo_'+base;await c.unsafe(`create function ${fn}() returns trigger language plpgsql as $$begin if new.clave_peticion='${clave}'::uuid then raise exception 'Fallo sintético tras version';end if;return new;end$$`);await c.unsafe(`create trigger ${fn} before insert on tiempo_operaciones for each row execute function ${fn}()`);
  const antes=await fotoTiempos(c,'rollback-antes');try{await assert.rejects(()=>repo.crear(trabajador,{...entrada(x.t,12),clavePeticion:clave}));assert.equal((await c`select id from tiempo_registros where tarea_id=${x.t}`).length,0);const despues=await fotoTiempos(c,'rollback-despues');assert.deepEqual(antes.tablas,despues.tablas);resultados.push({caso:'fallo posterior a versión revierte82tablas',ok:true});}finally{await c.unsafe(`drop trigger ${fn} on tiempo_operaciones`);await c.unsafe(`drop function ${fn}()`);}
 }
 console.log(JSON.stringify(resultados,null,2));await writeFile(resolve(SALIDA_TIEMPOS,'concurrencia-resultados.json'),JSON.stringify({fecha:new Date().toISOString(),base,resultados},null,2));
}finally{await c.end();}
