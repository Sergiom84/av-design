import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
import { esUuid } from '@/lib/uuid';
import { datosTecnicosDeArticulo } from '@/lib/datos-ficha-tecnica';

export const dynamic = 'force-dynamic';

/** Hechos de una referencia. Misma guarda que los puertos; no viaja el catálogo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const yo = await sesionActual();
  if (!yo) return new Response('Sin sesión', { status: 401 });
  if (yo.debeCambiarClave || !puede(yo.permisos, 'salas', 'ver')) {
    return new Response('Sin permiso', { status: 403 });
  }
  const { id } = await params;
  if (!esUuid(id)) return new Response('Referencia inválida', { status: 400 });
  if (!hayConfiguracion()) return Response.json([]);
  return Response.json(await datosTecnicosDeArticulo(id));
}
