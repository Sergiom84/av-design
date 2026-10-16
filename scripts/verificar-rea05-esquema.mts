/** Verifica retirada vacía y protección del historial sólo en la base REA05. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { conectarRevisiones, comprobarUrlRevisiones, fotografiarRevisiones, idTiempo } from './rea05-fixture.mjs';

const salida = 'output/rea-integracion/rea05/integracion';
const url = process.env.REA_DATABASE_URL;
if (!url) throw new Error('REA_DATABASE_URL explícita obligatoria.');
for (const incorrecta of [url.replace(':5557/', ':5556/'), url.replace('127.0.0.1', 'localhost'), url + '?sslmode=disable']) {
  assert.throws(() => comprobarUrlRevisiones(incorrecta));
}
const sql = await conectarRevisiones(url);
const deshacer = new Error('ROLLBACK deliberado de la prueba de esquema');
try {
  const antes = await fotografiarRevisiones(sql);
  const contrato = await readFile('docs/23-rea05-especificacion.md', 'utf8');
  const bloque = contrato.split('```sql\n')[1].split('\n```')[0] + '\n';
  const migracion = await readFile('db/migraciones/2026-10-rea05-tiempos-costes.sql', 'utf8');
  assert.equal(migracion.slice(migracion.indexOf('\n') + 1), bloque);
  const retirada = (await readFile('db/migraciones/rollback/2026-10-rea05-tiempos-costes.sql', 'utf8'))
    .replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
  await assert.rejects(sql.begin(async tx => {
    await tx.unsafe(retirada);
    const [{ n }] = await tx`select count(*)::int n from pg_tables where schemaname='public'`;
    assert.equal(n, 73);
    const [{ presente }] = await tx`select to_regclass('tiempo_registros') is not null as presente`;
    assert.equal(presente, false);
    throw deshacer;
  }), e => e === deshacer);
  await assert.rejects(sql.begin(async tx => {
    await tx`insert into usuarios(id,usuario,nombre,rol,clave_hash) values (${idTiempo(9901)},'rea05-esquema','PRUEBA REA05 esquema','admin','sintetico-sin-login')`;
    await tx`insert into coste_operaciones(id,autor_id,clave_peticion,hash_peticion,tipo,resultado) values (${idTiempo(9902)},${idTiempo(9901)},${idTiempo(9903)},${'a'.repeat(64)},'corte','{}'::jsonb)`;
    await assert.rejects(tx.savepoint(async sp => { await sp.unsafe(retirada); }), /REA05 contiene datos/);
    const [{ n }] = await tx`select count(*)::int n from pg_tables where schemaname='public'`;
    assert.equal(n, 82);
    assert.equal((await tx`select id from coste_operaciones where id=${idTiempo(9902)}`).length, 1);
    throw deshacer;
  }), e => e === deshacer);
  const despues = await fotografiarRevisiones(sql);
  assert.equal(despues.sha256, antes.sha256);
  assert.equal(despues.tablas.length, 82);
  await mkdir(salida, { recursive: true });
  const resultado = { estado: 'aprobado', tablas: 82, paridadLiteral: true, retiroVacio: true, retiroConHistoriaRechazado: true, cambiosPersistidos: 0, sha256Antes: antes.sha256, sha256Despues: despues.sha256, sqlSha256: createHash('sha256').update(bloque).digest('hex'), fecha: new Date().toISOString() };
  await writeFile(`${salida}/esquema-verificado.json`, JSON.stringify(resultado, null, 2) + '\n');
  console.log(JSON.stringify(resultado));
} finally { await sql.end(); }
