import { hayConfiguracion, sql } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
import { esUuid } from '@/lib/uuid';
import type { Puerto } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const yo = await sesionActual();
  if (!yo) return new Response('Sin sesión', { status: 401 });
  if (yo.debeCambiarClave || !puede(yo.permisos, 'salas', 'ver')) {
    return new Response('Sin permiso', { status: 403 });
  }
  const { id } = await params;
  if (!esUuid(id)) return new Response('Referencia inválida', { status: 400 });
  if (!hayConfiguracion()) return Response.json([]);
  const puertos = await sql<Puerto[]>`select p.* from puertos p
    join articulos a on a.id = p.articulo_id
    where a.id = ${id} and a.activo and a.tipo = 'equipo'
    order by p.orden nulls last, p.nombre, p.id`;
  return Response.json(puertos);
}
