import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const CLAVE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Si aún no hay proyecto de Supabase, la app avisa en vez de romperse. */
export function hayConfiguracion(): boolean {
  return Boolean(URL_SUPABASE && CLAVE_SUPABASE);
}

export async function clienteServidor() {
  if (!hayConfiguracion()) {
    throw new Error('Falta configurar Supabase. Revisa .env.local');
  }
  const almacen = await cookies();

  return createServerClient(URL_SUPABASE, CLAVE_SUPABASE, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (nuevas) => {
        try {
          nuevas.forEach(({ name, value, options }) =>
            almacen.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: la sesión la refresca el middleware.
        }
      },
    },
  });
}
