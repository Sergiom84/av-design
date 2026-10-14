import { sql } from '@/lib/db';
import { obtenerArchivoLote, obtenerLote } from '@/lib/importacion';
import { ErrorImportacionHttp, respuestaErrorImportacion, usuarioImportacion } from '@/lib/importacion-http';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const yo = await usuarioImportacion();
    const id = (await context.params).id;
    const lote = await obtenerLote(sql, id, yo.id);
    if (!lote) throw new ErrorImportacionHttp('Lote no encontrado.', 404);
    await usuarioImportacion(lote.destino);
    const archivo = await obtenerArchivoLote(sql, id, yo.id);
    if (!archivo) throw new ErrorImportacionHttp('Archivo no encontrado.', 404);
    return new Response(Buffer.from(archivo.bytes), { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
