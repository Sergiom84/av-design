import 'server-only';
import postgres from 'postgres';

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
    // Supabase exige TLS; el contenedor local no lo tiene.
    ssl: URL_BD.includes('localhost') || URL_BD.includes('127.0.0.1') ? false : 'require',
    transform: { undefined: null },
  });
}

/** En desarrollo se reutiliza la conexión entre recargas en caliente. */
export const sql = global.__sql ?? crear();
if (process.env.NODE_ENV !== 'production') global.__sql = sql;
