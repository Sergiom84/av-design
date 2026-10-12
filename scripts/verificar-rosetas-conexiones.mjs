/** L2B: solo PostgreSQL local desechable; no lee .env. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
const argumentos=process.argv.slice(2);
assert.ok(argumentos.every(a=>['--plan','--sin-pareja','--sin-capacidad','--sin-propiedad','--sin-documental'].includes(a)));
console.log('Solo bases qa_rosetas_<UUID> propias en 127.0.0.1:5433.');
if(argumentos.includes('--plan'))process.exit(0);
const nl=s=>s.replaceAll('\r\n','\n');
const esquema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const original=readFileSync(new URL('../db/migraciones/2026-09-rosetas-conexiones.sql',import.meta.url),'utf8');
const previo=esquema.replace(/-- BEGIN ROSETAS CONEXIONES L2B[\s\S]*?-- END ROSETAS CONEXIONES L2B/,'')
 .replace(/-- BEGIN TIRADAS DOCUMENTALES L2B[\s\S]*?-- END TIRADAS DOCUMENTALES L2B/,'');
let migracion=original;
if(argumentos.includes('--sin-pareja'))migracion=migracion.replaceAll("if (c.detalle_extremos='completo' and filas<>2) or (c.detalle_extremos='legacy' and filas<>0) then","if false then");
if(argumentos.includes('--sin-capacidad'))migracion=migracion.replaceAll('if (capacidad is null and total<>0) or (capacidad is not null and (total<>capacidad or menor<>1 or mayor<>capacidad)) then','if false then');
if(argumentos.includes('--sin-propiedad'))migracion=migracion.replaceAll('t.sala_id<>c.sala_id','false').replaceAll('t.plantilla_id<>c.plantilla_id','false');
if(argumentos.includes('--sin-documental'))migracion=migracion.replace('if exists(select 1 from sala_equipos e where e.toma_red_conexion_id','if false and exists(select 1 from sala_equipos e where e.toma_red_conexion_id');
const opciones={host:'127.0.0.1',port:5433,username:'av_design',password:'av_design_local',onnotice:()=>{},max:1};
async function fixture(fn,anterior=false){
 const nombre='qa_rosetas_'+randomUUID().replaceAll('-',''),admin=postgres({...opciones,database:'postgres'});let sql,paralela,monitor,creada=false;
 try{
  await admin.unsafe(`create database "${nombre}"`);creada=true;
  sql=postgres({...opciones,database:nombre});paralela=postgres({...opciones,database:nombre,max:3});monitor=postgres({...opciones,database:nombre});
  await sql.unsafe(previo);
  if(!anterior)await sql.unsafe(migracion);
  const [sala,otra]=await sql`insert into salas(nombre) values ('QA L2B'),('Otra QA L2B') returning id`;
  const [articulo]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Rosetas') returning id`;
  const equipos=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,x_m,y_m,z_m,posicion_confirmada) values (${sala.id},${articulo.id},'A',0,0,0,true),(${sala.id},${articulo.id},'B',1,2,3,true) returning id`;
  const [puerto]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${articulo.id},'LAN QA','bidireccional','red',20,'app') returning id`;
  async function placa(capacidad=2,salaId=sala.id){return sql.begin(async tx=>{
   const [t]=await tx`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m,capacidad_documentada) values (${salaId},${randomUUID()},0,0,0,${capacidad}) returning *`;
   const bocas=[];for(let i=1;i<=capacidad;i++)bocas.push((await tx`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},${i},'RJ45','red') returning *`)[0]);
   return {...t,bocas};
  });}
  const cable=async(boca,ordinal=1,conexion=sql,informarPid)=>conexion.begin(async tx=>{
   if(informarPid)informarPid((await tx`select pg_backend_pid() pid`)[0].pid);
   const [c]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,senal) values (${sala.id},${equipos[0].id},null,${puerto.id},'red') returning *`;
   await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal,toma_boca_id) values (${c.id},'origen',${equipos[0].id},${puerto.id},${ordinal},null),(${c.id},'destino',null,null,null,${boca})`;
   return c;
  });
  const aplicar=async()=>{try{await sql.unsafe(migracion);}catch(e){await sql`rollback`;throw e;}};
  const esperarBloqueo=async(pid)=>{
   const limite=Date.now()+5000;let bloqueada=false;
   while(Date.now()<limite){bloqueada=(await monitor`select wait_event_type from pg_stat_activity where pid=${pid}`)[0]?.wait_event_type==='Lock';if(bloqueada)break;await new Promise(r=>setTimeout(r,20));}
   assert.ok(bloqueada,'La operacion concurrente debe esperar un lock PostgreSQL real');
  };
  await fn({sql,paralela,sala,otra,articulo,equipos,puerto,placa,cable,aplicar,esperarBloqueo});
 }finally{
  if(monitor)await monitor.end();if(paralela)await paralela.end();if(sql){await sql`rollback`;await sql.end();}
  if(creada){await admin.unsafe(`drop database "${nombre}"`);console.log('Eliminada',nombre);}await admin.end();
 }
}
await test('Esquema limpio contiene la misma migracion; ninguna capacidad se inventa',()=>fixture(async({sql,sala})=>{
 // schema.sql lo sigue Git con core.autocrlf y llega en CRLF; la migración es un
 // fichero nuevo en LF. Se compara el SQL, no el fin de línea del checkout.
 const dentro=nl(esquema).split('-- BEGIN ROSETAS CONEXIONES L2B\n')[1];
 assert.ok(dentro,'Falta el bloque ROSETAS CONEXIONES L2B en db/schema.sql');
 assert.equal(dentro.split('-- END ROSETAS CONEXIONES L2B')[0],nl(original));
 const [t]=await sql`insert into tomas_red(sala_id,codigo) values (${sala.id},'SIN MEDIR') returning *`;
 assert.equal(t.capacidad_documentada,null);assert.equal(t.codigo_confirmado,false);
 assert.equal((await sql`select * from toma_red_bocas where toma_red_id=${t.id}`).length,0);
 await sql.unsafe(esquema);
 assert.equal((await sql`select capacidad_documentada from tomas_red where id=${t.id}`)[0].capacidad_documentada,null);
}));
await test('Upgrade L2A poblado y repeticion conservan UUID, bridas, bocas, rutas, puntos y XYZ parciales',()=>fixture(async({sql,sala,equipos,puerto,aplicar})=>{
 const [legacy]=await sql`insert into conexiones(sala_id,origen_id,destino_id,senal,ruta,longitud_manual_m) values (${sala.id},${equipos[0].id},${equipos[1].id},'red','falso_techo',12.5) returning *`;
 const detallada=await sql.begin(async tx=>{
  const [c]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal) values (${sala.id},${equipos[0].id},${equipos[1].id},${puerto.id},${puerto.id},'red') returning *`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${c.id},'origen',${equipos[0].id},${puerto.id},1),(${c.id},'destino',${equipos[1].id},${puerto.id},2)`;return c;
 });
 const [t]=await sql`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m) values (${sala.id},'HISTORICA',1,null,3) returning *`;
 await sql`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m) values (${legacy.id},0,0,1,2)`;
 const snapshot=async()=>({c:Array.from(await sql`select to_jsonb(c)-'detalle_extremos' v from conexiones c order by id`),b:Array.from(await sql`select to_jsonb(b)-'toma_boca_id' v from conexion_bocas b order by conexion_id,lado`),p:Array.from(await sql`select * from conexion_puntos_paso order by id`),e:Array.from(await sql`select to_jsonb(e)-'toma_red_conexion_id' v from sala_equipos e order by id`)});
 const antes=await snapshot();await aplicar();assert.deepEqual(await snapshot(),antes);
 assert.equal((await sql`select detalle_extremos from conexiones where id=${legacy.id}`)[0].detalle_extremos,'legacy');
 assert.equal((await sql`select detalle_extremos from conexiones where id=${detallada.id}`)[0].detalle_extremos,'completo');
 const [t2]=await sql`update tomas_red set notas='Conservado' where id=${t.id} returning *`;
 assert.equal(t2.x_m,t.x_m);assert.equal(t2.y_m,null);assert.equal(t2.z_m,t.z_m);
 await aplicar();assert.deepEqual(await snapshot(),antes);
 assert.equal((await sql`select capacidad_documentada from tomas_red where id=${t.id}`)[0].capacidad_documentada,null);
 await sql.begin(async tx=>{
  await tx`update conexiones set detalle_extremos='completo',puerto_origen_id=${puerto.id},puerto_destino_id=${puerto.id} where id=${legacy.id}`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${legacy.id},'origen',${equipos[0].id},${puerto.id},3),(${legacy.id},'destino',${equipos[1].id},${puerto.id},4)`;
 });
 const [convertida]=await sql`select * from conexiones where id=${legacy.id}`;
 assert.equal(convertida.etiqueta_cable,legacy.etiqueta_cable);assert.equal(convertida.detalle_extremos,'completo');
 await aplicar();assert.equal((await sql`select detalle_extremos from conexiones where id=${legacy.id}`)[0].detalle_extremos,'completo');
},true));
await test('Nuevas tiradas sin pareja o legacy se rechazan; no se degrada una completa',()=>fixture(async({sql,sala,equipos,placa,cable})=>{
 await assert.rejects(sql`insert into conexiones(sala_id,origen_id,destino_id) values (${sala.id},${equipos[0].id},${equipos[1].id})`,/detalle fisico/);
 await assert.rejects(sql`insert into conexiones(sala_id,detalle_extremos) values (${sala.id},'legacy')`,/legacy/);
 const t=await placa(),c=await cable(t.bocas[0].id);
 await assert.rejects(sql`update conexiones set detalle_extremos='legacy' where id=${c.id}`,/legacy/);
 await assert.rejects(sql`delete from conexion_bocas where conexion_id=${c.id}`,/detalle fisico/);
 await sql`update conexiones set notas='Inocente',origen_id=origen_id where id=${c.id}`;
 assert.equal((await sql`select * from conexion_bocas where conexion_id=${c.id}`).length,2);
}));
await test('Capacidad exige todos los ordinales, nunca una placa parcial',()=>fixture(async({sql,sala})=>{
 await assert.rejects(sql`insert into tomas_red(sala_id,codigo,capacidad_documentada) values (${sala.id},'FALTA',2)`,/Capacidad documentada/);
 const [t]=await sql`insert into tomas_red(sala_id,codigo) values (${sala.id},'DESCONOCIDA') returning id`;
 await assert.rejects(sql`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red')`,/Capacidad documentada/);
 await assert.rejects(sql.begin(async tx=>{
  await tx`update tomas_red set capacidad_documentada=2 where id=${t.id}`;
  await tx`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red'),(${t.id},3,'RJ45','red')`;
 }),/Capacidad documentada/);
 assert.equal((await sql`select capacidad_documentada from tomas_red where id=${t.id}`)[0].capacidad_documentada,null);
}));
await test('Una boca ocupada conserva identidad y no permite reducir ni eliminar placa',()=>fixture(async({sql,placa,cable})=>{
 const t=await placa();await cable(t.bocas[1].id);
 await assert.rejects(sql`delete from tomas_red where id=${t.id}`,/foreign key/);
 await assert.rejects(sql.begin(async tx=>{await tx`update tomas_red set capacidad_documentada=1 where id=${t.id}`;await tx`delete from toma_red_bocas where id=${t.bocas[1].id}`;}),/foreign key/);
 await assert.rejects(sql`update toma_red_bocas set ordinal=3 where id=${t.bocas[1].id}`,/inmutables/);
 await assert.rejects(sql`update toma_red_bocas set conector='USB' where id=${t.bocas[1].id}`,/ocupada/);
 await sql.begin(async tx=>{await tx`update tomas_red set capacidad_documentada=3 where id=${t.id}`;await tx`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},3,'RJ45','red')`;});
 assert.deepEqual(Array.from(await sql`select id from toma_red_bocas where toma_red_id=${t.id} and ordinal<=2 order by ordinal`).map(x=>x.id),t.bocas.map(x=>x.id));
}));
await test('Sala ajena y traslados inversos se rechazan',()=>fixture(async({sql,otra,equipos,placa,cable})=>{
 const ajena=await placa(1,otra.id);await assert.rejects(cable(ajena.bocas[0].id),/ajena/);
 const t=await placa();await cable(t.bocas[0].id);
 await assert.rejects(sql`update tomas_red set sala_id=${otra.id} where id=${t.id}`,/inmutables/);
 await assert.rejects(sql`update sala_equipos set sala_id=${otra.id} where id=${equipos[0].id}`,/bocas fisicas/);
 await assert.rejects(sql`update toma_red_bocas set toma_red_id=${ajena.id} where id=${t.bocas[0].id}`,/inmutables/);
}));
await test('Compatibilidad, alternativa excluyente e identidad de extremos comprobadas al commit',()=>fixture(async({sql,equipos,puerto,placa,cable})=>{
 const t=await placa(),c=await cable(t.bocas[0].id);
 await assert.rejects(sql`update conexiones set destino_id=${equipos[1].id} where id=${c.id}`,/Columnas compatibles/);
 await assert.rejects(sql`update conexion_bocas set equipo_id=${equipos[1].id},puerto_id=${puerto.id},ordinal=2 where conexion_id=${c.id} and lado='destino'`,/tipo_extremo/);
 await assert.rejects(sql`update conexion_bocas set lado='origen' where conexion_id=${c.id} and lado='destino'`,/inmutable/);
 await assert.rejects(sql`delete from conexion_bocas where conexion_id=${c.id} and lado='destino'`,/detalle fisico/);
 assert.equal((await sql`select destino_id from conexiones where id=${c.id}`)[0].destino_id,null);
}));
await test('Asignacion documental exige misma pareja; borrar cable deja pendiente sin borrar asignacion',()=>fixture(async({sql,equipos,placa,cable})=>{
 const t=await placa(),otra=await placa(),c=await cable(t.bocas[0].id);
 await assert.rejects(sql`update sala_equipos set toma_red_id=${otra.id},toma_red_conexion_id=${c.id} where id=${equipos[0].id}`,/enlace documental/);
 await sql`update sala_equipos set toma_red_id=${t.id},toma_red_conexion_id=${c.id} where id=${equipos[0].id}`;
 await assert.rejects(sql`update conexion_bocas set toma_boca_id=${otra.bocas[0].id} where conexion_id=${c.id} and lado='destino'`,/enlace documental/);
 await sql`delete from conexiones where id=${c.id}`;
 const [e]=await sql`select toma_red_id,toma_red_conexion_id from sala_equipos where id=${equipos[0].id}`;
 assert.equal(e.toma_red_id,t.id);assert.equal(e.toma_red_conexion_id,null);
}));
await test('Nuevas coordenadas exigen tres ejes; esquema no altera XYZ ni etiqueta',()=>fixture(async({sql,sala,placa,cable})=>{
 await assert.rejects(sql`insert into tomas_red(sala_id,codigo,x_m) values (${sala.id},'PARCIAL',0)`,/tres ejes/);
 const t=await placa(),c=await cable(t.bocas[0].id);
 await assert.rejects(sql`update tomas_red set z_m=null where id=${t.id}`,/tres ejes/);
 await assert.rejects(sql`update tomas_red set esquema_x=5 where id=${t.id}`,/esquema_posicion/);
 const [despues]=await sql`update tomas_red set esquema_x=500,esquema_y=200 where id=${t.id} returning *`;
 for(const eje of ['x_m','y_m','z_m'])assert.equal(despues[eje],t[eje]);
 assert.equal((await sql`select etiqueta_cable from conexiones where id=${c.id}`)[0].etiqueta_cable,c.etiqueta_cable);
}));
await test('Carrera asignacion/cambio de boca no confirma enlace incoherente',()=>fixture(async({sql,paralela,equipos,placa,cable,esperarBloqueo})=>{
 const t=await placa(),otra=await placa(),c=await cable(t.bocas[0].id);
 let avisar;const iniciada=new Promise(r=>{avisar=r;});let liberar;const continuar=new Promise(r=>{liberar=r;});
 const asignar=sql.begin(async tx=>{await tx`update sala_equipos set toma_red_id=${t.id},toma_red_conexion_id=${c.id} where id=${equipos[0].id}`;avisar();await continuar;});
 await iniciada;let notificar;const pid=new Promise(r=>{notificar=r;});
 const cambio=paralela.begin(async tx=>{notificar((await tx`select pg_backend_pid() pid`)[0].pid);await tx`update conexion_bocas set toma_boca_id=${otra.bocas[0].id} where conexion_id=${c.id} and lado='destino'`;});
 let r;try{await esperarBloqueo(await pid);}finally{liberar();r=await Promise.allSettled([asignar,cambio]);}
 assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');
 assert.equal((await sql`select toma_boca_id from conexion_bocas where conexion_id=${c.id} and lado='destino'`)[0].toma_boca_id,t.bocas[0].id);
}));
await test('Dos conexiones concurrentes a una boca: solo una confirma y contador no pierde numero',()=>fixture(async({sql,paralela,placa,cable})=>{
 const t=await placa();const r=await Promise.allSettled([cable(t.bocas[0].id,1,paralela),cable(t.bocas[0].id,2,paralela)]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected').length,1);
 assert.equal((await sql`select * from conexiones`).length,1);assert.equal((await sql`select * from conexion_bocas`).length,2);
 const ganador=r.find(x=>x.status==='fulfilled').value;assert.equal(ganador.etiqueta_cable,'RED-1000');
 const siguiente=await cable(t.bocas[1].id,3);assert.equal(siguiente.etiqueta_cable,'RED-1001');
}));
await test('Carrera capacidad/conexion no deja boca fuera de capacidad',()=>fixture(async({sql,paralela,placa,cable,esperarBloqueo})=>{
 const t=await placa();let avisar;const iniciada=new Promise(r=>{avisar=r;});let liberar;const continuar=new Promise(r=>{liberar=r;});
 const reducir=sql.begin(async tx=>{await tx`update tomas_red set capacidad_documentada=1 where id=${t.id}`;avisar();await continuar;await tx`delete from toma_red_bocas where id=${t.bocas[1].id}`;});
 await iniciada;let notificar;const pid=new Promise(r=>{notificar=r;});const alta=cable(t.bocas[1].id,1,paralela,notificar);
 let r;try{await esperarBloqueo(await pid);}finally{liberar();r=await Promise.allSettled([reducir,alta]);}
 assert.equal(r[0].status,'fulfilled');assert.equal(r[1].status,'rejected');
 assert.equal((await sql`select * from conexiones`).length,0);assert.equal((await sql`select * from toma_red_bocas where toma_red_id=${t.id}`).length,1);
}));
await test('Rollback despues de pareja revierte geometria, equipos, version y contador',()=>fixture(async({sql,sala,equipos,puerto,placa,cable})=>{
 const t=await placa();const [antes]=await sql`select diagrama_version from salas where id=${sala.id}`;
 await assert.rejects(sql.begin(async tx=>{
  await tx`update salas set diagrama_version=diagrama_version+1 where id=${sala.id}`;
  await tx`update tomas_red set esquema_x=10,esquema_y=20 where id=${t.id}`;
  await tx`insert into sala_equipos(sala_id,nombre) values (${sala.id},'Temporal')`;
  const [c]=await tx`insert into conexiones(sala_id,origen_id,puerto_origen_id,senal) values (${sala.id},${equipos[0].id},${puerto.id},'red') returning id`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal,toma_boca_id) values (${c.id},'origen',${equipos[0].id},${puerto.id},1,null),(${c.id},'destino',null,null,null,${t.bocas[0].id})`;
  throw new Error('Fallo despues de pareja');
 }),/Fallo despues/);
 assert.deepEqual((await sql`select diagrama_version from salas where id=${sala.id}`)[0],antes);
 assert.equal((await sql`select esquema_x from tomas_red where id=${t.id}`)[0].esquema_x,null);
 assert.equal((await sql`select * from sala_equipos where sala_id=${sala.id}`).length,2);
 assert.equal((await cable(t.bocas[0].id)).etiqueta_cable,'RED-1000');
}));
await test('Plantillas simetricas: roseta, capacidad, propiedad, pareja y longitud manual',()=>fixture(async({sql,articulo,puerto})=>{
 const [p,q]=await sql`insert into plantillas_sala(nombre,tipologia) values ('QA plantilla','QA'),('Otra plantilla','QA') returning id`;
 const [e]=await sql`insert into plantilla_articulos(plantilla_id,articulo_id,categoria,cantidad) values (${p.id},${articulo.id},'QA',1) returning id`;
 const [t]=await sql`insert into plantilla_tomas_red(plantilla_id,codigo,codigo_referencia) values (${p.id},'TOMA','ORIGINAL') returning *`;
 assert.equal(t.codigo_confirmado,false);assert.equal(t.capacidad_documentada,null);
 await assert.rejects(sql`update plantilla_tomas_red set capacidad_documentada=1 where id=${t.id}`,/Capacidad documentada/);
 const b=await sql.begin(async tx=>{await tx`update plantilla_tomas_red set capacidad_documentada=1 where id=${t.id}`;return (await tx`insert into plantilla_toma_red_bocas(plantilla_toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red') returning id`)[0];});
 await assert.rejects(sql`insert into plantilla_conexiones(plantilla_id) values (${p.id})`,/detalle fisico/);
 await assert.rejects(sql`insert into plantilla_conexiones(plantilla_id,detalle_extremos) values (${p.id},'legacy')`,/legacy/);
 const crear=(id)=>sql.begin(async tx=>{
  const [c]=await tx`insert into plantilla_conexiones(plantilla_id,origen_linea_id,longitud_manual_m) values (${id},${e.id},15) returning *`;
  await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal,toma_boca_id) values (${c.id},'origen',${e.id},${puerto.id},1,null),(${c.id},'destino',null,null,null,${b.id})`;return c;
 });
 const c=await crear(p.id);assert.equal(Number(c.longitud_manual_m),15);
 const ajena=await sql.begin(async tx=>{
  const [t]=await tx`insert into plantilla_tomas_red(plantilla_id,codigo,capacidad_documentada) values (${q.id},'AJENA',1) returning id`;
  return (await tx`insert into plantilla_toma_red_bocas(plantilla_toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red') returning id`)[0];
 });
 await assert.rejects(sql.begin(async tx=>{
  const [c]=await tx`insert into plantilla_conexiones(plantilla_id,origen_linea_id) values (${p.id},${e.id}) returning id`;
  await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal,toma_boca_id) values (${c.id},'origen',${e.id},${puerto.id},2,null),(${c.id},'destino',null,null,null,${ajena.id})`;
 }),/ajena/);
 await assert.rejects(sql`update plantilla_articulos set plantilla_id=${q.id} where id=${e.id}`,/bocas fisicas/);
 await assert.rejects(sql`delete from plantilla_tomas_red where id=${t.id}`,/foreign key/);
 await assert.rejects(sql`update plantilla_conexiones set destino_linea_id=${e.id} where id=${c.id}`);
 await assert.rejects(sql`delete from plantilla_conexion_bocas where plantilla_conexion_id=${c.id}`,/detalle fisico/);
 await sql`update plantilla_conexiones set notas='Mantener' where id=${c.id}`;
 assert.equal((await sql`select * from plantilla_conexion_bocas where plantilla_conexion_id=${c.id}`).length,2);
}));
