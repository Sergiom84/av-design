import { sql } from '@/lib/db';
import { obtenerLote } from '@/lib/importacion';
import { ErrorImportacionHttp, respuestaErrorImportacion, usuarioImportacion } from '@/lib/importacion-http';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const yo = await usuarioImportacion();
    const lote = await obtenerLote(sql, (await context.params).id, yo.id);
    if (!lote) throw new ErrorImportacionHttp('Lote no encontrado.', 404);
    await usuarioImportacion(lote.destino);
    return Response.json(lote, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
