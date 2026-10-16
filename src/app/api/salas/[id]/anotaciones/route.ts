import { sql, hayConfiguracion } from '@/lib/db';
import { obtenerAnotacionesSala } from '@/lib/datos-anotaciones';
import { sesionActual } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
import { esUuid } from '@/lib/uuid';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const yo = await sesionActual();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!yo) return Response.json({ error: 'Sin sesión.' }, { status: 401, headers });
  if (yo.debeCambiarClave || !puede(yo.permisos, 'salas', 'ver')) return Response.json({ error: 'Sin permiso para ver anotaciones.' }, { status: 403, headers });
  if (!hayConfiguracion()) return Response.json({ error: 'Base de datos sin configurar.' }, { status: 503, headers });
  const { id } = await params;
  if (!esUuid(id)) return Response.json({ error: 'Sala inválida.' }, { status: 400, headers });
  const [sala] = await sql`select id from salas where id = ${id}`;
  if (!sala) return Response.json({ error: 'Sala no encontrada.' }, { status: 404, headers });
  return Response.json(await obtenerAnotacionesSala(id), { headers });
}
