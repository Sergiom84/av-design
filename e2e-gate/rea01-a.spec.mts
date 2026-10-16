import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, FIXTURE_REVISIONES, type SqlRevisionesPrueba } from '../scripts/rea01-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';

const salida=resolve('output/rea-integracion/rea01/a');
const secreto='rea01-local-prueba-integracion-secreto-2026';
const f=JSON.parse(await readFile(resolve(salida,'fixture.json'),'utf8')) as Record<string,string>;
let db:SqlRevisionesPrueba;
const usuarios={ oculto:randomUUID(), pendiente:randomUUID() };
const errores:string[]=[];
async function entrar(context:BrowserContext,id=f.admin) { await context.clearCookies(); await context.addCookies([{name:COOKIE_SESION,value:await firmarSesion(secreto,Date.now()+3_600_000,id),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]); }
async function elegir(page:Page) {
  await page.getByRole('combobox',{name:'Buscar plantilla',exact:true}).fill(f.nombre);
  await page.getByRole('option').filter({hasText:f.nombre}).first().click();
  await expect(page.getByRole('region',{name:`Vista previa de ${f.nombre}`,exact:true})).toBeVisible();
}
test.describe.serial('REA01 A: escritorio completo y móvil al cierre',()=>{
  test.beforeAll(async()=>{
    if(!process.env.REA_DATABASE_URL) throw new Error('URL REA explícita obligatoria.');
    db=await conectarRevisiones(process.env.REA_DATABASE_URL);
    await db`insert into usuarios (id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo)
      select ${usuarios.oculto},${'rea01-a-oculto-'+usuarios.oculto},'REA01 sin plantillas','tei',clave_hash,false,true from usuarios where id=${f.admin}`;
    await db`insert into usuario_permisos(usuario_id,seccion,acceso) values(${usuarios.oculto},'plantillas','oculto')`;
    await db`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo)
      select ${usuarios.pendiente},${'rea01-a-pendiente-'+usuarios.pendiente},'REA01 clave pendiente','tei',clave_hash,true,true from usuarios where id=${f.admin}`;
  });
  test.afterAll(async()=>{ await writeFile(resolve(salida,'e2e-consola.json'),JSON.stringify({errores},null,2)); expect(errores).toEqual([]); await db?.end(); });

  test('escritorio: alta, Resumen, plantilla e inspector comparten m/ft sin deriva',async({page,context})=>{
    page.on('pageerror',e=>errores.push(e.message)); await entrar(context);
    await page.goto('/salas/nueva');
    await page.getByLabel('Nombre',{exact:true}).fill(f.nombre+' navegador pies');
    await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');
    await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('10'); await page.getByLabel('Ancho (ft)',{exact:true}).fill('12'); await page.getByLabel('Alto (ft)',{exact:true}).fill('9');
    await expect(page.getByText('Largo: 3,048 m. Se guardará 3,05 m.',{exact:true})).toBeVisible();
    for(let i=0;i<3;i++){await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('m'); await expect(page.getByLabel('Largo (m)',{exact:true})).toHaveValue('3,05'); await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft');}
    await page.getByRole('button',{name:'Crear sala',exact:true}).first().click();
    await expect(page).toHaveURL(/\/salas\/[0-9a-f-]+$/);
    const salaNueva=page.url().split('/').at(-1)!;
    await expect.poll(async()=>Number((await db`select largo_m from salas where id=${salaNueva}`)[0].largo_m)).toBe(3.05);
    await page.goto(`/salas/${salaNueva}?editar=medidas`);
    const antigua=await context.newPage(); await antigua.goto(`/salas/${salaNueva}?editar=medidas`);
    await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft'); await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('20');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await expect.poll(async()=>Number((await db`select largo_m from salas where id=${salaNueva}`)[0].largo_m)).toBe(6.1);
    await antigua.getByLabel('Largo (m)',{exact:true}).fill('7,5'); await antigua.getByRole('button',{name:'Guardar',exact:true}).click();
    await expect(antigua.getByRole('alert').filter({hasText:'La sala cambió en otra pestaña'})).toContainText('La sala cambió en otra pestaña'); await expect(antigua.getByLabel('Largo (m)',{exact:true})).toHaveValue('7,5');
    expect(Number((await db`select largo_m from salas where id=${salaNueva}`)[0].largo_m)).toBe(6.1); await antigua.close();
    await page.goto(`/plantillas?abierta=${f.plantilla}#p-${f.plantilla}`);
    const bloque=page.locator(`#p-${f.plantilla}`);
    await expect(bloque.getByRole('region',{name:`Vista previa de ${f.nombre}`})).toBeVisible();
    await bloque.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft'); await bloque.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('30');
    await bloque.getByRole('button',{name:'Guardar medidas',exact:true}).click();
    await expect.poll(async()=>Number((await db`select largo_m from plantillas_sala where id=${f.plantilla}`)[0].largo_m)).toBe(9.14);
    await page.screenshot({path:resolve(salida,'escritorio-plantilla.png'),fullPage:true});
    await page.goto(`/salas/${salaNueva}/plano`); await page.getByRole('button',{name:'Empezar desde cero',exact:true}).click();
    await expect(page.getByLabel('Unidad de las dimensiones').filter({visible:true})).toBeVisible();
    const guardar=page.getByRole('button',{name:'Guardar cambios',exact:true}); await expect(guardar).toBeDisabled();
    await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft'); await expect(guardar).toBeDisabled();
    await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('30'); await expect(guardar).toBeEnabled(); await guardar.click();
    await expect(guardar).toBeDisabled(); await expect.poll(async()=>Number((await db`select largo_m from salas where id=${salaNueva}`)[0].largo_m)).toBe(9.14);
    await page.screenshot({path:resolve(salida,'escritorio-inspector.png'),fullPage:true});
  });

  test('escritorio: preview sólo lectura, caída recuperable, huella obsoleta y aplicación real',async({page,context})=>{
    page.on('pageerror',e=>errores.push(e.message)); await entrar(context);
    const [antes]=await db`select to_jsonb(s) fila from salas s where id=${f.navegador}`;
    await page.route(`**/api/plantillas/${f.plantilla}`,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Caída sintética del preview'})}));
    await page.goto(`/salas/${f.navegador}/plano`); await page.getByRole('combobox',{name:'Buscar plantilla'}).fill(f.nombre); await page.getByRole('option').filter({hasText:f.nombre}).first().click();
    await expect(page.getByText('Caída sintética del preview',{exact:true})).toBeVisible(); await expect(page.getByRole('button',{name:'Aplicar plantilla',exact:true})).toBeDisabled();
    await page.unroute(`**/api/plantillas/${f.plantilla}`); await page.getByRole('button',{name:'Reintentar vista previa',exact:true}).click();
    const preview=page.getByRole('region',{name:`Vista previa de ${f.nombre}`}); await expect(preview.getByRole('img')).toBeVisible(); await expect(preview.getByText('Opcional; no se hereda',{exact:true})).toBeVisible();
    const [despues]=await db`select to_jsonb(s) fila from salas s where id=${f.navegador}`; expect(despues).toEqual(antes);
    expect((await db`select id from sala_equipos where sala_id=${f.navegador}`).length).toBe(0);
    await page.screenshot({path:resolve(salida,'escritorio-preview.png'),fullPage:true});
    await db`update plantillas_sala set notas='Cambio concurrente REA01 A' where id=${f.plantilla}`;
    await page.getByRole('button',{name:'Aplicar plantilla',exact:true}).click(); await expect(page.getByText('La plantilla o sus referencias cambiaron. Vuelve a revisar la vista previa.',{exact:true})).toBeVisible();
    expect((await db`select id from sala_equipos where sala_id=${f.navegador}`).length).toBe(0);
    await page.reload(); await elegir(page); await page.getByRole('button',{name:'Aplicar plantilla',exact:true}).click();
    await expect(page.getByLabel('Unidad de las dimensiones').filter({visible:true})).toBeVisible();
    await expect.poll(async()=>(await db`select id from sala_equipos where sala_id=${f.navegador}`).length).toBe(2);
    expect(Number((await db`select count(*) n from sala_mobiliario where sala_id=${f.navegador}`)[0].n)).toBe(1);
    await page.screenshot({path:resolve(salida,'escritorio-aplicado.png'),fullPage:true});
  });

  test('HTTP: sesión, sección, cambio de clave, máximo20 y detalle elegido',async({page,context})=>{
    await context.clearCookies(); expect((await context.request.get('/api/plantillas',{maxRedirects:0})).status()).toBe(401); expect((await context.request.get(`/api/plantillas/${f.plantilla}`,{maxRedirects:0})).status()).toBe(401);
    await entrar(context,randomUUID()); expect((await context.request.get('/api/plantillas')).status()).toBe(401); expect((await context.request.get(`/api/plantillas/${f.plantilla}`)).status()).toBe(401);
    for(const id of [usuarios.oculto,usuarios.pendiente]) { await entrar(context,id); expect((await context.request.get('/api/plantillas')).status()).toBe(403); expect((await context.request.get(`/api/plantillas/${f.plantilla}`)).status()).toBe(403); }
    await entrar(context,usuarios.oculto); const respuesta=await page.goto('/salas/nueva'); expect(await respuesta!.text()).not.toContain(f.plantilla); await expect(page.getByLabel('Nombre',{exact:true})).toBeVisible(); expect(await page.getByRole('option').filter({hasText:f.nombre}).count()).toBe(0);
    await entrar(context,FIXTURE_REVISIONES.lectura); const res=await context.request.get('/api/plantillas?q='); expect(res.status()).toBe(200); const lista=await res.json(); expect(lista.length).toBeLessThanOrEqual(20); expect(lista.every((p:Record<string,unknown>)=>typeof p.lineas==='number'&&typeof p.conexiones==='number'&&!Array.isArray(p.muebles))).toBe(true);
    const detalle=await context.request.get(`/api/plantillas/${f.plantilla}`); expect(detalle.status()).toBe(200); expect(detalle.headers()['cache-control']).toContain('no-store'); expect((await detalle.json()).plantilla.id).toBe(f.plantilla);
    expect((await context.request.get('/api/plantillas/no-es-uuid')).status()).toBe(400); expect((await context.request.get(`/api/plantillas/${randomUUID()}`)).status()).toBe(404);
  });

  test('móvil al cierre: medidas y preview legibles sin desbordamiento',async({page,context})=>{
    await entrar(context); await page.setViewportSize({width:390,height:844});
    await page.goto(`/salas/nueva?plantilla=${f.plantilla}`); const preview=page.getByRole('region',{name:`Vista previa de ${f.nombre}`}); await expect(preview.getByRole('img')).toBeVisible();
    await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft'); await page.getByLabel('Largo (ft)',{exact:true}).filter({visible:true}).fill('30');
    await expect(page.getByRole('button',{name:'Crear sala',exact:true}).last()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:resolve(salida,'movil-alta-preview.png'),fullPage:true});
    await page.goto(`/salas/${f.navegador}/plano`); await page.locator('summary').filter({hasText:'Medidas de la sala'}).click(); await expect(page.getByLabel('Unidad de las dimensiones').filter({visible:true})).toBeVisible();
    await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).selectOption('ft'); await page.getByLabel('Unidad de las dimensiones').filter({visible:true}).scrollIntoViewIfNeeded(); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:resolve(salida,'movil-inspector.png'),fullPage:true});
  });
});
