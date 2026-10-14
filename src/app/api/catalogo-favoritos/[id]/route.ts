import { sql } from '@/lib/db';
import { esArticuloFavorito, guardarFavorito } from '@/lib/catalogo-favoritos-repositorio';
import { leerCuerpoTecnico } from '@/lib/catalogo-tecnico';
import { accesoFavoritos, errorFavoritos } from '../comun';

export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{id: string}> };
export async function GET(request: Request, contexto: Contexto) {
  const acceso = await accesoFavoritos(request);
  if (acceso.error) return acceso.error;
  try {
    return Response.json({ favorito: await esArticuloFavorito(sql, acceso.usuario, (await contexto.params).id) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorFavoritos(error); }
}
export async function PUT(request: Request, contexto: Contexto) {
  const acceso = await accesoFavoritos(request, true);
  if (acceso.error) return acceso.error;
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Se requiere JSON.');
    const cuerpo = await leerCuerpoTecnico(request, 1024);
    await guardarFavorito(sql, acceso.usuario, (await contexto.params).id, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(cuerpo)));
    return Response.json({ guardado: true });
  } catch (error) { return errorFavoritos(error); }
}
