import { readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { resultadoE2eAprobado } from './resultado-e2e-diagrama.mjs';

const adminUrl = process.env.E2E_DATABASE_ADMIN_URL ??
  'postgres://av_design:av_design_local@127.0.0.1:5433/postgres';
const nombre = `av_design_e2e_diagrama_${process.pid}_${Date.now()}`;

if (!/^av_design_e2e_diagrama_[0-9_]+$/.test(nombre)) {
  throw new Error('Nombre de base efímera no válido.');
}

const admin = postgres(adminUrl, { max: 1 });
const url = new URL(adminUrl);
url.pathname = `/${nombre}`;
const databaseUrl = url.toString();

async function ejecutar() {
  await admin.unsafe(`create database "${nombre}"`);
  const db = postgres(databaseUrl, { max: 1 });
  try {
    await db.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    await db.unsafe(await readFile(new URL('../db/seed.sql', import.meta.url), 'utf8'));
  } finally {
    await db.end();
  }

  const hijo = spawn(
    process.execPath,
    [fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', '--config=e2e-gate/diagrama.config.ts'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'development',
        NEXT_DIST_DIR: '.next-e2e-diagrama',
      },
    },
  );
  const codigo = await new Promise((resolve, reject) => {
    hijo.once('error', reject);
    hijo.once('exit', (valor) => resolve(valor ?? 1));
  });
  const resultado = JSON.parse(
    await readFile(new URL('../output/e2e/diagrama/resultado.json', import.meta.url), 'utf8'),
  );
  const estadisticas = resultado.stats ?? {};
  if (!resultadoE2eAprobado(codigo, estadisticas)) {
    console.error(
      `Gate E2E no aprobado: codigo=${codigo}, ` +
        `aprobadas=${estadisticas.expected ?? 'desconocido'}, ` +
        `omitidas=${estadisticas.skipped ?? 'desconocido'}, ` +
        `inesperadas=${estadisticas.unexpected ?? 'desconocido'}, ` +
        `inestables=${estadisticas.flaky ?? 'desconocido'}.`,
    );
    process.exitCode = codigo || 1;
  }
}

try {
  await ejecutar();
} finally {
  await admin.unsafe(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${nombre}' and pid <> pg_backend_pid()`,
  );
  await admin.unsafe(`drop database if exists "${nombre}"`);
  await admin.end();
  await rm(new URL('../.next-e2e-diagrama', import.meta.url), { recursive: true, force: true });
}
