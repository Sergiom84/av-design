/**
 * Los parámetros dinámicos de la dirección (`/salas/[id]`, `/proyectos/[id]`,
 * `?proyecto=`) los escribe quien quiera: si llegan a una comparación con
 * columna uuid sin validar, Postgres devuelve 22P02 y la página un error 500.
 * Aquí se filtran antes de consultar; lo que no es uuid es un notFound.
 */
export function esUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
