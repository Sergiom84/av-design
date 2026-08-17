/**
 * Invariantes de usuarios contra Postgres real.
 *
 *   npm run test:usuarios
 *
 * La carrera tiene dos administradores y dos peticiones que quitan uno cada
 * una. Una tercera transacción mantiene bloqueadas ambas filas para que las
 * dos peticiones lleguen a la vez al mismo punto. Sin el `FOR UPDATE` estable
 * de la acción, ambas leen que queda la otra y dejan cero administradores.
 */

import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const urlBase = process.env.DATABASE_URL ?? 'postgres://av_design:av_design_local@localhost:5433/av_design';
const nombreBase = `av_design_usuarios_${Math.floor(Math.random() * 1e9).toString(36)}`;
const url = urlBase.replace(/\/[^/?]+(\?|$)/, `/${nombreBase}$1`);
const administracion = postgres(urlBase, { max: 1, ssl: false });

await administracion.unsafe(`create database "${nombreBase}"`);
process.env.DATABASE_URL = url;
delete process.env.SESION_SECRETO;

type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const moduloInterno = Module as unknown as ModuloConLoad;
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  return cargarOriginal.call(Module, request, ...resto);
};

const sql = postgres(url, { max: 2, ssl: false });
const cerrojo = postgres(url, { max: 1, ssl: false });
let cerrojoAbierto = false;
const prefijo = `TEST usuarios carrera ${randomUUID()}`;
const primero = randomUUID();
const segundo = randomUUID();

function formulario(valores: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(valores)) datos.set(clave, valor);
  return datos;
}

async function esperarDosBloqueados(): Promise<boolean> {
  for (let intento = 0; intento < 80; intento += 1) {
    const [{ n }] = await sql<Array<{ n: string }>>`
      select count(*)::text as n
        from pg_stat_activity
       where datname = current_database()
         and wait_event_type = 'Lock'
         and query ilike '%from usuarios%'
    `;
    if (Number(n) >= 2) return true;
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
  return false;
}

function resultado(peticion: Promise<unknown>): Promise<string> {
  return peticion.then(
    () => 'resuelta',
    (error: unknown) => {
      const mensaje = error instanceof Error ? error.message : String(error);
      const digest = (error as { digest?: unknown })?.digest;
      return typeof digest === 'string' ? `${mensaje} ${digest}` : mensaje;
    },
  );
}

try {
  await sql.unsafe(readFileSync('db/schema.sql', 'utf8'));
  await sql`
    insert into usuarios (id, usuario, nombre, rol, clave_hash, activo)
    values
      (${primero}, ${`test-admin-a-${primero.slice(0, 8)}`}, ${`${prefijo} A`}, 'admin', 'test', true),
      (${segundo}, ${`test-admin-b-${segundo.slice(0, 8)}`}, ${`${prefijo} B`}, 'admin', 'test', true)
  `;

  await cerrojo.unsafe('begin');
  cerrojoAbierto = true;
  await cerrojo`
    select id from usuarios
     where id in (${primero}, ${segundo})
     order by id
     for update
  `;

  const acciones = await import('../src/app/acciones-usuarios');
  const degradar = resultado(acciones.cambiarRolUsuario(formulario({ id: primero, rol: 'tecnico' })));
  const desactivar = resultado(acciones.cambiarActivoUsuario(formulario({ id: segundo, activo: 'no' })));

  if (!(await esperarDosBloqueados())) {
    throw new Error('Los dos contendientes no quedaron esperando los cerrojos de administradores.');
  }

  await cerrojo.unsafe('commit');
  cerrojoAbierto = false;
  const resultados = await Promise.all([degradar, desactivar]);
  const [{ n }] = await sql<Array<{ n: string }>>`
    select count(*)::text as n from usuarios where id in (${primero}, ${segundo}) and activo and rol = 'admin'
  `;

  if (Number(n) !== 1) {
    throw new Error(`La carrera dejó ${n} administradores activos; debía quedar exactamente uno.`);
  }
  if (!resultados.some((r) => decodeURIComponent(r).includes('Es el único administrador activo.'))) {
    throw new Error(`Ninguna petición rechazó quitar al último administrador: ${resultados.join(' | ')}`);
  }

  console.log('OK   dos operaciones concurrentes conservan exactamente un administrador activo');
} finally {
  if (cerrojoAbierto) await cerrojo.unsafe('rollback').catch(() => {});
  await sql`delete from usuarios where id in (${primero}, ${segundo})`;
  await cerrojo.end();
  await sql.end();
  await global.__sql?.end();
  await administracion.unsafe(`drop database if exists "${nombreBase}"`);
  await administracion.end();
}
