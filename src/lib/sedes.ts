import 'server-only';
import type postgres from 'postgres';
import { sql } from '@/lib/db';

/**
 * La sede se escribe a mano y se da de alta sola. Es el `Location` de XTEN-AV
 * —lo que permite decir que esta sala está en Madrid— y no merece una pantalla
 * de mantenimiento propia mientras solo sea un nombre.
 *
 * Vive aquí y no en un fichero de acciones porque la usan dos altas distintas
 * (sala y proyecto) y un fichero `'use server'` solo puede exportar acciones.
 */
/**
 * Da de alta la sede si hace falta y devuelve su identificador.
 *
 * Acepta una transacción porque **esto escribe**. Llamarla antes de abrir la
 * transacción de la sala creaba la sede aunque la escritura de la sala se
 * rechazara después: en una obra cerrada, mandar una sede nueva la dejaba
 * creada para siempre a cambio de nada. Dentro de la transacción, un rechazo
 * se lleva por delante también el alta de la sede.
 *
 * El orden de cerrojos no se rompe: `sedes` se escribe DESPUÉS de bloquear la
 * fila de la sala, y ninguna otra acción coge `sedes` antes que `salas`.
 */
export async function sedeId(
  nombre: string | null,
  db: postgres.TransactionSql<Record<string, unknown>> = sql as never,
): Promise<string | null> {
  if (!nombre) return null;
  const [s] = await db<Array<{ id: string }>>`
    insert into sedes (nombre) values (${nombre})
    on conflict (nombre) do update set nombre = excluded.nombre
    returning id`;
  return s.id;
}
