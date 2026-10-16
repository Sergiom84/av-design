/** Testigo durable de la colección y orden artículo -> puerto. Sólo QA identificada. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { fotografiarBase } from './documentos-fixture.mjs';
import { crearPuertoEnTransaccion, guardarPuertoEnTransaccion, borrarPuertoEnTransaccion } from '../src/lib/catalogo-puertos-escritura';
const destinos = {
  '5563': ['av_design_rea10_prueba', 'av_design_rea10'],
  '5565': ['av_design_rea10_puente_prueba', 'av_design_rea10_puente'],
  '5566': ['av_design_rea_final_e2_prueba', 'av_design_rea_final_e2'],
} as const;
const texto = process.env.REA10_PUERTOS_DATABASE_URL; assert.ok(texto);
const url = new URL(texto); assert.equal(url.hostname, '127.0.0.1'); assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.equal(url.search + url.hash, ''); assert.ok(url.port in destinos);
const destino = destinos[url.port as keyof typeof destinos];
assert.equal(url.pathname, '/' + destino[0]); assert.equal(url.username, destino[1]);
const salida = resolve(`output/rea-integracion/rea10/correccion-20261016/puertos-${url.port}-${Date.now()}`);
await mkdir(salida, { recursive: false });
const guardar = (nombre: string, datos: unknown) => writeFile(resolve(salida, nombre), JSON.stringify(datos, null, 2), { flag: 'wx' });
const sql = postgres(texto, { max: 4, ssl: false, onnotice: () => {} });
const casos: string[] = [];
const alta = { nombre: 'HDMI IN 1', total: 2, sentido: 'entrada', senal: 'hdmi', conector: 'HDMI', orden: 1, notas: null };
const propio = randomUUID(); let creado = false;
try {
  const [real] = await sql`select current_database() as base,current_user as usuario,inet_server_port() as puerto`;
  assert.deepEqual(real, { base: destino[0], usuario: destino[1], puerto: 5432 }); await guardar('identidad.json', real);
  const antes = await fotografiarBase(sql); await guardar('antes.json', { ...antes, base: destino[0] });
  if (process.argv.includes('--aplicar-migracion')) {
    const delta = await readFile('db/migraciones/2026-10-rea10-revision-puertos.sql', 'utf8');
    await sql.begin(tx => tx.unsafe(delta));
    assert.equal((await fotografiarBase(sql)).sha256, antes.sha256);
    casos.push('Migración aditiva idempotente: ninguna fila existente modificada');
  }
  const [trigger] = await sql`select pg_get_triggerdef(oid) as defin from pg_trigger where tgname='rea10_revision_conjunto_puertos' and tgrelid='puertos'::regclass`;
  assert.ok(trigger); await guardar('trigger.json', trigger);
  const rollback = new Error('ROLLBACK PROPIO B02');
  await assert.rejects(sql.begin(async tx => {
    const id = randomUUID();
    await tx`insert into articulos(id,tipo,categoria,marca,modelo,unidad,fuente) values(${id},'equipo','PRUEBA ABA','PRUEBA REA10 B02',${id},'ud','app')`;
    const revision = async () => BigInt((await tx`select revision::text as revision from articulos where id=${id}`)[0].revision);
    const r0 = await revision(), p = await crearPuertoEnTransaccion(tx, id, alta); assert.ok(p);
    const r1 = await revision(); assert.ok(r1 > r0);
    assert.equal(await guardarPuertoEnTransaccion(tx, p, { ...alta, total: 3 }), id);
    const r2 = await revision(); assert.ok(r2 > r1);
    await tx`update puertos set total=total where id=${p}`;
    const r3 = await revision(); assert.ok(r3 > r2);
    await tx`delete from puertos where id=${p}`;
    const r4 = await revision(); assert.ok(r4 > r3); assert.equal((await tx`select id from puertos where articulo_id=${id}`).length, 0);
    const p2 = await crearPuertoEnTransaccion(tx, id, alta); assert.ok(p2);
    assert.equal(await borrarPuertoEnTransaccion(tx, p2), id);
    const r6 = await revision(); assert.ok(r6 > r4);
    await guardar('revisiones.json', { vacioInicial: String(r0), alta: String(r1), guardar: String(r2), updateDirecto: String(r3), vacioFinal: String(r4), nuevaAltaBaja: String(r6) });
    throw rollback;
  }), e => e === rollback);
  assert.equal((await fotografiarBase(sql)).sha256, antes.sha256);
  casos.push('I/U/D comunes y SQL directo aumentan el testigo incluso al volver al conjunto vacío; rollback exacto');

  await sql.begin(async tx => {
    assert.equal((await tx`select id from articulos where id=${propio}`).length, 0);
    await tx`insert into articulos(id,tipo,categoria,marca,modelo,unidad,fuente) values(${propio},'equipo','PRUEBA LOCK','PRUEBA REA10 B02',${propio},'ud','app')`;
    await crearPuertoEnTransaccion(tx, propio, alta);
  }); creado = true;
  const [p] = await sql`select id from puertos where articulo_id=${propio}`;
  let soltar!: () => void, adquirido!: () => void, anunciarPid!: () => void;
  const liberacion = new Promise<void>(r => { soltar = r; }), bloqueo = new Promise<void>(r => { adquirido = r; }), pidListo = new Promise<void>(r => { anunciarPid = r; });
  let pidEscritor = 0;
  const poseedor = sql.begin(async tx => { await tx`select id from articulos where id=${propio} for update`; adquirido(); await liberacion; });
  await bloqueo;
  const escritor = sql.begin(async tx => { pidEscritor = Number((await tx`select pg_backend_pid() as pid`)[0].pid); anunciarPid(); return borrarPuertoEnTransaccion(tx, p.id); });
  await pidListo;
  let espera: Record<string, unknown> | undefined;
  try {
    for (let i = 0; i < 100; i++) {
      const [actividad] = await sql`select pid,wait_event_type,wait_event,query from pg_stat_activity where pid=${pidEscritor}`;
      if (actividad?.wait_event_type === 'Lock') { espera = actividad; break; }
      await new Promise(r => setTimeout(r, 10));
    }
    assert.ok(espera); assert.match(String(espera.query), /from articulos[\s\S]+for update/);
    await guardar('espera-real.json', espera);
  } finally { soltar(); }
  await poseedor; assert.equal(await escritor, propio);
  assert.equal((await sql`select id from puertos where articulo_id=${propio}`).length, 0);
  await sql`delete from articulos where id=${propio}`; creado = false;
  casos.push('Baja canónica espera por el artículo antes de bloquear/eliminar el puerto; espera real observada y sin deadlock');

  await assert.rejects(sql.begin(async tx => {
    await tx`drop trigger rea10_revision_conjunto_puertos on puertos`;
    await tx`drop function rea10_revision_articulo_por_puerto()`;
    assert.equal((await tx`select to_regprocedure('rea10_revision_articulo_por_puerto()') as funcion`)[0].funcion, null);
    throw rollback;
  }), e => e === rollback);
  assert.ok((await sql`select oid from pg_trigger where tgname='rea10_revision_conjunto_puertos' and tgrelid='puertos'::regclass`).length);
  casos.push('Fragmento de rollback elimina ambos objetos; rollback exterior conserva el esquema instalado');
  const despues = await fotografiarBase(sql); assert.equal(despues.sha256, antes.sha256);
  await guardar('despues.json', { ...despues, base: destino[0] });
  await guardar('resultado.json', { casos, tablas: antes.tablas.length, shaAntes: antes.sha256, shaDespues: despues.sha256, salida });
  console.log(JSON.stringify({ casos, salida }, null, 2));
} finally {
  if (creado) { await sql`delete from puertos where articulo_id=${propio}`; await sql`delete from articulos where id=${propio}`; }
  await sql.end();
}
