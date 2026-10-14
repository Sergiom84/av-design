/** Único gate postrevisión P2/G1/G2, únicamente fixture E2 identificada. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { conectarImportacion, fotografiarImportacion, FIXTURE_IMPORTACION as f } from './importacion-fixture.mjs';
import type { EntradaImportacion, LoteImportacion } from '../src/lib/importacion/modelo';

const url=process.env.IMPORTACION_DATABASE_URL;
if(!url)throw new Error('IMPORTACION_DATABASE_URL explícita obligatoria.');
const sql=await conectarImportacion(url);process.env.DATABASE_URL=url;
type Modulo={_load:(request:string,...resto:unknown[])=>unknown};
const modulo=Module as unknown as Modulo;const original=modulo._load;
modulo._load=(request,...resto)=>request==='server-only'?{}:original.call(Module,request,...resto);
const salida=resolve('output/e2-importacion/gates/tanda-final');await mkdir(salida,{recursive:true});
const checks:string[]=[];const lotes:LoteImportacion[]=[];
const ok=(msg:string)=>{checks.push(msg);console.log(`OK   ${msg}`);};
const id=(n:number)=>`e2a00000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const entrada=(destino:EntradaImportacion['destino'],nombre:string,cabecera:string,filas:string[][]):EntradaImportacion=>({
  destino,...(destino==='bom'?{salaId:f.sala}:{}),origen:'PRUEBA-IMPORT-01 REGRESIONES SINTÉTICAS',
  archivo:{nombre,bytes:new TextEncoder().encode(cabecera+'\n'+filas.map(fila=>fila.map(v=>'"'+v.replaceAll('"','""')+'"').join(';')).join('\n')+'\n')},
});
const propias:{articulos:string[];proveedores:string[];pedidos:string[];reservas:string[];favoritos:string[];bom:string[]}={articulos:[],proveedores:[],pedidos:[],reservas:[],favoritos:[],bom:[]};
const tablaFila=async(tabla:string,id:string)=>{
  if(!/^[a-z_]+$/.test(tabla))throw new Error('Tabla no permitida.');
  const filas=await sql.unsafe(`select to_jsonb(t) as fila from "${tabla}" t where id=$1`,[id]);return filas[0]?.fila??null;
};

try{
  const api=await import('../src/lib/importacion/index');
  const tecnico=await import('../src/lib/catalogo-tecnico-repositorio');
  const {PERMISOS_POR_ROL}=await import('../src/lib/usuarios');
  const usuario={id:f.admin,permisos:PERMISOS_POR_ROL.admin,debeCambiarClave:false,ficticio:false};
  const antes=await fotografiarImportacion(sql);
  await writeFile(resolve(salida,'regresiones-bd-antes.json'),JSON.stringify(antes,null,2));

  // G1: generador real y fuentes sintéticas en un esquema sin fallback público.
  const seedDir=resolve('output/e2-importacion/gates/seed-prueba');
  const manifest=JSON.parse(await readFile(resolve(seedDir,'manifest.json'),'utf8'));
  for(const [archivo,esperado]of Object.entries(manifest.protegidoAntes))assert.equal(hash(await readFile(resolve(archivo))),esperado);
  const conexion=await sql.reserve();
  let esquemaCreado=false;
  try{
    const [{existe}]=await conexion`select exists(select 1 from pg_namespace where nspname='e2_seed_prueba') as existe`;
    if(existe)throw new Error('e2_seed_prueba ya existe: no se resetea ni mezcla. Usa otro nombre de esquema sintético tras revisar su origen.');
    await conexion.unsafe('create schema e2_seed_prueba');esquemaCreado=true;
    await conexion.unsafe('set search_path to e2_seed_prueba, pg_catalog');
    const [identidad]=await conexion`select current_schema() as esquema,current_database() as base,current_user as usuario`;
    assert.deepEqual(identidad,{esquema:'e2_seed_prueba',base:'av_design_e2_prueba',usuario:'av_design_e2'});
    const schemaOriginal=await readFile(resolve('db/schema.sql'),'utf8');
    // El schema histórico se ejecuta en public; sus dos probes de columnas
    // no filtran namespace. La copia QA los acota, igual que sus constraints.
    const schemaQA=schemaOriginal.replaceAll('where table_name =','where table_schema = current_schema() and table_name =')
      .replaceAll('from pg_constraint where conname =','from pg_constraint where connamespace = (select oid from pg_namespace where nspname = current_schema()) and conname =');
    await writeFile(resolve(salida,'g1-schema-qa.sql'),schemaQA);
    await conexion.unsafe(schemaQA);
    await conexion.unsafe(await readFile(resolve(seedDir,'preparacion.sql'),'utf8'));
    // La lista parte de CSV; la confirmación debe convertir su descripción a app.
    await conexion`update articulos set fuente='csv' where id=${manifest.ids.cableApp}`;
    const fotoSeed=async()=>({
      articulos:await conexion`select to_jsonb(a) as fila from articulos a order by modelo`,
      precios:await conexion`select to_jsonb(p) as fila from precios p order by presupuesto,articulo_id`,
      puertos:await conexion`select to_jsonb(p) as fila from puertos p order by nombre,articulo_id`,
    });
    const inicial=await fotoSeed();
    // La actualización app usa el mismo servicio real de importación, con
    // usuario sintético del esquema. No se importan bytes de data/ reales.
    const clave='huella sintética sin autenticación externa';
    await conexion`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo)
      values(${f.admin},'prueba-seed-admin','Administrador sintético seed','admin',${clave},false,true)`;
    const datosCatalogo=entrada('catalogo','g1-catalogo.csv','referencia;marca;modelo;categoria;tipo;unidad;descripcion',[
      ['','E2SEED','CABLEAPP','E2SEED CABLE','cable','m','Descripción protegida desde importación app'],
    ]);
    await writeFile(resolve(salida,datosCatalogo.archivo.nombre),datosCatalogo.archivo.bytes);
    const compatible=postgres(url,{max:1,ssl:false,connection:{search_path:'e2_seed_prueba, pg_catalog'},onnotice:()=>{}});
    let lote:LoteImportacion;
    try{
      const [destino]=await compatible`select current_schema() as esquema,current_database() as base,current_user as usuario`;
      assert.deepEqual(destino,identidad);
      const revision=await api.previsualizarImportacion(compatible,datosCatalogo);
      assert.equal(revision.filas[0].candidatos.length,1);
      lote=await api.confirmarImportacion(compatible,datosCatalogo,[{fila:2,articuloId:revision.filas[0].candidatos[0].id,revisionArticulo:revision.filas[0].candidatos[0].revision}],f.admin);
    }finally{await compatible.end();}
    const importado=await fotoSeed();
    const seed=await readFile(resolve(seedDir,'db/seed.sql'),'utf8');
    assert.equal(hash(new TextEncoder().encode(seed)),manifest.archivos['db/seed.sql']);
    await conexion.unsafe(seed);
    const despues=await fotoSeed();
    // El manifest fija IDs y valores literales sin depender del inventario real.
    const appArticulos=importado.articulos.filter(a=>(a.fila as {fuente:string}).fuente==='app');
    for(const a of appArticulos)assert.deepEqual(despues.articulos.find(b=>b.fila.id===a.fila.id),a);
    for(const p of importado.precios.filter(p=>p.fila.fuente==='app'))assert.deepEqual(despues.precios.find(b=>b.fila.id===p.fila.id),p);
    for(const p of importado.puertos.filter(p=>p.fila.fuente==='app'))assert.deepEqual(despues.puertos.find(b=>b.fila.id===p.fila.id),p);
    assert.ok(despues.articulos.some(a=>a.fila.modelo==='CABLECSV'&&a.fila.fuente==='csv'));
    assert.ok(!despues.precios.some(p=>p.fila.id===manifest.ids.precioCsvRetirado));
    assert.ok(despues.precios.some(p=>p.fila.presupuesto===manifest.presupuestos.csvNuevo));
    assert.ok(!despues.puertos.some(p=>p.fila.id===manifest.ids.puertoCsvRetirado));
    assert.ok(despues.puertos.some(p=>p.fila.nombre==='LAN CSV NUEVO'));
    const cableCsv=despues.articulos.find(a=>a.fila.id===manifest.ids.cableCsv)!.fila;
    for(const [campo,valor]of Object.entries(manifest.esperado.cableCsv))assert.deepEqual(cableCsv[campo],valor);
    const equipoCsv=despues.articulos.find(a=>a.fila.id===manifest.ids.equipoCsv)!.fila;
    for(const [campo,valor]of Object.entries(manifest.esperado.equipoCsv))assert.deepEqual(equipoCsv[campo],valor);
    assert.equal(despues.articulos.length,manifest.esperado.referenciasTotales);assert.equal(despues.precios.length,manifest.esperado.preciosTotales);assert.equal(despues.puertos.length,manifest.esperado.puertosTotales);
    await writeFile(resolve(salida,'g1-seed.json'),JSON.stringify({manifest,identidad,inicial,importado,despues,lote},null,2));
  } finally{
    await conexion.unsafe('rollback');
    await conexion.unsafe('set search_path to public, pg_catalog');
    if(esquemaCreado)await conexion.unsafe('drop schema e2_seed_prueba cascade');
    conexion.release();
  }
  assert.deepEqual(await fotografiarImportacion(sql),antes);
  for(const [archivo,esperado]of Object.entries(manifest.protegidoDespues))assert.equal(hash(await readFile(resolve(archivo))),esperado);
  ok('G1: generador real con CSV sintéticos; importación app y precios/puertos app sobreviven siembra conflictiva, CSV sí regenera; 44 tablas públicas idénticas');

  // G2: altas reales y dependencia ajena representada por otro usuario.
  const alta=entrada('catalogo','g2-altas.csv','referencia;marca;modelo;categoria;tipo;unidad;descripcion',[
    ['E2G2-DEPENDIENTE','E2G2','DEPENDIENTE','PRUEBA G2','equipo','ud','Artículo utilizado posteriormente'],
    ['E2G2-LIBRE','E2G2','LIBRE','PRUEBA G2','equipo','ud','Control alta libre'],
  ]);
  const loteAlta=await api.confirmarImportacion(sql,alta,[{fila:2,crear:true},{fila:3,crear:true}],f.admin);lotes.push(loteAlta);
  const dependiente=loteAlta.informe.find(r=>r.fila===2)!.articuloId!;
  const libre=loteAlta.informe.find(r=>r.fila===3)!.articuloId!;propias.articulos.push(dependiente,libre);propias.favoritos.push(dependiente);
  await sql`insert into usuarios_articulos_favoritos(usuario_id,articulo_id) values(${f.lectura},${dependiente})`;
  const favoritoAntes=await sql`select to_jsonb(t) as fila from usuarios_articulos_favoritos t where usuario_id=${f.lectura} and articulo_id=${dependiente}`;
  const rAlta=await api.revertirLote(sql,loteAlta.id,f.admin);lotes.push(rAlta);
  assert.equal(rAlta.estado,'reversion_parcial');assert.ok(rAlta.reversion.some(r=>r.filaId===dependiente&&r.estado==='conservado'&&/utiliza/.test(r.motivo)));
  assert.ok(await tablaFila('articulos',dependiente));assert.equal(await tablaFila('articulos',libre),null);
  assert.deepEqual(await sql`select to_jsonb(t) as fila from usuarios_articulos_favoritos t where usuario_id=${f.lectura} and articulo_id=${dependiente}`,favoritoAntes);
  ok('G2: alta utilizada por favorito ajeno conservada con dependencia idéntica; alta libre de control sí eliminada');

  const base=id(1),aba=id(2),material=id(3);
  for(const [identificador,modelo]of[[base,'PRECIO'],[aba,'ABA'],[material,'MATERIAL']]){
    assert.equal(await tablaFila('articulos',identificador),null);propias.articulos.push(identificador);
    await sql`insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,coste,fuente,descripcion)
      values(${identificador},${'E2G2-'+modelo},'equipo','PRUEBA G2','E2G2',${modelo},'ud',100,'app','Inicial G2')`;
  }
  const catalogoABA=entrada('catalogo','g2-aba.csv','referencia;unidad;descripcion',[['E2G2-ABA','ud','A importada']]);
  const pABA=await api.previsualizarImportacion(sql,catalogoABA);
  const lABA=await api.confirmarImportacion(sql,catalogoABA,[{fila:2,articuloId:aba,revisionArticulo:pABA.filas[0].candidatos[0].revision}],f.admin);lotes.push(lABA);
  const filaA=await tablaFila('articulos',aba);
  await sql`update articulos set descripcion='B posterior' where id=${aba}`;
  await sql`update articulos set descripcion='A importada' where id=${aba}`;
  const filaABA=await tablaFila('articulos',aba);assert.equal(Number(filaABA.revision),Number(filaA.revision)+2);
  const rABA=await api.revertirLote(sql,lABA.id,f.admin);lotes.push(rABA);
  assert.equal(rABA.estado,'reversion_parcial');assert.deepEqual(await tablaFila('articulos',aba),filaABA);
  assert.ok(rABA.reversion.every(r=>r.estado==='conservado'&&/modificada/.test(r.motivo)));
  ok('G2: edición A→B→A conserva contenido y nueva revisión; reversión no borra trabajo posterior aunque vuelva al mismo texto');

  const ofertas=entrada('precios','g2-precio.csv','referencia;presupuesto;proveedor;fecha;moneda;unidad;unidad_compra;unidades_por_compra;precio_compra;origen;vinculante;kit',[
    ['E2G2-PRECIO','E2G2-OFERTA','PROVEEDOR SINTÉTICO G2 NUEVO','2026-10-14','EUR','ud','ud','1','10','final','sí','no'],
  ]);
  const pOferta=await api.previsualizarImportacion(sql,ofertas);
  const lOferta=await api.confirmarImportacion(sql,ofertas,[{fila:2,articuloId:base,revisionArticulo:pOferta.filas[0].candidatos[0].revision}],f.admin);lotes.push(lOferta);
  const [oferta]=await sql`select * from precios where lote_id=${lOferta.id}`;propias.proveedores.push(String(oferta.proveedor_id));
  const pedido=id(10),pedidoMaterial=id(11),reserva=id(12);propias.pedidos.push(pedido,pedidoMaterial);propias.reservas.push(reserva);
  await sql`insert into pedidos(id,proveedor_id,sala_id,proyecto_id,referencia) values
    (${pedido},${String(oferta.proveedor_id)},${f.sala},${f.proyecto},'E2G2 PEDIDO AJENO POSTERIOR')`;
  await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,precio_unitario) values(${pedido},${base},1,10)`;
  await sql`update articulos set coste=77,coste_orientativo=false where id=${base}`;
  const costePosterior=await tablaFila('articulos',base);const ofertaAntes=await tablaFila('precios',String(oferta.id));const proveedorAntes=await tablaFila('proveedores',String(oferta.proveedor_id));const pedidoAntes=await tablaFila('pedidos',pedido);
  const lineaAntes=await sql`select to_jsonb(t) as fila from pedido_lineas t where pedido_id=${pedido}`;
  const rOferta=await api.revertirLote(sql,lOferta.id,f.admin);lotes.push(rOferta);
  assert.equal(rOferta.estado,'reversion_parcial');assert.deepEqual(await tablaFila('articulos',base),costePosterior);
  assert.deepEqual(await tablaFila('precios',String(oferta.id)),ofertaAntes);assert.deepEqual(await tablaFila('proveedores',String(oferta.proveedor_id)),proveedorAntes);
  assert.deepEqual(await tablaFila('pedidos',pedido),pedidoAntes);assert.deepEqual(await sql`select to_jsonb(t) as fila from pedido_lineas t where pedido_id=${pedido}`,lineaAntes);
  assert.ok(rOferta.reversion.some(r=>r.tabla==='precios'&&r.estado==='conservado'&&/coste/.test(r.motivo)));
  assert.ok(rOferta.reversion.some(r=>r.tabla==='proveedores'&&r.estado==='conservado'&&/utiliza/.test(r.motivo)));
  ok('G2: coste posterior77 conserva coste+oferta; proveedor nuevo ya usado y pedido/precio congelado posteriores idénticos');

  const bom=entrada('bom','g2-bom-comprometida.csv','referencia;unidad;cantidad',[['E2G2-MATERIAL','ud','2']]);
  const pbom=await api.previsualizarImportacion(sql,bom);
  const lbom=await api.confirmarImportacion(sql,bom,[{fila:2,articuloId:material,revisionArticulo:pbom.filas[0].candidatos[0].revision}],f.admin);lotes.push(lbom);
  const [partida]=await sql`select id from sala_material_bom where lote_id=${lbom.id}`;propias.bom.push(String(partida.id));
  await sql`insert into reservas(id,sala_id,articulo_id,cantidad,estado,quien) values(${reserva},${f.sala},${material},2,'activa','PRUEBA-IMPORT-01 G2 posterior')`;
  await sql`insert into pedidos(id,proveedor_id,sala_id,proyecto_id,referencia) values(${pedidoMaterial},${f.proveedor},${f.sala},${f.proyecto},'E2G2 PEDIDO MATERIAL POSTERIOR')`;
  await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,precio_unitario) values(${pedidoMaterial},${material},2,100)`;
  const bomAntes=await tablaFila('sala_material_bom',String(partida.id)),reservaAntes=await tablaFila('reservas',reserva),pedidoBomAntes=await tablaFila('pedidos',pedidoMaterial);
  const rBom=await api.revertirLote(sql,lbom.id,f.admin);lotes.push(rBom);
  assert.equal(rBom.estado,'reversion_parcial');assert.deepEqual(await tablaFila('sala_material_bom',String(partida.id)),bomAntes);
  assert.deepEqual(await tablaFila('reservas',reserva),reservaAntes);assert.deepEqual(await tablaFila('pedidos',pedidoMaterial),pedidoBomAntes);
  assert.ok(rBom.reversion.some(r=>r.tabla==='sala_material_bom'&&r.estado==='conservado'&&/reservas, pedidos/.test(r.motivo)));
  ok('G2: BOM con reserva y pedido posteriores conservada; dependencias idénticas y motivo verificable');

  // P2: intentar sustituir la imagen buena existente con bytes corruptos.
  const [imagenAntes]=await sql`select to_jsonb(t) as fila from articulos_archivos_tecnicos t where articulo_id=${f.pantalla} and tipo='imagen'`;
  assert.ok(imagenAntes);
  const metadata={marca:'SINTÉTICA',modelo:'QB65R',origen:'PRUEBA-IMPORT-01 intento corrupto rechazado',url:'https://invalid.example/modelos/QB65R',fecha:'2026-10-13'};
  const webp=Buffer.alloc(32);webp.write('RIFF',0);webp.writeUInt32LE(24,4);webp.write('WEBP',8);webp.write('VP8L',12);webp.writeUInt32LE(12,16);webp[20]=0x2f;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
  const fallos=[];
  for(const [bytes,mime,nombre]of[[webp,'image/webp','roto.webp'],[png,'image/png','sinpaleta.png']] as const){
    let mensaje='';
    try{await tecnico.guardarArchivoTecnico(sql,usuario,f.pantalla,metadata,{bytes,mime,nombre,tipo:'imagen',sha256:hash(bytes),tamano_bytes:bytes.length});}
    catch(e){mensaje=e instanceof Error?e.message:String(e);}
    assert.ok(mensaje,`${nombre} no fue rechazado`);fallos.push({nombre,mime,sha256:hash(bytes),error:mensaje});
    assert.deepEqual((await sql`select to_jsonb(t) as fila from articulos_archivos_tecnicos t where articulo_id=${f.pantalla} and tipo='imagen'`)[0],imagenAntes);
  }
  await writeFile(resolve(salida,'p2-sustitucion-rechazada.json'),JSON.stringify({fallos,imagenConservada:{id:imagenAntes.fila.id,sha256:imagenAntes.fila.sha256,tamano_bytes:imagenAntes.fila.tamano_bytes},bytesHashPreservados:true},null,2));
  await writeFile(resolve(salida,'roto.webp'),webp);await writeFile(resolve(salida,'sinpaleta.png'),png);
  ok('P2: WebP sin píxeles y PNG indexado sin paleta rechazados antes de upsert; fila/hash/bytes de imagen válida anterior idénticos');

  await writeFile(resolve(salida,'regresiones-lotes.json'),JSON.stringify(lotes,null,2));
  for(const datos of [alta,catalogoABA,ofertas,bom])await writeFile(resolve(salida,datos.archivo.nombre),datos.archivo.bytes);
  await writeFile(resolve(salida,'g2-dependencias.json'),JSON.stringify({
    favorito:{antes:favoritoAntes,despues:await sql`select to_jsonb(t) as fila from usuarios_articulos_favoritos t where usuario_id=${f.lectura} and articulo_id=${dependiente}`},
    aba:{filaA,edicionABA:filaABA,trasReversion:await tablaFila('articulos',aba)},
    costeOferta:{articuloAntes:costePosterior,articuloDespues:await tablaFila('articulos',base),ofertaAntes,ofertaDespues:await tablaFila('precios',String(oferta.id))},
    proveedor:{antes:proveedorAntes,despues:await tablaFila('proveedores',String(oferta.proveedor_id))},
    pedido:{antes:pedidoAntes,despues:await tablaFila('pedidos',pedido),lineaAntes,lineaDespues:await sql`select to_jsonb(t) as fila from pedido_lineas t where pedido_id=${pedido}`},
    material:{bomAntes,bomDespues:await tablaFila('sala_material_bom',String(partida.id)),reservaAntes,reservaDespues:await tablaFila('reservas',reserva),pedidoAntes:pedidoBomAntes,pedidoDespues:await tablaFila('pedidos',pedidoMaterial)},
  },null,2));
  // Limpieza exclusiva de UUIDs/altas producidas en este proceso de prueba.
  await sql`delete from usuarios_articulos_favoritos where usuario_id=${f.lectura} and articulo_id in ${sql(propias.favoritos)}`;
  await sql`delete from reservas where id in ${sql(propias.reservas)}`;
  await sql`delete from pedidos where id in ${sql(propias.pedidos)}`;
  await sql`delete from sala_material_bom where id in ${sql(propias.bom)}`;
  await sql`delete from precios where articulo_id in ${sql(propias.articulos)}`;
  await sql`delete from articulos where id in ${sql(propias.articulos)}`;
  await sql`delete from proveedores where id in ${sql(propias.proveedores)}`;
  const despues=await fotografiarImportacion(sql);
  for(const tabla of antes.tablas.filter(t=>!['importacion_lotes','importacion_cambios'].includes(t.tabla)))assert.deepEqual(despues.tablas.find(t=>t.tabla===tabla.tabla),tabla);
  await writeFile(resolve(salida,'regresiones-bd-despues.json'),JSON.stringify(despues,null,2));
  await writeFile(resolve(salida,'regresiones-resultados.json'),JSON.stringify({checks,base:antes.base,tablasOriginalesPreservadas:true,propias,lotes:lotes.map(l=>l.id)},null,2));
  ok('44 tablas originales preservadas salvo trazabilidad durable de lotes/reportes; limpieza exclusivamente de objetos sintéticos propios');
}finally{await sql.end();modulo._load=original;}
