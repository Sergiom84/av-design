/** Gates E2 persistentes y sintéticos. Sólo se conecta tras guard E2. */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { comprobarUrlImportacion, conectarImportacion, fotografiarImportacion, FIXTURE_IMPORTACION as f, SALIDA_IMPORTACION as salida } from './importacion-fixture.mjs';
import type { EntradaImportacion, FilaImportacion, SeleccionFila, LoteImportacion } from '../src/lib/importacion/modelo';

const url = process.env.IMPORTACION_DATABASE_URL;
if (!url) throw new Error('Define IMPORTACION_DATABASE_URL explícitamente; no .env.local.');
for (const rechazada of [url.replace('5546','5545'),url.replace('5546','5433'),url.replace('av_design_e2_prueba','av_design'),url.replace('av_design_e2:','postgres:'),url+'?sslmode=require']) {
  assert.throws(() => comprobarUrlImportacion(rechazada),/Destino rechazado/);
}
const sql=await conectarImportacion(url);
process.env.DATABASE_URL=url;
type Modulo = {_load:(request:string,...resto:unknown[])=>unknown};
const modulo=Module as unknown as Modulo; const original=modulo._load;
modulo._load=(request,...resto)=>request==='server-only'?{}:original.call(Module,request,...resto);
await mkdir(salida,{recursive:true});
const checks:string[]=[];
const ok=(mensaje:string)=>{checks.push(mensaje);console.log(`OK   ${mensaje}`);};
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const fuente=async(nombre:string,destino:EntradaImportacion['destino'],salaId?:string):Promise<EntradaImportacion>=>({
  destino,...(salaId?{salaId}:{}),origen:'PRUEBA-IMPORT-01 · fuentes exclusivamente sintéticas',
  archivo:{nombre,bytes:new Uint8Array(await readFile(resolve(salida,'fuentes',nombre)))},
});
const eleccion=(fila:FilaImportacion,articuloId=fila.candidatos[0]?.id):SeleccionFila=>
  articuloId?{fila:fila.fila,articuloId,revisionArticulo:fila.candidatos.find(c=>c.id===articuloId)?.revision}:{fila:fila.fila,crear:true};
const protegidas=['salas','sala_equipos','conexiones','conexion_bocas','plantilla_articulos','plantilla_conexiones','movimientos','reservas','pedidos','pedido_lineas'];
const reportes:LoteImportacion[]=[];

