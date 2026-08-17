import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { hayConfiguracion, sql } from '@/lib/db';
import {
  COOKIE_SESION,
  estadoPuerta,
  leerSesion,
  limpiarSecreto,
  RUTA_CUENTA,
  RUTA_ENTRADA,
} from '@/lib/sesion';
import {
  esAcceso,
  esRol,
  esSeccion,
  PERMISOS_POR_ROL,
  puede,
  resolverPermisos,
  type Acceso,
  type Permisos,
  type Rol,
  type Seccion,
} from '@/lib/usuarios';

/**
 * La otra mitad de la puerta: la que sí puede preguntar a la base de datos.
 *
 * `src/lib/sesion.ts` corre en el runtime de borde y solo sabe decir «esta
 * cookie la firmó este servidor y dice ser de fulano». Aquí se comprueba lo que
 * de verdad importa: que fulano siga de alta y qué puede ver **ahora**, no qué
 * podía ver cuando entró. Se consulta en cada petición a propósito. Meter el
 * rol y los permisos dentro de la cookie habría ahorrado la consulta y habría
 * dejado a alguien con permisos retirados trabajando doce horas más.
 *
 * Se envuelve en `cache()` de React: dentro de una misma petición, el layout,
 * la página y la acción comparten la respuesta y la consulta se hace una vez.
 */

export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  permisos: Permisos;
  debeCambiarClave: boolean;
  /** Cierto solo en el modo abierto de desarrollo. Nunca en producción. */
  ficticio: boolean;
}

/**
 * El administrador de desarrollo.
 *
 * Cuando no hay `SESION_SECRETO` y no estamos en producción, la puerta está
 * abierta —es como funcionaba antes y es lo que se quiere para el trabajo
 * diario—, pero las pantallas necesitan saber quién eres para decidir qué
 * enseñar. Sin esto, abrir la aplicación en local exigiría una base sembrada
 * con usuarios.
 *
 * `estadoPuerta` garantiza que este camino no existe en producción: allí, sin
 * secreto, la respuesta es 503 y no pasa nadie.
 */
const DESARROLLO: UsuarioSesion = {
  id: '00000000-0000-0000-0000-000000000000',
  usuario: 'desarrollo',
  nombre: 'Desarrollo (puerta abierta)',
  rol: 'admin',
  permisos: PERMISOS_POR_ROL.admin,
  debeCambiarClave: false,
  ficticio: true,
};

function secreto(): string | undefined {
  // Con corchetes, no con punto: ver el comentario de src/middleware.ts.
  return limpiarSecreto(process.env['SESION_SECRETO']);
}

function puertaAbierta(): boolean {
  return estadoPuerta(secreto(), process.env['NODE_ENV'] === 'production') === 'abierta';
}

interface FilaUsuario {
  id: string;
  usuario: string;
  nombre: string;
  rol: string;
  debe_cambiar_clave: boolean;
}

interface FilaPermiso {
  seccion: string;
  acceso: string;
}

/**
 * Quién está usando la aplicación ahora mismo, o `null`.
 *
 * Devuelve `null` en todos los casos de fallo sin distinguirlos: cookie
 * ausente, firma mala, sesión caducada, usuario borrado o dado de baja. Quien
 * lo llama solo tiene una respuesta posible para todos ellos, que es mandar a
 * la puerta.
 */
