import { sql } from '@/lib/db';
import { listarFavoritos } from '@/lib/catalogo-favoritos-repositorio';
import { accesoFavoritos, errorFavoritos } from './comun';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const acceso = await accesoFavoritos(request);
  if (acceso.error) return acceso.error;
  try {
    return Response.json(await listarFavoritos(sql, acceso.usuario, { q: new URL(request.url).searchParams.get('q') ?? '' }),
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorFavoritos(error); }
}
