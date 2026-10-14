import { test, expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarImportacion, fotografiarImportacion, FIXTURE_IMPORTACION as f, SALIDA_IMPORTACION as salida, type SqlImportacionPrueba, type FotoImportacion } from '../scripts/importacion-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
import type { LoteImportacion, PreviewImportacion } from '../src/lib/importacion/modelo';

const secreto='e2-local-prueba-importacion-secreto-2026';
const origen='http://localhost:3103';
const protegidas=['salas','sala_equipos','conexiones','conexion_bocas','plantilla_articulos','plantilla_conexiones','movimientos','reservas','pedidos','pedido_lineas'];
let sql:SqlImportacionPrueba; let antes:FotoImportacion;
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
async function entrar(context:BrowserContext,id:string=f.admin){
  await context.clearCookies(); await context.addCookies([{name:COOKIE_SESION,value:await firmarSesion(secreto,Date.now()+3600_000,id),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
}
async function multipart(nombre:string,destino='bom',salaId:string|undefined=f.sala){
  return {archivo:{name:nombre,mimeType:nombre.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',buffer:await readFile(resolve(salida,'fuentes',nombre))},destino,origen:'PRUEBA-IMPORT-01 E2E sintética',...(salaId?{salaId}:{})};
}
async function previewApi(request:APIRequestContext,nombre='bom-valida.csv',destino='bom',salaId:string|undefined=f.sala){
  const body=await multipart(nombre,destino,salaId);
  const res=await request.post('/api/importacion',{multipart:body,headers:{origin:origen}});
  expect(res.status()).toBe(200);return {body,preview:await res.json() as PreviewImportacion};
}

test.describe.serial('E2 escritorio completo antes de móvil',()=>{
  test.beforeAll(async()=>{
    const url=process.env.IMPORTACION_DATABASE_URL;if(!url)throw new Error('IMPORTACION_DATABASE_URL obligatoria para guard de fixture.');
    sql=await conectarImportacion(url);await mkdir(salida,{recursive:true});antes=await fotografiarImportacion(sql);
    await writeFile(resolve(salida,'bd-e2e-antes.json'),JSON.stringify(antes,null,2));
  });
  test.afterAll(async()=>{
    if(!sql)return;try{const despues=await fotografiarImportacion(sql);
      await writeFile(resolve(salida,'bd-e2e-despues.json'),JSON.stringify(despues,null,2));
      for(const tabla of protegidas)expect(despues.tablas.find(t=>t.tabla===tabla)).toEqual(antes.tablas.find(t=>t.tabla===tabla));
    }finally{await sql.end();}
  });

  test('escritorio: CSV/XLSX subir, revisar, elegir, confirmar, informe, fuente, fallo y revertir',async({page,context})=>{
    await entrar(context);const errores:string[]=[];page.on('pageerror',e=>errores.push(e.message));
    await page.goto(`/catalogo/importar?sala=${f.sala}`);
    await expect(page.getByRole('heading',{name:'Importar catálogo y material',exact:true})).toBeVisible();
    await page.getByLabel(/^Procedencia/).fill('PRUEBA-IMPORT-01 E2E sintética');
    await page.getByLabel('Archivo CSV o XLSX',{exact:true}).setInputFiles(resolve(salida,'fuentes','bom-revision.xlsx'));
    const foto=await fotografiarImportacion(sql);
    await page.getByRole('button',{name:'Revisar archivo',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Revisión antes de guardar',exact:true})).toBeVisible();
    expect(await fotografiarImportacion(sql)).toEqual(foto);
    await expect(page.getByRole('combobox',{name:'Acción fila 3',exact:true})).toHaveValue('');
    await expect(page.getByRole('combobox',{name:'Acción fila 7',exact:true})).toBeDisabled();
    await page.getByRole('combobox',{name:'Acción fila 2',exact:true}).selectOption(f.pantalla);
    await page.getByRole('combobox',{name:'Acción fila 3',exact:true}).selectOption(f.ambiguoUno);
    await page.screenshot({path:resolve(salida,'e2e-escritorio-revision.png'),fullPage:true});
    const confirming=page.waitForResponse(r=>r.url().endsWith('/api/importacion/confirmar')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Confirmar 2 filas elegidas',exact:true}).click();
    const response=await confirming;expect(response.status()).toBe(200);const lote=await response.json() as LoteImportacion;
    await writeFile(resolve(salida,'e2e-lote.json'),JSON.stringify(lote,null,2));
    await expect(page.getByRole('heading',{name:'Resultado del lote',exact:true})).toBeVisible();
    expect(lote.informe.filter(r=>r.estado==='alta')).toHaveLength(2);
    expect((await sql`select id from sala_material_bom where lote_id=${lote.id}`).length).toBe(2);
    await page.screenshot({path:resolve(salida,'e2e-escritorio-resultado.png'),fullPage:true});
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Descargar fuente original',exact:true}).click();
    const archivo=await download;expect(await archivo.failure()).toBeNull();await archivo.saveAs(resolve(salida,'e2e-fuente-original.xlsx'));
    expect(digest(await readFile(resolve(salida,'e2e-fuente-original.xlsx')))).toBe(lote.archivoSha256);
    await page.reload();await page.getByRole('button',{name:'Consultar lote',exact:true}).first().click();
    await expect(page.getByRole('heading',{name:'Resultado del lote',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Revertir lote',exact:true}).click();
    await expect(page.getByText('Alta retirada sin dependencias ni ediciones posteriores.',{exact:false}).first()).toBeVisible();
    expect((await sql`select id from sala_material_bom where lote_id=${lote.id}`).length).toBe(0);
    await page.screenshot({path:resolve(salida,'e2e-escritorio-reversion.png'),fullPage:true});

    await page.getByLabel(/^Procedencia/).fill('PRUEBA-IMPORT-01 E2E fallo sintético');
    await page.getByLabel('Archivo CSV o XLSX',{exact:true}).setInputFiles(resolve(salida,'fuentes','bom-valida.csv'));
    await page.getByRole('button',{name:'Revisar archivo',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Revisión antes de guardar',exact:true})).toBeVisible();
    await page.getByRole('combobox',{name:'Acción fila 2',exact:true}).selectOption(f.pantalla);
    await page.getByRole('combobox',{name:'Acción fila 3',exact:true}).selectOption(f.ambiguoUno);
    const antesFallo=await fotografiarImportacion(sql);
    await page.route('**/api/importacion/confirmar',route=>route.continue({headers:{...route.request().headers(),'x-av-prueba-fallo-importacion':'1'}}));
    await page.getByRole('button',{name:'Confirmar 2 filas elegidas',exact:true}).click();
    await expect(page.getByRole('alert').filter({hasText:'Fallo sintético'})).toBeVisible();
    expect(await fotografiarImportacion(sql)).toEqual(antesFallo);
    await page.screenshot({path:resolve(salida,'e2e-escritorio-fallo.png'),fullPage:true});
    await page.unroute('**/api/importacion/confirmar');
    expect(errores).toEqual([]);await writeFile(resolve(salida,'e2e-consola.json'),JSON.stringify({erroresPagina:errores},null,2));
  });

  test('APIs: permisos vigentes, propiedad, clave provisional, origen, closedBOM y límites',async({context,request})=>{
    await entrar(context);const {body,preview}=await previewApi(context.request);
    const fila=preview.filas[0];
    const confirma={...body,previewHash:preview.previewHash,seleccion:JSON.stringify([{fila:2,articuloId:f.pantalla,revisionArticulo:fila.candidatos[0].revision}])};
    const auth=await context.request.post('/api/importacion/confirmar',{multipart:confirma,headers:{origin:origen}});expect(auth.status()).toBe(200);
    const lote=await auth.json() as LoteImportacion;const estados:Record<string,number>={};
    const sinSesion=await request.post('/api/importacion',{multipart:body,headers:{origin:origen},maxRedirects:0});expect([307,401]).toContain(sinSesion.status());estados.sinSesion=sinSesion.status();
    estados.origenAjeno=(await context.request.post('/api/importacion',{multipart:body,headers:{origin:'https://invalid.example'}})).status();expect(estados.origenAjeno).toBe(403);
    await entrar(context,f.lectura);
    estados.lecturaPreview=(await context.request.post('/api/importacion',{multipart:body,headers:{origin:origen}})).status();expect(estados.lecturaPreview).toBe(403);
    estados.lecturaConfirma=(await context.request.post('/api/importacion/confirmar',{multipart:confirma,headers:{origin:origen}})).status();expect(estados.lecturaConfirma).toBe(403);
    await entrar(context,f.oculto);
    estados.catalogoOculto=(await context.request.post('/api/importacion',{multipart:body,headers:{origin:origen}})).status();expect(estados.catalogoOculto).toBe(403);
    await entrar(context,f.bom);await previewApi(context.request);
    estados.bomNoCatalogo=(await context.request.post('/api/importacion',{multipart:await multipart('catalogo.csv','catalogo',undefined),headers:{origin:origen}})).status();expect(estados.bomNoCatalogo).toBe(403);
    estados.otroPropietario=(await context.request.get(`/api/importacion/lotes/${lote.id}`)).status();expect(estados.otroPropietario).toBe(404);
    estados.archivoOtro=(await context.request.get(`/api/importacion/lotes/${lote.id}/archivo`)).status();expect(estados.archivoOtro).toBe(404);
    estados.revertirOtro=(await context.request.post(`/api/importacion/lotes/${lote.id}/revertir`,{headers:{origin:origen}})).status();expect(estados.revertirOtro).toBe(404);
    const propio=await previewApi(context.request);
    const miLoteResponse=await context.request.post('/api/importacion/confirmar',{multipart:{...propio.body,previewHash:propio.preview.previewHash,
      seleccion:JSON.stringify([{fila:2,articuloId:f.pantalla,revisionArticulo:propio.preview.filas[0].candidatos[0].revision}])},headers:{origin:origen}});
    expect(miLoteResponse.status()).toBe(200);const miLote=await miLoteResponse.json() as LoteImportacion;
    await entrar(context,f.provisional);
    estados.claveProvisional=(await context.request.post('/api/importacion',{multipart:body,headers:{origin:origen},maxRedirects:0})).status();expect([403,307]).toContain(estados.claveProvisional);
    await entrar(context,f.admin);
    estados.obraCerrada=(await context.request.post('/api/importacion',{multipart:await multipart('bom-valida.csv','bom',f.salaCerrada),headers:{origin:origen}})).status();expect(estados.obraCerrada).toBe(409);
    estados.excesoTamano=(await context.request.post('/api/importacion',{multipart:{...body,archivo:{name:'enorme.csv',mimeType:'text/csv',buffer:Buffer.alloc(5*1024*1024+1,65)}},headers:{origin:origen}})).status();expect(estados.excesoTamano).toBe(413);
    // La cookie sigue igual: cada request siguiente consulta el permiso actual.
    await entrar(context,f.bom);
    await sql`insert into usuario_permisos(usuario_id,seccion,acceso) values(${f.bom},'salas','oculto') on conflict(usuario_id,seccion) do update set acceso='oculto'`;
    try{estados.revocado=(await context.request.post('/api/importacion',{multipart:body,headers:{origin:origen}})).status();expect(estados.revocado).toBe(403);
      estados.metadataRevocada=(await context.request.get(`/api/importacion/lotes/${miLote.id}`)).status();expect(estados.metadataRevocada).toBe(403);
      estados.archivoRevocado=(await context.request.get(`/api/importacion/lotes/${miLote.id}/archivo`)).status();expect(estados.archivoRevocado).toBe(403);
      estados.reversionRevocada=(await context.request.post(`/api/importacion/lotes/${miLote.id}/revertir`,{headers:{origin:origen}})).status();expect(estados.reversionRevocada).toBe(403);
    }
    finally{await sql`update usuario_permisos set acceso='editar' where usuario_id=${f.bom} and seccion='salas'`;}
    expect((await context.request.post(`/api/importacion/lotes/${miLote.id}/revertir`,{headers:{origin:origen}})).status()).toBe(200);
    await entrar(context,f.admin);expect((await context.request.post(`/api/importacion/lotes/${lote.id}/revertir`,{headers:{origin:origen}})).status()).toBe(200);
    await writeFile(resolve(salida,'e2e-permisos.json'),JSON.stringify(estados,null,2));
  });

  test('escritorio: datos técnicos exactos, archivo protegido, favoritos y copia real sala→plantilla',async({page,context})=>{
    await entrar(context);await page.goto(`/articulo/${f.pantalla}`);
    await expect(page.getByRole('heading',{name:'Datos técnicos por modelo',exact:true})).toBeVisible();
    const formulario=page.locator('form').filter({has:page.getByRole('button',{name:'Guardar verificación técnica',exact:true})});
    await formulario.getByLabel('Ancho',{exact:true}).fill('1550');
    await formulario.getByLabel('Alto',{exact:true}).fill('800');
    await formulario.getByLabel('Fondo',{exact:true}).fill('');
    await formulario.getByLabel(/^Unidad de dimensión/).selectOption('mm');
    await formulario.getByLabel('Origen',{exact:true}).fill('Ficha sintética verificada PRUEBA-IMPORT-01');
    await formulario.getByLabel('URL HTTPS',{exact:true}).fill('https://invalid.example/modelos/QB65R');
    await formulario.getByLabel('Fecha de verificación',{exact:true}).fill('2026-10-13');
    await formulario.getByRole('button',{name:'Guardar verificación técnica',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Datos técnicos verificados y guardados.'})).toBeVisible();
    await page.getByRole('button',{name:'Guardar en mis favoritos',exact:true}).click();
    await expect(page.getByRole('button',{name:'Quitar de mis favoritos',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:resolve(salida,'e2e-escritorio-tecnico-favorito.png'),fullPage:true});
    const datos=await (await context.request.get(`/api/catalogo-tecnico/${f.pantalla}`)).json();
    const archivoId=datos.archivos[0].id;expect(datos.datos.fondo).toBeNull();
    const [imagenBuena]=await sql`select to_jsonb(t) as fila from articulos_archivos_tecnicos t where id=${archivoId}`;
    const procedencia={marca:datos.datos.marca,modelo:datos.datos.modelo,origen:datos.datos.origen,url:datos.datos.url,fecha:datos.datos.fecha};
    const webp=Buffer.alloc(32);webp.write('RIFF',0);webp.writeUInt32LE(24,4);webp.write('WEBP',8);webp.write('VP8L',12);webp.writeUInt32LE(12,16);webp[20]=0x2f;
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
    const rechazos=[];
    for(const [buffer,mimeType,name]of[[webp,'image/webp','roto.webp'],[png,'image/png','sinpaleta.png']] as const){
      const rechazo=await context.request.post(`/api/catalogo-tecnico/${f.pantalla}`,{multipart:{tipo:'imagen',procedencia:JSON.stringify(procedencia),archivo:{name,mimeType,buffer}},headers:{origin:origen}});
      expect(rechazo.status()).toBe(400);rechazos.push({name,status:rechazo.status(),respuesta:await rechazo.json()});
      expect((await sql`select to_jsonb(t) as fila from articulos_archivos_tecnicos t where id=${archivoId}`)[0]).toEqual(imagenBuena);
    }
    await writeFile(resolve(salida,'e2e-imagenes-rechazadas.json'),JSON.stringify({rechazos,imagenConservada:imagenBuena.fila.sha256},null,2));
    const bytes=await context.request.get(`/api/catalogo-tecnico/${f.pantalla}/archivos/${archivoId}`);expect(bytes.status()).toBe(200);
    await entrar(context,f.lectura);
    expect((await (await context.request.get(`/api/catalogo-favoritos/${f.pantalla}`)).json()).favorito).toBe(false);
    expect((await context.request.get(`/api/catalogo-tecnico/${f.pantalla}/archivos/${archivoId}`)).status()).toBe(200);
    expect((await context.request.put(`/api/catalogo-tecnico/${f.pantalla}`,{data:datos.datos,headers:{origin:origen}})).status()).toBe(403);
    await entrar(context,f.oculto);expect((await context.request.get(`/api/catalogo-tecnico/${f.pantalla}/archivos/${archivoId}`)).status()).toBe(403);
    expect((await context.request.get(`/api/catalogo-favoritos/${f.pantalla}`)).status()).toBe(403);
    await entrar(context,f.admin);await page.reload();await page.getByRole('button',{name:'Quitar de mis favoritos',exact:true}).click();
    await page.goto('/catalogo');
    await page.getByLabel('Marca, modelo o sección',{exact:true}).fill('QB65R');
    await page.getByLabel('Ancho máximo (mm)',{exact:true}).fill('1600');
    await page.getByRole('button',{name:'Buscar referencias',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'1 referencias verificadas'})).toBeVisible();
    await page.screenshot({path:resolve(salida,'e2e-escritorio-busqueda-tecnica.png'),fullPage:true});
    const nombre='PRUEBA-IMPORT-01 E2E COPIA REAL TEMPORAL';
    await page.goto(`/salas/${f.sala}/equipamiento`);
    await page.getByLabel(/^Nombre de la plantilla/).fill(nombre);
    await page.getByRole('button',{name:'Crear plantilla',exact:true}).click();
    await page.waitForURL(/\/plantillas/);
    const [plantilla]=await sql`select id from plantillas_sala where nombre=${nombre}`;expect(plantilla).toBeTruthy();
    try{
      const lineas=await sql`select dimensiones_tecnicas,dimensiones_tecnicas is null as sql_null from plantilla_articulos where plantilla_id=${plantilla.id}`;
      expect(lineas).toHaveLength(1);expect(lineas[0].dimensiones_tecnicas).toBeNull();expect(lineas[0].sql_null).toBe(false);
      await writeFile(resolve(salida,'e2e-copia-real.json'),JSON.stringify({plantilla,lineas,resultado:'Ausencia legado copiada como JSON null explícito, no dimensiones actuales1550'},null,2));
    }finally{await sql`delete from plantillas_sala where id=${plantilla.id}`;}
  });

  test('móvil al cierre: revisión sin desbordamiento de página y lote reversible',async({page,context})=>{
    await entrar(context);await page.setViewportSize({width:390,height:844});
    await page.goto(`/catalogo/importar?sala=${f.sala}`);
    await page.getByLabel(/^Procedencia/).fill('PRUEBA-IMPORT-01 cierre móvil');
    await page.getByLabel('Archivo CSV o XLSX',{exact:true}).setInputFiles(resolve(salida,'fuentes','bom-valida.csv'));
    await page.getByRole('button',{name:'Revisar archivo',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Revisión antes de guardar',exact:true})).toBeVisible();
    await page.getByRole('combobox',{name:'Acción fila 2',exact:true}).selectOption(f.pantalla);
    await page.screenshot({path:resolve(salida,'e2e-movil-revision.png'),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Confirmar 1 filas elegidas',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Resultado del lote',exact:true})).toBeVisible();
    await page.screenshot({path:resolve(salida,'e2e-movil-resultado.png'),fullPage:true});
    await page.getByRole('button',{name:'Revertir lote',exact:true}).click();
    await expect(page.getByText('Alta retirada sin dependencias ni ediciones posteriores.',{exact:false}).first()).toBeVisible();
  });
});
