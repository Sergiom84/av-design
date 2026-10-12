import assert from 'node:assert/strict';
import Module from 'node:module';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {instanciarSuministro,asignarCableSuministrado,retirarAsignacionCable,marcarCableAdicional,leerSuministros} from '../src/lib/suministros-db';
import {proyectarSuministros,sumaCompraCable} from '../src/lib/suministros';
import {necesidadDeSala} from '../src/lib/compras';
import {agruparMaterialCable} from '../src/lib/calculo-cable';
import {exigirDisenoCopiable} from '../src/lib/copiar-conexiones';
import {esErrorConcurrencia} from '../src/lib/control-escritura';

const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_cables_[a-f0-9]{32}$/.test(url.pathname));
const modulo=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};const cargar=modulo._load;
modulo._load=(request,...resto)=>{
 if(request==='server-only')return {};
 if(request==='next/cache')return {revalidatePath:()=>{}};
 if(request==='next/headers')return {cookies:async()=>({get:()=>undefined})};
 if(request==='next/navigation')return {redirect:()=>{throw new Error('Redirección inesperada');}};
 return cargar.call(Module,request,...resto);
};
const {obtenerSala}=await import('../src/lib/datos');
const {fichaDeSala}=await import('../src/app/salas/[id]/datos-ficha');
const {faltaParaSala}=await import('../src/lib/datos-almacen');
const sql=postgres(url.href,{max:1,onnotice(){}}),otra=postgres(url.href,{max:1,onnotice(){}});
const es23514=(e:unknown)=>typeof e==='object'&&e!==null&&'code' in e&&String(e.code)==='23514';
const esUnico=(e:unknown)=>typeof e==='object'&&e!==null&&'code' in e&&['23505','23514'].includes(String(e.code));

