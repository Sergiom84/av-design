import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { mismoOrigen, permisoCatalogoTecnico } from '@/lib/catalogo-tecnico';
export { leerCuerpoTecnico } from '@/lib/catalogo-tecnico';

export async function accesoTecnico(request: Request, minimo: 'ver' | 'editar') {
  const usuario = await sesionActual();
  if (!usuario) return { error: Response.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!permisoCatalogoTecnico(usuario, minimo)) {
    return { error: Response.json({ error: 'Sin permiso para acceder al catálogo o contraseña provisional pendiente.' }, { status: 403 }) };
  }
  if (minimo === 'editar' && !mismoOrigen(request)) {
    return { error: Response.json({ error: 'El origen de la petición no está permitido.' }, { status: 403 }) };
  }
  if (!hayConfiguracion()) return { error: Response.json({ error: 'Base de datos sin configurar.' }, { status: 503 }) };
  return { usuario };
}

export function errorTecnico(error: unknown): Response {
  return Response.json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación técnica.' }, { status: 400 });
}
