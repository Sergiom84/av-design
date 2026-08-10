import type { NextRequest } from 'next/server';
import { hayConfiguracion } from '@/lib/db';
import { buscarMobiliario } from '@/lib/datos';

export const dynamic = 'force-dynamic';

/**
 * Lo que consulta el buscador de mobiliario del editor del plano.
 *
 * Es una ruta aparte de `/api/catalogo` y no un parámetro suyo porque son dos
 * catálogos distintos: teclear «mesa» buscando un mueble no puede devolver un
 * soporte de pantalla, ni teclear «silla» buscando equipamiento devolver nada
 * del catálogo AV. La separación empieza en la base de datos y llega hasta
 * aquí.
 *
 * Sin base de datos devuelve la lista vacía en vez de reventar, igual que
 * `SinConfigurar` en las páginas.
 */
export async function GET(request: NextRequest) {
  if (!hayConfiguracion()) return Response.json([]);

  const parametros = request.nextUrl.searchParams;
  const categoria = parametros.get('categoria')?.trim();

  const resultados = await buscarMobiliario(
    parametros.get('q') ?? '',
    categoria || undefined,
  );

  return Response.json(resultados);
}
