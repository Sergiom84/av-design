'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  COOKIE_SESION,
  destinoSeguro,
  DURACION_SESION_S,
  firmarSesion,
  huella,
  igualSinFiltrar,
  limpiarHuella,
  limpiarSecreto,
  RUTA_ENTRADA,
} from '@/lib/sesion';

/**
 * Entrar. Se compara la huella de lo tecleado con la huella configurada: la
 * clave en claro no existe en ningún sitio del servidor.
 *
 * Un fallo no dice qué ha fallado. "Clave incorrecta" y "no hay clave puesta"
 * son la misma pantalla a propósito.
 */
export async function entrar(datos: FormData) {
  const clave = String(datos.get('clave') ?? '');
  const destino = String(datos.get('destino') ?? '/');
  // Con corchetes, no con punto: ver el comentario de src/middleware.ts.
  // Y limpiadas: una huella pegada con un salto de línea detrás no coincide
  // nunca, y desde fuera parece que la contraseña está mal.
  const configurada = limpiarHuella(process.env['CLAVE_ACCESO_HASH']);
  const secreto = limpiarSecreto(process.env['SESION_SECRETO']);

  if (!configurada || !secreto || !clave) {
    redirect(`${RUTA_ENTRADA}?error=1`);
  }

  if (!igualSinFiltrar(await huella(clave), configurada)) {
    redirect(`${RUTA_ENTRADA}?error=1`);
  }

  const expira = Date.now() + DURACION_SESION_S * 1000;
  (await cookies()).set(COOKIE_SESION, await firmarSesion(secreto, expira), {
    httpOnly: true,
    sameSite: 'lax',
    // En desarrollo se entra por http, así que exigir https dejaría fuera.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_SESION_S,
  });

  redirect(destinoSeguro(destino) as never);
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect(RUTA_ENTRADA);
}
