import { sql } from '@/lib/db';
import { previsualizarImportacion, revisarSeleccionImportacion } from '@/lib/importacion';
import { comprobarOrigen, destinoDelFormulario, entradaDelFormulario, formularioAcotado, respuestaErrorImportacion, seleccionDelFormulario, usuarioImportacion } from '@/lib/importacion-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    comprobarOrigen(request);
    await usuarioImportacion();
    const datos = await formularioAcotado(request);
    await usuarioImportacion(destinoDelFormulario(datos));
    const entrada = await entradaDelFormulario(datos);
    const preview = datos.has('seleccion') ? await revisarSeleccionImportacion(sql, entrada, seleccionDelFormulario(datos)) : await previsualizarImportacion(sql, entrada);
    return Response.json(preview, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return respuestaErrorImportacion(error); }
}
