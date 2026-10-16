import { esUuid } from '@/lib/uuid';
import { obtenerPlantillaPreview } from '@/lib/datos-plantillas';
import { errorPlantillas, ErrorPlantillas, usuarioPlantillas } from '@/lib/plantillas-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await usuarioPlantillas();
    const { id } = await params;
    if (!esUuid(id)) throw new ErrorPlantillas('Identificador de plantilla inválido.', 400);
    const datos = await obtenerPlantillaPreview(id);
    if (!datos) throw new ErrorPlantillas('La plantilla ya no existe.', 404);
    return Response.json(datos, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorPlantillas(e); }
}
