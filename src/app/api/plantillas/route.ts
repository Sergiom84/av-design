import type { NextRequest } from 'next/server';
import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
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
  // El middleware ya ha comprobado que la cookie esta firmada y no ha
  // caducado, pero no que quien la trae siga de alta: alli no hay base de
  // datos. Se responde 401 y no una redireccion, porque quien llama es un
  // fetch del buscador, no un navegador que pueda seguirla.
  const yo = await sesionActual();
  if (!yo) return new Response('Sin sesion', { status: 401 });

  if (!hayConfiguracion()) return Response.json([]);
  return Response.json(await buscarPlantillas(request.nextUrl.searchParams.get('q') ?? ''));
}
