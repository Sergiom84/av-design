import type { NextRequest } from 'next/server';
import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { buscarArticulos } from '@/lib/datos';
import type { TipoArticulo } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const TIPOS: TipoArticulo[] = ['equipo', 'cable', 'consumible'];

/**
 * Lo que consulta el buscador del catálogo según se teclea. Devuelve como
 * mucho una veintena de referencias, no las novecientas: es la diferencia
 * entre una pantalla que abre en el almacén y una que no.
 *
 * Sin base de datos devuelve la lista vacía en vez de reventar, igual que
 * `SinConfigurar` en las páginas.
 */
export async function GET(request: NextRequest) {
  // El middleware ya ha comprobado que la cookie esta firmada y no ha
  // caducado, pero no que quien la trae siga de alta: alli no hay base de
  // datos. Se responde 401 y no una redireccion, porque quien llama es un
  // fetch del buscador, no un navegador que pueda seguirla.
  const yo = await sesionActual();
  if (!yo) return new Response('Sin sesion', { status: 401 });

  if (!hayConfiguracion()) return Response.json([]);

  const parametros = request.nextUrl.searchParams;
  const tipo = TIPOS.find((t) => t === parametros.get('tipo'));
  const resultados = await buscarArticulos(parametros.get('q') ?? '', tipo);

  return Response.json(resultados);
}
