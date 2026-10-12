import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import postgres from 'postgres';
import type {TransactionSql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {atribuirRegistroExistente,obtenerCoberturaSuministros} from '../src/lib/atribuciones-suministro-db';
import {recibirCompra} from '../src/lib/operaciones-compras';
import type * as ReservaModulo from '../src/lib/operaciones-reserva';
import {sqlConReintentos} from '../src/lib/sql-reintentos';
import {ErrorConcurrencia,transaccionConControl} from '../src/lib/control-escritura';
const url=new URL(process.env.DATABASE_URL??'');assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_reserva_[a-f0-9]{32}$/.test(url.pathname));
let escriturasOtra=0;
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){},debug(_conexion,consulta){if(/insert into movimientos/i.test(consulta))escriturasOtra++;}});
const autor={id:randomUUID(),nombre:'QA reserva',ficticio:false};
const {operarReservaKit}=await import(process.env.RESERVA_MODULO??'../src/lib/operaciones-reserva') as typeof ReservaModulo;
async function fixture(stock=1){
 const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 if(stock)await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',${stock})`;
 const [p]=await sql`insert into pedidos(sala_id,estado) values(${s.id},'pedido') returning id`;
 const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,comprado_en,comprado_por) values(${p.id},${a.id},2,current_date,'QA') returning id`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA') returning id`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente) values(${c.id},'pendiente','Pendiente','equipo',1,'por_determinar','QA')`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 const A=await instanciarSuministro(sql,s.id,c.id),B=await instanciarSuministro(sql,s.id,c.id);
 return {sala:String(s.id),articulo:String(a.id),composicion:String(c.id),pedido:String(p.id),linea:String(l.id),A,B};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
const reservar=(f:Fixture,id=randomUUID(),suministro=f.A)=>operarReservaKit(sql,{operacionId:id,operacion:'reservar',suministroId:suministro,autor});
const liberar=(reservaId:string,id=randomUUID())=>operarReservaKit(sql,{operacionId:id,operacion:'liberar',reservaId,autor});
async function saldo(f:Fixture){return Number((await sql`select disponible_stock_kit(${f.articulo}) d`)[0].d);}
async function hecho(tx:TransactionSql,suministro:string,token=randomUUID()){
 const [r]=await tx`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id)
 values(${token},'reservar',${tx.json({autorId:autor.id,suministroId:suministro,reservaId:null})},${token}) returning reserva_id`;
 return String(r.reserva_id);
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
 await test('Recibe B2a1, reservaA1 cobertura1, libera y conserva historial sin movimientos',async()=>{
  const f=await fixture(0);await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:f.linea,atribuciones:[{suministroId:f.A,cantidad:1,recibido:0},{suministroId:f.B,cantidad:1,recibido:0}]});
  const [u]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
  await recibirCompra(sql,{pedidoId:f.pedido,lineaId:f.linea,cantidad:1,ubicacionId:u.id,recepcionId:randomUUID(),autor});
  const antes=await sql`select * from movimientos where articulo_id=${f.articulo}`;
  const id=randomUUID(),r=await reservar(f,id);assert.equal(await saldo(f),0);
  let p=await obtenerCoberturaSuministros(sql,f.sala);assert.equal(p.porSuministro.get(f.A)?.coberturaFisica,1);assert.equal(p.porSuministro.get(f.B)?.coberturaFisica,0);
  await assert.doesNotReject(async()=>assert.equal(await reservar(f,id),r));await assert.rejects(reservar(f),/cubierto/);await assert.rejects(reservar(f,randomUUID(),f.B),/disponible/);
  const lid=randomUUID();await liberar(r,lid);await assert.doesNotReject(liberar(r,lid));assert.equal(await saldo(f),1);
  p=await obtenerCoberturaSuministros(sql,f.sala);assert.equal(p.porSuministro.get(f.A)?.coberturaFisica,0);
  assert.equal((await sql`select estado from reservas where id=${r}`)[0].estado,'liberada');
  assert.equal((await sql`select count(*)::int n from reserva_suministros where reserva_id=${r}`)[0].n,1);
  assert.deepEqual(await sql`select * from movimientos where articulo_id=${f.articulo}`,antes);
  assert.notEqual(await reservar(f),r);
 });
 await test('Déficit histórico no empeora; independiente fuera perímetro conserva semántica',async()=>{
  const f=await fixture(-3);await assert.rejects(reservar(f),/disponible/);
  await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'entrada',1)`;assert.equal(await saldo(f),-2);
  await assert.rejects(sql`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'salida',1)`,/agrava/);
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',-4)`;
 });
 await test('Compensación válida y OLD/NEW artículo verifican déficits separados',async()=>{
  const a=await fixture(),b=await fixture();
  await sql.begin(async tx=>{await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${a.articulo},'salida',2)`;await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${a.articulo},'entrada',2)`;});
  assert.equal(await saldo(a),1);
  await reservar(a);
  const [m]=await sql`select id from movimientos where articulo_id=${a.articulo} and tipo='ajuste'`;
  await assert.rejects(sql`update movimientos set articulo_id=${b.articulo},cantidad=3 where id=${m.id}`,/agrava/);
  assert.equal(await saldo(a),0);assert.equal(await saldo(b),1);
 });
 await test('Perímetro monotónico y baseline anterior a incorporación en misma TX',async()=>{
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  await assert.rejects(sql.begin(async tx=>{await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',-1)`;
   await tx`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA')`;}),/agrava/);
  const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA') returning id`;
  await sql`delete from articulo_composiciones where id=${c.id}`;
  assert.equal((await sql`select count(*)::int n from articulos_stock_kit where articulo_id=${a.id}`)[0].n,1);
  await assert.rejects(sql`delete from articulos_stock_kit where articulo_id=${a.id}`,/permanente/);
 });
 await test('Gestionada rechaza borrado, cantidad2, servida/reactivación y baseline cliente',async()=>{
  const f=await fixture();const r=await reservar(f);
  for(const consulta of [()=>sql`delete from reservas where id=${r}`,()=>sql`update reservas set cantidad=2 where id=${r}`,
   ()=>sql`update reservas set estado='servida' where id=${r}`])await assert.rejects(consulta);
  await liberar(r);await assert.rejects(sql`update reservas set estado='activa' where id=${r}`);
  await assert.rejects(sql`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id,disponible_previo)
   values(${randomUUID()},'reservar',${sql.json({autorId:autor.id,suministroId:f.A})},${randomUUID()},999)`,/impuesto/);
 });
 await test('Reintento completo cede control y ganador conserva saldo; agotamiento explícito',async()=>{
  const f=await fixture();let soltar!:()=>void,listo!:()=>void;
  const pausa=new Promise<void>(r=>soltar=r),inicio=new Promise<void>(r=>listo=r);
  const uno=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;listo();await pausa;});await inicio;
  const id=randomUUID();const intento=operarReservaKit(otra,{operacionId:id,operacion:'reservar',suministroId:f.A,autor});
  setTimeout(soltar,10);await uno;await intento;assert.equal(await saldo(f),0);
  let salir!:()=>void,entrar!:()=>void;const p=new Promise<void>(r=>salir=r),q=new Promise<void>(r=>entrar=r);
  const bloqueo=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;entrar();await p;});await q;
  const adaptada=sqlConReintentos(otra);
  const contadorPrevio=escriturasOtra;
  try{await assert.rejects(adaptada`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'entrada',1)`,ErrorConcurrencia);}finally{salir();await bloqueo;}
  assert.equal(escriturasOtra-contadorPrevio,3,'Agotamiento debe ejecutar exactamente tres sentencias autocommit');
  assert.equal(await saldo(f),0);
  await adaptada`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'entrada',1)`;assert.equal(await saldo(f),1);
 });
 await test('Reintento TX completa relee y revierte efectos en cada intento; negocio/conexión no repiten',async()=>{
  const f=await fixture(0);let intentos=0;const lecturas:number[]=[];
  const resultado=await transaccionConControl(sql,async tx=>{
   intentos++;lecturas.push(Number((await tx`select count(*)::int n from movimientos where articulo_id=${f.articulo}`)[0].n));
   await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'entrada',1)`;
   if(intentos<3)await tx.unsafe("do $$ begin raise exception 'Forzar aborto completo' using errcode='40001'; end $$");
   return 'confirmada';
  });
  assert.equal(resultado,'confirmada');assert.equal(intentos,3);assert.deepEqual(lecturas,[0,0,0]);assert.equal(await saldo(f),1);
  for(const code of ['23514','08006']){
   let n=0;await assert.rejects(transaccionConControl(sql,async()=>{n++;throw Object.assign(new Error('Negocio o conexión incierta'),{code});}),{code});assert.equal(n,1);
  }
 });
 await test('begin ajeno al protocolo conserva escritura usuarios sin tomar mutex kits',async()=>{
  let liberar!:()=>void,listo!:()=>void;const pausa=new Promise<void>(r=>liberar=r),inicio=new Promise<void>(r=>listo=r);
  const bloqueante=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;listo();await pausa;});await inicio;
  try{const cliente=sqlConReintentos(otra),id=randomUUID();
   await cliente.begin(async tx=>{await tx`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave) values(${id},${'qa_'+id},'Sin mutex kits','lectura','QA',false)`;});
   assert.equal((await otra`select nombre from usuarios where id=${id}`)[0].nombre,'Sin mutex kits');
  }finally{liberar();await bloqueante;}
 });
 await test('Proxy conserva lazy/lecturas readonly/retorno y transacción completa',async()=>{
  const cliente=sqlConReintentos(sql);const [antes]=await sql`select revision from control_atribuciones_kit`;
  const consulta=cliente`select 7 as n`;assert.equal((await consulta)[0].n,7);assert.equal((await consulta)[0].n,7);
  assert.equal(await cliente.begin('isolation level repeatable read read only',async tx=>(await tx`select 9 as n`)[0].n),9);
  assert.equal((await sql`select revision from control_atribuciones_kit`)[0].revision,antes.revision);
  assert.equal(await transaccionConControl(sql,async()=>11),11);
  const array=await cliente.begin(tx=>[tx`select 1 n`,tx`select 2 n`]);
  assert.equal(array[0][0].n,1);assert.equal(array[1][0].n,2);
  assert.deepEqual(await cliente`select 3 n`.values(),await sql`select 3 n`.values());
  assert.equal((await cliente.unsafe('select $1::int n',[4]))[0].n,4);
  assert.equal(await cliente.begin(tx=>tx.savepoint(sp=>sp`select 5 n`).then(r=>r[0].n)),5);
 });
 for(const etapa of ['token','reserva','enlace','liberacion'])await test(`Rollback tras ${etapa} conserva snapshot y permite mismo token`,async()=>{
  const f=await fixture(),token=randomUUID();const reserva=etapa==='liberacion'?await reservar(f):null;
  const snapshot=async()=>JSON.stringify(await sql`select
   (select jsonb_agg(to_jsonb(r) order by r.id) from reservas r where articulo_id=${f.articulo}) reservas,
   (select jsonb_agg(to_jsonb(o) order by o.orden) from operaciones_reserva_kit o where articulo_id=${f.articulo}) operaciones,
   (select jsonb_agg(to_jsonb(a) order by a.reserva_id) from reserva_suministros a where suministro_id in(${f.A},${f.B})) enlaces,
   disponible_stock_kit(${f.articulo}) disponible`);
  const antes=await snapshot(),tabla=etapa==='token'?'operaciones_reserva_kit':etapa==='enlace'?'reserva_suministros':'reservas';
  await sql.unsafe(`create function qa_fallo_reserva() returns trigger language plpgsql as $$ begin raise exception 'Fallo QA ${etapa}'; end $$`);
  await sql.unsafe(`create trigger zzz_qa_fallo after ${etapa==='liberacion'?'update':'insert'} on ${tabla} for each row execute function qa_fallo_reserva()`);
  try{await assert.rejects(etapa==='liberacion'?liberar(reserva!,token):reservar(f,token),new RegExp(`Fallo QA ${etapa}`));}
  finally{await sql.unsafe(`drop trigger zzz_qa_fallo on ${tabla}`);await sql.unsafe('drop function qa_fallo_reserva()');}
  assert.equal(await snapshot(),antes);
  if(etapa==='liberacion')await liberar(reserva!,token);else await reservar(f,token);
  assert.equal((await sql`select count(*)::int n from operaciones_reserva_kit where id=${token}`)[0].n,1);
 });
 await test('SQL genérico, efectos repetidos y token alterado rechazan sin cobertura falsa',async()=>{
  const f=await fixture(2),token=randomUUID(),r=await reservar(f,token);
  await assert.rejects(reservar(f,token,f.B),/otros datos/);
  for(const cantidad of [0.5,1,2])await assert.rejects(sql`insert into reservas(sala_id,articulo_id,cantidad) values(${f.sala},${f.articulo},${cantidad})`,{code:'23514'});
  await assert.rejects(sql`delete from reserva_suministros where reserva_id=${r}`,{code:'23514'});
  await assert.rejects(sql`update reserva_suministros set suministro_id=${f.B} where reserva_id=${r}`,{code:'23514'});
  await assert.rejects(sql.begin(async tx=>{const otro=await hecho(tx,f.B);await tx`insert into reservas(sala_id,articulo_id,cantidad) values(${f.sala},${f.articulo},1)`;return otro;}),{code:'23514'});
  assert.equal(await saldo(f),1);assert.equal((await sql`select count(*)::int n from reservas where articulo_id=${f.articulo}`)[0].n,1);
 });
 for(const nivel of ['read committed','repeatable read'])for(const inverso of [false,true]){
  await test(`${nivel}: A/B última unidad, orden ${inverso?'B/A':'A/B'}`,async()=>{
   const f=await fixture();const a=inverso?f.B:f.A,b=inverso?f.A:f.B;
   await carrera(`isolation level ${nivel}`,tx=>hecho(tx,a),tx=>hecho(tx,b),/disponible/);
   assert.equal(await saldo(f),0);assert.equal((await sql`select count(*)::int n from reservas where articulo_id=${f.articulo}`)[0].n,1);
  });
  await test(`${nivel}: salas distintas comparten artículo últimaunidad, orden ${inverso?'B/A':'A/B'}`,async()=>{
   const f=await fixture();const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
   const c=await instanciarSuministro(sql,s.id,f.composicion),a=inverso?c:f.A,b=inverso?f.A:c;
   await carrera(`isolation level ${nivel}`,tx=>hecho(tx,a),tx=>hecho(tx,b),/disponible/);assert.equal(await saldo(f),0);
  });
  await test(`${nivel}: reserva/liberación, orden ${inverso?'liberar/reservar':'reservar/liberar'}`,async()=>{
   const f=await fixture(2),r=await reservar(f),token=randomUUID();
   const soltar=async(tx:TransactionSql)=>{await tx`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id)
    values(${token},'liberar',${tx.json({autorId:autor.id,reservaId:r,suministroId:null})},${r})`;};
   const guardar=(tx:TransactionSql)=>hecho(tx,f.B);
   await carrera(`isolation level ${nivel}`,inverso?soltar:guardar,inverso?guardar:soltar);assert.equal(await saldo(f),1);
   assert.equal((await sql`select estado from reservas where id=${r}`)[0].estado,'liberada');
  });
  await test(`${nivel}: reserva/recepción B2a, orden ${inverso?'recibir/reservar':'reservar/recibir'}`,async()=>{
   const f=await fixture();await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:f.linea,atribuciones:[{suministroId:f.A,cantidad:1,recibido:0},{suministroId:f.B,cantidad:1,recibido:0}]});
   const [u]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;const token=randomUUID();
   const recibir=async(tx:TransactionSql)=>{await tx`insert into recepciones_compra(id,pedido_id,solicitud) values(${token},${f.pedido},${tx.json({pedidoId:f.pedido,lineaId:f.linea,cantidad:1,ubicacionId:u.id,autorId:autor.id})})`;
    await tx`insert into recepcion_lineas(recepcion_id,pedido_linea_id,cantidad) values(${token},${f.linea},1)`;};
   const guardar=(tx:TransactionSql)=>hecho(tx,f.A);
   await carrera(`isolation level ${nivel}`,inverso?recibir:guardar,inverso?guardar:recibir);assert.equal(await saldo(f),1);
   assert.equal(Number((await sql`select cantidad_recibida from pedido_lineas where id=${f.linea}`)[0].cantidad_recibida),1);
  });
  await test(`${nivel}: reserva/legacy stock, orden ${inverso?'legacy/reserva':'reserva/legacy'}`,async()=>{
   const f=await fixture();const reserva=(tx:TransactionSql)=>hecho(tx,f.A);
   const legacy=async(tx:TransactionSql)=>{await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'salida',1)`;};
   await carrera(`isolation level ${nivel}`,inverso?legacy:reserva,inverso?reserva:legacy,inverso?/disponible/:/agrava/);
   assert.equal(await saldo(f),0);
  });
  await test(`${nivel}: incorporación perímetro/legacy, orden ${inverso?'legacy/kit':'kit/legacy'}`,async()=>{
   const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
   const kit=async(tx:TransactionSql)=>{await tx`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${a.id},'QA',1,'parcial','QA')`;};
   const legacy=async(tx:TransactionSql)=>{await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${a.id},'ajuste',-1)`;};
   await carrera(`isolation level ${nivel}`,inverso?legacy:kit,inverso?kit:legacy,inverso?undefined:/agrava/);
   assert.equal(Number((await sql`select disponible_stock_kit(${a.id}) d`)[0].d),inverso?-1:0);
  });
 }
 await test('Snapshot RR anterior al ganador aborta por revisión y reintenta con saldo actual',async()=>{
  const f=await fixture();let seguir!:()=>void,avisar!:()=>void;
  const pausa=new Promise<void>(r=>seguir=r),inicio=new Promise<void>(r=>avisar=r);
  const lectura=otra.begin('isolation level repeatable read',async tx=>{await tx`select revision from control_atribuciones_kit`;avisar();await pausa;await tx`select tomar_control_escritura_kit()`;await hecho(tx,f.B);});
  const rechazo=assert.rejects(lectura,{code:'40001'});await inicio;await reservar(f);seguir();await rechazo;
  await assert.rejects(operarReservaKit(otra,{operacionId:randomUUID(),operacion:'reservar',suministroId:f.B,autor}),/disponible/);
  assert.equal(await saldo(f),0);
 });
 await test('Dos hechos válidos misma TX registran baseline propio y reserva/liberación íntegra',async()=>{
  const f=await fixture(2);
  await transaccionConControl(sql,async tx=>{const r=await hecho(tx,f.A);await hecho(tx,f.B);const id=randomUUID();
   await tx`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id) values(${id},'liberar',${tx.json({autorId:autor.id,reservaId:r})},${r})`;});
  const operaciones=await sql`select disponible_previo from operaciones_reserva_kit where articulo_id=${f.articulo} order by orden`;
  assert.deepEqual(operaciones.map(x=>Number(x.disponible_previo)),[2,1,0]);assert.equal(await saldo(f),1);
 });
 await test('Prelock externo sala antes del control aborta completo y reintenta tras ganador',async()=>{
  const f=await fixture(),token=randomUUID();let bloqueada!:()=>void,controlado!:()=>void;
  const inicio=new Promise<void>(r=>bloqueada=r),control=new Promise<void>(r=>controlado=r);
  const externo=otra.begin(async tx=>{await tx`select id from salas where id=${f.sala} for update`;bloqueada();await control;
   await tx`update salas set nombre='No debe persistir' where id=${f.sala}`;});
  const rechazo=assert.rejects(externo,{code:'40001'});await inicio;
  const ganador=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;controlado();await hecho(tx,f.A,token);});
  await rechazo;await ganador;
  assert.notEqual((await sql`select nombre from salas where id=${f.sala}`)[0].nombre,'No debe persistir');
  await transaccionConControl(otra,async tx=>{await tx`update salas set nombre='Reintentada' where id=${f.sala}`;});
  await assert.doesNotReject(async()=>assert.equal(await reservar(f,token),(await sql`select reserva_id from operaciones_reserva_kit where id=${token}`)[0].reserva_id));
  assert.equal(await saldo(f),0);
 });
 await test('Entrada STATEMENT rechaza antes de esperar fila: observación pg_stat_activity',async()=>{
  const observador=postgres(url.href,{max:1,onnotice(){}}),f=await fixture();
  let soltar!:()=>void,avisar!:()=>void;const pausa=new Promise<void>(r=>soltar=r),inicio=new Promise<void>(r=>avisar=r);
  const [p]=await otra`select pg_backend_pid() pid`;let terminada=false,codigo:string|undefined;
  const ganador=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;await tx`select id from salas where id=${f.sala} for update`;avisar();await pausa;});
  await inicio;
  const intento=otra`update salas set nombre='Mutación competidora' where id=${f.sala}`.then(()=>{terminada=true;},error=>{codigo=error.code;terminada=true;});
  let esperaFila=false;
  try{
   for(let vuelta=0;vuelta<100&&!terminada;vuelta++){
    const [actividad]=await observador`select wait_event_type from pg_stat_activity where pid=${p.pid}`;
    if(actividad?.wait_event_type==='Lock'){esperaFila=true;await observador`select pg_cancel_backend(${p.pid})`;break;}
    await new Promise(r=>setTimeout(r,5));
   }
   if(!terminada&&!esperaFila)await observador`select pg_cancel_backend(${p.pid})`;
   await intento;
   assert.equal(esperaFila,false,'La sentencia tomó/esperó fila antes de intentar el control');assert.equal(codigo,'40001');
  }finally{soltar();await ganador;await observador.end();}
 });
 await test('Barrido SQL real: cobertura STATEMENT y fronteras FK no vacías',async()=>{
  const triggers=await sql`select tgrelid::regclass::text tabla,tgtype::int tipo from pg_trigger where tgname='aa_control_statement' order by tabla`;
  assert.ok(triggers.length>0);
  const esperadas=['articulos','articulo_composiciones','articulo_composicion_lineas','sala_suministros','sala_componentes_suministro','salas','localizaciones','proyectos','hitos_proyecto','pedidos','pedido_lineas','recepciones_compra','recepcion_lineas','recepcion_repartos','movimientos','reservas','cargas','carga_lineas','suministro_pedido_asignaciones','reserva_suministros','movimiento_suministros','operaciones_reserva_kit','articulos_stock_kit','operaciones_carga_kit'].sort();
  assert.deepEqual(triggers.map(t=>t.tabla).sort(),esperadas);
  assert.ok(triggers.every(t=>t.tipo===30),'BEFORE STATEMENT INSERT UPDATE DELETE en todas las tablas del contrato');
  const fronteras=await sql`select c.conrelid::regclass::text hija,c.confrelid::regclass::text padre,c.confdeltype
   from pg_constraint c where c.contype='f' and c.conrelid in(select tgrelid from pg_trigger where tgname='aa_control_statement')
   and c.confrelid not in(select tgrelid from pg_trigger where tgname='aa_control_statement') order by hija,padre`;
  assert.ok(fronteras.length>0);assert.ok(fronteras.some(f=>f.hija==='movimientos'&&f.padre==='ubicaciones'&&f.confdeltype==='n'));
  console.log('Fronteras FK reales:',JSON.stringify([...fronteras]));
 });
 for(const nivel of ['read committed','repeatable read'])for(const inverso of [false,true]){
  await test(`${nivel}: cascada desde ubicación externa, orden ${inverso?'reserva/cascada':'cascada/reserva'}`,async()=>{
   const f=await fixture(),token=randomUUID();
   const [u]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
   await sql`update movimientos set ubicacion_id=${u.id} where articulo_id=${f.articulo}`;
   const cascada=(tx:TransactionSql)=>tx`delete from ubicaciones where id=${u.id}`;
   const reserva=(tx:TransactionSql)=>hecho(tx,f.A,token);
   await carrera(`isolation level ${nivel}`,inverso?reserva:cascada,inverso?cascada:reserva,undefined,{primero:inverso,segundo:!inverso});
   assert.equal(await saldo(f),0);
   assert.equal((await sql`select count(*)::int n from ubicaciones where id=${u.id}`)[0].n,0);
   assert.equal((await sql`select ubicacion_id from movimientos where articulo_id=${f.articulo}`)[0].ubicacion_id,null);
   assert.equal((await sql`select count(*)::int n from operaciones_reserva_kit where id=${token}`)[0].n,1);
  });
  await test(`${nivel}: lotes con padres opuestos ${inverso?'B/A':'A/B'} reintentan completos`,async()=>{
   const a=await fixture(2),b=await fixture(2),tokens=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
   const lote=(orden:Fixture[],indice:number)=>(async(tx:TransactionSql)=>{
    for(let i=0;i<orden.length;i++){const f=orden[i];await tx`select id from salas where id=${f.sala} for update`;
     await hecho(tx,indice===0?f.A:f.B,tokens[indice*2+i]);}
   });
   await carrera(`isolation level ${nivel}`,lote(inverso?[b,a]:[a,b],0),lote(inverso?[a,b]:[b,a],1));
   assert.equal(await saldo(a),0);assert.equal(await saldo(b),0);
   assert.equal((await sql`select count(*)::int n from operaciones_reserva_kit where id=any(${tokens}::uuid[])`)[0].n,4);
  });
  await test(`${nivel}: reserva legacy compromete la unidad, orden ${inverso?'kit/legacy':'legacy/kit'}`,async()=>{
   const f=await fixture();const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
   const legacy=(tx:TransactionSql)=>tx`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${f.articulo},1)`;
   const kit=(tx:TransactionSql)=>hecho(tx,f.A);
   await carrera(`isolation level ${nivel}`,inverso?kit:legacy,inverso?legacy:kit,inverso?/agrava/:/disponible/);
   assert.equal(await saldo(f),0);
   assert.equal((await sql`select sum(cantidad)::float8 n from reservas where articulo_id=${f.articulo} and estado='activa'`)[0].n,1);
  });
 }
 await test('OLD/NEW movimiento: cantidad, tipo, signo y DELETE respetan déficit final',async()=>{
  const f=await fixture();await reservar(f);
  const [m]=await sql`select id from movimientos where articulo_id=${f.articulo}`;
  for(const accion of [()=>sql`delete from movimientos where id=${m.id}`,
   ()=>sql`update movimientos set cantidad=-1 where id=${m.id}`,
   ()=>sql`update movimientos set tipo='salida' where id=${m.id}`])await assert.rejects(accion(),/agrava/);
  await sql.begin(async tx=>{await tx`delete from movimientos where id=${m.id}`;
   await tx`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'entrada',1)`;});
  assert.equal(await saldo(f),0);
  await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'ajuste',1)`;
  await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${f.articulo},'ajuste',-1)`;
  assert.equal(await saldo(f),0);
 });
 await test('OLD/NEW reserva legacy: estado, artículo, cantidad y DELETE no compensan otro artículo',async()=>{
  const a=await fixture(),b=await fixture(0);const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
  const [r]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${a.articulo},1) returning id`;
  await assert.rejects(sql`update reservas set articulo_id=${b.articulo} where id=${r.id}`,/agrava/);
  await assert.rejects(sql`update reservas set cantidad=2 where id=${r.id}`,/agrava/);
  await sql`update reservas set estado='liberada' where id=${r.id}`;await reservar(a);
  await assert.rejects(sql`update reservas set estado='activa' where id=${r.id}`,/agrava/);
  await sql`delete from reservas where id=${r.id}`;
  assert.equal(await saldo(a),0);assert.equal(await saldo(b),0);
 });
 await test('Composición borrador cambia artículo y se borra sin desproteger el viejo con reserva viva',async()=>{
  const ids=[];for(let i=0;i<2;i++)ids.push((await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`)[0].id);
  const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
  await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${ids[0]},'entrada',1)`;
  await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${ids[0]},1)`;
  const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${ids[0]},'QA',1,'parcial','QA') returning id`;
  await sql`update articulo_composiciones set articulo_kit_id=${ids[1]} where id=${c.id}`;
  await sql`delete from articulo_composiciones where id=${c.id}`;
  assert.equal((await sql`select count(*)::int n from articulos_stock_kit where articulo_id=any(${ids}::uuid[])`)[0].n,2);
  await assert.rejects(sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${ids[0]},1)`,/agrava/);
  await assert.rejects(sql`update articulos set id=${randomUUID()} where id=${ids[0]}`,{code:'23503'});
 });
 for(const nivel of ['read committed','repeatable read'])for(const inverso of [false,true]){
  await test(`${nivel}: cambio concurrente de artículo del movimiento, orden ${inverso?'reserva/cambio':'cambio/reserva'}`,async()=>{
   const a=await fixture(),b=await fixture();const [m]=await sql`select id from movimientos where articulo_id=${a.articulo}`;
   const cambio=(tx:TransactionSql)=>tx`update movimientos set articulo_id=${b.articulo} where id=${m.id}`;
   const reserva=(tx:TransactionSql)=>hecho(tx,a.A);
   await carrera(`isolation level ${nivel}`,inverso?reserva:cambio,inverso?cambio:reserva,inverso?/agrava/:/disponible/);
   assert.equal(await saldo(a),0);assert.equal(await saldo(b),inverso?1:2);
   assert.equal((await sql`select articulo_id from movimientos where id=${m.id}`)[0].articulo_id,inverso?a.articulo:b.articulo);
  });
  await test(`${nivel}: jerarquía cerrada concurrente, orden ${inverso?'reserva/traslado':'traslado/reserva'}`,async()=>{
   const f=await fixture(),token=randomUUID();
   const [p]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
   const [l]=await sql`insert into localizaciones(proyecto_id,nombre) values(${p.id},${randomUUID()}) returning id`;
   await sql`insert into hitos_proyecto(proyecto_id,tipo) values(${p.id},'cierre')`;
   const traslado=(tx:TransactionSql)=>tx`update salas set localizacion_id=${l.id} where id=${f.sala}`;
   const reserva=(tx:TransactionSql)=>hecho(tx,f.A,token);
   await carrera(`isolation level ${nivel}`,inverso?reserva:traslado,inverso?traslado:reserva,inverso?undefined:/Proyecto cerrado/);
   assert.equal((await sql`select localizacion_id from salas where id=${f.sala}`)[0].localizacion_id,l.id);
   assert.equal((await sql`select count(*)::int n from operaciones_reserva_kit where id=${token}`)[0].n,inverso?1:0);
   assert.equal(await saldo(f),inverso?0:1);
  });
 }
}finally{await sql.end();await otra.end();}
