import 'server-only';
import { sql } from '@/lib/db';

/**
 * La sede se escribe a mano y se da de alta sola. Es el `Location` de XTEN-AV
 * —lo que permite decir que esta sala está en Madrid— y no merece una pantalla
 * de mantenimiento propia mientras solo sea un nombre.
 *
 * Vive aquí y no en un fichero de acciones porque la usan dos altas distintas
 * (sala y proyecto) y un fichero `'use server'` solo puede exportar acciones.
 */
export async function sedeId(nombre: string | null): Promise<string | null> {
  if (!nombre) return null;
  const [s] = await sql<Array<{ id: string }>>`
    insert into sedes (nombre) values (${nombre})
    on conflict (nombre) do update set nombre = excluded.nombre
    returning id`;
  return s.id;
}
