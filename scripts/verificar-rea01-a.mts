/** Gate REA-01 A: únicamente el destino sintético estricto 127.0.0.1:5552. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, fotografiarRevisiones, FIXTURE_REVISIONES } from './rea01-fixture.mjs';
import { firmaMedidasPlantilla } from '../src/lib/longitudes';
import { construirEscena } from '../src/lib/croquis';
import { entradaDePlantilla } from '../src/lib/plantilla-preview';

if (!process.env.REA_DATABASE_URL) throw new Error('REA_DATABASE_URL explícita obligatoria.');
const db = await conectarRevisiones(process.env.REA_DATABASE_URL);
process.env.DATABASE_URL = process.env.REA_DATABASE_URL;
// Sólo este proceso invoca acciones fuera de una petición. Las pruebas HTTP
// usan la sesión real del servidor y comprueban 401/403 en el spec de navegador.
process.env.SESION_SECRETO = '';
const mod = Module as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
const original = mod._load;
mod._load = (request, ...args) => request === 'server-only' ? {} : request === 'next/cache' ? { revalidatePath: () => {} } : original.call(Module, request, ...args);
const salida = resolve('output/rea-integracion/rea01/a');
await mkdir(salida, { recursive: true });
const tanda = Date.now().toString(36);
const f = { plantilla: randomUUID(), articulo: randomUUID(), cable: randomUUID(), silla: randomUUID(), linea: randomUUID(), rack: randomUUID(), opcional: randomUUID(), tirada: randomUUID(), punto: randomUUID(), sala: randomUUID(), vacia: randomUUID(), carrera: randomUUID(), rollback: randomUUID(), navegador: randomUUID(), admin: FIXTURE_REVISIONES.admin, nombre: `REA01 A ${tanda}` };
const resultados: Array<{ caso: string; ok: true }> = [];
const comprobar = async (caso: string, hacer: () => Promise<void>) => { await hacer(); resultados.push({ caso, ok: true }); console.log(`OK ${caso}`); };
const datos = (valores: Record<string, unknown>) => { const d = new FormData(); for (const [k,v] of Object.entries(valores)) if (v != null) d.set(k,String(v)); return d; };
const medidas = { unidad_dimensiones: 'm', entrada_largo: 6, entrada_ancho: 4, entrada_alto: 3, mesa_largo_m: 2, mesa_ancho_m: 1, mesa_alto_cm: 75, ruta_por_defecto: 'falso_techo' };
const estado = { error: null };
async function invocar<T>(accion: () => Promise<T>): Promise<T | undefined> {
  try { return await accion(); } catch (e) { if (String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) return undefined; throw e; }
}
// Snapshot de las filas de A: otro gate puede operar simultáneamente en sus
// UUID sin causar falsos positivos ni ocultar escrituras de esta unidad.
async function fotoA() {
  const salas = await db`select to_jsonb(s) fila from salas s where nombre like ${f.nombre+'%'} order by id`;
  const diseno: Record<string, unknown> = {};
  for (const tabla of ['sala_equipos','sala_mobiliario','conexiones','tomas_red','puertas']) diseno[tabla] = await db.unsafe(`select to_jsonb(t) fila from ${tabla} t join salas s on s.id=t.sala_id where s.nombre like $1 order by t.id`, [f.nombre+'%']);
  diseno.puntos = await db`select to_jsonb(p) fila from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id join salas s on s.id=c.sala_id where s.nombre like ${f.nombre+'%'} order by p.id`;
  return JSON.parse(JSON.stringify({ salas, diseno }));
}

try {
  await writeFile(resolve(salida, `bd-antes-${tanda}.json`), JSON.stringify(await fotografiarRevisiones(db), null, 2));
  await db.begin(async tx => {
    await tx`insert into articulos (id,tipo,categoria,modelo,unidad) values (${f.articulo},'equipo','Pantalla',${f.nombre+' equipo'},'ud'),(${f.cable},'cable','HDMI',${f.nombre+' cable'},'m')`;
    await tx`insert into catalogo_mobiliario (id,clave,nombre,categoria,forma,rol,fuente) values (${f.silla},${f.nombre},${f.nombre+' silla'},'Silla','circulo','asiento','app')`;
    await tx`insert into plantillas_sala (id,nombre,tipologia,aforo,largo_m,ancho_m,alto_m,mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m,mesa_rotacion_grados) values (${f.plantilla},${f.nombre},'Reunión',8,6,4,3,2,1,75,2,2,30)`;
    await tx`insert into plantilla_articulos (id,plantilla_id,articulo_id,categoria,modelo_texto,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada,rotacion_grados) values (${f.linea},${f.plantilla},${f.articulo},'Pantalla',${f.nombre+' pantalla'},1,'pantalla',0,0,0,true,90),(${f.rack},${f.plantilla},${f.articulo},'Rack',${f.nombre+' rack'},2,'rack',null,null,null,false,45)`;
    await tx`insert into plantilla_articulos (id,plantilla_id,categoria,modelo_texto,cantidad,opcional) values (${f.opcional},${f.plantilla},'Opcional','Extra sin referencia',3,true)`;
    await tx`insert into plantilla_mobiliario (plantilla_id,mobiliario_id,nombre,forma,largo_m,ancho_m,alto_m,x_m,y_m,z_m,rotacion_grados,posicion_confirmada) values (${f.plantilla},${f.silla},${f.nombre+' silla'},'circulo',.5,.5,.8,3,2,0,20,true)`;
    await tx`insert into puertas (plantilla_id,pared,posicion_m,anchura_m,altura_m) values (${f.plantilla},'sur',1,.8,2)`;
    await tx`insert into plantilla_conexiones (id,plantilla_id,origen_linea_id,destino_linea_id,articulo_cable_id,senal,ruta) values (${f.tirada},${f.plantilla},${f.linea},${f.rack},${f.cable},'hdmi','falso_techo')`;
    await tx`insert into plantilla_conexion_puntos_paso (id,plantilla_conexion_id,orden,x_m,y_m,z_m) values (${f.punto},${f.tirada},0,3,1,2)`;
    for (const clave of ['sala','vacia','carrera','rollback','navegador'] as const) await tx`insert into salas (id,nombre,largo_m,ancho_m,alto_m) values (${f[clave]},${f.nombre+' '+clave},6,4,3)`;
  });
  await writeFile(resolve(salida, 'fixture.json'), JSON.stringify(f, null, 2));
  const { obtenerPlantillaPreview } = await import('../src/lib/datos-plantillas');
  const { crearSala, guardarSala, guardarMedidasPlantilla } = await import('../src/app/acciones');
  const { aplicarPlantillaAlDiagrama } = await import('../src/app/acciones-diagrama');
  const { obtenerDatosPlanoSala } = await import('../src/lib/datos-plano');
  const vista = (await obtenerPlantillaPreview(f.plantilla))!;
  await comprobar('preview real sólo lectura, opcional y puerta existente', async () => {
    const antes = await fotoA(); const otra = await obtenerPlantillaPreview(f.plantilla);
    assert.equal(otra?.huella, vista.huella); assert.deepEqual(await fotoA(), antes);
    assert.equal(vista.lineas.length,3); assert.equal(vista.puertas.length,1); assert.equal(vista.conexiones[0].puntos_paso?.length,1);
  });
  await comprobar('servidor convierte 10ft a3.05m e ignora metros falsificados', async () => {
    const d = datos({ ...medidas, nombre: f.nombre+' pies', unidad_dimensiones:'ft', entrada_largo:10, entrada_ancho:12, entrada_alto:9, largo_m:999 });
    await invocar(() => crearSala(estado,d));
    const [s] = await db`select * from salas where nombre=${f.nombre+' pies'}`;
    assert.equal(Number(s.largo_m),3.05); assert.equal(Number(s.ancho_m),3.66); assert.equal(Number(s.alto_m),2.74);
  });
  await comprobar('guardar Resumen en pies y conflicto optimista sin pérdida', async () => {
    const d = datos({ ...medidas, id:f.sala, nombre:f.nombre+' sala', version_esperada:0, unidad_dimensiones:'ft', entrada_largo:20, entrada_ancho:15, entrada_alto:10 });
    assert.equal((await guardarSala(d)).error,null);
    const [s] = await db`select * from salas where id=${f.sala}`; assert.equal(Number(s.largo_m),6.1); assert.equal(Number(s.diagrama_version),1);
    const antes=await fotoA(); assert.match((await guardarSala(d)).error!,/otra pestaña/); assert.deepEqual(await fotoA(),antes);
    d.set('entrada_largo','1e4'); const invalidas=await fotoA(); assert.match((await guardarSala(d)).error!,/positiva/); assert.deepEqual(await fotoA(),invalidas);
  });
  await comprobar('aplicar preview copia montaje y escena idéntica sin duplicar sillas', async () => {
    const r=await aplicarPlantillaAlDiagrama(f.vacia,f.plantilla,0,vista.huella); assert.equal(r.ok,true);
    const real=(await obtenerDatosPlanoSala(f.vacia))!;
    assert.equal(real.sala.sillas_modo,'manuales'); assert.equal(real.equipos.length,2); assert.equal(real.muebles.length,1); assert.equal(real.puertas.length,1);
    assert.equal(real.conexiones[0].puntos_paso?.length,1);
    const sinIdentidad=(escena:unknown) => JSON.parse(JSON.stringify(escena,(k,v) => ['id','sala_id','origen_id','destino_id','nombre','titulo','conexion_id'].includes(k) ? undefined : v));
    // Geometría derivada: ids, nombres y orden de equipos no son medidas.
    const geometria=(e:ReturnType<typeof construirEscena>) => ({ sala:e.sala, mesa:e.mesa, sillas:e.sillas, muebles:e.muebles, equipos:[...e.equipos].sort((a,b)=>a.x_m-b.x_m||a.y_m-b.y_m), puertas:e.puertas, tiradas:e.tiradas });
    assert.deepEqual(sinIdentidad(geometria(construirEscena(real))),sinIdentidad(geometria(construirEscena(entradaDePlantilla(vista)))));
  });
  await comprobar('alta con plantilla copia posición/giro del mismo snapshot y puntos reales', async () => {
    await invocar(() => crearSala(estado,datos({...medidas,nombre:f.nombre+' alta plantilla',plantilla_id:f.plantilla,huella_plantilla:vista.huella})));
    const [s]=await db`select * from salas where nombre=${f.nombre+' alta plantilla'}`;
    assert.equal(Number(s.mesa_x_m),2); assert.equal(Number(s.mesa_y_m),2); assert.equal(Number(s.mesa_rotacion_grados),30);
    const real=(await obtenerDatosPlanoSala(String(s.id)))!; assert.equal(real.conexiones[0].puntos_paso?.length,1);
  });
  await comprobar('huella antigua y referencia inactiva rechazan sin escrituras', async () => {
    await db`update articulos set activo=false where id=${f.articulo}`;
    const antes=await fotoA(); const vieja=await aplicarPlantillaAlDiagrama(f.rollback,f.plantilla,0,vista.huella);
    assert.equal(vieja.ok,false); if(!vieja.ok) assert.equal(vieja.motivo,'conflicto'); assert.deepEqual(await fotoA(),antes);
    const actual=(await obtenerPlantillaPreview(f.plantilla))!;
    const bloqueada=await aplicarPlantillaAlDiagrama(f.rollback,f.plantilla,0,actual.huella); assert.equal(bloqueada.ok,false); if(!bloqueada.ok) assert.equal(bloqueada.motivo,'catalogo'); assert.deepEqual(await fotoA(),antes);
    const alta=await crearSala(estado,datos({...medidas,nombre:f.nombre+' rechazada',plantilla_id:f.plantilla,huella_plantilla:actual.huella})); assert.match(alta.error!,/activa/); assert.deepEqual(await fotoA(),antes);
    await db`update articulos set activo=true where id=${f.articulo}`;
  });
  await comprobar('referencia de tipo cambiado se valida otra vez en servidor', async () => {
    await db`update articulos set tipo='cable' where id=${f.articulo}`;
    const v=(await obtenerPlantillaPreview(f.plantilla))!; const antes=await fotoA(); const r=await aplicarPlantillaAlDiagrama(f.rollback,f.plantilla,0,v.huella);
    assert.equal(r.ok,false); if(!r.ok) assert.equal(r.motivo,'catalogo'); assert.deepEqual(await fotoA(),antes);
    await db`update articulos set tipo='equipo' where id=${f.articulo}`;
  });
  await comprobar('rutas fuera provocan rollback completo incluso en serie de altas', async () => {
    await db`update plantilla_conexion_puntos_paso set x_m=9 where id=${f.punto}`;
    const v=(await obtenerPlantillaPreview(f.plantilla))!; const antes=await fotoA(); const r=await aplicarPlantillaAlDiagrama(f.rollback,f.plantilla,0,v.huella);
    assert.equal(r.ok,false); if(!r.ok) assert.equal(r.motivo,'fuera'); assert.deepEqual(await fotoA(),antes);
    const alta=await crearSala(estado,datos({...medidas,nombre:f.nombre+' rollback {n}',copias:3,plantilla_id:f.plantilla,huella_plantilla:v.huella})); assert.match(alta.error!,/fuera/); assert.deepEqual(await fotoA(),antes);
    await db`update plantilla_conexion_puntos_paso set x_m=3 where id=${f.punto}`;
  });
  await comprobar('encoger Resumen no abandona montaje, puertas ni recorridos', async () => {
    const antes=await fotoA(); const r=await guardarSala(datos({...medidas,id:f.vacia,nombre:f.nombre+' vacia',version_esperada:1,entrada_largo:2})); assert.match(r.error!,/fuera/); assert.deepEqual(await fotoA(),antes);
  });
  await comprobar('medidas de plantilla en pies, huella de formulario y conflicto', async () => {
    const [p]=await db`select * from plantillas_sala where id=${f.plantilla}`;
    const d=datos({...medidas,id:f.plantilla,huella_medidas:firmaMedidasPlantilla(p),unidad_dimensiones:'ft',entrada_largo:20,entrada_ancho:15,entrada_alto:10});
    assert.equal((await guardarMedidasPlantilla(d)).error,null); const [actual]=await db`select * from plantillas_sala where id=${f.plantilla}`; assert.equal(Number(actual.largo_m),6.1);
    assert.match((await guardarMedidasPlantilla(d)).error!,/otra pestaña/); const [despues]=await db`select * from plantillas_sala where id=${f.plantilla}`; assert.deepEqual(despues,actual);
  });
  await comprobar('dos pestañas aplicando sólo producen una copia atómica', async () => {
    const v=(await obtenerPlantillaPreview(f.plantilla))!;
    const rs=await Promise.all([aplicarPlantillaAlDiagrama(f.carrera,f.plantilla,0,v.huella),aplicarPlantillaAlDiagrama(f.carrera,f.plantilla,0,v.huella)]);
    assert.equal(rs.filter(r=>r.ok).length,1); assert.equal(rs.filter(r=>!r.ok&&r.motivo==='conflicto').length,1);
    const [fila]=await db`select (select count(*) from sala_equipos where sala_id=${f.carrera}) equipos,(select count(*) from conexiones where sala_id=${f.carrera}) conexiones,diagrama_version from salas where id=${f.carrera}`; assert.equal(Number(fila.equipos),2); assert.equal(Number(fila.conexiones),1); assert.equal(Number(fila.diagrama_version),1);
  });
  await comprobar('preview no sobreescribe ocupación, versión ni obra cerrada posteriores',async()=>{
    const v=(await obtenerPlantillaPreview(f.plantilla))!;
    const ocupada=randomUUID(), versionada=randomUUID(), cerrada=randomUUID(), proyecto=randomUUID(), localizacion=randomUUID();
    await db.begin(async tx=>{
      await tx`insert into proyectos(id,nombre) values(${proyecto},${f.nombre+' cerrada'})`;
      await tx`insert into localizaciones(id,proyecto_id,nombre) values(${localizacion},${proyecto},'Sintética A')`;
      await tx`insert into hitos_proyecto(proyecto_id,tipo) values(${proyecto},'cierre')`;
      await tx`insert into salas(id,nombre,diagrama_version) values(${ocupada},${f.nombre+' ocupada'},0),(${versionada},${f.nombre+' versionada'},1)`;
      await tx`insert into salas(id,nombre,localizacion_id) values(${cerrada},${f.nombre+' cerrada'},${localizacion})`;
      await tx`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m) values(${ocupada},'Red A',1,1,1)`;
    });
    const antes=await fotoA();
    for(const [id,motivo] of [[ocupada,'ocupada'],[versionada,'conflicto'],[cerrada,'cerrado']] as const){const r=await aplicarPlantillaAlDiagrama(id,f.plantilla,0,v.huella);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.motivo,motivo);}
    assert.deepEqual(await fotoA(),antes);
  });
  await writeFile(resolve(salida, `bd-despues-${tanda}.json`), JSON.stringify(await fotografiarRevisiones(db), null, 2));
  await writeFile(resolve(salida,'postgres-resultados.json'),JSON.stringify({tanda,fixture:f,resultados},null,2));
  console.log(`${resultados.length}/${resultados.length} escenarios A aprobados.`);
} finally { await db.end(); await global.__sql?.end(); }
