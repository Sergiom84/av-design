import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import postgres, {type TransactionSql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {atribuirRegistroExistente,obtenerCoberturaSuministros,leerAtribucionesSuministro} from '../src/lib/atribuciones-suministro-db';
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_atribuciones_[a-f0-9]{32}$/.test(url.pathname));
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){}});
const rechazo=(e:unknown)=>typeof e==='object'&&e!==null&&'code' in e&&['23514','23503','23505','40001'].includes(String(e.code));
async function fixture(cantidad=1,proyectoId:string|null=null){
 const [s]=await sql`insert into salas(nombre) values(${randomUUID()}) returning id`;
 const [art]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 // Stock sintético explícito para las dos reservas y las salidas de este fixture.
 // B1 verifica atribución; B2b verifica por separado el agotamiento del disponible.
 await sql`insert into movimientos(articulo_id,tipo,cantidad) values(${art.id},'ajuste',${cantidad*4})`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente)
  values(${art.id},'QA parcial',1,'parcial','QA') returning id`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente)
  values(${c.id},'pendiente','Identidad pendiente','equipo',1,'por_determinar','QA')`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 const [p]=await sql`insert into pedidos(sala_id,proyecto_id) values(${s.id},${proyectoId}) returning id`;
 const lineas=[],reservas=[],movimientos=[];
 for(let i=0;i<2;i++){
  const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,cantidad_recibida) values(${p.id},${art.id},${cantidad},1) returning id`;lineas.push(String(l.id));
  const [r]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${art.id},${cantidad}) returning id`;reservas.push(String(r.id));
 }
 for(const estado of ['servida','liberada']){
  const [r]=await sql`insert into reservas(sala_id,articulo_id,cantidad,estado) values(${s.id},${art.id},1,${estado}) returning id`;reservas.push(String(r.id));
 }
 for(const tipo of ['salida','devolucion','devolucion','salida','entrada','baja']){
  const [m]=await sql`insert into movimientos(sala_id,articulo_id,tipo,cantidad) values(${s.id},${art.id},${tipo}::tipo_movimiento,${cantidad}) returning id`;movimientos.push(String(m.id));
 }
 const [ajeno]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
 const [resAjena]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${ajeno.id},1) returning id`;
 const [movAjeno]=await sql`insert into movimientos(sala_id,articulo_id,tipo,cantidad) values(${s.id},${ajeno.id},'salida',1) returning id`;
 const [lineaAjena]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad) values(${p.id},${ajeno.id},1) returning id`;
 const a=await instanciarSuministro(sql,s.id,c.id),b=await instanciarSuministro(sql,s.id,c.id);
 return {sala:String(s.id),articulo:String(art.id),composicion:String(c.id),pedido:String(p.id),lineas,reservas,movimientos,a,b,resAjena:String(resAjena.id),movAjeno:String(movAjeno.id),lineaAjena:String(lineaAjena.id)};
}
async function res(tx:TransactionSql,id:string,sid:string){await tx`insert into reserva_suministros(reserva_id,suministro_id,cantidad) values(${id},${sid},1)`;}
async function mov(tx:TransactionSql,id:string,sid:string,salida:string|null=null){await tx`insert into movimiento_suministros(movimiento_id,suministro_id,cantidad,salida_movimiento_id) values(${id},${sid},1,${salida})`;}
async function ped(tx:TransactionSql,id:string,sid:string){await tx`insert into suministro_pedido_asignaciones(pedido_linea_id,suministro_id,cantidad) values(${id},${sid},1)`;}
async function carrera(primera:(tx:TransactionSql)=>Promise<void>,segunda:(tx:TransactionSql)=>Promise<void>,rr=false){
 let liberar!:()=>void,insertado!:()=>void;
 const puerta=new Promise<void>(r=>liberar=r),lista=new Promise<void>(r=>insertado=r);
 const uno=sql.begin(async tx=>{await primera(tx);insertado();await puerta;});
 await lista;
 try{await assert.rejects(otra.begin(rr?'isolation level repeatable read':'',async tx=>{await segunda(tx);}),{code:'40001'});}
 finally{liberar();await uno;}
 // El rechazo técnico no acredita B1: reintentar la TX entera tras el commit.
 await assert.rejects(otra.begin(rr?'isolation level repeatable read':'',async tx=>{await segunda(tx);}),
  e=>rechazo(e)&&'code' in (e as object)&&(e as {code:string}).code!=='40001');
}
try{
 await test('Pedido2 atribuye A/B y recibido1 solo A; recepción no acredita cobertura',async()=>{
  const f=await fixture(2);
  await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:f.lineas[0],atribuciones:[{suministroId:f.a,cantidad:1,recibido:0},{suministroId:f.b,cantidad:1,recibido:0}]});
  await sql`update suministro_pedido_asignaciones set cantidad_recibida_atribuida=1 where pedido_linea_id=${f.lineas[0]} and suministro_id=${f.a}`;
  await assert.rejects(sql`update suministro_pedido_asignaciones set cantidad_recibida_atribuida=1 where pedido_linea_id=${f.lineas[0]} and suministro_id=${f.b}`,/supera cantidad o recepcion/);
  await assert.rejects(sql`update suministro_pedido_asignaciones set cantidad_recibida_atribuida=0 where pedido_linea_id=${f.lineas[0]} and suministro_id=${f.a}`,/No se reasigna/);
  const p=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(p.porSuministro.get(f.a)?.recibido,1);assert.equal(p.porSuministro.get(f.b)?.recibido,0);
  assert.equal(p.porSuministro.get(f.a)?.coberturaFisica,0);assert.equal(p.porSuministro.get(f.b)?.coberturaFisica,0);
  await assert.rejects(sql.begin(tx=>ped(tx,f.lineas[1],f.a)),rechazo);
 });
 await test('Reserva1 no se atribuye a dos suministros; lote completo revierte',async()=>{
  const f=await fixture();
  await assert.rejects(atribuirRegistroExistente(sql,{tipo:'reserva',registroId:f.reservas[0],atribuciones:[{suministroId:f.a,cantidad:1},{suministroId:f.b,cantidad:1}]}),rechazo);
  assert.equal((await sql`select count(*)::int n from reserva_suministros where reserva_id=${f.reservas[0]}`)[0].n,0);
 });
 await test('Recibido atribuido no supera recibido canónico aunque haya cantidad pedida suficiente',async()=>{
  const f=await fixture(2);
  await assert.rejects(atribuirRegistroExistente(sql,{tipo:'pedido',registroId:f.lineas[0],atribuciones:[{suministroId:f.a,cantidad:1,recibido:1},{suministroId:f.b,cantidad:1,recibido:1}]}),/supera cantidad o recepcion/);
  assert.equal((await sql`select count(*)::int n from suministro_pedido_asignaciones where pedido_linea_id=${f.lineas[0]}`)[0].n,0);
 });
 await test('Pedido compartido acepta dos salas de obra; cambio de jerarquía inverso rechaza y revierte',async()=>{
  const f=await fixture();
  const [p]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
  const [q]=await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
  const [l]=await sql`insert into localizaciones(proyecto_id,nombre) values(${p.id},'QA') returning id`;
  const [otraLoc]=await sql`insert into localizaciones(proyecto_id,nombre) values(${q.id},'Otro edificio QA') returning id`;
  const [g]=await sql`insert into salas(nombre,localizacion_id) values('Segunda QA',${l.id}) returning id`;
  const [pedido]=await sql`insert into pedidos(proyecto_id) values(${p.id}) returning id`;
  const [linea]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,cantidad_recibida) values(${pedido.id},${f.articulo},2,1) returning id`;
  await sql`update salas set localizacion_id=${l.id} where id=${f.sala}`;
  const c=await instanciarSuministro(sql,g.id,f.composicion);
  await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:linea.id,atribuciones:[{suministroId:f.a,cantidad:1,recibido:1},{suministroId:c,cantidad:1,recibido:0}]});
  await assert.rejects(sql.begin(tx=>ped(tx,f.lineas[0],c)),/Pedido incompatible/);
  await assert.rejects(sql`update salas set localizacion_id=${otraLoc.id} where id=${g.id}`,/Pedido incompatible/);
  await assert.rejects(sql`update localizaciones set proyecto_id=${q.id} where id=${l.id}`,/Pedido incompatible/);
  assert.equal((await sql`select localizacion_id from salas where id=${g.id}`)[0].localizacion_id,l.id);
  assert.equal((await sql`select proyecto_id from localizaciones where id=${l.id}`)[0].proyecto_id,p.id);
  const incoherente=await fixture(1,q.id);
  await assert.rejects(sql.begin(tx=>ped(tx,incoherente.lineas[0],incoherente.a)),/Pedido incompatible/);
 });
 await test('Salida A cubre A1/B0, retorno A y baja dejan A0/B0; original conservado',async()=>{
  const f=await fixture();const antes=await sql`select * from movimientos where id=any(${f.movimientos}::uuid[]) order by id`;
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[0],atribuciones:[{suministroId:f.a,cantidad:1,salidaMovimientoId:null}]});
  let p=await obtenerCoberturaSuministros(sql,f.sala);assert.equal(p.porSuministro.get(f.a)?.servido,1);assert.equal(p.porSuministro.get(f.b)?.servido,0);
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[1],atribuciones:[{suministroId:f.a,cantidad:1,salidaMovimientoId:f.movimientos[0]}]});
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[5],atribuciones:[{suministroId:f.a,cantidad:1,salidaMovimientoId:null}]});
  p=await obtenerCoberturaSuministros(sql,f.sala);assert.equal(p.porSuministro.get(f.a)?.servido,0);assert.equal(p.porSuministro.get(f.b)?.servido,0);
  assert.deepEqual(await sql`select * from movimientos where id=any(${f.movimientos}::uuid[]) order by id`,antes);
 });
 await test('SQL rechaza padre movimiento excedido, retorno cruzado y retorno doble',async()=>{
  const f=await fixture();await sql.begin(tx=>mov(tx,f.movimientos[0],f.a));
  await assert.rejects(sql.begin(tx=>mov(tx,f.movimientos[0],f.b)),rechazo);
  await assert.rejects(sql.begin(tx=>mov(tx,f.movimientos[1],f.b,f.movimientos[0])),rechazo);
  await sql.begin(tx=>mov(tx,f.movimientos[1],f.a,f.movimientos[0]));
  await assert.rejects(sql.begin(tx=>mov(tx,f.movimientos[2],f.a,f.movimientos[0])),rechazo);
 });
 await test('Devolución canónica conjunta2, salidas distintas A/B, SQL y lector confirman0/0 sin alterar canónicos',async()=>{
  const f=await fixture(2);
  const antes=await sql`select * from movimientos where id=any(${f.movimientos}::uuid[]) order by id`;
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[0],atribuciones:[{suministroId:f.a,cantidad:1,salidaMovimientoId:null}]});
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[3],atribuciones:[{suministroId:f.b,cantidad:1,salidaMovimientoId:null}]});
  await atribuirRegistroExistente(sql,{tipo:'movimiento',registroId:f.movimientos[1],atribuciones:[
   {suministroId:f.a,cantidad:1,salidaMovimientoId:f.movimientos[0]},
   {suministroId:f.b,cantidad:1,salidaMovimientoId:f.movimientos[3]}]});
  const filas=await sql`select a.suministro_id,sum(case m.tipo when 'salida' then a.cantidad when 'devolucion' then -a.cantidad else 0 end)::int servido
   from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=any(${[f.a,f.b]}::uuid[]) group by a.suministro_id`;
  assert.equal(filas.length,2);assert.ok(filas.every(fila=>fila.servido===0));
  const p=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(p.porSuministro.get(f.a)?.servido,0);assert.equal(p.porSuministro.get(f.b)?.servido,0);
  assert.deepEqual(await sql`select * from movimientos where id=any(${f.movimientos}::uuid[]) order by id`,antes);
 });
 await test('FK, artículo/sala y cantidades fraccionarias se rechazan por SQL real',async()=>{
  const f=await fixture(),g=await fixture();
  await assert.rejects(sql.begin(tx=>res(tx,f.reservas[0],g.a)),rechazo);
  await assert.rejects(sql.begin(tx=>ped(tx,f.lineas[0],g.a)),rechazo);
  await assert.rejects(sql.begin(tx=>mov(tx,f.movimientos[0],g.a)),rechazo);
  await assert.rejects(sql.begin(tx=>res(tx,f.reservas[0],randomUUID())),rechazo);
  await assert.rejects(sql`insert into reserva_suministros(reserva_id,suministro_id,cantidad) values(${f.reservas[0]},${f.a},0.5)`,rechazo);
  await assert.rejects(sql`insert into suministro_pedido_asignaciones(pedido_linea_id,suministro_id,cantidad,cantidad_recibida_atribuida) values(${f.lineas[0]},${f.a},1,0.5)`,rechazo);
  await assert.rejects(sql.begin(tx=>res(tx,f.resAjena,f.a)),/Reserva incompatible/);
  await assert.rejects(sql.begin(tx=>mov(tx,f.movAjeno,f.a)),/Movimiento incompatible/);
  await assert.rejects(sql.begin(tx=>ped(tx,f.lineaAjena,f.a)),/Pedido incompatible/);
  const [s]=await sql`insert into salas(nombre) values('Mismo artículo otra sala') returning id`;
  const [r]=await sql`insert into reservas(sala_id,articulo_id,cantidad) values(${s.id},${f.articulo},1) returning id`;
  const [m]=await sql`insert into movimientos(sala_id,articulo_id,tipo,cantidad) values(${s.id},${f.articulo},'salida',1) returning id`;
  await assert.rejects(sql.begin(tx=>res(tx,r.id,f.a)),/Reserva incompatible/);
  await assert.rejects(sql.begin(tx=>mov(tx,m.id,f.a)),/Movimiento incompatible/);
 });
 await test('Lector RR conserva instantánea anterior; lectura nueva ve atribución confirmada',async()=>{
  const f=await fixture();
  await sql.begin('isolation level repeatable read read only',async tx=>{
   assert.equal((await leerAtribucionesSuministro(tx,f.sala)).porSuministro.get(f.a)?.reservado,0);
   await otra.begin(t=>res(t,f.reservas[0],f.a));
   assert.equal((await leerAtribucionesSuministro(tx,f.sala)).porSuministro.get(f.a)?.reservado,0);
  });
  assert.equal((await obtenerCoberturaSuministros(sql,f.sala)).porSuministro.get(f.a)?.reservado,1);
 });
 await test('Reservas históricas servidas/liberadas y movimientos sin atribuir no dan cobertura',async()=>{
  const f=await fixture();
  await sql.begin(async tx=>{await res(tx,f.reservas[2],f.a);await res(tx,f.reservas[3],f.b);});
  const p=await obtenerCoberturaSuministros(sql,f.sala);
  assert.equal(p.porSuministro.get(f.a)?.coberturaFisica,0);assert.equal(p.porSuministro.get(f.b)?.coberturaFisica,0);
  assert.equal(p.avisosSinAtribuir.length,6);assert.ok(p.avisosSinAtribuir.every(m=>m.cantidad===1));
 });
 await test('No se borra historial; padres RESTRICT; cambios de canónico conservados por L3A',async()=>{
  const f=await fixture();await sql.begin(tx=>res(tx,f.reservas[0],f.a));
  await assert.rejects(sql`delete from reserva_suministros where reserva_id=${f.reservas[0]}`,/conserva historial/);
  await assert.rejects(sql`delete from reservas where id=${f.reservas[0]}`,e=>typeof e==='object'&&e!==null&&'code'in e&&e.code==='23503');
  await assert.rejects(sql`update reservas set cantidad=0.5 where id=${f.reservas[0]}`,/Kits pendientes/);
  await assert.rejects(sql`update reserva_suministros set suministro_id=${f.b} where reserva_id=${f.reservas[0]}`,/No se reasigna/);
  assert.equal((await sql`select cantidad::float8 n from reservas where id=${f.reservas[0]}`)[0].n,1);
 });
 for(const inverso of [false,true]){
  for(const tipo of ['pedido','reserva','movimiento','demanda','reserva-salida','retorno'] as const){
   await test(`Carrera ${tipo}, ganador ${inverso?'B':'A'}: contención, reintento, rechazo y saldo final`,async()=>{
    const f=await fixture();const [a,b]=inverso?[f.b,f.a]:[f.a,f.b];
    if(tipo==='retorno')await sql.begin(tx=>mov(tx,f.movimientos[0],a));
    const operaciones={
     pedido:[(tx:TransactionSql)=>ped(tx,f.lineas[0],a),(tx:TransactionSql)=>ped(tx,f.lineas[0],b)],
     reserva:[(tx:TransactionSql)=>res(tx,f.reservas[0],a),(tx:TransactionSql)=>res(tx,f.reservas[0],b)],
     movimiento:[(tx:TransactionSql)=>mov(tx,f.movimientos[0],a),(tx:TransactionSql)=>mov(tx,f.movimientos[0],b)],
     demanda:[(tx:TransactionSql)=>res(tx,f.reservas[0],a),(tx:TransactionSql)=>res(tx,f.reservas[1],a)],
     'reserva-salida':inverso?[(tx:TransactionSql)=>mov(tx,f.movimientos[0],a),(tx:TransactionSql)=>res(tx,f.reservas[0],a)]:[(tx:TransactionSql)=>res(tx,f.reservas[0],a),(tx:TransactionSql)=>mov(tx,f.movimientos[0],a)],
     retorno:[(tx:TransactionSql)=>mov(tx,f.movimientos[1],a,f.movimientos[0]),(tx:TransactionSql)=>mov(tx,f.movimientos[2],a,f.movimientos[0])],
    };
    await carrera(operaciones[tipo][0],operaciones[tipo][1]);
    const p=await obtenerCoberturaSuministros(sql,f.sala);
    assert.equal(p.porSuministro.get(a)?.coberturaFisica,tipo==='pedido'||tipo==='retorno'?0:1);
    assert.equal(p.porSuministro.get(b)?.coberturaFisica,0);
    if(tipo==='pedido')assert.equal((await sql`select sum(cantidad)::float8 n from suministro_pedido_asignaciones where pedido_linea_id=${f.lineas[0]}`)[0].n,1);
   });
  }
 }
 await test('REPEATABLE READ no confirma atribuciones con instantánea obsoleta',async()=>{
  const f=await fixture();await carrera(tx=>res(tx,f.reservas[0],f.a),tx=>res(tx,f.reservas[0],f.b),true);
  assert.equal((await sql`select sum(cantidad)::float8 n from reserva_suministros where reserva_id=${f.reservas[0]}`)[0].n,1);
 });
}finally{await sql.end();await otra.end();}
