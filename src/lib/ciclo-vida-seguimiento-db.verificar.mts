/** Fixture aislado: solo localhost:5433, base efímera. No usa .env ni migra av_design.
 * Ejecutar mediante ciclo-vida-seguimiento-verificar.mjs para incluir mutaciones causales.
 * Next cookies/cache/redirect se adaptan al runner; sesión, permisos, acciones y SQL son reales.
 * El semáforo usa una ficha controlada: aquí se prueba su contrato, no compras/almacén.
 */
import Module from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { test, after } from 'node:test';

const nombre = process.env.SEGUIMIENTO_FIXTURE ?? `av_seguimiento_test_${randomUUID().replaceAll('-', '')}`;
assert.match(nombre, /^av_seguimiento_test_[a-f0-9]{32}$/);
const base = 'postgres://av_design:av_design_local@127.0.0.1:5433/av_design';
const admin = postgres(base, { max: 1, onnotice: () => {} });
await admin.unsafe(`create database "${nombre}"`);
const destino = new URL(base); destino.pathname = `/${nombre}`;
const url = destino.toString();
process.env.DATABASE_URL = url;
process.env.SESION_SECRETO = 'fixture-seguimiento-secreto-local-suficientemente-largo';
const db = postgres(url, { max: 5, onnotice: () => {} });
let cookie: string | undefined;
let bloqueoEntrega = false;
const cargador = Module as unknown as { _load: (r: string, ...args: unknown[]) => unknown };
const original = cargador._load;
cargador._load = (r, ...args) => {
  if (r === 'server-only') return {};
  if (r === 'next/headers') return { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) };
  if (r === 'next/cache') return { revalidatePath: () => {} };
  if (r === 'next/navigation') return { redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } };
  if (r === '@/app/salas/[id]/datos-ficha') return { fichaConAlmacen: async () => ({ puntosMontaje: bloqueoEntrega ? [{ estado: 'bloqueo', titulo: 'Material', detalle: 'Falta HDMI' }] : [] }) };
  return original.call(Module, r, ...args);
};
after(async () => {
  if (global.__sql) await global.__sql.end({ timeout: 1 });
  await db.end({ timeout: 1 });
  await admin.unsafe(`drop database "${nombre}" with (force)`);
  await admin.end();
  cargador._load = original;
  console.log(`FIXTURE ELIMINADO ${nombre}`);
});
// Arranca en el esquema anterior para probar la degradación antes de migrar.
const esquema = readFileSync('db/schema.sql', 'utf8');
assert.ok(esquema.includes('-- Septiembre 2026: compra y seguimiento'));
await db.unsafe(esquema.split('-- Septiembre 2026: compra y seguimiento')[0]);
const { seguimientoDeSala } = await import('./datos-ciclo');
assert.equal((await seguimientoDeSala(randomUUID())).disponible, false);
const migracion = await db.reserve();
try { await migracion.unsafe(readFileSync('db/migraciones/2026-09-seguimiento-instalacion.sql', 'utf8')); } finally { migracion.release(); }
const autor = randomUUID(); const tecnico = randomUUID();
await db`insert into usuarios (id, usuario, nombre, rol, clave_hash, debe_cambiar_clave) values (${autor}, 'fixture', 'Autor real fixture', 'admin', 'no-login-password', false)`;
await db`insert into tecnicos (id, nombre) values (${tecnico}, 'Instalador fixture')`;
await db`insert into tecnico_roles values (${tecnico}, 'instalacion'), (${tecnico}, 'inicio')`;
const { firmarSesion } = await import('./sesion');
cookie = await firmarSesion(process.env.SESION_SECRETO, Date.now() + 3600000, autor);
const cookieValida = cookie;
const acciones = await import('../app/acciones-ciclo');
const { PUNTOS_PRUEBA_FINAL } = await import('./ciclo-vida-seguimiento');
const { comprasDeSala } = await import('./datos-ciclo');
function form(sala: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ sala_id: sala, tecnico_id: tecnico, fecha: '2026-09-08', version: '0', ...extra })) f.set(k, v);
  return f;
}
async function sala() { const [s] = await db`insert into salas (nombre) values (${randomUUID()}) returning id`; return String(s.id); }
async function resultado(operacion: Promise<unknown>) {
  try { await operacion; return 'OK'; } catch (e) { return decodeURIComponent((e as Error).message); }
}
async function bien(p: Promise<unknown>) { const r = await resultado(p); assert.match(r, /^REDIRECT \/salas\/[\da-f-]+$/); }
async function mal(p: Promise<unknown>, patron: RegExp) { assert.match(await resultado(p), patron); }
function checklist(s: string, extra: Record<string, string> = {}) {
  const f = form(s, { operacion: 'prueba_final', ...extra });
  for (const p of PUNTOS_PRUEBA_FINAL) { f.set(`resultado_${p.clave}`, 'conforme'); f.set(`nota_${p.clave}`, ''); }
  return f;
}
async function instalada(s: string) { await bien(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' }))); }
async function probada(s: string) { await instalada(s); await bien(acciones.guardarSeguimientoSala(checklist(s))); }
async function cuenta(s: string) { const [r] = await db`select count(*)::int as n from auditoria_instalacion_sala where sala_id = ${s}`; return r.n; }

test('plan separado, versión y autor de sesión; no crea hitos', async () => {
  const s = await sala();
  await bien(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan', notas: 'Equipo en sala; falta HDMI', autor_id: tecnico })));
  const leido = await seguimientoDeSala(s);
  assert.equal(leido.plan?.nota, 'Equipo en sala; falta HDMI');
  assert.equal(leido.auditoria[0].autor, 'Autor real fixture');
  const [a] = await db`select autor_id from auditoria_instalacion_sala where sala_id = ${s}`; assert.equal(a.autor_id, autor);
  assert.equal((await db`select * from hitos_sala where sala_id = ${s}`).length, 0);
  await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })), /plan ha cambiado/);
  assert.equal(await cuenta(s), 1);
});
test('acciones rechazan sesión ausente, firma manipulada y rol lectura', async () => {
  const s = await sala();
  for (const valor of [undefined, `${cookieValida}alterada`]) {
    cookie = valor;
    await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })), /No hay sesión/);
    await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' })), /No hay sesión/);
    await mal(acciones.borrarHitoSala(form(s)), /No hay sesión/);
  }
  cookie = cookieValida;
  await db`update usuarios set rol = 'lectura' where id = ${autor}`;
  try {
    await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })), /Sin permiso/);
    await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' })), /Sin permiso/);
    await mal(acciones.borrarHitoSala(form(s)), /Sin permiso/);
  } finally { await db`update usuarios set rol = 'admin' where id = ${autor}`; }
  assert.equal(await cuenta(s), 0);
});
test('usuario ficticio no firma; técnico inactivo o sin rol no firma', async () => {
  const s = await sala(); const secreto = process.env.SESION_SECRETO;
  delete process.env.SESION_SECRETO;
  try { await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' })), /usuario real/); }
  finally { process.env.SESION_SECRETO = secreto; }
  await db`update tecnicos set activo = false where id = ${tecnico}`;
  try { await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' })), /no está activo/); }
  finally { await db`update tecnicos set activo = true where id = ${tecnico}`; }
  await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion', tecnico_id: autor })), /no está activo/);
  assert.equal(await cuenta(s), 0);
});
test('no prueba sin instalación ni entrega sin prueba; fechas coherentes', async () => {
  const s = await sala();
  await mal(acciones.guardarSeguimientoSala(checklist(s)), /Primero marca/);
  await mal(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Cliente' })), /Primero marca/);
  await instalada(s);
  await mal(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Cliente' })), /Primero completa/);
  await mal(acciones.guardarSeguimientoSala(checklist(s, { fecha: '2026-09-07' })), /anterior/);
  await mal(acciones.guardarSeguimientoSala(checklist(s, { fecha: '2026-02-30' })), /Fecha no válida/);
  assert.equal(await cuenta(s), 1);
});
test('checklist persiste pendiente; no hay falsa completitud', async () => {
  const s = await sala(); await instalada(s);
  const f = checklist(s, { operacion: 'checklist' }); f.set('resultado_audio', 'incidencia'); f.set('nota_audio', 'No se oye');
  await bien(acciones.guardarSeguimientoSala(f));
  const p = (await seguimientoDeSala(s)).prueba;
  assert.equal(p?.fecha, null); assert.equal(p?.puntos.find((x) => x.clave === 'audio')?.nota, 'No se oye');
  f.set('operacion', 'prueba_final'); f.set('version', '1');
  await mal(acciones.guardarSeguimientoSala(f), /pendientes o incidencias/);
  await mal(acciones.guardarSeguimientoSala(checklist(s)), /checklist ha cambiado/);
  f.set('resultado_audio', 'conforme'); await bien(acciones.guardarSeguimientoSala(f));
  assert.equal((await seguimientoDeSala(s)).prueba?.fecha, '2026-09-08');
});
test('entrega excepcional exige nota y aceptación, audita destinatario y aviso', async () => {
  const s = await sala(); await probada(s); bloqueoEntrega = true;
  try {
    await mal(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Responsable sala' })), /exige una nota/);
    await mal(acciones.registrarHitoSala(form(s, { tipo: 'entrega', notas: 'Autorizado' })), /quién recibe/);
    await bien(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Responsable sala', notas: 'Acepta entrega excepcional' })));
    const leido = await seguimientoDeSala(s); assert.equal(leido.auditoria[0].datos.acepta, 'Responsable sala');
    assert.deepEqual(leido.auditoria[0].datos.avisos, ['Material: Falta HDMI']);
  } finally { bloqueoEntrega = false; }
  await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })), /sala está entregada/);
  await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'reabrir_prueba', version: '1', notas: 'Corregir' })), /sala está entregada/);
});
test('anulación y reapertura conservan rastro y reinician puntos', async () => {
  const s = await sala(); await probada(s);
  await bien(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Responsable' })));
  const [h] = await db`select id from hitos_sala where sala_id = ${s} and tipo = 'entrega'`;
  await mal(acciones.borrarHitoSala(form(await sala(), { id: h.id, notas: 'Cruce' })), /no pertenece/);
  await bien(acciones.borrarHitoSala(form(s, { id: h.id, notas: 'Revisar sala' })));
  await bien(acciones.guardarSeguimientoSala(form(s, { operacion: 'reabrir_prueba', version: '1', notas: 'Nueva comprobación' })));
  const p = (await seguimientoDeSala(s)).prueba;
  assert.equal(p?.fecha, null); assert.ok(p?.puntos.every((x) => x.resultado === 'pendiente'));
  await mal(acciones.registrarHitoSala(form(s, { tipo: 'entrega', acepta: 'Responsable' })), /Primero completa/);
  assert.equal(await cuenta(s), 5);
});
test('históricos no se migran a pruebas ni cambian de fecha', async () => {
  const s = await sala();
  await db`insert into hitos_sala (sala_id,tipo,fecha) values (${s},'entrega','2024-03-01')`;
  assert.equal((await seguimientoDeSala(s)).prueba, null);
  await mal(acciones.registrarHitoSala(form(s, { tipo: 'instalacion' })), /sala está entregada/);
  const [h] = await db`select fecha::text from hitos_sala where sala_id = ${s}`; assert.equal(h.fecha, '2024-03-01');
  assert.equal(await cuenta(s), 0);
});
test('fallo de auditoría revierte el plan entero', async () => {
  const s = await sala();
  await db.unsafe("create function fallo_auditoria_fixture() returns trigger language plpgsql as $$ begin raise exception 'fallo auditoria fixture'; end $$; create trigger fallo_fixture before insert on auditoria_instalacion_sala for each row execute function fallo_auditoria_fixture()");
  try { await mal(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })), /fallo auditoria fixture/); }
  finally { await db.unsafe('drop trigger fallo_fixture on auditoria_instalacion_sala'); }
  assert.equal((await seguimientoDeSala(s)).plan, null); assert.equal(await cuenta(s), 0);
});
test('dos pestañas concurrentes: una versión gana y otra se rechaza', async () => {
  const s = await sala();
  const resultados = await Promise.all([1, 2].map((n) => resultado(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan', notas: String(n) })))));
  assert.equal(resultados.filter((r) => r.includes('plan ha cambiado')).length, 1);
  assert.equal(await cuenta(s), 1);
});
test('cierre concurrente usa cerrojo de sala: escritura espera y ve cierre', async () => {
  const s = await sala();
  const [p] = await db`insert into proyectos (nombre) values (${randomUUID()}) returning id`;
  const [l] = await db`insert into localizaciones (proyecto_id,nombre) values (${p.id},'Planta fixture') returning id`;
  await db`update salas set localizacion_id = ${l.id} where id = ${s}`;
  const conexion = await db.reserve();
  let pendiente: Promise<string> | undefined;
  try {
    await conexion`begin`; await conexion`select id from salas where id = ${s} for update`;
    pendiente = resultado(acciones.guardarSeguimientoSala(form(s, { operacion: 'plan' })));
    let esperando = false;
    for (let i = 0; i < 100; i++) {
      const [r] = await db`select count(*)::int as n from pg_stat_activity where datname = ${nombre} and wait_event_type = 'Lock' and query like '%from salas%for update%'`;
      if (r.n > 0) { esperando = true; break; }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(esperando, 'La acción debe esperar el lock real de sala');
    await conexion`insert into hitos_proyecto (proyecto_id,tipo) values (${p.id},'cierre')`;
    await conexion`commit`;
    assert.match(await pendiente, /proyecto está cerrado/);
    assert.equal(await cuenta(s), 0);
  } finally { await conexion`rollback`; conexion.release(); if (pendiente) await pendiente; }
});

test('corregir instalación con borrador conserva checklist anterior en auditoría', async () => {
  const s = await sala(); await instalada(s);
  await bien(acciones.guardarSeguimientoSala(checklist(s, { operacion: 'checklist' })));
  const [h] = await db`select id from hitos_sala where sala_id = ${s}`;
  await bien(acciones.borrarHitoSala(form(s, { id: h.id, notas: 'Fecha de instalación equivocada' })));
  assert.equal((await seguimientoDeSala(s)).prueba, null);
  assert.equal((await db`select id from hitos_sala where sala_id = ${s}`).length, 0);
  const [a] = await db`select datos from auditoria_instalacion_sala where sala_id = ${s} and operacion = 'borrar_instalacion'`;
  assert.equal(a.datos.prueba_anterior.puntos.length, 6);
});

test('compra y recepción directas: parcial, histórico sin FK, total y pedido de otra sala', async () => {
  const s = await sala();
  assert.equal((await comprasDeSala(s)).disponible, false);
  await db.unsafe(readFileSync('db/migraciones/2026-09-trazabilidad-compras.sql', 'utf8'));
  const [art] = await db`insert into articulos (tipo,categoria,modelo) values ('equipo','fixture',${randomUUID()}) returning id`;
  const [ubicacion] = await db`insert into ubicaciones (nombre) values (${randomUUID()}) returning id`;
  const [pedido] = await db`insert into pedidos (sala_id) values (${s}) returning id`;
  const [linea] = await db`insert into pedido_lineas (pedido_id,articulo_id,cantidad) values (${pedido.id},${art.id},10) returning id`;
  assert.equal((await comprasDeSala(s)).compra, 'pendiente');
  await db`update pedido_lineas set comprado_en = '2026-09-08', cantidad_recibida = 1 where id = ${linea.id}`;
  await db`insert into movimientos (articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo) values (${art.id},${ubicacion.id},'entrada',1,${s},'Recepción de pedido histórico')`;
  assert.equal((await comprasDeSala(s)).recepcion, 'sin_acreditar');
  await db`insert into movimientos (articulo_id,ubicacion_id,tipo,cantidad,sala_id,pedido_linea_id) values (${art.id},${ubicacion.id},'entrada',1,${s},${linea.id})`;
  assert.equal((await comprasDeSala(s)).recepcion, 'parcial');
  await db`update pedido_lineas set cantidad_recibida = 10 where id = ${linea.id}`;
  assert.equal((await comprasDeSala(s)).recepcion, 'parcial');
  await db`insert into movimientos (articulo_id,ubicacion_id,tipo,cantidad,pedido_linea_id) values (${art.id},${ubicacion.id},'entrada',9,${linea.id})`;
  assert.equal((await comprasDeSala(s)).recepcion, 'total');
  await db`insert into pedido_lineas (pedido_id,articulo_id,cantidad) values (${pedido.id},${art.id},1)`;
  assert.equal((await comprasDeSala(s)).compra, 'parcial');
  assert.equal((await comprasDeSala(s)).recepcion, 'parcial');
  assert.equal((await comprasDeSala(await sala())).recepcion, 'sin_datos');
});
