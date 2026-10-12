/** Regresión contra una base nueva por ejecución; nunca usa DATABASE_URL heredada. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import postgres from 'postgres';

const verificadores = [
  'diagrama', 'plantillas', 'guarda-equipos', 'bocas-puerto',
  'rutas-cable', 'editor-conexiones', 'concurrencia',
];
const argumentos = process.argv.slice(2);
assert.ok(argumentos.every(x => x === '--plan' || x.startsWith('--solo=')), 'Opciones: --plan, --solo=<verificador>');
const filtros = argumentos.filter(x => x.startsWith('--solo='));
assert.ok(filtros.length <= 1, 'Solo se admite un verificador');
const solo = filtros[0]?.slice('--solo='.length);
assert.ok(solo === undefined || verificadores.includes(solo), 'Verificador desconocido');
const seleccionados = solo === undefined ? verificadores : [solo];
const nombre = `qa_plan40_base_${randomUUID().replaceAll('-', '')}`;
const raiz = 'postgres://av_design:av_design_local@127.0.0.1:5433/';
const salida = resolve('output', nombre);
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ host: '127.0.0.1', puerto: 5433, base: nombre, verificadores: seleccionados, salida }));
  process.exit(0);
}
mkdirSync(salida, { recursive: true });
const admin = postgres(raiz + 'postgres', { onnotice() {} });
let creada = false;
let sql;
try {
  assert.match(nombre, /^qa_plan40_base_[a-f0-9]{32}$/);
  await admin.unsafe(`create database "${nombre}"`);
  creada = true;
  sql = postgres(raiz + nombre, { max: 1, onnotice() {} });
  await sql.unsafe(readFileSync('db/schema.sql', 'utf8'));
  await sql.unsafe(readFileSync('db/seed.sql', 'utf8'));
  for (const verificador of seleccionados) {
    const resultado = spawnSync(process.execPath, ['--import', 'tsx', `scripts/verificar-${verificador}.mts`], {
      encoding: 'utf8', timeout: 180000,
      env: { ...process.env, DATABASE_URL: raiz + nombre, SESION_SECRETO: '', NODE_ENV: 'test' },
    });
    const texto = (resultado.stdout ?? '') + (resultado.stderr ?? '') + (resultado.error ? String(resultado.error) : '');
    writeFileSync(resolve(salida, `${verificador}.log`), texto);
    console.log(`${verificador}: exit=${resultado.status}; ${salida}`);
    assert.equal(resultado.status, 0, `Falla ${verificador}: consultar su log`);
  }
} finally {
  if (sql) await sql.end();
  if (creada) await admin.unsafe(`drop database "${nombre}" with (force)`);
  await admin.end();
  console.log(`Base desechable cerrada: ${nombre}`);
}
