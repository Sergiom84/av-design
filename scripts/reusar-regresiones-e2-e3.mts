/** Reusa gates E2 sin escribir sus archivos/evidencia ni conectar a su base. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';

const raiz = resolve('.');
const salida = resolve('output/e3-revisiones/regresiones-e2');
const copias = resolve(salida, 'scripts');
const url = process.env.E3_REGRESIONES_DATABASE_URL;
if (!url) throw new Error('E3_REGRESIONES_DATABASE_URL explícita obligatoria.');
const destino = new URL(url);
assert.ok(['postgres:', 'postgresql:'].includes(destino.protocol));
assert.ok(['127.0.0.1', 'localhost'].includes(destino.hostname));
assert.equal(destino.port, '5548');
assert.equal(destino.pathname, '/av_design_e3_regresiones');
assert.equal(decodeURIComponent(destino.username), 'av_design_e3_regresiones');
assert.equal(destino.search + destino.hash, '');
const sql = postgres(url, { max: 1, ssl: false, onnotice: () => {} });
const [real] = await sql`select current_database() as base,current_user as usuario,inet_server_port() as puerto`;
assert.deepEqual(real, { base: 'av_design_e3_regresiones', usuario: 'av_design_e3_regresiones', puerto: 5432 });
console.log(`Destino nuevo comprobado: ${destino.hostname}:5548/${real.base}, usuario ${real.usuario}.`);
await mkdir(copias, { recursive: true });
await writeFile(resolve(salida, 'identidad.json'), JSON.stringify({ ...real, host: destino.hostname, puertoCliente: 5548 }, null, 2));
try {
  if (process.argv.includes('--preparar')) {
    const [{ n }] = await sql`select count(*)::int as n from pg_tables where schemaname='public'`;
    if (n !== 0) throw new Error('Preparación sólo en base nueva vacía; no se resetea.');
    await sql.unsafe(await readFile(resolve('db/schema.sql'), 'utf8'));
  }
  if (process.argv.includes('--migraciones')) {
    for (const nombre of ['2026-10-e3-revisiones.sql', '2026-10-e3-anotaciones.sql']) {
      await sql.unsafe(await readFile(resolve('db/migraciones', nombre), 'utf8'));
      console.log(`Migración sólo en base de regresiones nueva: ${nombre}`);
    }
  }
} finally { await sql.end(); }

const nombres = ['importacion-fixture.mts', 'preparar-seed-importacion.mjs', 'verificar-importacion.mts', 'verificar-importacion-regresiones.mts'];
const rollback = (await readFile(resolve('db/migraciones/rollback/2026-10-e2.sql'), 'utf8'))
  .replaceAll('av_design_e2_prueba', 'av_design_e3_regresiones').replaceAll('av_design_e2', 'av_design_e3_regresiones');
await writeFile(resolve(salida, 'rollback-e2-destino-prueba.sql'), rollback);
for (const nombre of nombres) {
  const original = await readFile(resolve('scripts', nombre), 'utf8');
  let contenido = original
    .replaceAll('av_design_e2_prueba', 'av_design_e3_regresiones')
    .replaceAll('av_design_e2', 'av_design_e3_regresiones')
    .replaceAll('5546', '5548')
    .replaceAll('output/e2-importacion/gates', 'output/e3-revisiones/regresiones-e2')
    .replaceAll("'../src/", `'${raiz}/src/`)
    .replaceAll("'./importacion-fixture.mjs'", "'./importacion-fixture.mts'")
    .replaceAll("resolve('db/migraciones/rollback/2026-10-e2.sql')", `resolve(${JSON.stringify(resolve(salida, 'rollback-e2-destino-prueba.sql'))})`)
    .replaceAll("new URL('../db/schema.sql', import.meta.url)", `new URL(${JSON.stringify(pathToFileURL(resolve('db/schema.sql')).href)})`)
    .replaceAll("new URL(`../db/migraciones/${nombre}`,import.meta.url)", `new URL(\`${pathToFileURL(resolve('db/migraciones')).href}/\${nombre}\`)`);
  if (nombre === 'preparar-seed-importacion.mjs') {
    contenido = contenido.replace("const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');", `const raiz = ${JSON.stringify(raiz)};`);
  }
  // E3 añade un contador monotónico de diseño: volver al contenido previo
  // mantiene ese contador incrementado. El contrato E2 compara las columnas
  // de negocio. Cada foto conserva además las filas crudas con el contador.
  if (nombre === 'importacion-fixture.mts') {
    contenido = contenido.replace("const fotos: FotoImportacion['tablas'] = [];", "const fotos: FotoImportacion['tablas'] = []; const crudas: Record<string, unknown> = {};")
      .replace('fotos.push({ tabla: String(tablename), filas: filas.length,', "crudas[String(tablename)] = JSON.parse(JSON.stringify(filas));\n      if (tablename === 'salas') for (const fila of filas) { const obj = JSON.parse(String(fila.fila)); delete obj.diseno_version; delete obj.actualizado_en; fila.fila = JSON.stringify(obj); }\n      fotos.push({ tabla: String(tablename), filas: filas.length,")
      .replace("return { base: 'av_design_e3_regresiones', sha256:", "await mkdir(SALIDA_IMPORTACION,{recursive:true}); await writeFile(resolve(SALIDA_IMPORTACION,`foto-cruda-${Date.now()}-${Math.random().toString(16).slice(2)}.json`),JSON.stringify(crudas,null,2));\n    return { base: 'av_design_e3_regresiones', sha256:");
  }
  await writeFile(resolve(copias, nombre), contenido);
}

const pasos = process.argv.includes('--preparar')
  ? [['importacion-fixture.mts', '--aplicar'], ['preparar-seed-importacion.mjs']]
  : [['verificar-importacion.mts'], ['verificar-importacion-regresiones.mts']];
const resultados = [];
for (const [nombre, ...args] of pasos) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', resolve(copias, nombre), ...args], {
    cwd: raiz, encoding: 'utf8', timeout: 180_000,
    env: { ...process.env, IMPORTACION_DATABASE_URL: url, DATABASE_URL: '', DOCUMENTOS_DATABASE_URL: '' },
  });
  const log = resolve(salida, `${nombre}.log`);
  await writeFile(log, (r.stdout ?? '') + (r.stderr ?? ''));
  resultados.push({ comando: `${nombre} ${args.join(' ')}`, exit: r.status, log });
  console.log(`${nombre}: exit ${r.status}, ${log}`);
  if (r.status !== 0) { await writeFile(resolve(salida, 'comandos.json'), JSON.stringify(resultados, null, 2)); throw new Error(`Gate ${nombre} falló. Consultar log crudo.`); }
}
await writeFile(resolve(salida, process.argv.includes('--preparar') ? 'preparacion-comandos.json' : 'comandos.json'), JSON.stringify(resultados, null, 2));
