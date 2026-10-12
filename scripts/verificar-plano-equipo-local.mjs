/**
 * npm run test:plano-equipo
 * npm run test:plano-equipo:plan  (sin conexión ni escrituras)
 * Usa exclusivamente el Postgres de docker-compose en localhost:5433.
 * No lee DATABASE_URL ni .env.local. No siembra el catálogo ni migra av_design.
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import postgres from 'postgres';

if (process.argv.slice(2).some((arg) => arg !== '--plan')) {
  throw new Error('Única opción admitida: --plan');
}
const raiz = fileURLToPath(new URL('../', import.meta.url));
const nombre = `qa_plano_${randomUUID()}`;
if (!/^qa_plano_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nombre)) {
  throw new Error('Nombre QA no válido');
}
// Credenciales de desarrollo publicadas en docker-compose.yml, destino fijo.
const administracion = 'postgres://av_design:av_design_local@localhost:5433/postgres';
const destino = new URL(administracion);
destino.pathname = `/${nombre}`;
console.log(`Destino: localhost:5433/${nombre}`);
console.log('Crear BD nueva → aplicar db/schema.sql → verificar-plano-equipo → borrar solo esa BD.');
if (process.argv.includes('--plan')) process.exit(0);

const opciones = { max: 1, ssl: false, connect_timeout: 10, onnotice() {} };
const admin = postgres(administracion, opciones);
let creada = false;
let fixture;
let hijo;
let cancelado = false;
const cancelar = () => { cancelado = true; hijo?.kill(); };
const comprobarCancelacion = () => {
  if (cancelado) throw new Error('QA interrumpida; se limpia la base temporal');
};
process.on('SIGINT', cancelar);
process.on('SIGTERM', cancelar);

try {
  const esquema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  comprobarCancelacion();
  // Sin IF NOT EXISTS: si hubiera una colisión, falla y NO borra la BD previa.
  await admin`create database ${admin(nombre)}`;
  creada = true;
  comprobarCancelacion();
  fixture = postgres(destino.href, opciones);
  const [actual] = await fixture`select current_database() as nombre`;
  if (actual.nombre !== nombre) throw new Error('La conexión no apunta a la base recién creada');
  await fixture.begin(async (tx) => { await tx.unsafe(esquema); });
  await fixture.end();
  fixture = undefined;
  comprobarCancelacion();

  const codigo = await new Promise((resolve, reject) => {
    hijo = spawn(process.execPath, ['--import', 'tsx', 'scripts/verificar-plano-equipo.mts'], {
      cwd: raiz,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: destino.href,
        QA_PLANO_DATABASE_URL: destino.href, SESION_SECRETO: '' },
    });
    hijo.once('error', reject);
    hijo.once('close', (code) => resolve(code ?? 1));
  });
  hijo = undefined;
  comprobarCancelacion();
  if (codigo !== 0) throw new Error(`Verificador fallido: salida ${codigo}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await fixture?.end({ timeout: 5 });
  } catch (error) {
    console.error(`Cierre de conexión QA: ${error.message}`);
    process.exitCode = 1;
  }
  try {
    // Solo el nombre aleatorio creado con éxito por ESTA ejecución.
    // FORCE cierra conexiones residuales del verificador únicamente en esa BD.
    if (creada) {
      await admin`drop database ${admin(nombre)} with (force)`;
      const restantes = await admin`select datname from pg_database where datname = ${nombre}`;
      if (restantes.length) throw new Error(`No se ha eliminado ${nombre}`);
      console.log(`Limpieza verificada: ${nombre} eliminada.`);
    }
  } catch (error) {
    console.error(`No se pudo limpiar ${nombre}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await admin.end({ timeout: 5 });
    process.off('SIGINT', cancelar);
    process.off('SIGTERM', cancelar);
  }
}