try {
  const api=await import('../src/lib/importacion/index');
  const antes=await fotografiarImportacion(sql);
  await writeFile(resolve(salida,'bd-gate-antes.json'),JSON.stringify(antes,null,2));
  const entradaBom=await fuente('bom-revision.csv','bom',f.sala);
  const bom=await api.previsualizarImportacion(sql,entradaBom);
  const bomXlsx=await api.previsualizarImportacion(sql,await fuente('bom-revision.xlsx','bom',f.sala));
  assert.equal(bom.filas.length,10); assert.equal(bomXlsx.filas.length,10);
  assert.deepEqual(bomXlsx.filas.map(r=>r.datos),bom.filas.map(r=>r.datos));
  assert.equal(bom.filas[1].estado,'ambigua'); assert.equal(bom.filas[1].candidatos.length,2);
  assert.equal(bom.filas[2].candidatos[0].id,f.variante);
  assert.equal(bom.filas[3].estado,'no_encontrada');
  assert.equal(bom.filas[4].estado,'coincidencia');assert.match(bom.filas[4].avisos.join(' '),/duplicad/i);
  for(const idx of [5,7,8,9])assert.equal(bom.filas[idx].estado,'rechazada');
  const xml = strFromU8(unzipSync((await fuente('bom-revision.xlsx','bom',f.sala)).archivo.bytes)['xl/worksheets/sheet1.xml']);
  assert.match(xml, /<(?:(?:\w+):)?c\b[^>]*\br="F2"[^>]*>\s*<(?:(?:\w+):)?v>2<\//);
  assert.doesNotMatch(xml, /<(?:(?:\w+):)?c\b[^>]*\br="F2"[^>]*\bt="(?:s|inlineStr)"/);
  assert.doesNotMatch(xml, /<(?:(?:\w+):)?c\b[^>]*\br="F11"[^>]*>[\s\S]*?<(?:(?:\w+):)?v>0<\//);
  const peligrosa=await api.previsualizarImportacion(sql,await fuente('bom-formula.xlsx','bom',f.sala));
  assert.equal(peligrosa.filas[0].estado,'rechazada');
  const peligrosaCsv=await api.previsualizarImportacion(sql,await fuente('bom-peligrosa.csv','bom',f.sala));
  assert.equal(peligrosaCsv.filas[0].estado,'rechazada');
  const precios=await api.previsualizarImportacion(sql,await fuente('precios.csv','precios'));
  const preciosXlsx=await api.previsualizarImportacion(sql,await fuente('precios-tipados.xlsx','precios'));
  assert.equal(preciosXlsx.filas[0].datos.fecha,'2026-10-13');
  for(const idx of [2,3,4,6,7,8])assert.equal(precios.filas[idx].estado,'rechazada');
  assert.equal(precios.filas[5].estado,'no_encontrada');
  assert.match(precios.filas[2].errores.join(' '),/ausente/i);
  assert.match(precios.filas[4].errores.join(' '),/kit/i);
  assert.deepEqual(await fotografiarImportacion(sql),antes);
  await assert.rejects(api.previsualizarImportacion(sql,{...entradaBom,archivo:{nombre:'exceso.csv',bytes:new Uint8Array(5*1024*1024+1)}}),/5 MiB|tama[nñ]o|grande/i);
  const muchas=['referencia;unidad;cantidad',...Array.from({length:501},()=> 'E2-QB65R;ud;1')].join('\n');
  await assert.rejects(api.previsualizarImportacion(sql,{...entradaBom,archivo:{nombre:'muchas.csv',bytes:new TextEncoder().encode(muchas)}}),/500/);
  await writeFile(resolve(salida,'previews.json'),JSON.stringify({bom,bomXlsx,peligrosa,peligrosaCsv,precios,preciosXlsx},null,2));
  ok('CSV/XLSX deterministas, acentos, variantes/ambiguas, duplicados, unidades/cantidades, fórmulas, nulos/cero/kit, monedas/fechas; preview no escribe ninguna tabla');

  const antesError=await fotografiarImportacion(sql);
  await assert.rejects(api.confirmarImportacion(sql,entradaBom,[{fila:3}],f.admin),/ambigua|elige|selecci[oó]n/i);
  const catalogo=await fuente('catalogo.csv','catalogo');
  const previewCatalogo=await api.previsualizarImportacion(sql,catalogo);
  await assert.rejects(api.confirmarImportacion(sql,catalogo,[eleccion(previewCatalogo.filas[0]),eleccion(previewCatalogo.filas[1])],f.admin,{fallarDespuesDeFila:1}),/prueba|inyectado|fallo/i);
  assert.deepEqual(await fotografiarImportacion(sql),antesError);
  ok('ambigüedad exige ID; fallo después de primera escritura revierte lote, informe, archivo y todos los cambios');

  const loteBom=await api.confirmarImportacion(sql,entradaBom,[eleccion(bom.filas[0]),eleccion(bom.filas[1],f.ambiguoUno)],f.admin);
  reportes.push(loteBom);
  const lineas=await sql`select articulo_id,cantidad::float as cantidad from sala_material_bom where lote_id=${loteBom.id} order by articulo_id`;
  assert.equal(lineas.length,2);
  assert.deepEqual(lineas.map(r=>[r.articulo_id,r.cantidad]),[[f.pantalla,2],[f.ambiguoUno,1]].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const conBom=await fotografiarImportacion(sql);
  for(const tabla of protegidas)assert.deepEqual(conBom.tablas.find(t=>t.tabla===tabla),antes.tablas.find(t=>t.tabla===tabla));
  const archivo=await api.obtenerArchivoLote(sql,loteBom.id,f.admin);
  const {cargarSnapshot}=await import('../src/lib/documentos/datos');
  const {construirBom,generarXlsx}=await import('../src/lib/documentos/tablas');
  const snapshot=await cargarSnapshot([f.sala]);
  const materialExportado=construirBom(snapshot,snapshot.salas);
  const pantallaExportada=materialExportado.find(a=>a.articulo_id===f.pantalla)!;
  assert.equal(pantallaExportada.cantidad,3);assert.equal(pantallaExportada.a_comprar,0);
  assert.equal(materialExportado.find(a=>a.articulo_id===f.ambiguoUno)!.cantidad,1);
  await writeFile(resolve(salida,'bom-importada-exportada.xlsx'),await generarXlsx(snapshot,snapshot.salas,'bom'));
  await writeFile(resolve(salida,'bom-importada.json'),JSON.stringify(materialExportado,null,2));
  assert.ok(archivo); assert.equal(hash(archivo.bytes),hash(entradaBom.archivo.bytes));
  assert.equal(await api.obtenerLote(sql,loteBom.id,f.lectura),null);
  const revertidaBom=await api.revertirLote(sql,loteBom.id,f.admin);reportes.push(revertidaBom);
  assert.equal(revertidaBom.estado,'revertido');
  assert.equal((await sql`select id from sala_material_bom where lote_id=${loteBom.id}`).length,0);
  ok('confirmación afecta sólo filas elegidas, BOM no coloca ni conecta, archivo/hash/procedencia duraderos y propietario; reversión restaura necesidad');

  const loteCatalogo=await api.confirmarImportacion(sql,catalogo,[eleccion(previewCatalogo.filas[0]),eleccion(previewCatalogo.filas[1])],f.admin);reportes.push(loteCatalogo);
  const [pantalla]=await sql`select descripcion,fuente from articulos where id=${f.pantalla}`;
  assert.equal(pantalla.descripcion,'Descripción áéíóú revisada');assert.equal(pantalla.fuente,'app');
  assert.equal((await sql`select id from articulos where referencia='E2-NUEVA'`).length,1);
  assert.equal((await sql`select id from articulos where referencia='E2-OTRA-NUEVA'`).length,0);
  const cambioPosterior='Modificación posterior sintética que la reversión conserva';
  await sql`update articulos set descripcion=${cambioPosterior} where id=${f.pantalla}`;
  const reversaCatalogo=await api.revertirLote(sql,loteCatalogo.id,f.admin);reportes.push(reversaCatalogo);
  assert.equal(reversaCatalogo.estado,'reversion_parcial');
  assert.ok(reversaCatalogo.reversion.some(r=>r.estado==='conservado'));
  assert.equal((await sql`select descripcion from articulos where id=${f.pantalla}`)[0].descripcion,cambioPosterior);
  assert.equal((await sql`select id from articulos where referencia='E2-NUEVA'`).length,0);
  ok('catálogo exacto crea sólo lo seleccionado y fuente app; reversión conserva edición posterior y revierte alta atribuible');

  const [precioAppAntes]=await sql`select to_jsonb(p) as fila from precios p where id=${f.precioApp}`;
  const preciosActuales=await api.previsualizarImportacion(sql,await fuente('precios.csv','precios'));
  const lotePrecios=await api.confirmarImportacion(sql,await fuente('precios.csv','precios'),[0,1,9,10].map(i=>eleccion(preciosActuales.filas[i])),f.admin);reportes.push(lotePrecios);
  const actuales=await sql`select id,coste::float as coste,coste_orientativo from articulos where id in ${sql([f.pantalla,f.variante,f.sinPrecio,f.cero,f.cable])}`;
  assert.equal(actuales.find(a=>a.id===f.pantalla)!.coste,700);
  assert.ok(Math.abs(actuales.find(a=>a.id===f.variante)!.coste-86.7)<0.00001);
  assert.equal(actuales.find(a=>a.id===f.variante)!.coste_orientativo,true);
  assert.equal(actuales.find(a=>a.id===f.sinPrecio)!.coste,null);
  assert.equal(actuales.find(a=>a.id===f.cero)!.coste,0);
  assert.deepEqual((await sql`select to_jsonb(p) as fila from precios p where id=${f.precioApp}`)[0],precioAppAntes);
  assert.equal(Number((await sql`select precio_unitario from pedido_lineas where id=${f.pedidoLinea}`)[0].precio_unitario),800);
  reportes.push(await api.revertirLote(sql,lotePrecios.id,f.admin));
  assert.equal(Number((await sql`select coste from articulos where id=${f.pantalla}`)[0].coste),800);
  ok('ofertas anteriores app intactas, final vigente vence vieja expirada, USD orientativo parametrizado, null/cero conservados, bobina explícita; pedidos congelados sin cambio');

  const tecnico=await import('../src/lib/catalogo-tecnico-repositorio');
  const tecnicoPuro=await import('../src/lib/catalogo-tecnico');
  const {PERMISOS_POR_ROL}=await import('../src/lib/usuarios');
  const usuario={id:f.admin,permisos:PERMISOS_POR_ROL.admin,debeCambiarClave:false,ficticio:false};
  const lector={id:f.lectura,permisos:PERMISOS_POR_ROL.lectura,debeCambiarClave:false,ficticio:false};
  const metadata={marca:'SINTÉTICA',modelo:'QB65R',origen:'Ficha sintética verificada PRUEBA-IMPORT-01',url:'https://invalid.example/modelos/QB65R',fecha:'2026-10-13'};
  const dimensiones={...metadata,ancho:1400,alto:800,fondo:null,unidad:'mm',ru:null};
  const [legado]=await sql`select dimensiones_tecnicas from sala_equipos where id=${f.equipo}`;
  await tecnico.guardarDatosTecnicos(sql,usuario,f.pantalla,dimensiones);
  await assert.rejects(tecnico.guardarDatosTecnicos(sql,lector,f.pantalla,dimensiones),/permiso/);
  await assert.rejects(tecnico.guardarDatosTecnicos(sql,usuario,f.pantalla,{...dimensiones,modelo:'QB65R-B'}),/modelo/);
  const equipoNuevo='e2000000-0000-4000-8000-000000001000';
  const equipoCopiado='e2000000-0000-4000-8000-000000001001';
  const equipoLegacy='e2000000-0000-4000-8000-000000001002';
  const equipoAusente='e2000000-0000-4000-8000-000000001003';
  const plantillaPrueba='e2000000-0000-4000-8000-000000001004';
  const lineaPlantilla='e2000000-0000-4000-8000-000000001005';
  const lineaAusente='e2000000-0000-4000-8000-000000001006';
  await sql`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada)
    values(${equipoNuevo},${f.sala},${f.pantalla},'Gate snapshot sintético',1,'pantalla',4,0.1,1.45,true)`;
  try {
    const [congelado]=await sql`select dimensiones_tecnicas from sala_equipos where id=${equipoNuevo}`;
    assert.equal(congelado.dimensiones_tecnicas.ancho,1400);assert.equal(congelado.dimensiones_tecnicas.fondo,null);
    await tecnico.guardarDatosTecnicos(sql,usuario,f.pantalla,{...dimensiones,ancho:1550});
    assert.deepEqual((await sql`select dimensiones_tecnicas from sala_equipos where id=${equipoNuevo}`)[0],congelado);
    assert.deepEqual((await sql`select dimensiones_tecnicas from sala_equipos where id=${f.equipo}`)[0],legado);
    await sql`insert into plantillas_sala(id,nombre,tipologia) values(${plantillaPrueba},'GATE E2 SNAPSHOT TEMPORAL','Prueba sintética')`;
    await sql`insert into plantilla_articulos(id,plantilla_id,articulo_id,categoria,cantidad,dimensiones_tecnicas) values
      (${lineaPlantilla},${plantillaPrueba},${f.pantalla},'PANTALLA CONGELADA',1,${sql.json(congelado.dimensiones_tecnicas)}),
      (${lineaAusente},${plantillaPrueba},${f.pantalla},'PANTALLA LEGADO',1,${legado.dimensiones_tecnicas==null?sql`'null'::jsonb`:sql.json(legado.dimensiones_tecnicas)})`;
    await sql`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,origen_plantilla_linea_id) values
      (${equipoCopiado},${f.sala},${f.pantalla},'Gate copiado con snapshot',1,${lineaPlantilla}),
      (${equipoLegacy},${f.sala},${f.pantalla},'Gate copiado legacy null',1,${f.plantillaArticulo}),
      (${equipoAusente},${f.sala},${f.pantalla},'Gate copia ausencia explícita',1,${lineaAusente})`;
    assert.deepEqual((await sql`select dimensiones_tecnicas from sala_equipos where id=${equipoCopiado}`)[0],congelado);
    assert.equal((await sql`select dimensiones_tecnicas from sala_equipos where id=${equipoLegacy}`)[0].dimensiones_tecnicas,null);
    assert.equal((await sql`select dimensiones_tecnicas from sala_equipos where id=${equipoAusente}`)[0].dimensiones_tecnicas,null);
    const atributos=await tecnico.buscarPorAtributosTecnicos(sql,usuario,{q:'QB65R',ancho_max_mm:1600});
    assert.ok(atributos.some(a=>a.articulo_id===f.pantalla&&a.modelo==='QB65R'&&a.origen===metadata.origen));
    assert.equal((await tecnico.buscarPorAtributosTecnicos(sql,usuario,{q:'QB65R',fondo_max_mm:100})).length,0);
    await writeFile(resolve(salida,'dimensiones-snapshot.json'),JSON.stringify({legado,congelado,catalogo:(await tecnico.obtenerDatosTecnicos(sql,usuario,f.pantalla)).datos,atributos},null,2));
  } finally {
    await sql`delete from sala_equipos where id in ${sql([equipoNuevo,equipoCopiado,equipoLegacy,equipoAusente])}`;
    await sql`delete from plantilla_articulos where id in ${sql([lineaPlantilla,lineaAusente])}`;
    await sql`delete from plantillas_sala where id=${plantillaPrueba}`;
  }
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  const imagen=tecnicoPuro.validarArchivoTecnico(png,'image/png','QB65R.png','imagen');
  assert.throws(()=>tecnicoPuro.validarArchivoTecnico(png,'image/jpeg','QB65R.jpg','imagen'));
  assert.throws(()=>tecnicoPuro.validarArchivoTecnico(new Uint8Array(5*1024*1024+1),'image/png','grande.png','imagen'),/5 MiB/);
  assert.throws(()=>tecnicoPuro.validarArchivoTecnico(new TextEncoder().encode('<svg/>'),'image/svg+xml','activo.svg','imagen'));
  const archivoId=await tecnico.guardarArchivoTecnico(sql,usuario,f.pantalla,metadata,imagen);
  const almacenado=await tecnico.obtenerArchivoTecnico(sql,lector,f.pantalla,archivoId);
  assert.ok(almacenado);assert.equal(hash(almacenado.bytes),hash(png));assert.equal(almacenado.modelo,'QB65R');
  assert.equal(await tecnico.obtenerArchivoTecnico(sql,lector,f.variante,archivoId),null);
  await writeFile(resolve(salida,'archivo-tecnico.png'),png);
  ok('datos técnicos exactos/parciales y procedencia; dimensiones catálogo no cambian legado ni snapshot/ida-vuelta; filtros sólo verificadas, permisos, formato/tamaño/archivo durable');

  const favoritos=await import('../src/lib/catalogo-favoritos-repositorio');
  await favoritos.guardarFavorito(sql,usuario,f.pantalla,{favorito:true});
  await favoritos.guardarFavorito(sql,usuario,f.pantalla,{favorito:true});
  assert.equal(await favoritos.esArticuloFavorito(sql,usuario,f.pantalla),true);
  assert.equal(await favoritos.esArticuloFavorito(sql,lector,f.pantalla),false);
  const misFavoritos=await favoritos.listarFavoritos(sql,usuario,{});
  assert.ok(misFavoritos.some(a=>a.id===f.pantalla&&a.motivos.length>0));
  await favoritos.guardarFavorito(sql,usuario,f.pantalla,{favorito:false});
  assert.equal(await favoritos.esArticuloFavorito(sql,usuario,f.pantalla),false);
  await assert.rejects(favoritos.listarFavoritos(sql,{...usuario,debeCambiarClave:true},{}),/contrase[nñ]a/);
  ok('favoritos personales, explicados, idempotentes, reversibles y sin compartir preferencia ni modificar obra');

  const antesConcurrencia=await fotografiarImportacion(sql);
  // tsx procesa las dependencias de datos.ts como CommonJS: cargar la misma
  // instancia evita crear otro AsyncLocalStorage por mezclar ESM y CJS.
  const {conLecturaConsistente,sql:lectura}=createRequire(import.meta.url)('../src/lib/db.ts') as typeof import('../src/lib/db');
  const {materialBomDeSala}=createRequire(import.meta.url)('../src/lib/datos-material-bom.ts') as typeof import('../src/lib/datos-material-bom');
  const temporal='e2000000-0000-4000-8000-000000009999';
  assert.equal((await sql`select id from sala_material_bom where id=${temporal}`).length,0);
  let primera=0;let segunda=0;let exterior=0;
  try {
    await conLecturaConsistente(async()=>{
      primera=(await materialBomDeSala(f.sala)).length;
      await sql`insert into sala_material_bom(id,sala_id,articulo_id,cantidad,unidad,nota) values
        (${temporal},${f.sala},${f.sinPrecio},1,'ud','PRUEBA-IMPORT-01 CONCURRENCIA TEMPORAL')`;
      segunda=(await materialBomDeSala(f.sala)).length;
      assert.equal(segunda,primera);
    });
    exterior=(await cargarSnapshot([f.sala])).salas[0].materialBom?.length??0;
    assert.equal(exterior,primera+1);
    await assert.rejects(conLecturaConsistente(async()=>{
      await lectura`insert into sala_material_bom(sala_id,articulo_id,cantidad,unidad) values(${f.sala},${f.sinPrecio},1,'ud')`;
    }),/read.only/);
  } finally {await sql`delete from sala_material_bom where id=${temporal}`;}
  assert.deepEqual(await fotografiarImportacion(sql),antesConcurrencia);
  await writeFile(resolve(salida,'snapshot-bom-concurrencia.json'),JSON.stringify({primera,segunda,exterior,shaAntes:antesConcurrencia.sha256,shaDespues:(await fotografiarImportacion(sql)).sha256,soloLectura:true},null,2));
  ok('snapshot E1 incluye BOM en la misma lectura consistente frente a commit concurrente; escritura en snapshot rechazada y 44 tablas restauradas exactamente');

  const antesRollback=await fotografiarImportacion(sql);
  const reservada=await sql.reserve();
  try { await assert.rejects(reservada.unsafe(await readFile(resolve('db/migraciones/rollback/2026-10-e2.sql'),'utf8')),/datos E2/i); }
  finally { await reservada.unsafe('rollback');reservada.release(); }
  assert.deepEqual(await fotografiarImportacion(sql),antesRollback);
  ok('rollback de estructura rechaza datos E2 existentes y conserva toda la base byte a byte');

  const despues=await fotografiarImportacion(sql);
  for(const tabla of protegidas)assert.deepEqual(despues.tablas.find(t=>t.tabla===tabla),antes.tablas.find(t=>t.tabla===tabla));
  await writeFile(resolve(salida,'bd-gate-despues.json'),JSON.stringify(despues,null,2));
  await writeFile(resolve(salida,'lotes.json'),JSON.stringify(reportes,null,2));
  await writeFile(resolve(salida,'gate-resultados.json'),JSON.stringify({base:antes.base,checks,tablasProtegidas:protegidas,sha256Antes:antes.sha256,sha256Despues:despues.sha256,lotes:reportes.map(r=>r.id)},null,2));
  ok('stock/reservas/diseño/plano/conexiones/plantillas y pedidos preservados; toda evidencia antes/después guardada');
} finally {
  await global.__sql?.end();await sql.end();modulo._load=original;
}
