import assert from 'node:assert/strict';
import Module from 'node:module';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import postgres, {type Sql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {proyectarSuministros} from '../src/lib/suministros';
import {necesidadDeSala} from '../src/lib/compras';
import {exigirDisenoCopiable} from '../src/lib/copiar-conexiones';
import {comprarLineas} from '../src/lib/operaciones-compras';
import {esErrorConcurrencia} from '../src/lib/control-escritura';
import {leerComposiciones,sqlComposiciones} from './sql-composiciones.mjs';
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_suministros_[a-f0-9]{32}$/.test(url.pathname));
const modulo=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};const cargar=modulo._load;
modulo._load=(request,...resto)=>{
 if(request==='server-only')return {};
 if(request==='next/cache')return {revalidatePath:()=>{}};
 if(request==='next/navigation')return {redirect:()=>{throw new Error('Redirección inesperada');}};
 return cargar.call(Module,request,...resto);
};
const {obtenerSala}=await import('../src/lib/datos');
const {faltaParaSala}=await import('../src/lib/datos-almacen');
const {fichaDeSala}=await import('../src/app/salas/[id]/datos-ficha');
const acciones=await import('../src/app/acciones');
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){}});
const formulario=(id:string,paso?:string)=>{const f=new FormData();f.set('id',id);if(paso)f.set('paso',paso);return f;};
// Las acciones CJS y el ensayo ESM cargan constructores distintos de postgres.
const esRechazoIntegridad=(e:unknown)=>typeof e==='object'&&e!==null&&'code' in e&&['23503','23514'].includes(String(e.code));
async function fixture(parcial=false){
 const [s]=await sql`insert into salas(nombre) values (${randomUUID()}) returning id`;
 const [kit]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${randomUUID()}) returning id`;
 const piezas=[];
 for(let i=0;i<3;i++){
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${randomUUID()}) returning id`;
  piezas.push(a.id);
 }
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${kit.id},'SKU QA',1,${parcial?'parcial':'documentada'},'Documento QA') returning id`;
 for(const [i,a] of piezas.entries())await sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
  values (${c.id},${String(i)},${a},${'Pieza '+i},'equipo',1,'incluido','Documento QA')`;
 if(parcial)await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente)
  values (${c.id},'pendiente','Accesorio desconocido','accesorio',2,'incluido','Documento QA')`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 return {sala:s.id,kit:kit.id,composicion:c.id,piezas};
}
async function lectura(sala:string){const completa=await obtenerSala(sala);assert.ok(completa);return completa;}
async function huella(sala:string){
 const tablas=['sala_equipos','sala_suministros','sala_componentes_suministro','conexiones'];const contenido=[];
 for(const t of tablas)contenido.push(await sql`select to_jsonb(t) dato from ${sql(t)} t where sala_id=${sala} order by to_jsonb(t)::text`);
 return JSON.stringify(contenido);
}
// El control de escritura de B2b (`pg_try_advisory_xact_lock(21440,2)`) no espera:
// si otra transacción lo retiene lanza 40001 en el acto, en vez de dejar a la
// segunda sesión colgada de un lock de fila observable en `pg_stat_activity`.
// Contrato B2b, «Protocolo de locks»: «Si está ocupado lanza40001: no espera por
// el control mientras retiene un padre». Así que la contención se acredita con el
// rechazo exacto —que solo puede ocurrir habiendo otro dueño del control— y la
// semántica se acredita después, reintentando, como exige la evidencia de B2c
// («Tras40001, ejecutar y comprobar resultado del reintento»). Ese hecho tiene
// dos renderizados legítimos: SQL directo devuelve el 40001 tal cual; una ruta de
// aplicación reintenta la transacción completa tres veces y, si el control sigue
// ocupado, lo traduce a AV_CONCURRENCIA_AGOTADA. Cada llamada declara cuál
// espera, así que aceptar uno no encubre al otro.
const esControlOcupado=(e:unknown)=>typeof e==='object'&&e!==null&&'code' in e&&String(e.code)==='40001';
const EXITO=Symbol('rival completado'),ESPERA=Symbol('rival esperando');
async function exigirControlOcupado(via:'sql'|'accion',operacion:()=>Promise<unknown>){
 const rival=operacion();rival.catch(()=>{});
 // La cota solo se agota si el rechazo no llega: sin exclusión el rival se
 // quedaría colgado del lock de fila y la prueba no mediría nada.
 let temporizador:ReturnType<typeof setTimeout>|undefined;
 const espera=new Promise(r=>{temporizador=setTimeout(()=>r(ESPERA),8000);});
 const fin=await Promise.race([rival.then(()=>EXITO,(e:unknown)=>e),espera]);
 clearTimeout(temporizador);
 assert.notEqual(fin,EXITO,'El rival se completó con el control retenido: no hubo exclusión de escritura');
 assert.notEqual(fin,ESPERA,'El rival se quedó esperando un lock: el control debía rechazarlo en el acto');
 if(via==='sql'){
  assert.ok(esControlOcupado(fin),`Se esperaba 40001 por control ocupado y llegó ${JSON.stringify(fin)}`);
  assert.match(String((fin as Error).message),/Control de escritura ocupado/);
 }else assert.ok(esErrorConcurrencia(fin),`Se esperaba AV_CONCURRENCIA_AGOTADA y llegó ${JSON.stringify(fin)}`);
}
try{
 await test('Tres piezas incluidas compran un kit; dos instancias y extra independiente mantienen cantidades exactas en lectores reales',async()=>{
  const f=await fixture();const a=await instanciarSuministro(sql,f.sala,f.composicion);
  let completa=await lectura(f.sala);let p=proyectarSuministros(completa.equipos,completa.suministros);
  assert.equal(p.fisicos.length,3);assert.equal(p.necesidades.reduce((n,l)=>n+l.cantidad,0),1);
  assert.deepEqual(necesidadDeSala(p.necesidades,[],new Map()).map(l=>[l.articulo_id,l.cantidad,l.suministros]),[[f.kit,1,[a]]]);
  const b=await instanciarSuministro(sql,f.sala,f.composicion);assert.notEqual(a,b);
  await sql`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad) values (${f.sala},${f.piezas[0]},'Extra',1)`;
  completa=await lectura(f.sala);p=proyectarSuministros(completa.equipos,completa.suministros);
  assert.equal(p.fisicos.length,7);assert.equal(p.componentes.length,6);
  const ficha=await fichaDeSala(f.sala),falta=await faltaParaSala(f.sala);assert.ok(ficha&&falta);
  assert.deepEqual(ficha.necesidad,falta.necesidad);
  assert.equal(ficha.necesidad.find(l=>l.articulo_id===f.kit)?.cantidad,2);
  assert.equal(ficha.necesidad.find(l=>l.articulo_id===f.piezas[0])?.cantidad,1);
  assert.equal(ficha.necesidad.length,2);assert.ok(falta.bloqueoComercial);
 });
 await test('Composición parcial conserva identidad pendiente sin fabricar equipos ni bocas',async()=>{
  const f=await fixture(true);await instanciarSuministro(sql,f.sala,f.composicion);
  const s=await lectura(f.sala),p=proyectarSuministros(s.equipos,s.suministros);
  assert.equal(s.equipos.length,3);assert.equal(p.pendientes.length,1);assert.equal(p.pendientes[0].clave,'pendiente');
  assert.equal(s.suministros.suministros[0].snapshot.lineas.find(l=>l.clave==='pendiente')?.cantidad,2);
  await assert.rejects(sql.begin(tx=>exigirDisenoCopiable(tx,'sala',f.sala)),/Gestionar kit/);
  const [vacia]=await sql`insert into salas(nombre) values ('QA solo documental') returning id`;
  const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${f.kit},'SKU sin identidad',2,'parcial','Documento QA') returning id`;
  await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente) values (${c.id},'desconocido','Pieza sin referencia','equipo',1,'incluido','Documento QA')`;
  await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
  await instanciarSuministro(sql,vacia.id,c.id);
  assert.equal((await lectura(vacia.id)).equipos.length,0);
  await assert.rejects(sql.begin(tx=>exigirDisenoCopiable(tx,'sala',vacia.id)),/Gestionar kit/);
 });
 await test('Versión nueva no modifica snapshot; edición CSV de versión publicada se rechaza y seed repetido conserva identidad',async()=>{
  const [c]=await sql`select id from articulo_composiciones where sku='CS-KIT-EQ-K9' and version=1`;
  assert.ok(c);const [s]=await sql`insert into salas(nombre) values ('QA CSV') returning id`;
  await instanciarSuministro(sql,s.id,c.id);const antes=await huella(s.id);
  const texto=readFileSync('data/composiciones.csv','utf8');const grupos=leerComposiciones(texto);
  await sql.unsafe(sqlComposiciones(grupos));assert.equal(await huella(s.id),antes);
  const siguiente=leerComposiciones(texto.replaceAll(';1;parcial;',';2;parcial;'));
  await sql.unsafe(sqlComposiciones(siguiente));assert.equal(await huella(s.id),antes);
  const corrupta=leerComposiciones(texto.replace('CS-CODEC-EQ-K9+','OTRO-SKU'));
  await assert.rejects(sql.unsafe(sqlComposiciones(corrupta)),/nueva version requerida/);
  assert.equal(await huella(s.id),antes);
 });
 await test('Guardas inversas y borrados conservan piezas, conexiones y bridas',async()=>{
  const f=await fixture();await instanciarSuministro(sql,f.sala,f.composicion);
  const es=await sql`select * from sala_equipos where sala_id=${f.sala} order by nombre`;
  const puertos:string[]=[];for(const e of es.slice(0,2)){
   const [p]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${e.articulo_id},'LAN QA','bidireccional','red',1,'app') returning id`;puertos.push(p.id);
  }
  await sql.begin(async tx=>{
   const [c]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal,longitud_manual_m) values (${f.sala},${es[0].id},${es[1].id},${puertos[0]},${puertos[1]},'red',7.25) returning id`;
   await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${c.id},'origen',${es[0].id},${puertos[0]},1),(${c.id},'destino',${es[1].id},${puertos[1]},1)`;
  });
  const antes=await huella(f.sala);assert.match(antes,/RED-1000/);
  for(const operacion of [
   ()=>acciones.borrarEquipo(formulario(es[0].id)),()=>acciones.ajustarCantidadEquipo(formulario(es[0].id,'1')),
   ()=>sql`delete from sala_equipos where id=${es[0].id}`,
   ()=>sql`delete from salas where id=${f.sala}`,
   ()=>sql`delete from sala_componentes_suministro where equipo_id=${es[0].id}`,
   ()=>sql`delete from sala_suministros where sala_id=${f.sala}`,
   ()=>sql`update sala_suministros set estado='retirado_del_diseno' where sala_id=${f.sala}`,
   ()=>sql`update sala_suministros set snapshot='{}' where sala_id=${f.sala}`,
   ()=>sql`update sala_suministros set articulo_id=${f.piezas[0]} where sala_id=${f.sala}`,
   ()=>sql`update sala_componentes_suministro set ordinal=2 where equipo_id=${es[0].id}`,
   ()=>sql`update sala_equipos set cantidad=2 where id=${es[0].id}`,
   ()=>sql`update sala_equipos set articulo_id=${f.piezas[1]} where id=${es[0].id}`,
   ()=>sql`update articulo_composicion_lineas set cantidad=2 where composicion_id=${f.composicion}`,
   ()=>sql`update articulo_composicion_lineas set articulo_componente_id=${f.kit} where composicion_id=${f.composicion}`,
   ()=>sql`update articulo_composiciones set sku='otro' where id=${f.composicion}`,
   ()=>sql`update articulos set tipo='cable' where id=${f.piezas[0]}`,
  ]){await assert.rejects(operacion,esRechazoIntegridad);assert.equal(await huella(f.sala),antes);}
 });
 await test('Vínculos rechazan sala, composición, artículo, ordinal y cantidad incorrectos',async()=>{
  const f=await fixture(),otro=await fixture();
  const [linea]=await sql`select id from articulo_composicion_lineas where composicion_id=${f.composicion} order by clave`;
  for(const defecto of ['sala','composicion','articulo','ordinal','cantidad','incompleto']){
   await assert.rejects(sql.begin(async tx=>{
    const [s]=await tx`insert into sala_suministros(sala_id,articulo_id,composicion_id,snapshot) values (${f.sala},${f.kit},${f.composicion},'{}') returning id`;
    if(defecto==='incompleto')return;
    const [e]=await tx`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad) values (${defecto==='sala'?otro.sala:f.sala},${defecto==='articulo'?f.piezas[1]:f.piezas[0]},'Pieza',${defecto==='cantidad'?2:1}) returning id`;
    await tx`insert into sala_componentes_suministro(equipo_id,suministro_id,sala_id,composicion_id,linea_id,ordinal,snapshot)
     values (${e.id},${s.id},${f.sala},${defecto==='composicion'?otro.composicion:f.composicion},${linea.id},${defecto==='ordinal'?2:1},'{}')`;
   }),esRechazoIntegridad);
   assert.equal((await sql`select count(*)::int n from sala_suministros where sala_id=${f.sala}`)[0].n,0);
  }
 });
 for(const punto of ['insert into sala_suministros','insert into sala_equipos','insert into sala_componentes_suministro','update salas set diagrama_version']){
  await test(`Fallo inyectado después de ${punto} revierte toda la operación real`,async()=>{
   const f=await fixture();const antes=await huella(f.sala);let alcanzado=false;
   const instrumentada=new Proxy(sql,{get(target,clave){
    if(clave!=='begin')return Reflect.get(target,clave);
    return (cuerpo:(tx:postgres.TransactionSql)=>Promise<unknown>)=>target.begin(tx=>cuerpo(new Proxy(tx,{apply(t,self,args){
     const partes=args[0],texto=Array.isArray(partes)&&'raw' in partes?partes.join(''):'';
     if(texto.includes(punto))return(async()=>{await Reflect.apply(t,self,args);alcanzado=true;throw new Error('Fallo inyectado QA');})();
     return Reflect.apply(t,self,args);
    }})));
   }}) as Sql;
   await assert.rejects(instanciarSuministro(instrumentada,f.sala,f.composicion),/Fallo inyectado QA/);
   assert.ok(alcanzado);assert.equal(await huella(f.sala),antes);
   assert.equal(Number((await sql`select diagrama_version from salas where id=${f.sala}`)[0].diagrama_version),0);
  });
 }
 await test('Dos altas concurrentes generan dos unidades y seis piezas distintas',async()=>{
  const f=await fixture();const ids=await Promise.all([instanciarSuministro(sql,f.sala,f.composicion),instanciarSuministro(otra,f.sala,f.composicion)]);
  assert.equal(new Set(ids).size,2);const s=await lectura(f.sala);
  assert.equal(s.equipos.length,6);assert.equal(new Set(s.equipos.map(e=>e.id)).size,6);
  assert.equal(proyectarSuministros(s.equipos,s.suministros).necesidades.reduce((n,l)=>n+l.cantidad,0),2);
 });
 await test('Reservas y salidas históricas no acreditan kit nuevo; logística directa queda rechazada',async()=>{
  const f=await fixture();const [u]=await sql`insert into ubicaciones(nombre) values (${randomUUID()}) returning id`;
  // La composición publicada mete al kit en `articulos_stock_kit`, así que su
  // stock queda bajo la cota de déficit de B2b: `max(0,-D_final)<=max(0,-D_inicial)`.
  // El histórico sale de existencias reales; sacar 10 de la nada las inventaba.
  await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${f.kit},${u.id},'entrada',20)`;
  await sql`insert into movimientos(articulo_id,ubicacion_id,sala_id,tipo,cantidad) values (${f.kit},${u.id},${f.sala},'salida',10)`;
  await sql`insert into reservas(articulo_id,sala_id,cantidad) values (${f.kit},${f.sala},10)`;
  await instanciarSuministro(sql,f.sala,f.composicion);
  const falta=await faltaParaSala(f.sala);assert.ok(falta);assert.equal(falta.faltantes[0].falta,1);assert.equal(falta.faltantes[0].servido??0,0);
  assert.equal(falta.reservadoAqui.get(f.kit),undefined);assert.equal(falta.servidoAqui.get(f.kit),undefined);
  assert.equal(falta.reservas.length,1);
  for(const op of [
   ()=>sql`insert into reservas(articulo_id,sala_id,cantidad) values (${f.kit},${f.sala},1)`,
   ()=>sql`insert into movimientos(articulo_id,ubicacion_id,sala_id,tipo,cantidad) values (${f.kit},${u.id},${f.sala},'salida',1)`,
   ()=>sql`insert into pedidos(sala_id) values (${f.sala})`,
   ()=>sql`insert into cargas(sala_id,nombre) values (${f.sala},'QA')`,
  ])await assert.rejects(op,/atribucion comercial/);
  // Equivalente en la semántica vigente de lo que antes montaba el fixture con
  // una salida de la nada: un déficit anterior al perímetro sobrevive a entrar
  // en él y se puede conservar o mejorar; lo que B2b prohíbe es agravarlo.
  const [legado]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${randomUUID()}) returning id`;
  await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${legado.id},${u.id},'salida',3)`;
  await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${legado.id},${'SKU legado '+randomUUID()},1,'documentada','Documento QA')`;
  const disponible=async()=>Number((await sql`select disponible_stock_kit(${legado.id}) d`)[0].d);
  assert.equal((await sql`select count(*)::int n from articulos_stock_kit where articulo_id=${legado.id}`)[0].n,1);
  assert.equal(await disponible(),-3);
  await assert.rejects(sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${legado.id},${u.id},'salida',1)`,/agrava el deficit/);
  assert.equal(await disponible(),-3);
  await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${legado.id},${u.id},'entrada',1)`;
  assert.equal(await disponible(),-2);
 });
 await test('Compra registrada antes del suministro: retirada rechazada conserva pedido y montaje',async()=>{
  const f=await fixture();const [pedido]=await sql`insert into pedidos(sala_id) values (${f.sala}) returning id`;
  await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,precio_unitario,precio_orientativo) values (${pedido.id},${f.kit},1,100,false)`;
  await comprarLineas(sql,pedido.id,{id:randomUUID(),nombre:'Comprador QA',ficticio:false});
  const antesPedido=JSON.stringify(await sql`select * from pedido_lineas where pedido_id=${pedido.id}`);
  assert.match(antesPedido,/Comprador QA/);
  await instanciarSuministro(sql,f.sala,f.composicion);const antes=await huella(f.sala);
  await assert.rejects(sql`update sala_suministros set estado='retirado_del_diseno' where sala_id=${f.sala}`,/revision de diseno registrada/);
  assert.equal(await huella(f.sala),antes);
  assert.equal(JSON.stringify(await sql`select * from pedido_lineas where pedido_id=${pedido.id}`),antesPedido);
 });
 for(const primero of ['kit','reserva'])await test(`Concurrencia ${primero} primero: no se confirma reserva nueva sin atribución`,async()=>{
  const f=await fixture();let liberar=()=>{},avisar=()=>{};
  // La rama «reserva» reserva de verdad una unidad del kit, que ya está en el
  // perímetro de stock: sin existencias detrás, la cota de déficit de B2b tumba
  // la propia transacción de partida. Con una unidad real, D pasa de 1 a 0 y lo
  // que se mide sigue siendo la contención, no el saldo. La rama «kit» no llega
  // a confirmar ninguna reserva, así que su kit se queda sin existencias y la
  // falta esperada sigue siendo 1 en las dos.
  if(primero==='reserva'){
   const [u]=await sql`insert into ubicaciones(nombre) values (${randomUUID()}) returning id`;
   await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${f.kit},${u.id},'entrada',1)`;
  }
  const seguir=new Promise<void>(r=>{liberar=r;}),pausada=new Promise<void>(r=>{avisar=r;});
  let primera:Promise<unknown>,segunda:Promise<unknown>|undefined;
  if(primero==='kit'){
   const instrumentada=new Proxy(sql,{get(target,clave){
    if(clave!=='begin')return Reflect.get(target,clave);
    return (cuerpo:(tx:postgres.TransactionSql)=>Promise<unknown>)=>target.begin(tx=>cuerpo(new Proxy(tx,{apply(t,self,args){
     const partes=args[0],texto=Array.isArray(partes)&&'raw' in partes?partes.join(''):'';
     if(texto.includes('insert into sala_suministros'))return(async()=>{const r=await Reflect.apply(t,self,args);avisar();await seguir;return r;})();
     return Reflect.apply(t,self,args);
    }})));
   }}) as Sql;
   primera=instanciarSuministro(instrumentada,f.sala,f.composicion);
  }else primera=sql.begin(async tx=>{
   await tx`insert into reservas(articulo_id,sala_id,cantidad) values (${f.kit},${f.sala},1)`;
   avisar();await seguir;
  });
  primera.catch(()=>{});
  const rival=()=>primero==='kit'
   ?otra`insert into reservas(articulo_id,sala_id,cantidad) values (${f.kit},${f.sala},1)`.then(r=>r)
   :instanciarSuministro(otra,f.sala,f.composicion);
  try{
   await Promise.race([pausada,primera.then(()=>{throw new Error('No alcanzó pausa');})]);
   await exigirControlOcupado(primero==='kit'?'sql':'accion',rival);
   liberar();await primera;
   segunda=rival();segunda.catch(()=>{});
   if(primero==='kit')await assert.rejects(segunda,/atribucion comercial/);else await segunda;
   assert.equal((await sql`select count(*)::int n from reservas where sala_id=${f.sala}`)[0].n,primero==='kit'?0:1);
   const falta=await faltaParaSala(f.sala);assert.ok(falta);assert.equal(falta.faltantes.find(l=>l.articulo_id===f.kit)?.falta,1);
   assert.equal(falta.reservadoAqui.size,0);
  }finally{liberar();await primera.catch(()=>{});await segunda?.catch(()=>{});}
 });
 for(const primero of ['composicion','tipo'])await test(`Catálogo concurrente ${primero} primero: tipo incompatible se rechaza sin composición inválida`,async()=>{
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${randomUUID()}) returning id`;
  let liberar=()=>{},avisar=()=>{};
  const seguir=new Promise<void>(r=>{liberar=r;}),pausada=new Promise<void>(r=>{avisar=r;});
  const primera=sql.begin(async tx=>{
   if(primero==='composicion')await tx`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${a.id},'QA',1,'parcial','QA')`;
   else await tx`update articulos set tipo='cable' where id=${a.id}`;
   avisar();await seguir;
  });
  primera.catch(()=>{});let segunda:Promise<unknown>|undefined;
  const rival=()=>primero==='composicion'?otra`update articulos set tipo='cable' where id=${a.id}`.then(r=>r)
   :otra`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${a.id},'QA',1,'parcial','QA')`.then(r=>r);
  try{
   await Promise.race([pausada,primera.then(()=>{throw new Error('No alcanzó pausa');})]);
   await exigirControlOcupado('sql',rival);
   liberar();await primera;
   segunda=rival();segunda.catch(()=>{});await assert.rejects(segunda,esRechazoIntegridad);
   assert.equal((await sql`select count(*)::int n from articulo_composiciones c join articulos a on a.id=c.articulo_kit_id where a.tipo<>'equipo'`)[0].n,0);
  }finally{liberar();await primera.catch(()=>{});await segunda?.catch(()=>{});}
 });
}finally{
 await sql.end();await otra.end();
 const {sql:compartida}=await import('../src/lib/db');await compartida.end();
}
