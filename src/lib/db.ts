import 'server-only';
import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Conexión a Postgres. Ahora apunta al contenedor local de docker-compose;
 * cuando se migre a Supabase basta con cambiar DATABASE_URL, porque Supabase
 * también es Postgres.
 */

const URL_BD = process.env.DATABASE_URL ?? '';

export function hayConfiguracion(): boolean {
  return Boolean(URL_BD);
}

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

function crear() {
  if (!URL_BD) throw new Error('Falta DATABASE_URL. Revisa .env.local');
  return postgres(URL_BD, {
    max: 5,
    idle_timeout: 20,
    // El proveedor gestionado exige TLS; el contenedor local no lo tiene.
    ssl: URL_BD.includes('localhost') || URL_BD.includes('127.0.0.1') ? false : 'require',
    transform: { undefined: null },
  });
}

/** Un pool por proceso, también entre recargas en caliente de desarrollo. */
function obtener() {
  const existente = global.__sql;
  if (existente) return existente;
  const nueva = crear();
  global.__sql = nueva;
  return nueva;
}

// Contexto limitado a una exportación: todas las funciones de lectura existentes
// usan la misma transacción y no se duplican sus consultas ni normalizadores.
export type ConexionDeLectura = ReturnType<typeof postgres> | postgres.TransactionSql<Record<string, unknown>>;
const lectura = new AsyncLocalStorage<ConexionDeLectura>();

/**
 * Comparte una transacción de lectura ya abierta con los lectores E1. El
 * llamante establece aislamiento/ACL y conserva su commit o rollback; aquí
 * sólo se limita la conexión al callback, también si falla o corre en paralelo.
 */
export function conConexionDeLectura<T>(
  conexion: ConexionDeLectura,
  leer: () => Promise<T>,
): Promise<T> {
  return lectura.run(conexion, leer);
}

export async function conLecturaConsistente<T>(leer: () => Promise<T>): Promise<T> {
  return obtener().begin('isolation level repeatable read read only', async (transaccion) =>
    lectura.run(transaccion, leer),
  ) as Promise<T>;
}

/**
 * La conexión se abre en la primera consulta, no al cargar el módulo. Durante
 * `next build` se importan todas las páginas para recoger su configuración, y
 * ahí todavía no hay DATABASE_URL: si el cliente se creara aquí, compilar
 * exigiría una base de datos. Sin ella la aplicación debe enseñar
 * `SinConfigurar`, no romperse.
 */
export const sql = new Proxy(function () {} as unknown as ReturnType<typeof postgres>, {
  apply: (_destino, _this, argumentos) =>
    ((lectura.getStore() ?? obtener()) as unknown as (...a: unknown[]) => unknown)(...argumentos),
  get: (_destino, propiedad) => {
    // Nadie hace `await sql`, pero quien lo compruebe no debe abrir la conexión.
    if (propiedad === 'then') return undefined;
    return ((lectura.getStore() ?? obtener()) as unknown as Record<string | symbol, unknown>)[propiedad];
  },
}) as ReturnType<typeof postgres>;
