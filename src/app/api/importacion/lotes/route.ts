import { sql } from '@/lib/db';
import { listarLotes } from '@/lib/importacion';
import { respuestaErrorImportacion, usuarioImportacion } from '@/lib/importacion-http';
import { puede } from '@/lib/usuarios';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const yo = await usuarioImportacion();
    const lotes = await listarLotes(sql, yo.id);
    return Response.json(lotes.filter(l => l.destino === 'bom'
      ? puede(yo.permisos, 'salas', 'editar') && puede(yo.permisos, 'catalogo', 'ver')
      : puede(yo.permisos, 'catalogo', 'editar')), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