export const sesionActual = cache(async function sesionActual(): Promise<UsuarioSesion | null> {
  if (puertaAbierta()) return DESARROLLO;

  const llave = secreto();
  if (!llave || !hayConfiguracion()) return null;

  const cookie = (await cookies()).get(COOKIE_SESION)?.value;
  const sesion = await leerSesion(llave, cookie, Date.now());
  if (!sesion) return null;

  const filas = await sql<FilaUsuario[]>`
    select id, usuario, nombre, rol::text as rol, debe_cambiar_clave
      from usuarios
     where id = ${sesion.usuarioId} and activo
  `;
  const fila = filas[0];
  if (!fila) return null;

  // Un rol que la aplicación ya no reconoce (`av`) no se interpreta como algo
  // parecido: se trata como el mínimo. Adivinar aquí es dar permisos por
  // parecido de nombre.
  const rol: Rol = esRol(fila.rol) ? fila.rol : 'lectura';

  const excepciones = await sql<FilaPermiso[]>`
    select seccion, acceso from usuario_permisos where usuario_id = ${fila.id}
  `;

  const ajustes: Partial<Record<Seccion, Acceso>> = {};
  for (const { seccion, acceso } of excepciones) {
    if (esSeccion(seccion) && esAcceso(acceso)) ajustes[seccion] = acceso;
  }

  return {
    id: fila.id,
    usuario: fila.usuario,
    nombre: fila.nombre,
    rol,
    permisos: resolverPermisos(rol, ajustes),
    debeCambiarClave: fila.debe_cambiar_clave,
    ficticio: false,
  };
});

/** Hay sesión o se va a la puerta. */
export async function exigirUsuario(): Promise<UsuarioSesion> {
  const usuario = await sesionActual();
  if (!usuario) redirect(RUTA_ENTRADA);
  return usuario;
}

/**
 * La guarda de una sección entera. Se llama desde el `layout.tsx` de la
 * sección, no desde cada página: así una página nueva dentro de `/almacen`
 * nace protegida sin que nadie se acuerde de protegerla.
 *
 * Quien no tiene acceso va al panel, no a un 403. Un 403 le confirma que la
 * sección existe y que a él le falta permiso, y eso no ayuda a nadie: el menú
 * ya no se la enseñaba.
 */
export async function exigirSeccion(
  seccion: Seccion,
  minimo: Acceso = 'ver',
): Promise<UsuarioSesion> {
  const usuario = await exigirUsuario();

  // Con la contraseña que le puso el administrador todavía sin cambiar no se
  // llega a ningún dato. Es el único momento en que la aplicación empuja.
  if (usuario.debeCambiarClave) redirect(RUTA_CUENTA);

  if (!puede(usuario.permisos, seccion, minimo)) redirect('/');
  return usuario;
}

/**
 * Si esta persona entra a la sección sin poder escribir en ella.
 *
 * Las pantallas siguen pintando sus botones: son doscientos repartidos por
 * cuarenta ficheros y esconderlos uno a uno no protege nada —la guarda de
 * verdad está en la acción— pero sí evita el desconcierto de pulsar y que no
 * pase nada. Con esto la sección lo dice al entrar, una vez y arriba.
 */
export async function esSoloLectura(seccion: Seccion): Promise<boolean> {
  const usuario = await sesionActual();
  if (!usuario) return false;
  return (
    puede(usuario.permisos, seccion, 'ver') && !puede(usuario.permisos, seccion, 'editar')
  );
}

/**
 * Lo mismo, pero para una acción de servidor.
 *
 * Aquí no se redirige: se lanza. Una acción que redirige al panel después de
 * no hacer nada parece que ha funcionado. Y ocultar el botón no es la guarda:
 * una acción de servidor es una dirección pública a la que se puede llamar sin
 * pasar por la pantalla que la esconde.
 */
export async function exigirEdicion(seccion: Seccion): Promise<UsuarioSesion> {
  const usuario = await sesionActual();
  if (!usuario) throw new Error('No hay sesión.');
  if (usuario.debeCambiarClave) {
    throw new Error('Antes de trabajar hay que cambiar la contraseña provisional.');
  }
  if (!puede(usuario.permisos, seccion, 'editar')) {
    throw new Error(`Sin permiso para modificar ${seccion}.`);
  }
  return usuario;
}

/** Igual, pero exigiendo administrador. Solo lo usan las acciones de usuarios. */
export async function exigirAdmin(): Promise<UsuarioSesion> {
  const usuario = await exigirEdicion('usuarios');
  if (usuario.rol !== 'admin') throw new Error('Solo un administrador puede hacer esto.');
  return usuario;
}