async function composicion(sku:string){
 const [c]=await sql`select id,articulo_kit_id from articulo_composiciones where sku=${sku} and publicada order by version limit 1`;
 assert.ok(c,`Falta composición publicada ${sku}`);
 return {id:String(c.id),articulo:String(c.articulo_kit_id)};
}
async function destinoRed(sala:string){
 const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${'SW-'+randomUUID()}) returning id`;
 const [p]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${a.id},'PoE','bidireccional','red',8,'app') returning id`;
 const [e]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad) values(${sala},${a.id},'Switch QA',1) returning id`;
 return {equipo:String(e.id),puerto:String(p.id),articulo:String(a.id)};
}
async function conectar(sala:string,origen:{equipo:string;puerto:string;ordinal?:number},destino:{equipo:string;puerto:string;ordinal?:number},manual=8){
 return sql.begin(async tx=>{
  const [c]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal,longitud_manual_m)
   values(${sala},${origen.equipo},${destino.equipo},${origen.puerto},${destino.puerto},'red',${manual}) returning id,estado_suministro,etiqueta_cable`;
  await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal)
   values(${c.id},'origen',${origen.equipo},${origen.puerto},${origen.ordinal??1}),
         (${c.id},'destino',${destino.equipo},${destino.puerto},${destino.ordinal??1})`;
  return {id:String(c.id),estado:String(c.estado_suministro),etiqueta:String(c.etiqueta_cable)};
 });
}

try{
 await test('INSERT nuevo nace por_determinar; legado del upgrade sigue adicional heredado',async()=>{
  const [sala]=await sql`insert into salas(nombre) values(${'Nueva '+randomUUID()}) returning id`;
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  const [b]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  const [e1]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${sala.id},${a.id},'A') returning id`;
  const [e2]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${sala.id},${b.id},'B') returning id`;
  const [p1]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${a.id},'L','bidireccional','red',1,'app') returning id`;
  const [p2]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${b.id},'L','bidireccional','red',1,'app') returning id`;
  const c=await conectar(String(sala.id),{equipo:String(e1.id),puerto:String(p1.id)},{equipo:String(e2.id),puerto:String(p2.id)});
  assert.equal(c.estado,'por_determinar');
  const legado=await sql`select count(*)::int n from conexiones where estado_suministro='adicional' and decision_heredada`;
  assert.ok(legado[0].n>=1);
 });

 await test('Kit EQ no crea HDMI/Ethernet incluidos; cableado queda pendiente y no suma compra',async()=>{
  const eq=await composicion('CS-KIT-EQ-K9');
  const [sala]=await sql`insert into salas(nombre) values(${'EQ '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),eq.id);
  assert.equal((await sql`select count(*)::int n from sala_cables_suministrados k join sala_suministros s on s.id=k.suministro_id where s.sala_id=${sala.id}`)[0].n,0);
  const completa=await obtenerSala(String(sala.id));assert.ok(completa);
  const p=proyectarSuministros(completa.equipos,completa.suministros);
  assert.ok(p.pendientes.some(x=>/cableado|por determinar/i.test(x.detalle)));
  const ficha=await fichaDeSala(String(sala.id));assert.ok(ficha);
  assert.equal(ficha.necesidad.filter(l=>l.articulo_id===eq.articulo).reduce((n,l)=>n+l.cantidad,0),1);
  assert.equal(ficha.material.length,0);
 });

 await test('Dos micros: dos compras, dos unidos de 11 m congelados; HDMI no se presupone',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Micros '+randomUUID()}) returning id`;
  const a=await instanciarSuministro(sql,String(sala.id),micro.id);
  const b=await instanciarSuministro(sql,String(sala.id),micro.id);
  const cables=await sql`select k.* from sala_cables_suministrados k join sala_suministros s on s.id=k.suministro_id where s.sala_id=${sala.id} order by k.id`;
  assert.equal(cables.length,2);
  assert.ok(cables.every(k=>k.tipo==='unido' && Number(k.longitud_utilizable_m)===11));
  assert.notEqual(cables[0].propietario_equipo_id,cables[1].propietario_equipo_id);
  assert.notEqual(cables[0].suministro_id,cables[1].suministro_id);
  const completa=await obtenerSala(String(sala.id));assert.ok(completa);
  const p=proyectarSuministros(completa.equipos,completa.suministros);
  const nec=necesidadDeSala(p.necesidades,[],new Map());
  assert.equal(nec.find(l=>l.articulo_id===micro.articulo)?.cantidad,2);
  assert.deepEqual(new Set(nec.find(l=>l.articulo_id===micro.articulo)?.suministros),new Set([a,b]));
  const snap=cables[0].snapshot as {longitud_utilizable_m?:number};
  await sql`update articulo_datos_tecnicos set valor=jsonb_set(valor,'{longitud_m}','5'::jsonb)
   where articulo_id=${micro.articulo} and clave='cable-unido'`;
  try{
   const [despues]=await sql`select snapshot,longitud_utilizable_m from sala_cables_suministrados where id=${cables[0].id}`;
   assert.equal(Number(despues.longitud_utilizable_m),11);
   assert.equal((despues.snapshot as {longitud_utilizable_m?:number}).longitud_utilizable_m,11);
   assert.equal(snap.longitud_utilizable_m,11);
  }finally{
   await sql`update articulo_datos_tecnicos set valor=jsonb_set(valor,'{longitud_m}','11'::jsonb)
    where articulo_id=${micro.articulo} and clave='cable-unido'`;
  }
  const dest=await destinoRed(String(sala.id));
  const c1=await conectar(String(sala.id),{equipo:String(cables[0].propietario_equipo_id),puerto:String(cables[0].puerto_fijo_id)},dest,20);
  await asignarCableSuministrado(sql,c1.id,String(cables[0].id));
  const ficha=await fichaDeSala(String(sala.id));assert.ok(ficha);
  const falta=await faltaParaSala(String(sala.id));assert.ok(falta);
  assert.deepEqual(ficha.necesidad.map(l=>[l.articulo_id,l.cantidad]),falta.necesidad.map(l=>[l.articulo_id,l.cantidad]));
  assert.equal(ficha.filasCable.find(f=>f.conexion_id===c1.id)?.estado_suministro,'incluido');
  assert.ok(ficha.filasCable.find(f=>f.conexion_id===c1.id)?.avisos.some(a=>/insuficiente|11/.test(a)));
  assert.equal(agruparMaterialCable(ficha.resultados,ficha.conexiones,ficha.porId).length,0);
  assert.ok(sumaCompraCable('incluido')===false);
 });

 await test('11 m frente a tirada mayor y longitud manual 20 no acreditan alcance; incluido no compra',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Alcance '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),micro.id);
  const [k]=await sql`select * from sala_cables_suministrados where sala_id=${sala.id}`;
  const dest=await destinoRed(String(sala.id));
  const c=await conectar(String(sala.id),{equipo:String(k.propietario_equipo_id),puerto:String(k.puerto_fijo_id)},dest,20);
  await asignarCableSuministrado(sql,c.id,String(k.id));
  const ficha=await fichaDeSala(String(sala.id));assert.ok(ficha);
  const fila=ficha.filasCable.find(f=>f.conexion_id===c.id);assert.ok(fila);
  assert.equal(fila.longitud_utilizable_m,11);
  assert.ok((fila.metros??0)>11 || fila.avisos.some(a=>/insuficiente/.test(a)));
  assert.equal(ficha.material.length,0);
 });

 await test('Unido sin el extremo fijo, libre con propietario, incluido sin fila y doble asignación se rechazan',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Guardas '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),micro.id);
  const [k]=await sql`select * from sala_cables_suministrados where sala_id=${sala.id}`;
  const dest=await destinoRed(String(sala.id));
  const [ajeno]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${sala.id},${dest.articulo},'Ajeno') returning id`;
  const c=await conectar(String(sala.id),{equipo:dest.equipo,puerto:dest.puerto,ordinal:1},{equipo:String(ajeno.id),puerto:dest.puerto,ordinal:2});
  await assert.rejects(asignarCableSuministrado(sql,c.id,String(k.id)),e=>es23514(e)||(e instanceof Error && /extremo fijo/i.test(e.message)));
  await assert.rejects(sql`insert into sala_cables_suministrados(suministro_id,sala_id,ordinal,tipo,propietario_equipo_id,puerto_fijo_id,ordinal_fijo,snapshot)
   values(${k.suministro_id},${sala.id},99,'libre',${k.propietario_equipo_id},${k.puerto_fijo_id},1,'{}')`,es23514);
  await assert.rejects(sql`update conexiones set estado_suministro='incluido' where id=${c.id}`,es23514);
  const buena=await conectar(String(sala.id),{equipo:String(k.propietario_equipo_id),puerto:String(k.puerto_fijo_id)},{equipo:dest.equipo,puerto:dest.puerto,ordinal:3});
  await asignarCableSuministrado(sql,buena.id,String(k.id));
  const [libre]=await sql`insert into sala_cables_suministrados(suministro_id,sala_id,ordinal,tipo,snapshot)
   values(${k.suministro_id},${sala.id},99,'libre','{"referencia":"QA libre"}') returning id`;
  const cA=await conectar(String(sala.id),{equipo:dest.equipo,puerto:dest.puerto,ordinal:4},{equipo:String(ajeno.id),puerto:dest.puerto,ordinal:5});
  const cB=await conectar(String(sala.id),{equipo:dest.equipo,puerto:dest.puerto,ordinal:6},{equipo:String(ajeno.id),puerto:dest.puerto,ordinal:7});
  await asignarCableSuministrado(sql,cA.id,String(libre.id));
  await assert.rejects(asignarCableSuministrado(sql,cB.id,String(libre.id)),e=>esUnico(e)||es23514(e)||e instanceof Error);
  await assert.rejects(sql`delete from sala_cables_suministrados where id=${k.id}`,es23514);
  await assert.rejects(sql`delete from conexiones where id=${buena.id}`,es23514);
  await retirarAsignacionCable(sql,buena.id,'por_determinar');
  const [lib]=await sql`select estado_suministro,cable_suministrado_id from conexiones where id=${buena.id}`;
  assert.equal(lib.estado_suministro,'por_determinar');assert.equal(lib.cable_suministrado_id,null);
  assert.equal((await sql`select count(*)::int n from sala_cables_suministrados where id=${k.id}`)[0].n,1);
  await marcarCableAdicional(sql,buena.id);
  const [ad]=await sql`select estado_suministro from conexiones where id=${buena.id}`;
  assert.equal(ad.estado_suministro,'adicional');
 });

 await test('Dos micros no intercambian propietario ni FK; copia con unidos rechaza; sin cables transporta estado',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Copia '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),micro.id);
  await instanciarSuministro(sql,String(sala.id),micro.id);
  const ks=await sql`select * from sala_cables_suministrados where sala_id=${sala.id} order by id`;
  await assert.rejects(sql`update sala_cables_suministrados set propietario_equipo_id=${ks[1].propietario_equipo_id} where id=${ks[0].id}`,es23514);
  await assert.rejects(sql.begin(tx=>exigirDisenoCopiable(tx,'sala',String(sala.id))),/L3D|unidos o incluidos/);
  const [limpia]=await sql`insert into salas(nombre) values(${'Sin kit '+randomUUID()}) returning id`;
  const [a]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  const [b]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA',${randomUUID()}) returning id`;
  const [e1]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${limpia.id},${a.id},'A') returning id`;
  const [e2]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${limpia.id},${b.id},'B') returning id`;
  const [p1]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${a.id},'L','bidireccional','red',1,'app') returning id`;
  const [p2]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values(${b.id},'L','bidireccional','red',1,'app') returning id`;
  const c=await conectar(String(limpia.id),{equipo:String(e1.id),puerto:String(p1.id)},{equipo:String(e2.id),puerto:String(p2.id)});
  await marcarCableAdicional(sql,c.id);
  await sql.begin(tx=>exigirDisenoCopiable(tx,'sala',String(limpia.id)));
  const [pl]=await sql`select id from plantillas_sala limit 1`;
  assert.ok(pl);
  await assert.rejects(sql`insert into plantilla_conexiones(plantilla_id,senal,estado_suministro,decision_heredada)
   values(${pl.id},'red','incluido',false)`,es23514);
 });

 await test('Quitar una tirada incluida desasigna en la misma TX y conserva el latiguillo',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Borrar '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),micro.id);
  const [k]=await sql`select * from sala_cables_suministrados where sala_id=${sala.id}`;
  const dest=await destinoRed(String(sala.id));
  const c=await conectar(String(sala.id),{equipo:String(k.propietario_equipo_id),puerto:String(k.puerto_fijo_id)},dest,8);
  await asignarCableSuministrado(sql,c.id,String(k.id));
  const {borrarConexion}=await import('../src/app/acciones');
  const f=new FormData();f.set('id',c.id);f.set('sala_id',String(sala.id));
  const r=await borrarConexion(f);
  assert.equal(r?.error??null,null);
  assert.equal((await sql`select count(*)::int n from conexiones where id=${c.id}`)[0].n,0);
  assert.equal((await sql`select count(*)::int n from sala_cables_suministrados where id=${k.id}`)[0].n,1);
 });

 await test('Versión nueva documentada de unidad simple se publica; kit anidado sigue 23514',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [v2]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente)
   values(${micro.articulo},'CS-MIC-ARRAY-T',2,'documentada','https://example.com/qa') returning id`;
  await sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
   values(${v2.id},'cuerpo',${micro.articulo},'Cuerpo','equipo',1,'incluido','https://example.com/qa')`;
  await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente)
   values(${v2.id},'cable-unido','Latiguillo','cable',1,'incluido','https://example.com/qa')`;
  await sql`update articulo_composiciones set publicada=true where id=${v2.id}`;
  const [pub]=await sql`select publicada,estado_documental from articulo_composiciones where id=${v2.id}`;
  assert.equal(pub.publicada,true);assert.equal(pub.estado_documental,'documentada');
  const [kit]=await sql`insert into articulos(tipo,categoria,modelo,unidad) values('equipo','QA',${'Nest '+randomUUID()},'ud') returning id`;
  const [anidada]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente)
   values(${kit.id},'NEST-QA',1,'parcial','QA') returning id`;
  await assert.rejects(sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
   values(${anidada.id},'micro-kit',${micro.articulo},'Micro kit','equipo',1,'incluido','QA')`,es23514);
 });

 await test('Unidad simple admite cuerpo=kit; kit anidado sigue prohibido; retirada poscompra sigue rechazada',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [kit]=await sql`insert into articulos(tipo,categoria,modelo,unidad) values('equipo','QA',${'Nest '+randomUUID()},'ud') returning id`;
  const [anidada]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente)
   values(${kit.id},'NEST-QA',1,'parcial','QA') returning id`;
  await assert.rejects(sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
   values(${anidada.id},'micro-kit',${micro.articulo},'Micro kit','equipo',1,'incluido','QA')`,es23514);
  const [sala]=await sql`insert into salas(nombre) values(${'Poscompra '+randomUUID()}) returning id`;
  const id=await instanciarSuministro(sql,String(sala.id),micro.id);
  await assert.rejects(sql`update sala_suministros set estado='retirado_del_diseno' where id=${id}`,es23514);
  await assert.rejects(sql`delete from sala_suministros where id=${id}`,es23514);
  const eq=await composicion('CS-KIT-EQ-K9');
  const [eqSala]=await sql`insert into salas(nombre) values(${'EQ2 '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(eqSala.id),eq.id);
  const [pieza]=await sql`select equipo_id from sala_componentes_suministro c join sala_suministros s on s.id=c.suministro_id where s.sala_id=${eqSala.id} limit 1`;
  await assert.rejects(sql`delete from sala_equipos where id=${pieza.equipo_id}`,es23514);
 });

 await test('Concurrencia: dos asignaciones del mismo cable, un ganador',async()=>{
  const micro=await composicion('CS-MIC-ARRAY-T');
  const [sala]=await sql`insert into salas(nombre) values(${'Race '+randomUUID()}) returning id`;
  await instanciarSuministro(sql,String(sala.id),micro.id);
  const [k]=await sql`select * from sala_cables_suministrados where sala_id=${sala.id}`;
  const dest=await destinoRed(String(sala.id));
  const [libre]=await sql`insert into sala_cables_suministrados(suministro_id,sala_id,ordinal,tipo,snapshot)
   values(${k.suministro_id},${sala.id},99,'libre','{"referencia":"QA race"}') returning id`;
  const [e3]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${sala.id},${dest.articulo},'Ext') returning id`;
  const c1=await conectar(String(sala.id),{equipo:dest.equipo,puerto:dest.puerto,ordinal:1},{equipo:String(e3.id),puerto:dest.puerto,ordinal:2});
  const c2=await conectar(String(sala.id),{equipo:dest.equipo,puerto:dest.puerto,ordinal:3},{equipo:String(e3.id),puerto:dest.puerto,ordinal:4});
  const r=await Promise.allSettled([asignarCableSuministrado(sql,c1.id,String(libre.id)),asignarCableSuministrado(otra,c2.id,String(libre.id))]);
  const ok=r.filter(x=>x.status==='fulfilled').length;
  const ko=r.filter(x=>x.status==='rejected');
  assert.equal(ok,1);
  assert.ok(ko.length>=1);
  const [n]=await sql`select count(*)::int n from conexiones where cable_suministrado_id=${libre.id}`;
  assert.equal(n.n,1);
  void esErrorConcurrencia;
  void leerSuministros;
 });
}finally{
 await sql.end();await otra.end();
}
