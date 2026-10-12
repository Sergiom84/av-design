import assert from 'node:assert/strict';
import Module from 'node:module';
import {test} from 'node:test';
import postgres from 'postgres';
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(url.hostname==='127.0.0.1'&&url.port==='5433'&&/^\/qa_servidor_rosetas_[a-f0-9]{32}$/.test(url.pathname),'Solo fixture desechable propia del wrapper');
const modulo=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};
const cargar=modulo._load;
modulo._load=(request,...resto)=>{
 if(request==='server-only')return {};
 if(request==='next/cache')return {revalidatePath:()=>{}};
 if(request==='next/navigation')return {redirect:(ruta:string)=>{throw new Error('REDIRECT_QA:'+ruta);}};
 return cargar.call(Module,request,...resto);
};
const sql=postgres(process.env.DATABASE_URL!,{max:3,onnotice:()=>{}});
const acciones=await import('../src/app/acciones');
const diagrama=await import('../src/app/acciones-diagrama');
const form=(datos:Record<string,unknown>)=>{const f=new FormData();for(const [k,v] of Object.entries(datos))if(v!==undefined)f.set(k,v===null?'':String(v));return f;};
const [sala]=await sql<Array<{id:string}>>`insert into salas(nombre,largo_m,ancho_m,alto_m) values ('QA rosetas servidor',10,10,3) returning id`;
const [art]=await sql<Array<{id:string}>>`insert into articulos(tipo,categoria,modelo) values ('equipo','QA servidor','Equipo rosetas') returning id`;
const [puerto]=await sql<Array<{id:string}>>`insert into puertos(articulo_id,nombre,sentido,senal,total,fuente) values (${art.id},'LAN','bidireccional','red',10,'app') returning id`;
const [equipo]=await sql<Array<{id:string}>>`insert into sala_equipos(sala_id,articulo_id,nombre,x_m,y_m,z_m,posicion_confirmada) values (${sala.id},${art.id},'Equipo QA',0,0,0,true) returning id`;
const [toma]=await sql<Array<{id:string}>>`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m) values (${sala.id},'T-42',0,0,0) returning id`;
const version=async()=>Number((await sql`select diagrama_version from salas where id=${sala.id}`)[0].diagrama_version);
const datosCapacidad=(v:number,capacidad:number|null)=>form({sala_id:sala.id,toma_id:toma.id,versionEsperada:v,capacidad_documentada:capacidad,codigo_confirmado:'on',bocas:JSON.stringify(Array.from({length:capacidad??0},(_,i)=>({ordinal:i+1,etiqueta:null,conector:'RJ45',senal:'red'})))});
let bocaId='',conexionId='',plantillaId='';
try{
await test('Documentar capacidad conserva UUID y rechaza version vieja, capacidad incoherente y ocupadas',async()=>{
 const r=await acciones.guardarBocasToma(datosCapacidad(0,2));assert.ok(r.ok);assert.equal(r.version,1);
 const antes=await sql`select id from toma_red_bocas where toma_red_id=${toma.id} order by ordinal`;bocaId=antes[0].id;
 const vieja=await acciones.guardarBocasToma(datosCapacidad(0,3));assert.equal(vieja.ok,false);assert.equal(await version(),1);
 const ampliada=await acciones.guardarBocasToma(datosCapacidad(1,3));assert.ok(ampliada.ok);
 assert.deepEqual(Array.from(await sql`select id from toma_red_bocas where toma_red_id=${toma.id} and ordinal<=2 order by ordinal`),Array.from(antes));
 assert.equal((await sql`select codigo_confirmado from tomas_red where id=${toma.id}`)[0].codigo_confirmado,true);
});
await test('Editor crea extremo roseta y mueve esquema sin alterar XYZ; mantiene manual y puntos',async()=>{
 const datos={sala_id:sala.id,versionEsperada:await version(),altas:[{temporal_id:'cable',origen:{tipo:'equipo' as const,equipo_id:equipo.id,puerto_id:puerto.id,ordinal:1},destino:{tipo:'roseta' as const,toma_boca_id:bocaId},senal:'red' as const,articulo_cable_id:null,ruta:'directo' as const}],cambios:[],bajas:[],posiciones_rosetas:[{toma_id:toma.id,x:800,y:450}]};
 const r=await diagrama.guardarEditorConexiones(datos);assert.ok(r.ok);conexionId=r.ids.cable;assert.equal(r.etiquetas[conexionId],'RED-1000');
 const [t]=await sql`select x_m,y_m,z_m,esquema_x,esquema_y from tomas_red where id=${toma.id}`;assert.deepEqual([Number(t.x_m),Number(t.y_m),Number(t.z_m),t.esquema_x,t.esquema_y],[0,0,0,800,450]);
 await sql`update conexiones set longitud_manual_m=12.5 where id=${conexionId}`;
 await sql`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m) values (${conexionId},0,1,1,1)`;
 const cambio=await diagrama.guardarEditorConexiones({...datos,versionEsperada:r.version,altas:[],cambios:[{...datos.altas[0],id:conexionId}],posiciones_rosetas:[]});assert.ok(cambio.ok);
 assert.equal(Number((await sql`select longitud_manual_m from conexiones where id=${conexionId}`)[0].longitud_manual_m),12.5);
 assert.equal((await sql`select * from conexion_puntos_paso where conexion_id=${conexionId}`).length,1);
 const borrado=await acciones.guardarBocasToma(datosCapacidad(await version(),null));assert.equal(borrado.ok,false);
});
await test('Conversion documental reutiliza pareja y doble envio con version vieja es idempotente',async()=>{
 await sql`update sala_equipos set toma_red_id=${toma.id} where id=${equipo.id}`;
 const f=form({sala_id:sala.id,equipo_id:equipo.id,versionEsperada:await version(),puerto_id:puerto.id,ordinal:1,toma_boca_id:bocaId,articulo_cable_id:null,senal:'red',ruta:'directo',longitud_manual_m:12.5});
 const primera=await acciones.convertirAsignacionToma(f);assert.ok(primera.ok);assert.equal(primera.id,conexionId);
 const segunda=await acciones.convertirAsignacionToma(f);assert.deepEqual(segunda,primera);
 f.set('longitud_manual_m','13');assert.equal((await acciones.convertirAsignacionToma(f)).ok,false);
 assert.equal((await sql`select * from conexiones where sala_id=${sala.id}`).length,1);assert.equal(await version(),primera.version);
});
await test('Boca ajena revierte equipo temporal, esquema y version del lote',async()=>{
 const [otra]=await sql`insert into salas(nombre) values ('QA ajena rosetas') returning id`;
 const boca=await sql.begin(async tx=>{
  const [t]=await tx`insert into tomas_red(sala_id,codigo,capacidad_documentada) values (${otra.id},'AJENA',1) returning id`;
  return (await tx`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red') returning id`)[0];
 });
 const antes=Array.from(await sql`select id,esquema_x,esquema_y from sala_equipos where sala_id=${sala.id} order by id`),v=await version();
 const r=await diagrama.guardarEditorConexiones({sala_id:sala.id,versionEsperada:v,equipos_alta:[{temporal_id:'nuevo-ajeno',articulo_id:art.id}],posiciones:[{equipo_id:equipo.id,x:900,y:900}],altas:[{temporal_id:'ajena',origen:{tipo:'equipo',equipo_id:'nuevo-ajeno',puerto_id:puerto.id,ordinal:1},destino:{tipo:'roseta',toma_boca_id:boca.id},senal:'red',ruta:'directo',articulo_cable_id:null}],cambios:[],bajas:[]});
 assert.equal(r.ok,false);assert.equal(await version(),v);
 assert.deepEqual(Array.from(await sql`select id,esquema_x,esquema_y from sala_equipos where sala_id=${sala.id} order by id`),antes);
});
await test('Sala→plantilla conserva rosetas, manual y puntos, y deja codigo pendiente',async()=>{
 await assert.rejects(acciones.crearPlantillaDesdeSala(form({sala_id:sala.id,nombre:'QA copia rosetas'})),/REDIRECT_QA:/);
 const [p]=await sql`select id from plantillas_sala where nombre='QA copia rosetas'`;plantillaId=p.id;
 const [t]=await sql`select * from plantilla_tomas_red where plantilla_id=${p.id}`;
 assert.notEqual(t.id,toma.id);assert.equal(t.codigo_referencia,'T-42');assert.equal(t.codigo_confirmado,false);assert.equal(t.capacidad_documentada,3);
 const [c]=await sql`select * from plantilla_conexiones where plantilla_id=${p.id}`;assert.notEqual(c.id,conexionId);assert.equal(Number(c.longitud_manual_m),12.5);
 assert.equal((await sql`select * from plantilla_conexion_puntos_paso where plantilla_conexion_id=${c.id}`).length,1);
 assert.equal((await sql`select * from plantilla_conexion_bocas where plantilla_conexion_id=${c.id} and toma_boca_id is not null`).length,1);
});
await test('Crear sala y aplicar plantilla conservan las mismas bocas, manual, puntos y geometria',async()=>{
 const datos=form({nombre:'QA recreada rosetas',plantilla_id:plantillaId,largo_m:10,ancho_m:10,alto_m:3});
 await assert.rejects(acciones.crearSala(null,datos),/REDIRECT_QA:/);
 const [creada]=await sql`select id from salas where nombre='QA recreada rosetas'`;
 const [vacia]=await sql`insert into salas(nombre) values ('QA aplicar rosetas') returning id`;
 const aplicada=await diagrama.aplicarPlantillaAlDiagrama(vacia.id,plantillaId,0);assert.ok(aplicada.ok);
 for(const destino of [creada.id,vacia.id]){
  const [t]=await sql`select * from tomas_red where sala_id=${destino}`;assert.equal(t.codigo_referencia,'T-42');assert.equal(t.codigo_confirmado,false);assert.equal(t.capacidad_documentada,3);
  assert.deepEqual([Number(t.x_m),Number(t.y_m),Number(t.z_m)],[0,0,0]);
  const [c]=await sql`select * from conexiones where sala_id=${destino}`;assert.equal(Number(c.longitud_manual_m),12.5);assert.equal(c.etiqueta_cable,'RED-1000');assert.notEqual(c.id,conexionId);
  assert.equal((await sql`select * from conexion_puntos_paso where conexion_id=${c.id}`).length,1);
  assert.equal((await sql`select * from conexion_bocas where conexion_id=${c.id}`).length,2);
 }
});
await test('Pendientes documentales rechazan alta completa y aplicar sin cambiar sala',async()=>{
 const [p]=await sql`select id from plantillas_sala where nombre='SALA TP · aforo 8'`;
 const respuesta=await acciones.crearSala(null,form({nombre:'NO CREAR pendiente',plantilla_id:p.id,largo_m:10,ancho_m:10,alto_m:3}));assert.match(respuesta.error??'',/pendientes/);
 assert.equal((await sql`select * from salas where nombre='NO CREAR pendiente'`).length,0);
 const [s]=await sql`insert into salas(nombre) values ('QA pendiente aplicar') returning *`;
 const resultado=await diagrama.aplicarPlantillaAlDiagrama(s.id,p.id,0);assert.equal(resultado.ok,false);
 assert.deepEqual((await sql`select * from salas where id=${s.id}`)[0],s);
});
await test('Copia fuera de medidas revierte sala y rosetas aunque el fallo llegue despues de insertarlas',async()=>{
 const r=await acciones.crearSala(null,form({nombre:'NO CREAR pequeña',plantilla_id:plantillaId,largo_m:0.5,ancho_m:0.5,alto_m:3}));
 assert.match(r.error??'',/fuera/);assert.equal((await sql`select * from salas where nombre='NO CREAR pequeña'`).length,0);
 const [vacia]=await sql`insert into salas(nombre) values ('QA aplicar rechazo') returning *`;
 await sql`update plantillas_sala set largo_m=0.5,ancho_m=0.5 where id=${plantillaId}`;
 try{const r=await diagrama.aplicarPlantillaAlDiagrama(vacia.id,plantillaId,0);assert.equal(r.ok,false);assert.deepEqual((await sql`select * from salas where id=${vacia.id}`)[0],vacia);assert.equal((await sql`select * from tomas_red where sala_id=${vacia.id}`).length,0);}
 finally{await sql`update plantillas_sala set largo_m=10,ancho_m=10 where id=${plantillaId}`;}
});
await test('Resolucion documental enlaza solo eleccion explicita y puede reutilizar completa propia',async()=>{
 const [doc]=await sql`insert into plantilla_tiradas_documentales(fuente_clave,plantilla_id,tipologia,aforo,origen_categoria,destino_categoria,senal,ruta,orden,notas) values ('qa-explicita',${plantillaId},'QA','','A','T','red','directo','1','Original') returning id`;
 const [c]=await sql`select id from plantilla_conexiones where plantilla_id=${plantillaId}`;
 const extremos=await sql`select * from plantilla_conexion_bocas where plantilla_conexion_id=${c.id}`;
 const o=extremos.find(b=>b.lado==='origen')!,d=extremos.find(b=>b.lado==='destino')!;
 await acciones.anadirTiradaPlantilla(form({plantilla_id:plantillaId,documental_id:doc.id,conexion_existente_id:c.id,boca_origen:`${o.linea_id}:${o.puerto_id}:${o.ordinal}`,boca_destino:`roseta:${d.toma_boca_id}`,senal:'red',ruta:'directo'}));
 assert.equal((await sql`select conexion_resuelta_id from plantilla_tiradas_documentales where id=${doc.id}`)[0].conexion_resuelta_id,c.id);
 assert.equal(Number((await sql`select longitud_manual_m from plantilla_conexiones where id=${c.id}`)[0].longitud_manual_m),12.5);
});
await test('Borrar cable devuelve asignacion documental pendiente y capacidad puede retirarse',async()=>{
 await acciones.borrarConexion(form({id:conexionId}));
 const [e]=await sql`select toma_red_id,toma_red_conexion_id from sala_equipos where id=${equipo.id}`;assert.equal(e.toma_red_id,toma.id);assert.equal(e.toma_red_conexion_id,null);
 const r=await acciones.guardarBocasToma(datosCapacidad(await version(),null));assert.ok(r.ok);
 assert.equal((await sql`select * from toma_red_bocas where toma_red_id=${toma.id}`).length,0);
});
await test('Obra cerrada rechaza documentacion de bocas y conversion sin subir version',async()=>{
 const [p]=await sql`insert into proyectos(nombre) values ('QA cerrada rosetas') returning id`;
 const [l]=await sql`insert into localizaciones(proyecto_id,nombre) values (${p.id},'QA') returning id`;
 await sql`update salas set localizacion_id=${l.id} where id=${sala.id}`;await sql`insert into hitos_proyecto(proyecto_id,tipo) values (${p.id},'cierre')`;
 const v=await version();const r=await acciones.guardarBocasToma(datosCapacidad(v,2));assert.equal(r.ok,false);assert.equal(await version(),v);
 const c=await acciones.convertirAsignacionToma(form({sala_id:sala.id,equipo_id:equipo.id,versionEsperada:v,puerto_id:puerto.id,ordinal:1,toma_boca_id:bocaId,senal:'red'}));assert.equal(c.ok,false);assert.equal(await version(),v);
});
await test('Ficha y almacen mantienen manual 7.25 una sola vez sin medidas ni XYZ de roseta',async()=>{
 const [s]=await sql`insert into salas(nombre) values ('QA manual sin medidas') returning id`;
 const [e]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${art.id},'Equipo manual') returning id`;
 const [cable]=await sql`insert into articulos(tipo,categoria,modelo,unidad,senal) values ('cable','QA','Cable manual metros','m','red') returning id`;
 const t=await sql.begin(async tx=>{
  const [t]=await tx`insert into tomas_red(sala_id,codigo,capacidad_documentada) values (${s.id},'SIN XYZ',1) returning id`;
  const [b]=await tx`insert into toma_red_bocas(toma_red_id,ordinal,conector,senal) values (${t.id},1,'RJ45','red') returning id`;
  return {id:t.id,boca:b.id};
 });
 await sql`update sala_equipos set toma_red_id=${t.id} where id=${e.id}`;
 const r=await acciones.convertirAsignacionToma(form({sala_id:s.id,equipo_id:e.id,versionEsperada:0,puerto_id:puerto.id,ordinal:1,toma_boca_id:t.boca,articulo_cable_id:cable.id,senal:'red',ruta:'directo',longitud_manual_m:7.25}));assert.ok(r.ok);
 const {fichaDeSala}=await import('../src/app/salas/[id]/datos-ficha');
 const {faltaParaSala}=await import('../src/lib/datos-almacen');
 const ficha=await fichaDeSala(s.id),falta=await faltaParaSala(s.id);assert.ok(ficha&&falta);assert.equal(ficha.sinMedidas,true);
 assert.equal(ficha.resultados.length,1);assert.equal(ficha.resultados[0].longitud_m,7.25);assert.equal(ficha.filasCable.length,1);assert.equal(ficha.filasCable[0].metros,7.25);
 assert.equal(ficha.material.filter(m=>m.articulo_id===cable.id).length,1);assert.equal(ficha.material.find(m=>m.articulo_id===cable.id)!.cantidad,7.25);
 assert.equal(falta.necesidad.filter(m=>m.articulo_id===cable.id).length,1);assert.equal(falta.necesidad.find(m=>m.articulo_id===cable.id)!.cantidad,7.25);
});
for(const caso of ['manual','catalogo'])await test(`Cableado rechaza ${caso} invalido en alta y edicion conservando conexion y version`,async()=>{
 const [s]=await sql`insert into salas(nombre) values (${`QA guarda ${caso}`}) returning id`;
 const [e]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${art.id},'QA') returning id`;
 const [d]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${art.id},'QA destino') returning id`;
 const base={sala_id:s.id,origen_id:e.id,destino_id:d.id,boca_origen:`${puerto.id}:1`,boca_destino:`${puerto.id}:2`,senal:'red',ruta:'directo',longitud_manual_m:'4'};
 const invalidos=caso==='manual'?[{longitud_manual_m:'abc'}]:[{articulo_cable_id:art.id},{articulo_cable_id:(await sql`insert into articulos(tipo,categoria,modelo,activo) values ('cable','QA','Inactivo',false) returning id`)[0].id}];
 for(const dato of invalidos){const r=await acciones.anadirConexionConEstado({error:null},form({...base,...dato}));assert.ok(r.error);assert.equal((await sql`select * from conexiones where sala_id=${s.id}`).length,0);assert.equal(Number((await sql`select diagrama_version from salas where id=${s.id}`)[0].diagrama_version),0);}
 await acciones.anadirConexion(form(base));const [c]=await sql`select * from conexiones where sala_id=${s.id}`;
 const [v]=await sql`select diagrama_version from salas where id=${s.id}`;
 for(const dato of invalidos){await assert.rejects(()=>acciones.guardarConexion(form({...base,id:c.id,...dato})));assert.deepEqual((await sql`select * from conexiones where id=${c.id}`)[0],c);assert.equal((await sql`select diagrama_version from salas where id=${s.id}`)[0].diagrama_version,v.diagrama_version);}
});
}finally{await sql.end();await (await import('../src/lib/db')).sql.end();}
