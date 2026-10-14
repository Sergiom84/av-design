import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { obtenerLote, revertirLote } from '@/lib/importacion';
import { comprobarOrigen, ErrorImportacionHttp, respuestaErrorImportacion, usuarioImportacion } from '@/lib/importacion-http';

export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    comprobarOrigen(request);
    const yo = await usuarioImportacion();
    const id = (await context.params).id;
    const lote = await obtenerLote(sql, id, yo.id);
    if (!lote) throw new ErrorImportacionHttp('Lote no encontrado.', 404);
    await usuarioImportacion(lote.destino);
    const resultado = await revertirLote(sql, id, yo.id);
    revalidatePath('/catalogo', 'layout');
    revalidatePath('/articulo', 'layout');
    revalidatePath('/salas', 'layout');
    return Response.json(resultado, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
