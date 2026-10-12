import assert from 'node:assert/strict';
import Module from 'node:module';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {copiarInfraestructuraYCables} from '../src/lib/copiar-conexiones';
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_copia_documental_[a-f0-9]{32}$/.test(url.pathname));
const modulo=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};const cargar=modulo._load;
modulo._load=(request,...resto)=>{
 if(request==='server-only')return {};
 if(request==='next/cache')return {revalidatePath:()=>{}};
 if(request==='next/navigation')return {redirect:()=>{throw new Error('Redirección inesperada');}};
 return cargar.call(Module,request,...resto);
};
const acciones=await import('../src/app/acciones');
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){}}),monitor=postgres(url.href,{max:1,onnotice(){}});
const form=(id:string,operacion?:string)=>{const f=new FormData();f.set('id',id);if(operacion)f.set('operacion',operacion);return f;};
async function fixture(){
 const [p]=await sql`insert into plantillas_sala(nombre,tipologia,largo_m,ancho_m,alto_m) values (${randomUUID()},'QA',10,10,3) returning id`;
 const [s]=await sql`insert into salas(nombre,largo_m,ancho_m,alto_m) values ('Destino QA',10,10,3) returning id`;
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${randomUUID()}) returning id`;
 const [puerto]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${a.id},'LAN','bidireccional','red',2,'app') returning id`;
 const ls=await sql`insert into plantilla_articulos(plantilla_id,articulo_id,categoria,cantidad) values (${p.id},${a.id},'A',1),(${p.id},${a.id},'B',1) returning id`;
 const es=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${a.id},'A'),(${s.id},${a.id},'B') returning id`;
 const c=await sql.begin(async tx=>{
  const [c]=await tx`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id,senal,longitud_manual_m) values (${p.id},${ls[0].id},${ls[1].id},'red',7.25) returning id`;
  await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal) values (${c.id},'origen',${ls[0].id},${puerto.id},1),(${c.id},'destino',${ls[1].id},${puerto.id},1)`;
  await tx`insert into plantilla_tiradas_documentales(fuente_clave,plantilla_id,tipologia,aforo,origen_categoria,destino_categoria,senal,ruta,orden,notas,conexion_resuelta_id) values (${randomUUID()},${p.id},'QA','2','A','B','red','directo','1','Literal',${c.id})`;
  return c;
 });
 return {p,s,a,c,ls,mapa:new Map<string,string>([[ls[0].id,es[0].id],[ls[1].id,es[1].id]])};
}
async function bloqueo(patron:string){
 const limite=Date.now()+4000;
 while(Date.now()<limite){
  const filas=await monitor`select query from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock'`;
  if(filas.some(f=>String(f.query).includes(patron)))return;
  await new Promise(r=>setTimeout(r,20));
 }
 assert.fail(`No se observó el lock esperado en ${patron}`);
}
try{
 for(const modo of ['sql','tirada','linea'])await test(`Copia primero: ${modo} espera y el destino conserva el cable completo`,async()=>{
  const f=await fixture();let liberar=()=>{},avisar=()=>{};
  const seguir=new Promise<void>(r=>{liberar=r;}),pausada=new Promise<void>(r=>{avisar=r;});let interceptada=false;
  const copia=sql.begin(async tx=>{
   const instrumentada=new Proxy(tx,{apply(target,self,args){
    const partes=args[0];const texto=Array.isArray(partes)&&'raw' in partes?partes.join(''):'';
    if(!interceptada&&texto.includes("detalle_extremos<>'completo'")&&texto.includes('select id from')){
     interceptada=true;return(async()=>{avisar();await seguir;return Reflect.apply(target,self,args);})();
    }
    return Reflect.apply(target,self,args);
   }});
   await copiarInfraestructuraYCables(instrumentada,'plantilla',f.p.id,f.s.id,f.mapa);
  });
  copia.catch(()=>{});let borrado:Promise<unknown>|undefined;
  try{
   await Promise.race([pausada,copia.then(()=>{throw new Error('No alcanzó pausa');})]);
   borrado=modo==='sql'?otra`delete from plantilla_conexiones where id=${f.c.id}`.then(r=>r)
    :modo==='tirada'?acciones.quitarTiradaPlantilla(form(f.c.id)):acciones.operarLineaPlantilla(form(f.ls[0].id,'quitar'));
   borrado.catch(()=>{});
   await bloqueo(modo==='sql'?'delete from plantilla_conexiones':'select id from plantillas_sala');
   liberar();await copia;await borrado;
   const cables=await sql`select id,longitud_manual_m from conexiones where sala_id=${f.s.id}`;
   assert.equal(cables.length,1);assert.equal(Number(cables[0].longitud_manual_m),7.25);
   assert.equal((await sql`select count(*)::int n from conexion_bocas where conexion_id=${cables[0].id}`)[0].n,2);
   assert.equal((await sql`select conexion_resuelta_id from plantilla_tiradas_documentales where plantilla_id=${f.p.id}`)[0].conexion_resuelta_id,null);
  }finally{liberar();await copia.catch(()=>{});await borrado?.catch(()=>{});}
 });
 await test('Borrado primero sin commit: copia espera, rechaza pendiente y revierte destino',async()=>{
  const f=await fixture();let liberar=()=>{},avisar=()=>{};
  const seguir=new Promise<void>(r=>{liberar=r;}),pausada=new Promise<void>(r=>{avisar=r;});
  const borrado=otra.begin(async tx=>{await tx`delete from plantilla_conexiones where id=${f.c.id}`;avisar();await seguir;});
  borrado.catch(()=>{});let copia:Promise<unknown>|undefined;
  const antes=Array.from(await sql`select * from sala_equipos where sala_id=${f.s.id} order by id`);
  try{
   await Promise.race([pausada,borrado]);
   copia=sql.begin(async tx=>{
    await tx`insert into sala_equipos(sala_id,articulo_id,nombre) values (${f.s.id},${f.a.id},'Debe revertirse')`;
    await tx`update salas set notas='Debe revertirse' where id=${f.s.id}`;
    await copiarInfraestructuraYCables(tx,'plantilla',f.p.id,f.s.id,f.mapa);
   });copia.catch(()=>{});
   await bloqueo('plantilla_conexiones');liberar();await borrado;
   await assert.rejects(copia,/Documenta las tiradas pendientes/);
   assert.deepEqual(Array.from(await sql`select * from sala_equipos where sala_id=${f.s.id} order by id`),antes);
   assert.equal((await sql`select notas from salas where id=${f.s.id}`)[0].notas,null);
   assert.equal((await sql`select count(*)::int n from conexiones where sala_id=${f.s.id}`)[0].n,0);
  }finally{liberar();await borrado.catch(()=>{});await copia?.catch(()=>{});}
 });
 await test('Rechazo posterior a escribir cable revierte pareja y destino completos',async()=>{
  const f=await fixture();
  await sql`insert into plantilla_conexion_puntos_paso(plantilla_conexion_id,orden,x_m,y_m,z_m) values (${f.c.id},1,9,9,1)`;
  await sql`update salas set largo_m=2,ancho_m=2 where id=${f.s.id}`;
  await assert.rejects(sql.begin(async tx=>{
   await tx`update salas set notas='Debe revertirse' where id=${f.s.id}`;
   await copiarInfraestructuraYCables(tx,'plantilla',f.p.id,f.s.id,f.mapa);
  }),/fuera de las medidas/);
  assert.equal((await sql`select notas from salas where id=${f.s.id}`)[0].notas,null);
  assert.equal((await sql`select count(*)::int n from conexiones where sala_id=${f.s.id}`)[0].n,0);
  assert.equal((await sql`select count(*)::int n from series_cable_sala where sala_id=${f.s.id}`)[0].n,0);
 });
}finally{await sql.end();await otra.end();await monitor.end();await(await import('../src/lib/db')).sql.end();modulo._load=cargar;}
