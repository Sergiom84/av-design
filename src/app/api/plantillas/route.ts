import type { NextRequest } from 'next/server';
import { hayConfiguracion } from '@/lib/db';
import { buscarPlantillas } from '@/lib/datos';

export const dynamic = 'force-dynamic';

/**
 * Lo que consulta el selector de origen del plano: plantillas por nombre o
 * tipología, con sus recuentos para la previsualización.
 *
 * Hoy son diecisiete y cabrían enteras en el HTML, pero el selector es el
 * mismo combobox que el del catálogo y crecerán: una tipología nueva no puede
 * obligar a cambiar de mecánica.
 */
export async function GET(request: NextRequest) {
  if (!hayConfiguracion()) return Response.json([]);
  return Response.json(await buscarPlantillas(request.nextUrl.searchParams.get('q') ?? ''));
}
