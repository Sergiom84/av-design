import { sql } from '@/lib/db';
import { buscarPorAtributosTecnicos } from '@/lib/catalogo-tecnico-repositorio';
import { accesoTecnico, errorTecnico } from './comun';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const acceso = await accesoTecnico(request, 'ver');
  if (acceso.error) return acceso.error;
  try {
    const parametros = new URL(request.url).searchParams;
    const filtros: Record<string, string | number> = { q: parametros.get('q') ?? '' };
    for (const nombre of ['ancho_max_mm', 'alto_max_mm', 'fondo_max_mm', 'ru']) {
      if (parametros.has(nombre)) filtros[nombre] = Number(parametros.get(nombre));
    }
    const resultados = await buscarPorAtributosTecnicos(sql, acceso.usuario, filtros as {q: string});
    return Response.json(resultados, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorTecnico(error); }
}
