/** Servidor de aceptación con una base nueva. No carga .env para preparar datos. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import postgres from 'postgres';
import { require as tsRequire } from 'tsx/cjs/api';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const opciones = process.argv.slice(2);
assert.ok(opciones.every(x => x === '--plan'), 'Solo admite --plan');
console.log('QA exclusiva: 127.0.0.1:5433, nueva qa_plan40_ui_<UUID>, servidor 127.0.0.1:3128.');
console.log('Cerrar escribiendo cerrar. No reutiliza ni elimina bases anteriores.');
if (opciones.includes('--plan')) process.exit(0);

// Comprobar el puerto antes de crear la base o iniciar un proceso.
await new Promise((resolve, reject) => {
  const prueba = createServer();
  prueba.once('error', reject);
  prueba.listen(3128, '127.0.0.1', () => prueba.close(resolve));
});
const nombre = `qa_plan40_ui_${randomUUID().replaceAll('-', '')}`;
assert.match(nombre, /^qa_plan40_ui_[a-f0-9]{32}$/);
const configuracion = { host: '127.0.0.1', port: 5433, username: 'av_design',
  password: 'av_design_local', max: 1, onnotice: () => {} };
const admin = postgres({ ...configuracion, database: 'postgres' });
let creada = false;
let servidor;
try {
  await admin.unsafe(`create database "${nombre}"`);
  creada = true;
  const db = postgres({ ...configuracion, database: nombre });
  try {
    await db.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    await db.unsafe(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
    const { cifrarClave } = tsRequire('../src/lib/contrasena.ts', import.meta.url);
    // Credencial pública de ensayo: existe únicamente en esta base desechable.
    const hash = await cifrarClave('EnsayoPlan40!2026');
    await db`insert into usuarios(usuario,nombre,rol,clave_hash,debe_cambiar_clave)
      values ('qa.proyectista','Proyectista QA Plan 40','admin',${hash},false)`;
  } finally { await db.end(); }
  console.log(`BASE_QA=${nombre}`);
  console.log('USUARIO_QA=qa.proyectista');
  servidor = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)),
    'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3128'], {
    cwd: raiz, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env,
      NODE_ENV: 'development', DATABASE_URL: `postgres://av_design:av_design_local@127.0.0.1:5433/${nombre}`,
      SESION_SECRETO: randomUUID() + randomUUID(), NEXT_DIST_DIR: '.next-qa-plan40' },
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.once('exit', resolve);
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', texto => { if (texto.trim() === 'cerrar') resolve(); });
  });
} finally {
  if (servidor?.pid && servidor.exitCode === null) {
    if (process.platform === 'win32') {
      const cierre = spawnSync('taskkill', ['/PID', String(servidor.pid), '/T', '/F'], { encoding: 'utf8' });
      if (cierre.status !== 0) console.error('Revisar cierre del proceso QA propio:', servidor.pid);
    } else servidor.kill('SIGTERM');
  }
  if (creada) {
    await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname=${nombre} and pid<>pg_backend_pid()`;
    await admin.unsafe(`drop database "${nombre}"`);
    console.log(`FIXTURE ELIMINADO ${nombre}`);
  }
  await admin.end();
  process.stdin.pause();
}
