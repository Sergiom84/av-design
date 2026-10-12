import assert from 'node:assert/strict';
import Module from 'node:module';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import postgres from 'postgres';
import type {TransactionSql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {atribuirRegistroExistente,obtenerCoberturaSuministros} from '../src/lib/atribuciones-suministro-db';
import {recibirCompra} from '../src/lib/operaciones-compras';
import {operarReservaKit} from '../src/lib/operaciones-reserva';
import type * as CargaModulo from '../src/lib/operaciones-carga';
import {sqlConReintentos} from '../src/lib/sql-reintentos';
import {ErrorConcurrencia,transaccionConControl} from '../src/lib/control-escritura';

const moduloCarga=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};
const cargar=moduloCarga._load;
moduloCarga._load=(request,...resto)=>request==='server-only'?{}:cargar.call(Module,request,...resto);

const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_carga_[a-f0-9]{32}$/.test(url.pathname));
let escriturasOtra=0;
const sql=postgres(url.href,{max:1,onnotice(){}});
const otra=postgres(url.href,{max:1,onnotice(){},debug(_c,consulta){if(/insert into operaciones_carga_kit/i.test(consulta))escriturasOtra++;}});
const autor={id:randomUUID(),nombre:'QA carga',ficticio:false};
const {operarCargaKit}=await import(process.env.CARGA_MODULO??'../src/lib/operaciones-carga') as typeof CargaModulo;
const {leerCargaEnInstantanea}=await import('../src/lib/datos-almacen');
const {leerReservasSuministro}=await import('../src/lib/reservas-suministro-lectura');

