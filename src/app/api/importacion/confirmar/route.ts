import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { confirmarImportacion } from '@/lib/importacion';
import { comprobarOrigen, destinoDelFormulario, entradaDelFormulario, ErrorImportacionHttp, formularioAcotado, respuestaErrorImportacion, seleccionDelFormulario, usuarioImportacion } from '@/lib/importacion-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    comprobarOrigen(request);
    await usuarioImportacion();
    const datos = await formularioAcotado(request);
    const yo = await usuarioImportacion(destinoDelFormulario(datos));
    const entrada = await entradaDelFormulario(datos);
    const seleccion = seleccionDelFormulario(datos);
    const previewHash = String(datos.get('previewHash') ?? '');
    if (!/^[a-f\d]{64}$/.test(previewHash)) throw new ErrorImportacionHttp('Revisa el archivo antes de confirmar.', 400);
    const fallo = process.env.NODE_ENV === 'development' && process.env.AV_IMPORTACION_PRUEBA === '1'
      ? Number(request.headers.get('x-av-prueba-fallo-importacion')) || undefined : undefined;
    const lote = await confirmarImportacion(sql, entrada, seleccion, yo.id, { previewHash, fallarDespuesDeFila: fallo });
    revalidatePath('/catalogo', 'layout');
    revalidatePath('/articulo', 'layout');
    if (entrada.salaId) revalidatePath(`/salas/${entrada.salaId}`, 'layout');
    return Response.json(lote, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
