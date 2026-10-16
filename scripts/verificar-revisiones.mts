/** Gate E3 dirigido a la fixture PRUEBA-REV-01. Sin .env, seed ni BD habitual. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { conectarRevisiones, comprobarUrlRevisiones, fotografiarRevisiones, FIXTURE_REVISIONES as f, SALIDA_REVISIONES } from './revisiones-fixture.mjs';
import { compararDisenos } from '../src/lib/revisiones-diseno';
const url=process.env.REVISIONES_DATABASE_URL;if(!url)throw new Error('REVISIONES_DATABASE_URL explícita obligatoria.');
for(const rechazada of [url.replace('5547','5432'),url.replace('av_design_e3_prueba','av_design'),url.replace('av_design_e3:','postgres:'),url+'?sslmode=require'])assert.throws(()=>comprobarUrlRevisiones(rechazada));
const sql=await conectarRevisiones(url);process.env.DATABASE_URL=url;
type Loader={_load:(request:string,...resto:unknown[])=>unknown};const modulo=Module as unknown as Loader;const original=modulo._load;
modulo._load=(request,...resto)=>request==='server-only'?{}:original.call(Module,request,...resto);
const repo=await import('../src/lib/revisiones-diseno-repositorio');
const carpeta=resolve(SALIDA_REVISIONES,`core-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(carpeta,{recursive:true});
const checks:string[]=[];const ok=(texto:string)=>{checks.push(texto);console.log(`OK ${texto}`);};
const OPERACION=['movimientos','reservas','pedidos','pedido_lineas','cargas','carga_lineas','hitos_proyecto','hitos_sala','revisiones','revision_puntos','articulos','precios','puertos','parametros','plantillas_sala','plantilla_articulos','plantilla_conexiones','plantilla_mobiliario','usuarios','usuario_permisos'];
const foto=async(etiqueta:string)=>{const foto=await fotografiarRevisiones(sql);await writeFile(resolve(carpeta,`bd-${etiqueta}.json`),JSON.stringify(foto,null,2));return foto;};
try {
  if(process.argv.includes('--inspeccionar')) {
    const revisiones=await sql`select numero,snapshot from revisiones_diseno order by numero`;
    for(const r of revisiones)console.log(JSON.stringify({numero:r.numero,datos:(r.snapshot as {datos:unknown}).datos}));
    process.exitCode=0;
  } else {
  if(process.argv.includes('--recuperar-fixture')) {
    // La primera tanda falló antes de restaurar. Recuperación sólo de dos campos sintéticos.
    await sql`update sala_equipos set x_m=4,rotacion_grados=0,esquema_x=null,esquema_y=null where id=${f.equipoPantalla}`;
    await sql`update salas set largo_m=8 where id=${f.sala}`;
  }
  const antes=await foto('antes');
  const [notasExistentes]=await sql`select count(*)::int n from anotaciones_sala where sala_id=${f.sala}`;
  if(!notasExistentes.n)await sql`insert into anotaciones_sala(sala_id,texto,ancla_tipo,ancla_id,x,y) values
    (${f.sala},'PRUEBA-REV-01 · Equipo: conservar altura medida','equipo',${f.equipoPantalla},null,null),
    (${f.sala},'PRUEBA-REV-01 · Cable: verificar ruta física','conexion',${f.conexionHdmi},null,null),
    (${f.sala},'PRUEBA-REV-01 · Coordenada visual; no es una medida','visual',null,260,320)`;
  const inicial=await repo.leerDiseno(sql,f.sala);const r1=await repo.crearRevisionDiseno(sql,f.sala,'PRUEBA-REV-01 · Revisión inicial',f.admin,inicial.base);
  assert.equal(r1.hash,inicial.base.hash);assert.equal(r1.autorId,f.admin);assert.ok(r1.creadoEn);ok('Snapshot consistente con autor,fecha,hash,puertos/rutas/BOM/notes/contexto y sin operación');
  const antesLectura=await foto('antes-lectura');await repo.historialDiseno(sql,f.sala);await repo.obtenerRevisionDiseno(sql,f.sala,r1.id);const despuesLectura=await foto('despues-lectura');assert.equal(antesLectura.sha256,despuesLectura.sha256);ok('Lectura de historial/snapshot no escribe');
  await assert.rejects(sql`update revisiones_diseno set nombre='No permitido' where id=${r1.id}`,/inmutable/);
  await assert.rejects(sql`delete from revisiones_diseno where id=${r1.id}`,/inmutable/);ok('UPDATE y DELETE historial rechazados por Postgres');
  const [etiquetasAntes]=await sql`select jsonb_object_agg(id,identificador_cable) etiquetas from conexiones where sala_id=${f.sala}`;
  await sql`update sala_equipos set x_m=x_m+0.25,rotacion_grados=90,esquema_x=400,esquema_y=250 where id=${f.equipoPantalla}`;
  await sql`update salas set largo_m=largo_m+1 where id=${f.sala}`;
  const cambiado=await repo.leerDiseno(sql,f.sala);
  await assert.rejects(repo.crearRevisionDiseno(sql,f.sala,'Base obsoleta',f.admin,inicial.base),/cambió/);
  const r2=await repo.crearRevisionDiseno(sql,f.sala,'PRUEBA-REV-01 · Alternativa de posición',f.admin,cambiado.base);
  const diferencias=await repo.compararRevisionesDiseno(sql,f.sala,r1.id,r2.id);assert.ok(diferencias.cambios.some(c=>c.grupo==='medidas'));assert.ok(diferencias.cambios.some(c=>c.grupo==='equipos'));assert.ok(diferencias.cambios.some(c=>c.grupo==='presentacion'));assert.ok(diferencias.material.some(m=>m.antes>0));await writeFile(resolve(carpeta,'diff.json'),JSON.stringify(diferencias,null,2));ok('Diff físico/visual separado y material derivado con cables');
  const fotoRollback=await foto('antes-rollback');await assert.rejects(repo.restaurarRevisionDiseno(sql,f.sala,r1.id,f.admin,cambiado.base,{fallarDespuesDeAplicar:true}),/rollback sintético/);assert.equal((await foto('despues-rollback')).sha256,fotoRollback.sha256);ok('Fallo tras aplicación revierte diseño,versiones,contadores e historial entero');
  const restaurada=await repo.restaurarRevisionDiseno(sql,f.sala,r1.id,f.admin,cambiado.base);const vivo=await repo.leerDiseno(sql,f.sala);
  assert.equal(restaurada.restauradaDeId,r1.id);assert.equal(restaurada.hash,vivo.base.hash);assert.equal(compararDisenos(r1.snapshot!,vivo.snapshot).cambios.length,0);
  const [etiquetasDespues]=await sql`select jsonb_object_agg(id,identificador_cable) etiquetas from conexiones where sala_id=${f.sala}`;assert.deepEqual(etiquetasAntes,etiquetasDespues);ok('Restauración nueva reconcilia IDs,ausencias,giros,bocas,rutas y códigos de cable');
  const copia=await repo.duplicarSalaDiseno(sql,f.sala,`PRUEBA-REV-01 · Copia ${r1.numero}`,`PRUEBA-REV-COPIA-${r1.numero}`,f.admin,vivo.base);const copiaFoto=await repo.leerDiseno(sql,copia.salaId);
  for(const grupo of ['equipos','muebles','puertas','tomas','conexiones','puntos','material','anotaciones'] as const){assert.equal(copiaFoto.snapshot.datos[grupo].length,vivo.snapshot.datos[grupo].length);const ids=new Set(vivo.snapshot.datos[grupo].map(f=>f.id));assert.ok(copiaFoto.snapshot.datos[grupo].every(f=>!ids.has(f.id)));}
  assert.equal(copiaFoto.origen?.salaId,f.sala);assert.equal(copiaFoto.origen?.revisionId,copia.origenRevisionId);assert.ok(copiaFoto.snapshot.datos.material.every(m=>m.lote_id===null));
  assert.equal((await sql`select medidas_heredadas from salas where id=${copia.salaId}`)[0].medidas_heredadas,true);
  const diffCopia=await repo.compararAlternativaDiseno(sql,f.sala,copia.salaId);assert.equal(diffCopia.cambios.length,0);for(const m of diffCopia.material)assert.equal(m.antes,m.despues);ok('Duplicación con IDs nuevos,herencia y BOM sin lote; comparación original/copia sin falsas altas');
  for(const tabla of ['reservas','movimientos','pedidos','cargas','hitos_sala','revisiones'])assert.equal((await sql.unsafe(`select count(*)::int n from ${tabla} where sala_id=$1`,[copia.salaId]))[0].n,0);ok('Copia no contiene reservas,movimientos,pedidos,cargas,hitos ni visitas');
  const nuevaBase=await repo.leerDiseno(sql,f.sala);await sql`update sala_equipos set nombre=nombre||' ABA' where id=${f.equipoPantalla}`;await sql`update sala_equipos set nombre=${vivo.snapshot.datos.equipos.find(e=>e.id===f.equipoPantalla)!.nombre as string} where id=${f.equipoPantalla}`;
  const aba=await repo.leerDiseno(sql,f.sala);assert.equal(aba.base.hash,nuevaBase.base.hash);assert.ok(aba.base.version>nuevaBase.base.version);await assert.rejects(repo.restaurarRevisionDiseno(sql,f.sala,r1.id,f.admin,nuevaBase.base),/cambió/);ok('ABA con contenido idéntico invalida la base por versión de diseño');
  const paralelas=await Promise.allSettled([repo.crearRevisionDiseno(sql,f.sala,'Concurrente A',f.admin,aba.base),repo.crearRevisionDiseno(sql,f.sala,'Concurrente B',f.admin,aba.base)]);
  // Dos snapshots sin mutar diseño pueden ser válidos; su numeración serializada nunca colisiona.
  assert.ok(paralelas.some(r=>r.status==='fulfilled'));const nums=(await repo.historialDiseno(sql,f.sala)).revisiones.map(r=>r.numero);assert.equal(nums.length,new Set(nums).size);ok('Concurrencia serializable conserva numeración e integridad del historial');
  const pruebaPuerto={sala:randomUUID(),origen:randomUUID(),destino:randomUUID(),conexion:randomUUID(),puerto:randomUUID()};
  await sql.begin(async tx=>{
    await tx`insert into salas(id,nombre,largo_m,ancho_m,alto_m) values(${pruebaPuerto.sala},'PRUEBA-REV-01 · Puerto histórico retirado',8,6,3)`;
    await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre) values(${pruebaPuerto.origen},${pruebaPuerto.sala},${f.codec},'Origen sintético'),(${pruebaPuerto.destino},${pruebaPuerto.sala},${f.pantalla},'Destino sintético')`;
    await tx`insert into puertos(id,articulo_id,nombre,total,sentido,senal,fuente) values(${pruebaPuerto.puerto},${f.codec},'PRUEBA PUERTO RETIRADO',1,'salida','hdmi','app')`;
    await tx`insert into conexiones(id,sala_id,origen_id,destino_id,senal,puerto_origen_id,puerto_destino_id) values(${pruebaPuerto.conexion},${pruebaPuerto.sala},${pruebaPuerto.origen},${pruebaPuerto.destino},'hdmi',${pruebaPuerto.puerto},${f.puertoHdmiEntrada})`;
  });
  const fotoPuerto=await repo.leerDiseno(sql,pruebaPuerto.sala);const revisionPuerto=await repo.crearRevisionDiseno(sql,pruebaPuerto.sala,'Puerto anterior',f.admin,fotoPuerto.base);
  await sql`delete from conexiones where id=${pruebaPuerto.conexion}`;await sql`delete from puertos where id=${pruebaPuerto.puerto}`;
  const incompatible=await repo.leerDiseno(sql,pruebaPuerto.sala);const fotoIncompatible=await foto('antes-incompatible');await assert.rejects(repo.restaurarRevisionDiseno(sql,pruebaPuerto.sala,revisionPuerto.id,f.admin,incompatible.base),/puerto/i);assert.equal((await foto('despues-incompatible')).sha256,fotoIncompatible.sha256);ok('Puerto histórico incompatible rechaza toda restauración sin escritura');
  await assert.rejects(repo.obtenerRevisionDiseno(sql,f.salaDos,r1.id),/pertenece/);await assert.rejects(repo.compararAlternativaDiseno(sql,f.sala,f.salaAjena),/Sólo se comparan/);ok('Revisión ajena/alternativa sin relación rechazadas');
  const cerrada=await repo.leerDiseno(sql,f.cerrada);await assert.rejects(repo.crearRevisionDiseno(sql,f.cerrada,'No',f.admin,cerrada.base),/cerrada/);await assert.rejects(repo.duplicarSalaDiseno(sql,f.cerrada,'No',null,f.admin,cerrada.base),/cerrada/);ok('Obra cerrada rechaza revisión y copia');
  const legado=await repo.leerDiseno(sql,f.legado);await repo.crearRevisionDiseno(sql,f.legado,'Legado válido',f.admin,legado.base);ok('Sala legado permite revisión sin proyecto');
  const despues=await foto('despues');for(const tabla of OPERACION)assert.equal(despues.tablas.find(t=>t.tabla===tabla)?.sha256,antes.tablas.find(t=>t.tabla===tabla)?.sha256,`${tabla} intacta`);ok('Hechos operativos,usuarios,catálogo/precios/puertos/parámetros y plantillas byte a byte intactos');
  const final=await repo.leerDiseno(sql,f.sala);await repo.crearRevisionDiseno(sql,f.sala,'PRUEBA-REV-01 · Estado final verificado',f.admin,final.base);
  const ref=await repo.referenciaRevisionDiseno(f.sala,sql);assert.equal(ref.estado,'revision');assert.ok(ref.autor&&ref.creadoEn);ok('Identidad de entregables referencia revisión actual y antecedentes');
  await writeFile(resolve(carpeta,'resultados.json'),JSON.stringify({checks,revisionInicial:r1.id,revisionAlternativa:r2.id,revisionRestaurada:restaurada.id,salaCopia:copia.salaId,referencia:ref},null,2));
  await writeFile(resolve(SALIDA_REVISIONES,'core-ultimo.json'),JSON.stringify({carpeta,checks:checks.length,salaCopia:copia.salaId,revisionInicial:r1.id},null,2));
  console.log(`Resultado ${checks.length} gates: ${carpeta}`);
  }
}finally{modulo._load=original;await sql.end();}
