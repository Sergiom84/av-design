import 'server-only';
import { sesionActual } from './sesion-servidor';
import { hayConfiguracion } from './db';
import { puedeLeerPlantillas } from './plantilla-preview';

export class ErrorPlantillas extends Error { constructor(mensaje: string, readonly estado: number) { super(mensaje); } }
export async function usuarioPlantillas() {
  const yo = await sesionActual();
  if (!yo) throw new ErrorPlantillas('Sin sesión.', 401);
  if (!puedeLeerPlantillas(yo)) throw new ErrorPlantillas('Sin permiso para consultar plantillas.', 403);
  if (!hayConfiguracion()) throw new ErrorPlantillas('Base de datos sin configurar.', 503);
  return yo;
}
export function errorPlantillas(error: unknown) {
  return Response.json({ error: error instanceof ErrorPlantillas ? error.message : 'No se pudieron consultar las plantillas. Reinténtalo.' },
    { status: error instanceof ErrorPlantillas ? error.estado : 503, headers: { 'Cache-Control': 'no-store' } });
}
