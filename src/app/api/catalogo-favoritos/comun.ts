import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { puedeUsarFavoritos } from '@/lib/catalogo-favoritos';
import { mismoOrigen } from '@/lib/catalogo-tecnico';

export async function accesoFavoritos(request: Request, mutacion = false) {
  const usuario = await sesionActual();
  if (!usuario) return { error: Response.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!puedeUsarFavoritos(usuario)) return { error: Response.json({ error: 'Los favoritos son personales: entra con un usuario que pueda ver el catálogo y tenga cambiada su contraseña.' }, { status: 403 }) };
  if (mutacion && !mismoOrigen(request)) return { error: Response.json({ error: 'Origen no permitido.' }, { status: 403 }) };
  if (!hayConfiguracion()) return { error: Response.json({ error: 'Base de datos sin configurar.' }, { status: 503 }) };
  return { usuario };
}
export function errorFavoritos(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación con favoritos.' }, { status: 400 });
}
