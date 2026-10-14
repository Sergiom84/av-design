import { sql } from '@/lib/db';
import { previsualizarImportacion } from '@/lib/importacion';
import { comprobarOrigen, destinoDelFormulario, entradaDelFormulario, formularioAcotado, respuestaErrorImportacion, usuarioImportacion } from '@/lib/importacion-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    comprobarOrigen(request);
    await usuarioImportacion();
    const datos = await formularioAcotado(request);
    await usuarioImportacion(destinoDelFormulario(datos));
    const entrada = await entradaDelFormulario(datos);
    return Response.json(await previsualizarImportacion(sql, entrada), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
