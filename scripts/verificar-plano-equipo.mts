/** Solo una base desechable inicializada con schema.sql; nunca usa .env.local.
 * QA_PLANO_DATABASE_URL=postgres://.../qa_plano_... node --import tsx scripts/verificar-plano-equipo.mts
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import type { PatchEquipoPlano, PatchPlano } from '../src/lib/plano-editor';

const destino = new URL(process.env.QA_PLANO_DATABASE_URL ?? 'http://sin-configurar');
assert.ok(['localhost', '127.0.0.1'].includes(destino.hostname) && /^\/qa_plano_/.test(destino.pathname),
  'Se exige QA_PLANO_DATABASE_URL local y base qa_plano_* desechable');
process.env.DATABASE_URL = destino.href;
process.env.SESION_SECRETO = '';
assert.notEqual(process.env.NODE_ENV, 'production');
const modulo = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const cargar = modulo._load;
modulo._load = (id, ...args) => {
  if (id === 'server-only') return {};
  if (id === 'next/cache') return { revalidatePath() {}, unstable_cache: (f: unknown) => f };
  return cargar.call(Module, id, ...args);
};
const { guardarDiagramaSala } = await import('../src/app/acciones-diagrama');
const { sql: conexionApp } = await import('../src/lib/db');
const sql = postgres(destino.href, { max: 1, ssl: false, onnotice() {} });
const sala = randomUUID(), vecina = randomUUID(), equipo = randomUUID();
const toma = randomUUID(), ajena = randomUUID(), articulo = randomUUID();
let fallos = 0, total = 0;
const cambio = (extra: Partial<PatchEquipoPlano> = {}): PatchEquipoPlano => ({
  id: equipo, x_m: 1, y_m: 1, z_m: 1, rotacion_grados: 0, posicion_confirmada: true, ...extra,
});
const patch = (e = cambio(), versionEsperada = 0): PatchPlano => ({
  sala_id: sala, versionEsperada, sala: null, equipos: [e], equipos_alta: [],
  mobiliario_cambio: [], mobiliario_alta: [], mobiliario_baja: [], tomas: [],
  puertas_alta: [], puertas_cambio: [], puertas_baja: [], inicio_diagrama: null, sillas_modo: null,
});
const estado = async () => (await sql`
  select e.extremo, e.toma_red_id, e.x_m, e.rotacion_grados, s.diagrama_version
  from sala_equipos e join salas s on s.id=e.sala_id where e.id=${equipo}`)[0];
const probar = async (nombre: string, fn: () => Promise<void>) => {
  total++;
  await sql`update salas set diagrama_version=0 where id=${sala}`;
  await sql`update sala_equipos set extremo='pared', toma_red_id=null, x_m=1, rotacion_grados=0 where id=${equipo}`;
  try { await fn(); console.log(`OK ${nombre}`); }
  catch (error) { fallos++; console.error(`FALLO ${nombre}`, error); }
};
try {
  await sql`insert into salas (id,nombre,largo_m,ancho_m,alto_m) values
    (${sala},'QA propia',10,10,3), (${vecina},'QA vecina',10,10,3)`;
  await sql`insert into articulos (id,tipo,categoria,modelo) values (${articulo},'equipo','PANTALLAS','QA catálogo')`;
  await sql`insert into sala_equipos (id,sala_id,articulo_id,nombre,x_m,y_m,z_m,posicion_confirmada)
    values (${equipo},${sala},${articulo},'QA equipo',1,1,1,true)`;
  await sql`insert into tomas_red (id,sala_id,codigo) values (${toma},${sala},'QA-1'),(${ajena},${vecina},'QA-2')`;
  await probar('extremo aislado se persiste', async () => {
    assert.equal((await guardarDiagramaSala(patch(cambio({ extremo: 'techo' })))).ok, true);
    assert.equal((await estado()).extremo, 'techo');
    assert.equal((await estado()).diagrama_version, 1);
  });
  await probar('asignar y quitar toma sin mover', async () => {
    assert.equal((await guardarDiagramaSala(patch(cambio({ toma_red_id: toma })))).ok, true);
    assert.equal((await estado()).toma_red_id, toma);
    assert.equal((await guardarDiagramaSala(patch(cambio({ toma_red_id: null }), 1))).ok, true);
    assert.equal((await estado()).toma_red_id, null);
  });
  await probar('patch antiguo conserva extremo y toma', async () => {
    await sql`update sala_equipos set extremo='rack',toma_red_id=${toma} where id=${equipo}`;
    assert.equal((await guardarDiagramaSala(patch(cambio({ x_m: 2 })))).ok, true);
    const e = await estado();
    assert.equal(e.extremo, 'rack'); assert.equal(e.toma_red_id, toma); assert.equal(Number(e.x_m), 2);
  });
  for (const [nombre, extra] of [
    ['enum inventado', { extremo: 'inexistente' }],
    ['UUID mal formado', { toma_red_id: 'inexistente' }],
    ['toma ajena', { toma_red_id: ajena }],
    ['toma inexistente', { toma_red_id: randomUUID() }],
  ] as const) await probar(nombre, async () => {
    const antes = await estado();
    const p = patch(cambio({ x_m: 2, extremo: 'rack' }));
    Object.assign(p.equipos[0], extra);
    assert.equal((await guardarDiagramaSala(p)).ok, false);
    assert.deepEqual(await estado(), antes);
  });
  await probar('versión obsoleta no pisa extremo/toma/posición', async () => {
    await sql`update salas set diagrama_version=2 where id=${sala}`;
    const antes = await estado();
    const r = await guardarDiagramaSala(patch(cambio({ extremo: 'rack', toma_red_id: toma, x_m: 2 })));
    assert.equal(r.ok, false); assert.deepEqual(await estado(), antes);
  });
  await probar('guardado conjunto conserva todos los campos', async () => {
    assert.equal((await guardarDiagramaSala(patch(cambio({ extremo: 'rack', toma_red_id: toma, x_m: 2, rotacion_grados: 450 })))).ok, true);
    const e = await estado();
    assert.equal(e.extremo, 'rack'); assert.equal(e.toma_red_id, toma);
    assert.equal(Number(e.x_m), 2); assert.equal(Number(e.rotacion_grados), 90); assert.equal(e.diagrama_version, 1);
  });
  await probar('fallo después de escribir equipo revierte también versión', async () => {
    const antes = await estado();
    await sql.unsafe(`create function qa_plano_fallo() returns trigger language plpgsql as $$ begin raise exception 'QA rollback'; end $$`);
    await sql.unsafe(`create trigger qa_plano_fallo before update of diagrama_version on salas for each row execute function qa_plano_fallo()`);
    try {
      await assert.rejects(() => guardarDiagramaSala(patch(cambio({ extremo: 'rack', toma_red_id: toma, x_m: 2 }))), /QA rollback/);
      assert.deepEqual(await estado(), antes);
    } finally {
      await sql.unsafe('drop trigger qa_plano_fallo on salas');
      await sql.unsafe('drop function qa_plano_fallo()');
    }
  });
  await probar('alta sigue releyendo extremo del catálogo', async () => {
    const p = patch(); p.equipos = [];
    p.equipos_alta = [{ ...cambio(), extremo: 'techo', articulo_id: articulo }];
    assert.equal((await guardarDiagramaSala(p)).ok, true);
    const nuevos = await sql`select extremo from sala_equipos where sala_id=${sala} and id<>${equipo}`;
    assert.equal(nuevos.length, 1);
    const { extremoPorCategoria } = await import('../src/lib/tipos');
    assert.equal(nuevos[0].extremo, extremoPorCategoria('PANTALLAS'));
    assert.notEqual(nuevos[0].extremo, 'techo');
  });
} finally {
  await sql`delete from salas where id in (${sala},${vecina})`;
  await sql`delete from articulos where id=${articulo}`;
  await sql.end(); await conexionApp.end();
}
console.log(`${total - fallos}/${total} pruebas; ${fallos} fallos`);
process.exitCode = fallos ? 1 : 0;
