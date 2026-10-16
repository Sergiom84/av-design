/** Escritores compartidos reales; destino exclusivo nueva5563. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { conectarRevisiones, fotografiarRevisiones, FIXTURE_REVISIONES as f, idRequisito } from './rea10-fixture.mjs';
import { PERMISOS_POR_ROL } from '../src/lib/usuarios';
const { guardarDatosTecnicosEnTransaccion } = await import('../src/lib/catalogo-tecnico-repositorio');
const { crearPuertoEnTransaccion } = await import('../src/lib/catalogo-puertos-escritura');
const { crearLocalizacionEnTransaccion, ErrorJerarquia } = await import('../src/lib/jerarquia-transaccional');
const url=process.env.REA10_DATABASE_URL;if(!url)throw new Error('REA10_DATABASE_URL obligatoria.');
const sql=await conectarRevisiones(url),salida='output/rea-integracion/rea10/escritores';
await mkdir(salida,{recursive:true});
const usuario={id:idRequisito(1),permisos:PERMISOS_POR_ROL.admin,debeCambiarClave:false,ficticio:false};
const checks:string[]=[];class Revertir extends Error{}
try{
 const antes=await fotografiarRevisiones(sql);await writeFile(salida+'/antes.json',JSON.stringify(antes,null,2));
 await assert.rejects(sql.begin(async tx=>{
  const [articulo]=await tx`select id,marca,modelo from articulos where id=${f.matriz}`;
  assert.ok(articulo);
  const datos={marca:articulo.marca==null?null:String(articulo.marca),modelo:String(articulo.modelo),
   ancho:1200,alto:null,fondo:null,unidad:'mm',ru:null,origen:'PRUEBA-REA10-WRITER',url:'https://example.invalid/prueba',fecha:'2026-10-15'};
  await assert.rejects(guardarDatosTecnicosEnTransaccion(tx,usuario,f.matriz,{...datos,url:''}));
  await guardarDatosTecnicosEnTransaccion(tx,usuario,f.matriz,datos);
  const [tecnico]=await tx`select ancho::text as ancho,alto,fondo,unidad,revision_fuente::text as revision from articulos_tecnicos where articulo_id=${f.matriz}`;
  assert.equal(tecnico.ancho,'1200');assert.equal(tecnico.alto,null);assert.equal(tecnico.fondo,null);assert.equal(tecnico.unidad,'mm');assert.ok(BigInt(tecnico.revision)>BigInt(0));
  const puerto={nombre:'HDMI IN PRUEBA-REA10',total:2,sentido:'entrada',senal:'hdmi',conector:'HDMI A',orden:1,notas:null};
  const id=await crearPuertoEnTransaccion(tx,f.matriz,puerto,{rechazarDuplicado:true});assert.ok(id);
  const [guardado]=await tx`select nombre,total,fuente,revision_fuente::text as revision from puertos where id=${id}`;
  assert.equal(guardado.nombre,puerto.nombre);assert.equal(guardado.total,2);assert.equal(guardado.fuente,'app');
  await assert.rejects(tx.savepoint(t=>crearPuertoEnTransaccion(t,f.matriz,{...puerto,total:5},{rechazarDuplicado:true})),/ya existe/u);
  const [igual]=await tx`select total,revision_fuente::text as revision from puertos where id=${id}`;
  assert.equal(igual.total,2);assert.equal(igual.revision,guardado.revision);
  assert.equal(await crearPuertoEnTransaccion(tx,f.matriz,puerto),null);
  throw new Revertir();
 }),Revertir);
 assert.deepEqual(await fotografiarRevisiones(sql),antes);
 checks.push('Escritores E2 técnico y alta de puerto comparten tx; dimensión parcial1200mm, URL exigida, literal/total2/fuenteapp; duplicado no pisa; rollback restaura104tablas.');

 const proyecto=randomUUID(),hito=randomUUID(),nombre='PRUEBA-REA10-CIERRE-'+randomUUID();
 await sql`insert into proyectos(id,nombre,codigo) values(${proyecto},${nombre},${nombre})`;
 let liberar!:()=>void,entro!:()=>void,pidB=0;
 const barrera=new Promise<void>(r=>{liberar=r;}),entrada=new Promise<void>(r=>{entro=r;});
 const bloqueo=sql.begin(async tx=>{
  await tx`select id from proyectos where id=${proyecto} for update`;entro();await barrera;
  await tx`insert into hitos_proyecto(id,proyecto_id,tipo,fecha,notas) values(${hito},${proyecto},'cierre',current_date,'PRUEBA-REA10-CIERRE')`;
 });
 await entrada;
 const alta=sql.begin(async tx=>{const [p]=await tx`select pg_backend_pid() as pid`;pidB=Number(p.pid);
  return crearLocalizacionEnTransaccion(tx,proyecto,nombre);
 }).then(id=>({id,error:null}),error=>({id:null,error}));
 let espera:Record<string,unknown>|undefined;
 try{
  for(let i=0;i<100;i++){
   if(pidB){const [p]=await sql`select pid,wait_event_type,query from pg_stat_activity where pid=${pidB}`;
    if(p?.wait_event_type==='Lock'){espera=p;break;}}
   await new Promise(r=>setTimeout(r,20));
  }
  assert.ok(espera,'La espera real de la nueva alta debe observarse.');
 }finally{liberar();}
 await bloqueo;const resultado=await alta;
 try{
  assert.ok(resultado.error instanceof ErrorJerarquia);assert.equal(resultado.error.estadoHttp,409);
  const [{n}]=await sql`select count(*)::int as n from localizaciones where proyecto_id=${proyecto}`;assert.equal(n,0);
  await writeFile(salida+'/carrera-cierre.json',JSON.stringify({espera,rechazo:resultado.error.message,localizaciones:n},null,2));
 }finally{
  // Sólo estas filas PRUEBA nuevas; ningún registro previo se elimina.
  await sql`delete from hitos_proyecto where id=${hito} and proyecto_id=${proyecto}`;
  await sql`delete from localizaciones where proyecto_id=${proyecto}`;
  await sql`delete from proyectos where id=${proyecto} and nombre=${nombre}`;
 }
 assert.deepEqual(await fotografiarRevisiones(sql),antes);
 checks.push('Cierre real gana mientras alta espera proyecto:409 tras lock observado; ninguna localización,104tablas originales idénticas tras retirar sólo fixture nueva.');
 await writeFile(salida+'/resultado.json',JSON.stringify({checks,tablas:antes.tablas.length,limite:'No sustituye integración13GWT10 ni cierre generalST33; sólo escritores compartidos y una carrera de alta/cierre.'},null,2));
 console.log(JSON.stringify({checks:checks.length,tablas:antes.tablas.length}));
}finally{await sql.end();}