async function fixture(unidades=1,segunda=0){
 const [proy]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
 const [loc]=await sql`insert into localizaciones(proyecto_id,nombre) values(${proy.id},'QA') returning id`;
 const [s]=await sql`insert into salas(nombre,localizacion_id) values(${randomUUID()},${loc.id}) returning id`;
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 const [comp]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA') returning id`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente,articulo_componente_id)
  values(${c.id},'conocido','Pieza','equipo',1,'incluido','QA',${comp.id})`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 const [p]=await sql`insert into pedidos(sala_id,estado) values(${s.id},'pedido') returning id`;
 const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,comprado_en,comprado_por) values(${p.id},${a.id},2,current_date,'QA') returning id`;
 const [u]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
 const [u2]=segunda?await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`:[{id:null}];
 if(unidades)await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values(${a.id},${u.id},'ajuste',${unidades})`;
 if(segunda)await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values(${a.id},${u2.id},'ajuste',${segunda})`;
 const A=await instanciarSuministro(sql,s.id,c.id),B=await instanciarSuministro(sql,s.id,c.id);
 return {sala:String(s.id),articulo:String(a.id),componente:String(comp.id),composicion:String(c.id),
  pedido:String(p.id),linea:String(l.id),ubicacion:String(u.id),ubicacion2:u2.id?String(u2.id):null,
  proyecto:String(proy.id),A,B};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
const reservar=(f:Fixture,id=randomUUID(),suministro=f.A)=>operarReservaKit(sql,{operacionId:id,operacion:'reservar',suministroId:suministro,autor});
const liberar=(reservaId:string,id=randomUUID())=>operarReservaKit(sql,{operacionId:id,operacion:'liberar',reservaId,autor});
const preparar=(reservaId:string,id=randomUUID())=>operarCargaKit(sql,{operacionId:id,operacion:'preparar',reservaId,autor});
const marcar=(lineaId:string,valor:boolean,id=randomUUID())=>operarCargaKit(sql,{operacionId:id,operacion:'marcar',lineaId,valor,autor});
const servir=(cargaId:string,ubicacionId:string,id=randomUUID())=>operarCargaKit(sql,{operacionId:id,operacion:'servir',cargaId,ubicacionId,autor});
async function saldos(f:Fixture,ubicacion=f.ubicacion){
 const [g]=await sql`select coalesce((select sum(cantidad) from existencias where articulo_id=${f.articulo}),0)::float8 e,
  coalesce((select sum(cantidad) from reservas where articulo_id=${f.articulo} and estado='activa'),0)::float8 r,
  disponible_stock_kit(${f.articulo}) d`;
 const [l]=await sql`select coalesce((select cantidad from existencias where articulo_id=${f.articulo} and ubicacion_id=${ubicacion}),0)::float8 e`;
 return {E:Number(g.e),R:Number(g.r),D:Number(g.d),Eu:Number(l.e)};
}
async function piezas(f:Fixture){
 return JSON.stringify({
  componentes:await sql`select equipo_id,suministro_id,linea_id,ordinal from sala_componentes_suministro where suministro_id in(${f.A},${f.B}) order by equipo_id`,
  equipos:await sql`select articulo_id,nombre from sala_equipos where sala_id=${f.sala} order by id`,
  puertos:Number((await sql`select count(*)::int n from puertos where articulo_id in(${f.articulo},${f.componente})`)[0].n),
  conexiones:Number((await sql`select count(*)::int n from conexiones where sala_id=${f.sala}`)[0].n),
  stockComp:Number((await sql`select coalesce(sum(cantidad),0)::float8 n from existencias where articulo_id=${f.componente}`)[0].n),
 });
}
function solicitud(extra:Record<string,unknown>){
 return {autorId:autor.id,reservaId:null,lineaId:null,cargaId:null,ubicacionId:null,valor:null,...extra};
}
async function hechoPreparar(tx:TransactionSql,reservaId:string,token=randomUUID()){
 const [r]=await tx`insert into operaciones_carga_kit(id,operacion,solicitud)
  values(${token},'preparar',${tx.json(solicitud({reservaId}))}) returning carga_id,linea_id,reserva_id,reutilizada`;
 return {token,cargaId:String(r.carga_id),lineaId:String(r.linea_id),reservaId:String(r.reserva_id),reutilizada:r.reutilizada===true};
}
async function hechoMarcar(tx:TransactionSql,lineaId:string,valor:boolean,token=randomUUID()){
 await tx`insert into operaciones_carga_kit(id,operacion,solicitud)
  values(${token},'marcar',${tx.json(solicitud({lineaId,valor}))})`;
 return token;
}
async function hechoServir(tx:TransactionSql,cargaId:string,ubicacionId:string,token=randomUUID()){
 await tx`insert into operaciones_carga_kit(id,operacion,solicitud)
  values(${token},'servir',${tx.json(solicitud({cargaId,ubicacionId}))})`;
 return token;
}
async function carrera(aislamiento:string,primero:(tx:TransactionSql)=>Promise<unknown>,segundo:(tx:TransactionSql)=>Promise<unknown>,rechazo?:RegExp,entrada={primero:true,segundo:true}){
 let liberar!:()=>void,avisar!:()=>void;
 const pausa=new Promise<void>(r=>liberar=r),inicio=new Promise<void>(r=>avisar=r);
 const ganador=sql.begin(aislamiento,async tx=>{if(entrada.primero)await tx`select tomar_control_escritura_kit()`;await primero(tx);avisar();await pausa;});
 await Promise.race([inicio,ganador]);
 try{await assert.rejects(otra.begin(aislamiento,async tx=>{if(entrada.segundo)await tx`select tomar_control_escritura_kit()`;await segundo(tx);}),{code:'40001'});}
 finally{liberar();await ganador;}
 const repetir=otra.begin(aislamiento,async tx=>{if(entrada.segundo)await tx`select tomar_control_escritura_kit()`;await segundo(tx);});
 if(rechazo)await assert.rejects(repetir,rechazo);else await repetir;
}

try{
 await sql`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave) values(${autor.id},${'qa_'+randomUUID()},${autor.nombre},'admin','QA',false)`;

 await test('Caso A/B: recepciónA, reservaA, preparación, marcado, salidaA; B intacta; replay conserva',async()=>{
  const f=await fixture(0);
  await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:f.linea,atribuciones:[{suministroId:f.A,cantidad:1,recibido:0},{suministroId:f.B,cantidad:1,recibido:0}]});
  await recibirCompra(sql,{pedidoId:f.pedido,lineaId:f.linea,cantidad:1,ubicacionId:f.ubicacion,recepcionId:randomUUID(),autor});
  const r=await reservar(f);
  const antesPiezas=await piezas(f);
  const s0=await saldos(f);
  assert.deepEqual(s0,{E:1,R:1,D:0,Eu:1});
  let cob=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(cob.porSuministro.get(f.A)?.coberturaFisica,1);
  assert.equal(cob.porSuministro.get(f.B)?.coberturaFisica,0);
  const tokenP=randomUUID();
  const prep=await preparar(r,tokenP);
  assert.deepEqual(await saldos(f),s0);
  cob=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(cob.porSuministro.get(f.A)?.reservado,1);
  assert.equal(cob.porSuministro.get(f.A)?.servido,0);
  const otraPrep=await preparar(r,randomUUID());
  assert.equal(otraPrep.cargaId,prep.cargaId);
  assert.equal(otraPrep.reutilizada,true);
  assert.equal((await preparar(r,tokenP)).cargaId,prep.cargaId);
  const [autorOriginal]=await sql`select autor_nombre,usuario_id from operaciones_carga_kit where id=${tokenP}`;
  const [reuso]=await sql`select autor_nombre from operaciones_carga_kit where carga_id=${prep.cargaId} and reutilizada`;
  assert.ok(autorOriginal,'El token original de preparación debe quedar registrado');
  assert.equal(autorOriginal.autor_nombre,autor.nombre);
  assert.ok(reuso);
  const tokenM=randomUUID();
  await marcar(prep.lineaId,true,tokenM);
  assert.equal((await sql`select cargado from carga_lineas where id=${prep.lineaId}`)[0].cargado,true);
  await marcar(prep.lineaId,false);
  assert.equal((await sql`select cargado from carga_lineas where id=${prep.lineaId}`)[0].cargado,false);
  await marcar(prep.lineaId,true,tokenM);
  assert.equal((await sql`select cargado from carga_lineas where id=${prep.lineaId}`)[0].cargado,false,'Replay del primer true conserva false');
  await marcar(prep.lineaId,true);
  const tokenS=randomUUID();
  const salida=await servir(prep.cargaId,f.ubicacion,tokenS);
  assert.deepEqual(await saldos(f),{E:0,R:0,D:0,Eu:0});
  cob=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(cob.porSuministro.get(f.A)?.reservado,0);
  assert.equal(cob.porSuministro.get(f.A)?.servido,1);
  assert.equal(cob.porSuministro.get(f.A)?.coberturaFisica,1);
  assert.equal(cob.porSuministro.get(f.B)?.coberturaFisica,0);
  assert.equal((await sql`select count(*)::int n from movimientos where articulo_id=${f.articulo} and tipo='salida'`)[0].n,1);
  assert.equal((await sql`select count(*)::int n from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=${f.A} and m.tipo='salida' and a.salida_movimiento_id is null`)[0].n,1);
  assert.equal((await sql`select estado from reservas where id=${r}`)[0].estado,'servida');
  assert.equal((await sql`select count(*)::int n from reserva_suministros where reserva_id=${r}`)[0].n,1);
  assert.equal(await piezas(f),antesPiezas);
  await assert.doesNotReject(servir(prep.cargaId,f.ubicacion,tokenS));
  assert.equal((await sql`select count(*)::int n from movimientos where articulo_id=${f.articulo} and tipo='salida'`)[0].n,1);
  assert.equal(salida.movimientoId,(await servir(prep.cargaId,f.ubicacion,tokenS)).movimientoId);
 });

 await test('Preparación no altera E/R/cobertura; duplicada = misma carga; marcar no alterna',async()=>{
  const f=await fixture();const r=await reservar(f);const s0=await saldos(f);
  const cob0=await obtenerCoberturaSuministros(sql,f.sala);
  const p1=await preparar(r),p2=await preparar(r);
  assert.equal(p1.cargaId,p2.cargaId);assert.equal(p2.reutilizada,true);
  assert.deepEqual(await saldos(f),s0);
  assert.equal((await obtenerCoberturaSuministros(sql,f.sala)).porSuministro.get(f.A)?.reservado,cob0.porSuministro.get(f.A)?.reservado);
  await marcar(p1.lineaId,true);await marcar(p1.lineaId,true);
  assert.equal((await sql`select cargado from carga_lineas where id=${p1.lineaId}`)[0].cargado,true);
  assert.equal((await sql`select count(*)::int n from operaciones_carga_kit where operacion='marcar' and linea_id=${p1.lineaId}`)[0].n,2);
 });

 await test('Rechazo íntegro: sin marcar, ubicación ajena/sin saldo/NULL, otra sala, histórica, multiunidad, liberada, obra cerrada',async()=>{
  const f=await fixture(1,1);const r=await reservar(f);const p=await preparar(r);
  const antes=await saldos(f);
  await assert.rejects(servir(p.cargaId,f.ubicacion),/Marca la linea/);
  await marcar(p.lineaId,true);
  await assert.rejects(servir(p.cargaId,randomUUID()),/Elige la ubicacion/);
  const [vacia]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
  await assert.rejects(servir(p.cargaId,String(vacia.id)),/No hay una unidad en esa ubicacion/);
  await assert.rejects(sql`insert into operaciones_carga_kit(id,operacion,solicitud)
   values(${randomUUID()},'servir',${sql.json(solicitud({cargaId:p.cargaId,ubicacionId:null}))})`,/Elige la ubicacion/);
  const [otraSala]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
  await assert.rejects(sql`update cargas set sala_id=${otraSala.id} where id=${p.cargaId}`);
  const [hist]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
  const [artHist]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  const [rh]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${hist.id},${artHist.id},1) returning id`;
  await assert.rejects(preparar(String(rh.id)),/reserva gestionada/);
  await assert.rejects(sql`update reservas set cantidad=2 where id=${r}`);
  const r2=await reservar(f,randomUUID(),f.B);const p2=await preparar(r2);await marcar(p2.lineaId,true);
  await liberar(r2);
  assert.deepEqual(await saldos(f),antes);
  await assert.rejects(servir(p2.cargaId,f.ubicacion2!),/no esta activa|no es unitaria/);
  assert.equal((await sql`select count(*)::int n from cargas where id=${p2.cargaId}`)[0].n,1);
  await sql`insert into hitos_proyecto(proyecto_id,tipo) values(${f.proyecto},'cierre')`;
  await assert.rejects(servir(p.cargaId,f.ubicacion),/Proyecto cerrado/);
  await sql`delete from hitos_proyecto where proyecto_id=${f.proyecto} and tipo='cierre'`;
  assert.deepEqual(await saldos(f),antes);
 });

 await test('Tras salida liberar rechaza; borrar carga y cierre de obra de kits siguen bloqueados',async()=>{
  const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
  await servir(p.cargaId,f.ubicacion);
  await assert.rejects(liberar(r));
  await assert.rejects(sql`delete from reservas where id=${r}`,/conserva historial/);
  const filas=await sql.begin('isolation level repeatable read read only',tx=>leerReservasSuministro(tx,f.sala));
  assert.equal(filas.find(x=>x.suministroId===f.A)?.reservaGestionadaId,null);
  assert.ok(filas.find(x=>x.suministroId===f.A)?.reservasVinculadas.includes(r));
  await assert.rejects(sql`delete from cargas where id=${p.cargaId}`);
  await assert.rejects(sql`update cargas set estado='cerrada' where id=${p.cargaId}`);
  await assert.rejects(sql`insert into cargas(sala_id,nombre) values(${f.sala},'Genérica kit')`);
 });

 await test('SQL: falsificación, token incompleto, efectos ausentes, identidad, cascadas',async()=>{
  const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
  await assert.rejects(sql`insert into operaciones_carga_kit(id,operacion,solicitud,cantidad)
   values(${randomUUID()},'preparar',${sql.json(solicitud({reservaId:r}))},1)`,/impuesto/);
  const token=randomUUID();await preparar(r,token);
  await assert.rejects(operarCargaKit(sql,{operacionId:token,operacion:'preparar',reservaId:f.B,autor}),/otros datos/);
  await assert.rejects(sql`insert into operaciones_carga_kit(id,operacion,solicitud)
   values(${randomUUID()},'servir',${sql.json(solicitud({cargaId:randomUUID(),ubicacionId:f.ubicacion}))})`,/carga gestionada/);
  await assert.rejects(sql`update carga_lineas set cantidad=2 where id=${p.lineaId}`);
  await assert.rejects(sql`update carga_lineas set articulo_id=${f.componente} where id=${p.lineaId}`);
  await servir(p.cargaId,f.ubicacion);
  const [m]=await sql`select movimiento_id from operaciones_carga_kit where carga_id=${p.cargaId} and operacion='servir'`;
  await assert.rejects(sql`update movimientos set cantidad=2 where id=${m.movimiento_id}`);
  await assert.rejects(sql`delete from movimientos where id=${m.movimiento_id}`);
  await assert.rejects(sql`delete from movimiento_suministros where movimiento_id=${m.movimiento_id}`);
  await assert.rejects(sql`update movimiento_suministros set cantidad=1,salida_movimiento_id=${m.movimiento_id} where movimiento_id=${m.movimiento_id}`);
  await assert.rejects(sql`delete from ubicaciones where id=${f.ubicacion}`);
  await assert.rejects(sql`update operaciones_carga_kit set operacion='marcar' where id=${token}`,/inmutable/);
 });

 await test('Reservar+preparar+marcar+servir en la misma TX',async()=>{
  const f=await fixture();
  await transaccionConControl(sql,async tx=>{
   const [res]=await tx`insert into operaciones_reserva_kit(id,operacion,solicitud)
    values(${randomUUID()},'reservar',${tx.json({autorId:autor.id,suministroId:f.A,reservaId:null})}) returning reserva_id`;
   const prep=await hechoPreparar(tx,String(res.reserva_id));
   await hechoMarcar(tx,prep.lineaId,true);
   await hechoServir(tx,prep.cargaId,f.ubicacion);
  });
  assert.deepEqual(await saldos(f),{E:0,R:0,D:0,Eu:0});
  assert.equal((await sql`select estado from reservas where articulo_id=${f.articulo}`)[0].estado,'servida');
 });

 for(const etapa of ['token','carga','linea','marcar','reserva','movimiento','atribucion'])await test(`Rollback tras ${etapa} conserva snapshot y permite mismo token`,async()=>{
  const f=await fixture();const r=await reservar(f);const token=randomUUID();
  const snapshot=async()=>JSON.stringify(await sql`select
   (select jsonb_agg(to_jsonb(c) order by c.id) from cargas c where sala_id=${f.sala}) cargas,
   (select jsonb_agg(to_jsonb(o) order by o.orden) from operaciones_carga_kit o where articulo_id=${f.articulo}) operaciones,
   (select jsonb_agg(to_jsonb(m) order by m.id) from movimientos m where articulo_id=${f.articulo} and tipo='salida') salidas,
   (select estado from reservas where id=${r}) reserva,
   disponible_stock_kit(${f.articulo}) disponible`);
  const antes=await snapshot();
  const tabla=etapa==='token'||etapa==='carga'?'operaciones_carga_kit':etapa==='linea'?'carga_lineas':etapa==='marcar'?'carga_lineas':etapa==='reserva'?'reservas':etapa==='movimiento'?'movimientos':'movimiento_suministros';
  await sql.unsafe(`create function qa_fallo_carga() returns trigger language plpgsql as $$ begin raise exception 'Fallo QA ${etapa}'; end $$`);
  const evento=etapa==='reserva'||etapa==='marcar'?'update':'insert';
  await sql.unsafe(`create trigger zzz_qa_fallo after ${evento} on ${tabla} for each row execute function qa_fallo_carga()`);
  try{
   if(etapa==='token'||etapa==='carga'||etapa==='linea')await assert.rejects(preparar(r,token),/Fallo QA/);
   else {
    const p=await preparar(r,token);
    if(etapa==='marcar')await assert.rejects(marcar(p.lineaId,true),/Fallo QA/);
    else {await marcar(p.lineaId,true);await assert.rejects(servir(p.cargaId,f.ubicacion),/Fallo QA/);}
   }
  }finally{await sql.unsafe(`drop trigger if exists zzz_qa_fallo on ${tabla}`);await sql.unsafe('drop function if exists qa_fallo_carga()');}
  if(etapa==='token'||etapa==='carga'||etapa==='linea'){
   assert.equal(await snapshot(),antes);
   await preparar(r,token);
  }else{
   const p=await preparar(r,token);
   if(etapa==='marcar'){await marcar(p.lineaId,true);assert.equal((await sql`select count(*)::int n from operaciones_carga_kit where operacion='marcar' and linea_id=${p.lineaId}`)[0].n,1);}
   else {await marcar(p.lineaId,true);await servir(p.cargaId,f.ubicacion);}
  }
 });

 await test('Reintento TX completa relee y revierte; 40001 tres veces; negocio no repite',async()=>{
  const f=await fixture();const r=await reservar(f);let intentos=0;const lecturas:number[]=[];
  const resultado=await transaccionConControl(sql,async tx=>{
   intentos++;lecturas.push(Number((await tx`select count(*)::int n from cargas where sala_id=${f.sala}`)[0].n));
   await hechoPreparar(tx,r);
   if(intentos<3)await tx.unsafe("do $$ begin raise exception 'Forzar aborto completo' using errcode='40001'; end $$");
   return 'confirmada';
  });
  assert.equal(resultado,'confirmada');assert.equal(intentos,3);assert.deepEqual(lecturas,[0,0,0]);
  assert.equal((await sql`select count(*)::int n from cargas where sala_id=${f.sala}`)[0].n,1);
  let n=0;await assert.rejects(transaccionConControl(sql,async()=>{n++;throw Object.assign(new Error('Negocio'),{code:'23514'});}),{code:'23514'});assert.equal(n,1);
 });

 await test('Agotamiento explícito ejecuta tres sentencias y no escribe',async()=>{
  const f=await fixture();const r=await reservar(f);
  let salir!:()=>void,entrar!:()=>void;const p=new Promise<void>(res=>salir=res),q=new Promise<void>(res=>entrar=res);
  const bloqueo=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;entrar();await p;});await q;
  const adaptada=sqlConReintentos(otra);const previo=escriturasOtra;
  try{await assert.rejects(adaptada`insert into operaciones_carga_kit(id,operacion,solicitud)
   values(${randomUUID()},'preparar',${otra.json(solicitud({reservaId:r}))})`,ErrorConcurrencia);}
  finally{salir();await bloqueo;}
  assert.equal(escriturasOtra-previo,3);
  assert.equal((await sql`select count(*)::int n from cargas where sala_id=${f.sala}`)[0].n,0);
 });

 for(const nivel of ['read committed','repeatable read'])for(const inverso of [false,true]){
  await test(`${nivel}: cargar/liberar, orden ${inverso?'liberar/cargar':'cargar/liberar'}`,async()=>{
   const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
   const cargar=(tx:TransactionSql)=>hechoServir(tx,p.cargaId,f.ubicacion);
   const soltar=async(tx:TransactionSql)=>{await tx`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id)
    values(${randomUUID()},'liberar',${tx.json({autorId:autor.id,reservaId:r,suministroId:null})},${r})`;};
   await carrera(`isolation level ${nivel}`,inverso?soltar:cargar,inverso?cargar:soltar,/no esta activa|no es unitaria|ya salio/);
   const estado=(await sql`select estado from reservas where id=${r}`)[0].estado;
   if(inverso){assert.equal(estado,'liberada');assert.equal((await sql`select estado from cargas where id=${p.cargaId}`)[0].estado,'preparacion');}
   else {assert.equal(estado,'servida');assert.deepEqual(await saldos(f),{E:0,R:0,D:0,Eu:0});}
  });
  await test(`${nivel}: dos reservas última unidad de ubicación, orden ${inverso?'B/A':'A/B'}`,async()=>{
   const f=await fixture(1,1);
   const ra=await reservar(f),rb=await reservar(f,randomUUID(),f.B);
   const pa=await preparar(ra),pb=await preparar(rb);
   await marcar(pa.lineaId,true);await marcar(pb.lineaId,true);
   const a=inverso?pb:pa,b=inverso?pa:pb;
   await carrera(`isolation level ${nivel}`,tx=>hechoServir(tx,a.cargaId,f.ubicacion),tx=>hechoServir(tx,b.cargaId,f.ubicacion),/No hay una unidad/);
   assert.equal((await sql`select count(*)::int n from movimientos where articulo_id=${f.articulo} and tipo='salida' and ubicacion_id=${f.ubicacion}`)[0].n,1);
  });
  await test(`${nivel}: cargar/cargar misma reserva, orden ${inverso?'B/A':'A/B'}`,async()=>{
   const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
   const t1=randomUUID(),t2=randomUUID();
   const uno=(tx:TransactionSql)=>hechoServir(tx,p.cargaId,f.ubicacion,inverso?t2:t1);
   const dos=(tx:TransactionSql)=>hechoServir(tx,p.cargaId,f.ubicacion,inverso?t1:t2);
   await carrera(`isolation level ${nivel}`,uno,dos,/ya salio|duplicate|unique|incompleta|servida|no esta activa|no es unitaria/i);
   assert.equal((await sql`select count(*)::int n from operaciones_carga_kit where operacion='servir' and reserva_id=${r}`)[0].n,1);
  });
 }

 await test('Movimiento concurrente deja la ubicación sin saldo y el reintento rechaza',async()=>{
  const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
  const [u2]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
  const mover=async(tx:TransactionSql)=>{
   await tx`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values(${f.articulo},${f.ubicacion},'ajuste',-1)`;
   await tx`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values(${f.articulo},${u2.id},'ajuste',1)`;
  };
  await carrera('isolation level read committed',mover,tx=>hechoServir(tx,p.cargaId,f.ubicacion),/No hay una unidad/);
  assert.equal(Number((await sql`select coalesce(sum(cantidad),0)::float8 n from existencias where articulo_id=${f.articulo} and ubicacion_id=${f.ubicacion}`)[0].n),0);
 });
 for(const inverso of [false,true])await test(`Borrar ubicación concurrente durante servir, orden ${inverso?'borrar/servir':'servir/borrar'}`,async()=>{
  const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
  const borrar=(tx:TransactionSql)=>tx`delete from ubicaciones where id=${f.ubicacion}`;
  const servirTx=(tx:TransactionSql)=>hechoServir(tx,p.cargaId,f.ubicacion);
  await carrera('isolation level read committed',inverso?borrar:servirTx,inverso?servirTx:borrar,
   inverso?/Elige la ubicacion|No hay una unidad/:/inmutable|foreign key|operaciones_carga_kit|restrict/i);
  const salidas=Number((await sql`select count(*)::int n from operaciones_carga_kit where operacion='servir' and carga_id=${p.cargaId}`)[0].n);
  const viva=Number((await sql`select count(*)::int n from ubicaciones where id=${f.ubicacion}`)[0].n);
  if(inverso){assert.equal(salidas,0);assert.equal(viva,0);}
  else {assert.equal(salidas,1);assert.equal(viva,1);}
 });

 await test('Lector RR conserva reserva activa y sin salida mientras el mutante confirma',async()=>{
  const f=await fixture();const r=await reservar(f);const p=await preparar(r);await marcar(p.lineaId,true);
  let seguir!:()=>void,avisar!:()=>void;
  const pausa=new Promise<void>(res=>seguir=res),inicio=new Promise<void>(res=>avisar=res);
  const aislamiento=process.env.CARGA_LECTOR_AISLAMIENTO??'repeatable read';
  const lectura=sql.begin(`isolation level ${aislamiento} read only`,async tx=>{
   const a=await leerCargaEnInstantanea(tx,p.cargaId);avisar();await pausa;
   const b=await leerCargaEnInstantanea(tx,p.cargaId);return [a,b];
  });
  await inicio;
  await operarCargaKit(otra,{operacionId:randomUUID(),operacion:'servir',cargaId:p.cargaId,ubicacionId:f.ubicacion,autor});
  seguir();
  const [a,b]=await lectura;
  assert.equal(a?.gestionada?.reservaEstado,'activa');assert.equal(b?.gestionada?.reservaEstado,'activa');
  assert.equal(a?.gestionada?.cobertura.servido,0);assert.equal(b?.gestionada?.cobertura.servido,0);
  assert.equal(a?.carga.estado,'preparacion');assert.equal(b?.carga.estado,'preparacion');
  const despues=await sql.begin('isolation level repeatable read read only',tx=>leerCargaEnInstantanea(tx,p.cargaId));
  assert.equal(despues?.gestionada?.reservaEstado,'servida');
  assert.equal(despues?.gestionada?.cobertura.servido,1);
  assert.equal(despues?.carga.estado,'cargada');
 });

 await test('Barrido SQL: control STATEMENT incluye operaciones_carga_kit y FK de ubicación restrictiva',async()=>{
  const triggers=await sql`select tgrelid::regclass::text tabla from pg_trigger where tgname='aa_control_statement' order by tabla`;
  assert.ok(triggers.some(t=>t.tabla==='operaciones_carga_kit'));
  assert.ok(triggers.some(t=>t.tabla==='operaciones_reserva_kit'));
  const fk=await sql`select confdeltype from pg_constraint where conrelid='operaciones_carga_kit'::regclass and conname like '%ubicacion%'`;
  assert.ok(fk.some(f=>f.confdeltype==='r'));
 });
}finally{
 moduloCarga._load=cargar;
 await sql.end();await otra.end();
}
