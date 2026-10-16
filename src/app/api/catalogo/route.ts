import type { NextRequest } from 'next/server';
import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { buscarArticulos } from '@/lib/datos';
import type { TipoArticulo } from '@/lib/tipos';
import { puede } from '@/lib/usuarios';

export const dynamic = 'force-dynamic';

const TIPOS: TipoArticulo[] = ['equipo', 'cable', 'consumible'];

/**
 * Lo que consulta el buscador del catálogo según se teclea. Devuelve como
 * mucho una veintena de referencias, no las novecientas: es la diferencia
 * entre una pantalla que abre en el almacén y una que no.
 *
 * La autorización actual se resuelve antes de consultar referencias. Un fallo
 * de servicio se distingue de una búsqueda correcta sin coincidencias.
 */
export async function GET(request: NextRequest) {
  const respuesta = (datos: unknown, status = 200) => Response.json(datos, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  try {
    const yo = await sesionActual();
    if (!yo) return respuesta({ error: 'Inicia sesión para consultar el catálogo.' }, 401);
    if (yo.debeCambiarClave || !puede(yo.permisos, 'catalogo', 'ver')) {
      return respuesta({ error: 'No tienes permiso para consultar el catálogo.' }, 403);
    }
    if (!hayConfiguracion()) return respuesta({ error: 'El catálogo no está disponible.' }, 503);

    const parametros = request.nextUrl.searchParams;
    const tipo = TIPOS.find((t) => t === parametros.get('tipo'));
    return respuesta(await buscarArticulos(parametros.get('q') ?? '', tipo));
  } catch {
    return respuesta({ error: 'El catálogo no está disponible.' }, 503);
  }
}
