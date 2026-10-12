import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import postgres,{type Sql,type TransactionSql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {atribuirRegistroExistente,obtenerCoberturaSuministros} from '../src/lib/atribuciones-suministro-db';
const {recibirCompra,ErrorCompra}:typeof import('../src/lib/operaciones-compras')=await import(process.env.RECEPCION_MODULO??'../src/lib/operaciones-compras');
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_recepcion_[a-f0-9]{32}$/.test(url.pathname));
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){}}),monitor=postgres(url.href,{max:1,onnotice(){}});
const autor={id:randomUUID(),nombre:'QA receptor',ficticio:false};
const rechazo=(e:unknown)=>typeof e==='object'&&e!==null&&'code'in e&&['23514','23503','23505','40001'].includes(String(e.code));
async function fixture({cantidad=2,previo=0,mixto=false,compartido=false,legacy=false,atribuirB=true,comprado=true,orientativo=false}={}){
 const [proy]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
 const [loc]=await sql`insert into localizaciones(proyecto_id,nombre) values(${proy.id},'QA') returning id`;
 const [s]=await sql`insert into salas(nombre,localizacion_id) values(${randomUUID()},${loc.id}) returning id`;
 const [s2]=await sql`insert into salas(nombre,localizacion_id) values(${randomUUID()},${loc.id}) returning id`;
 const [art]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 const [componente]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${art.id},'QA',1,'parcial','QA') returning id`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente) values(${c.id},'pendiente','Pendiente','equipo',1,'por_determinar','QA')`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
  values(${c.id},'conocido',${componente.id},'Componente físico documentado','equipo',1,'incluido','QA documentada')`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 const [p]=await sql`insert into pedidos(sala_id,proyecto_id,estado) values(${compartido?null:s.id},${proy.id},'pedido') returning id`;
 const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,cantidad_recibida,comprado_en,comprado_por,precio_orientativo)
  values(${p.id},${art.id},${cantidad},${previo},case when ${comprado} then current_date else null end,'QA',${orientativo}) returning id`;
 let independiente:string|null=null;
 if(mixto){const [art2]=await sql`insert into articulos(tipo,categoria,modelo,unidad) values('cable','QA',${randomUUID()},'m') returning id`;
  const [l2]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,comprado_en,comprado_por) values(${p.id},${art2.id},1.5,current_date,'QA') returning id`;independiente=l2.id;}
 const [u]=await sql`insert into ubicaciones(nombre) values(${randomUUID()}) returning id`;
 const tokenLegacy=randomUUID();
 const solicitud={pedidoId:p.id,lineaId:l.id,cantidad:1,ubicacionId:u.id,autorId:autor.id};
 if(legacy)await sql`insert into recepciones_compra(id,pedido_id,solicitud) values(${tokenLegacy},${p.id},${sql.json(solicitud)})`;
 const a=await instanciarSuministro(sql,s.id,c.id),b=await instanciarSuministro(sql,compartido?s2.id:s.id,c.id);
 await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:l.id,atribuciones:[{suministroId:a,cantidad:1,recibido:0},...(cantidad>=2&&atribuirB?[{suministroId:b,cantidad:1 as const,recibido:0 as const}]:[])]});
 const orden=await sql`select suministro_id from suministro_pedido_asignaciones where pedido_linea_id=${l.id} order by creado_en,suministro_id`;
 return {pedido:String(p.id),linea:String(l.id),articulo:String(art.id),componente:String(componente.id),sala:String(s.id),otraSala:String(s2.id),ubicacion:String(u.id),a,b,orden:orden.map(x=>String(x.suministro_id)),independiente,tokenLegacy,solicitud};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
type Token={id:string;lineas_esperadas:{linea:string;cantidad:number}[];protocolo:string;transaccion:string};
async function recibir(f:Fixture,id=randomUUID(),cantidad=1){await recibirCompra(sql,{pedidoId:f.pedido,lineaId:f.linea,cantidad,ubicacionId:f.ubicacion,autor,recepcionId:id});return id;}
async function token(tx:TransactionSql,f:Fixture,id=randomUUID(),completo=false){
 const solicitud={...f.solicitud,...(completo?{lineaId:null,cantidad:null}:{})};
 const [t]=await tx<Token[]>`insert into recepciones_compra(id,pedido_id,solicitud) values(${id},${f.pedido},${tx.json(solicitud)}) returning *`;return t;
}
async function detalle(tx:TransactionSql,t:{id:string;lineas_esperadas:{linea:string;cantidad:number}[]}){
 for(const l of t.lineas_esperadas)await tx`insert into recepcion_lineas(recepcion_id,pedido_linea_id,cantidad) values(${t.id},${l.linea},${l.cantidad})`;
}
async function estado(f:Fixture){return {
 lineas:await sql`select * from pedido_lineas where pedido_id=${f.pedido} order by id`,
 tokens:await sql`select * from recepciones_compra where pedido_id=${f.pedido} order by id`,
 detalles:await sql`select d.* from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id where t.pedido_id=${f.pedido} order by d.orden`,
 movimientos:await sql`select * from movimientos where pedido_linea_id in(select id from pedido_lineas where pedido_id=${f.pedido}) order by id`,
 atribuciones:await sql`select * from suministro_pedido_asignaciones where pedido_linea_id in(select id from pedido_lineas where pedido_id=${f.pedido}) order by suministro_id`,
 reparto:await sql`select r.* from recepcion_repartos r join recepciones_compra t on t.id=r.recepcion_id where t.pedido_id=${f.pedido} order by suministro_id`,
 pedido:await sql`select * from pedidos where id=${f.pedido}`,
};}
async function carrera(primera:(tx:TransactionSql)=>Promise<void>,segunda:(tx:TransactionSql)=>Promise<void>,rr=false){
 let liberar!:()=>void,listo!:()=>void;
 const barrera=new Promise<void>(r=>liberar=r),inicio=new Promise<void>(r=>listo=r);
 const uno=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;await primera(tx);listo();await barrera;});
 await Promise.race([inicio,uno]);
 try{await assert.rejects(otra.begin(rr?'isolation level repeatable read':'',async tx=>{await tx`select tomar_control_escritura_kit()`;await segunda(tx);}),{code:'40001'});}finally{liberar();}
 await uno;
 return otra.begin(rr?'isolation level repeatable read':'',async tx=>{await tx`select tomar_control_escritura_kit()`;await segunda(tx);}).then(()=>({ok:true,error:null}),error=>({ok:false,error}));
}
try{
 for(const variante of ['sin_token','legacy','legacy_otra_linea'])await test(`Entrada compartida ${variante} sin detalle rechaza sin alterar filas`,async()=>{
  const f=await fixture({compartido:true,legacy:true,mixto:true});const antes=await estado(f);
  const linea=variante==='legacy_otra_linea'?f.independiente!:f.linea;
  const [l]=await sql`select articulo_id from pedido_lineas where id=${linea}`;
  await assert.rejects(sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad,sala_id,pedido_linea_id,recepcion_compra_id,quien)
   values(${l.articulo_id},${f.ubicacion},'entrada',1,null,${linea},${variante==='sin_token'?null:f.tokenLegacy},'QA SQL')`,
   e=>rechazo(e)&&/detalle exacto/.test(String(e)));
  assert.deepEqual(await estado(f),antes);
 });
 await test('Entrada compartida frente a alta de kit: ambos órdenes RC/RR conservan secuencia',async()=>{
  const referencia=await fixture();const [c]=await sql`select id from articulo_composiciones where articulo_kit_id=${referencia.articulo}`;
  for(const rr of [false,true])for(const kitPrimero of [false,true]){
   const [p]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
   const [loc]=await sql`insert into localizaciones(proyecto_id,nombre) values(${p.id},'QA') returning id`;
   const [s]=await sql`insert into salas(nombre,localizacion_id) values('Carrera entrada',${loc.id}) returning id`;
   const [pe]=await sql`insert into pedidos(proyecto_id) values(${p.id}) returning id`;
   const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad) values(${pe.id},${referencia.articulo},1) returning id`;
   const kit=async(tx:TransactionSql)=>{const dentro=new Proxy(sql,{get(target,propiedad){
    if(propiedad==='begin')return(cuerpo:(tx:TransactionSql)=>Promise<unknown>)=>cuerpo(tx);
    return Reflect.get(target,propiedad);
   }}) as Sql;await instanciarSuministro(dentro,s.id,c.id);};
   const entrada=async(tx:TransactionSql)=>{await tx`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad,pedido_linea_id)
    values(${referencia.articulo},${referencia.ubicacion},'entrada',1,${l.id})`;};
   const r=await carrera(kitPrimero?kit:entrada,kitPrimero?entrada:kit,rr);
   if(kitPrimero){assert.equal(r.ok,false);assert.ok(rechazo(r.error));
    assert.ok(/detalle exacto/.test(String(r.error))||(rr&&(r.error as {code:string}).code==='40001'));
   }else{assert.equal(r.ok,true,String(r.error));}
   assert.equal((await sql`select count(*)::int n from movimientos where pedido_linea_id=${l.id}`)[0].n,kitPrimero?0:1);
   assert.equal((await sql`select count(*)::int n from sala_suministros where sala_id=${s.id}`)[0].n,1);
  }
 });
 await sql`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave)
  values(${autor.id},${'qa_'+randomUUID()},${autor.nombre},'admin','QA no interactivo',false)`;
 await test('A/B reciben1 y1, stock comercial2, físico0; reintentos idénticos no duplican',async()=>{
  const f=await fixture();const id=await recibir(f);let e=await estado(f);
  assert.equal(Number(e.lineas[0].cantidad_recibida),1);assert.equal(e.movimientos.length,1);
  assert.equal(Number(e.atribuciones.find(a=>a.suministro_id===f.orden[0])?.cantidad_recibida_atribuida),1);
  assert.equal(Number(e.atribuciones.find(a=>a.suministro_id===f.orden[1])?.cantidad_recibida_atribuida),0);
  await recibir(f,id);assert.deepEqual(await estado(f),e);
  const finalId=await recibir(f);e=await estado(f);assert.equal(Number(e.lineas[0].cantidad_recibida),2);
  await recibir(f,finalId);assert.deepEqual(await estado(f),e);
  assert.equal(e.movimientos.length,2);assert.ok(e.movimientos.every(m=>m.articulo_id===f.articulo&&m.quien===autor.nombre));
  assert.equal((await sql`select count(*)::int n from sala_equipos where sala_id=${f.sala} and articulo_id=${f.componente}`)[0].n,2);
  assert.equal(Number((await sql`select coalesce(sum(cantidad),0) n from existencias where articulo_id=${f.articulo}`)[0].n),2);
  assert.equal(Number((await sql`select coalesce(sum(cantidad),0) n from existencias where articulo_id=${f.componente}`)[0].n),0);
  const p=await obtenerCoberturaSuministros(sql,f.sala);assert.equal(p.porSuministro.get(f.a)?.coberturaFisica,0);assert.equal(p.porSuministro.get(f.b)?.coberturaFisica,0);
  await assert.rejects(recibir(f,id,2),/otros datos/);
 });
 await test('Pedido compartido mixto recibe metros independientes y no inventa sala de entrada',async()=>{
  const f=await fixture({mixto:true,compartido:true});
  await recibirCompra(sql,{pedidoId:f.pedido,ubicacionId:f.ubicacion,autor,recepcionId:randomUUID()});
  const e=await estado(f);assert.equal(e.movimientos.length,2);assert.ok(e.movimientos.every(m=>m.sala_id===null));
  assert.equal(e.detalles.length,2);assert.equal(e.reparto.length,2);
  assert.equal((await sql`select count(*)::int n from movimiento_suministros where movimiento_id=any(${e.movimientos.map(m=>m.id)}::uuid[])`)[0].n,0);
 });
 await test('Recibido previo no se atribuye retroactivamente; sobrante permanece sin asignar',async()=>{
  const f=await fixture({cantidad:4,previo:1});await recibir(f,randomUUID(),3);
  const e=await estado(f);assert.equal(Number(e.lineas[0].cantidad_recibida),4);assert.equal(Number(e.movimientos[0].cantidad),3);
  assert.equal(e.reparto.length,2);assert.equal(Number(e.detalles[0].cantidad)-e.reparto.reduce((s,r)=>s+Number(r.cantidad),0),1);
 });
 await test('Completitud desde token vacío o parcial rechaza y revierte incluso sin materializador',async()=>{
  const f=await fixture({mixto:true});const antes=await estado(f);
  await assert.rejects(sql.begin(async tx=>{await token(tx,f);}),/incompleta desde token/);assert.deepEqual(await estado(f),antes);
  await assert.rejects(sql.begin(async tx=>{const t=await token(tx,f,randomUUID(),true);const l=t.lineas_esperadas[0];
   await tx`insert into recepcion_lineas(recepcion_id,pedido_linea_id,cantidad) values(${t.id},${l.linea},${l.cantidad})`;}),/incompleta desde token/);
  assert.deepEqual(await estado(f),antes);
 });
 await test('Baseline/xid/artículo proporcionados por cliente no se aceptan',async()=>{
  const f=await fixture();const antes=await estado(f);
  for(const campo of ['recibido_previo','transaccion','articulo_id']){
   await assert.rejects(sql.begin(async tx=>{const t=await token(tx,f);const extra=campo==='articulo_id'?f.articulo:campo==='transaccion'?'1':999;
    await tx`insert into recepcion_lineas ${tx({recepcion_id:t.id,pedido_linea_id:f.linea,cantidad:1,[campo]:extra})}`;}),/impuestos por servidor/);
  }
  assert.deepEqual(await estado(f),antes);
 });
 await test('Dos tokens consecutivos misma transacción suman desde primer baseline; reusar detalle no autoriza segundo incremento',async()=>{
  const f=await fixture();await sql.begin(async tx=>{await detalle(tx,await token(tx,f));await detalle(tx,await token(tx,f));});
  assert.equal(Number((await estado(f)).lineas[0].cantidad_recibida),2);
  const g=await fixture();const antes=await estado(g);
  await assert.rejects(sql.begin(async tx=>{await detalle(tx,await token(tx,g));await tx`update pedido_lineas set cantidad_recibida=cantidad_recibida+1 where id=${g.linea}`;}),/Kits pendientes/);
  assert.deepEqual(await estado(g),antes);
 });
 await test('No-op completo agotado es explícito; parcial agotada rechaza',async()=>{
  const f=await fixture();await recibir(f,randomUUID(),2);const antes=await estado(f);
  await recibirCompra(sql,{pedidoId:f.pedido,ubicacionId:f.ubicacion,autor,recepcionId:randomUUID()});
  const e=await estado(f);assert.equal(e.tokens.length,antes.tokens.length+1);assert.equal(e.detalles.length,antes.detalles.length);assert.equal(e.movimientos.length,antes.movimientos.length);
  await assert.rejects(recibir(f),/recepción supera/);
 });
 await test('Token histórico sigue legacy sin reinterpretar JSON ni crear detalles',async()=>{
  const f=await fixture({legacy:true,cantidad:1,previo:1});const antes=await estado(f);await recibir(f,f.tokenLegacy);assert.deepEqual(await estado(f),antes);
  assert.equal(antes.tokens[0].protocolo,'legacy');
  await assert.rejects(sql.begin(async tx=>{await tx`insert into recepcion_lineas(recepcion_id,pedido_linea_id,cantidad) values(${f.tokenLegacy},${f.linea},1)`;}),/token de esta transaccion/);
 });
 await test('Token/entrada inmutables y resto L3A permanece cerrado',async()=>{
  const f=await fixture();const id=await recibir(f);const antes=await estado(f);
  await assert.rejects(sql`update recepciones_compra set solicitud='{}' where id=${id}`,/inmutable/);
  await assert.rejects(sql`delete from movimientos where recepcion_compra_id=${id}`,/inmutable/);
  await assert.rejects(sql`insert into reservas(sala_id,articulo_id,cantidad) values(${f.sala},${f.articulo},1)`,/Kits pendientes/);
  await assert.rejects(sql`insert into cargas(sala_id,nombre) values(${f.sala},'No permitido')`,/Kits pendientes/);
  await assert.rejects(sql`insert into movimientos(sala_id,articulo_id,tipo,cantidad) values(${f.sala},${f.articulo},'salida',1)`,/Kits pendientes/);
  assert.deepEqual(await estado(f),antes);
 });
 await test('Fallo posterior a cada efecto revierte token, saldos y vínculos; reintento funciona',async()=>{
  for(const [tabla,op] of [['recepciones_compra','insert'],['pedido_lineas','update'],['movimientos','insert'],['recepcion_repartos','insert'],['pedidos','update'],['recepcion_lineas','insert']]){
   const f=await fixture();const antes=await estado(f);const id=randomUUID();
   await sql.unsafe("create or replace function qa_abortar_recepcion() returns trigger language plpgsql as $$ begin raise exception 'Fallo QA posterior' using errcode='P0001'; end $$");
   await sql.unsafe(`create trigger zzz_qa_fallo after ${op} on ${tabla} for each row execute function qa_abortar_recepcion()`);
   try{await assert.rejects(recibir(f,id),/Fallo QA posterior/);}finally{await sql.unsafe(`drop trigger zzz_qa_fallo on ${tabla}`);}
   assert.deepEqual(await estado(f),antes);await recibir(f,id);assert.equal((await estado(f)).movimientos.length,1);
  }
 });
 await test('API traduce solo rechazo de negocio; SQL conserva validación de fracción y destino',async()=>{
  const f=await fixture();const antes=await estado(f);
  await assert.rejects(recibir(f,randomUUID(),0.5),e=>e instanceof ErrorCompra&&/unidades enteras/.test(e.message));
  await assert.rejects(sql.begin(async tx=>{await tx`insert into recepciones_compra(id,pedido_id,solicitud)
   values(${randomUUID()},${f.pedido},${tx.json({...f.solicitud,cantidad:0.5})})`;}),/unidades enteras/);
  await assert.rejects(sql.begin(async tx=>{await tx`insert into recepciones_compra(id,pedido_id,solicitud)
   values(${randomUUID()},${f.pedido},${tx.json({...f.solicitud,ubicacionId:randomUUID()})})`;}),/almacen de recepcion/);
  assert.deepEqual(await estado(f),antes);
 });
 await test('Token actual no autoriza entrada duplicada ni entrada compartida sin detalle; xid se impone',async()=>{
  const f=await fixture({compartido:true});const id=await recibir(f);const antes=await estado(f);
  await assert.rejects(sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad,pedido_linea_id,recepcion_compra_id)
   values(${f.articulo},${f.ubicacion},'entrada',1,${f.linea},${id})`,/detalle exacto/);
  await assert.rejects(sql.begin(async tx=>{const t=await token(tx,f);await detalle(tx,t);
   await tx`update suministro_pedido_asignaciones set cantidad_recibida_atribuida=0 where pedido_linea_id=${f.linea}`;}),rechazo);
  assert.deepEqual(await estado(f),antes);
  const g=await fixture();await sql.begin(async tx=>{
   const [t]=await tx<Token[]>`insert into recepciones_compra(id,pedido_id,solicitud,protocolo,transaccion,lineas_esperadas)
    values(${randomUUID()},${g.pedido},${tx.json(g.solicitud)},'legacy','1','[]') returning *`;
   const [x]=await tx`select pg_current_xact_id()::text xid`;assert.equal(t.protocolo,'kit_v1');assert.equal(String(t.transaccion),x.xid);
   assert.equal(t.lineas_esperadas.length,1);await detalle(tx,t);
  });
 });
 await test('Dos recepciones concurrentes última unidad, ambos ganadores: solo1 efecto',async()=>{
  for(const inverso of [false,true]){
   const f=await fixture({cantidad:1});const ids=[randomUUID(),randomUUID()];if(inverso)ids.reverse();
   const dos=await carrera(async tx=>{await detalle(tx,await token(tx,f,ids[0]));},async tx=>{await detalle(tx,await token(tx,f,ids[1]));});
   assert.equal(dos.ok,false);assert.ok(rechazo(dos.error));assert.match(String(dos.error),/pendiente/);
   const e=await estado(f);assert.equal(e.movimientos.length,1);assert.equal(e.tokens.length,1);assert.equal(Number(e.lineas[0].cantidad_recibida),1);
  }
 });
 await test('Mismo token concurrente API confirma una vez y ambos retornan',async()=>{
  const f=await fixture({cantidad:1});const id=randomUUID();
  await Promise.all([recibir(f,id),recibirCompra(otra,{pedidoId:f.pedido,lineaId:f.linea,cantidad:1,ubicacionId:f.ubicacion,autor,recepcionId:id})]);
  const e=await estado(f);assert.equal(e.tokens.length,1);assert.equal(e.movimientos.length,1);assert.equal(Number(e.lineas[0].cantidad_recibida),1);
 });
 await test('Recepción contra atribución histórica, ambos órdenes RC y RR sin deadlock',async()=>{
  for(const rr of [false,true])for(const recibePrimero of [false,true]){
   const f=await fixture({atribuirB:false});
   const atribuir=async(tx:TransactionSql)=>{await tx`select id from salas where id=${f.sala} for update`;
    await tx`insert into suministro_pedido_asignaciones(pedido_linea_id,suministro_id,cantidad) values(${f.linea},${f.b},1)`;};
   const recepcionar=async(tx:TransactionSql)=>{await detalle(tx,await token(tx,f));};
   const r=await carrera(recibePrimero?recepcionar:atribuir,recibePrimero?atribuir:recepcionar,rr);
   if(!r.ok){assert.ok(rr);assert.equal((r.error as {code:string}).code,'40001');}
   if(!(await estado(f)).movimientos.length)await recibir(f);
   if(!(await estado(f)).atribuciones.some(a=>a.suministro_id===f.b))await sql.begin(atribuir);
   const e=await estado(f);assert.equal(e.movimientos.length,1);
   assert.equal(Number(e.atribuciones.find(a=>a.suministro_id===f.a)?.cantidad_recibida_atribuida),1);
   assert.equal(Number(e.atribuciones.find(a=>a.suministro_id===f.b)?.cantidad_recibida_atribuida),0);
  }
 });
 await test('SQL no materializa sin compra final aunque se invoque sin TypeScript',async()=>{
  for(const opciones of [{comprado:false},{orientativo:true}]){
   const f=await fixture(opciones);const antes=await estado(f);
   await assert.rejects(sql.begin(async tx=>{await detalle(tx,await token(tx,f));}),/compra con oferta final/);
   assert.deepEqual(await estado(f),antes);
  }
 });
 await test('Token concurrente a destino aborta antes de captura y reintenta contra destino vigente',async()=>{
  const [s]=await sql`insert into salas(nombre) values('Origen token QA') returning id`;
  const [s2]=await sql`insert into salas(nombre) values('Destino token QA') returning id`;
  const [p]=await sql`insert into pedidos(sala_id) values(${s.id}) returning id`;
  let soltar!:()=>void,listo!:()=>void;
  const puerta=new Promise<void>(r=>soltar=r),preparado=new Promise<void>(r=>listo=r);
  const uno=sql.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;await tx`select id from salas where id=${s.id} for update`;
   await tx`update pedidos set sala_id=${s2.id} where id=${p.id}`;listo();await puerta;});
  await preparado;
  const id=randomUUID();
  try{await assert.rejects(otra.begin(async tx=>{await tx`insert into recepciones_compra(id,pedido_id,solicitud) values(${id},${p.id},'{}')`;}),{code:'40001'});}finally{soltar();}
  await uno;
  assert.equal((await sql`select count(*)::int n from recepciones_compra where pedido_id=${p.id}`)[0].n,0);
  await otra.begin(async tx=>{await tx`select tomar_control_escritura_kit()`;await tx`insert into recepciones_compra(id,pedido_id,solicitud) values(${id},${p.id},'{}')`;});
  assert.equal((await sql`select sala_id from pedidos where id=${p.id}`)[0].sala_id,s2.id);
  assert.equal((await sql`select protocolo from recepciones_compra where id=${id}`)[0].protocolo,'legacy');
 });
}finally{await sql.end();await otra.end();await monitor.end();}
