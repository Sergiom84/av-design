'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { sql } from '@/lib/db';
import {
  cifrarClave,
  convieneRecifrar,
  motivoClaveInvalida,
  verificarClave,
} from '@/lib/contrasena';
import {
  COOKIE_SESION,
  destinoSeguro,
  DURACION_SESION_S,
  firmarSesion,
  limpiarSecreto,
  RUTA_CUENTA,
  RUTA_ENTRADA,
} from '@/lib/sesion';
import { exigirUsuario, sesionActual } from '@/lib/sesion-servidor';
import { normalizarUsuario } from '@/lib/usuarios';

/*
  Freno de fuerza bruta.

  Es un contador en memoria, y hay que saber lo que eso significa: se reinicia
  en cada despliegue y no se comparte entre instancias. No es un control de
  acceso, es un peaje. Con 600.000 iteraciones de PBKDF2 cada intento ya cuesta
  cientos de milisegundos; esto solo evita que alguien deje un script corriendo
  toda la noche contra `xe05206`.

  Se cuenta por usuario y no por dirección IP: detrás de la red del edificio
  todos comparten IP, y bloquear por IP dejaría fuera al departamento entero
  cuando uno se equivoque.
*/
const INTENTOS_MAX = 10;
const ESPERA_MS = 5 * 60 * 1000;

const intentos = new Map<string, { fallos: number; hasta: number }>();

function frenado(usuario: string, ahora: number): boolean {
  const estado = intentos.get(usuario);
  if (!estado) return false;
  if (estado.hasta > ahora) return true;
  intentos.delete(usuario);
  return false;
}

function apuntarFallo(usuario: string, ahora: number): void {
  const estado = intentos.get(usuario) ?? { fallos: 0, hasta: 0 };
  estado.fallos += 1;
  if (estado.fallos >= INTENTOS_MAX) {
    estado.hasta = ahora + ESPERA_MS;
    estado.fallos = 0;
  }
  intentos.set(usuario, estado);
}

/*
  Una huella real contra la que comparar cuando el usuario no existe.

  Sin esto, «no existe» responde al instante y «existe con contraseña mala»
  tarda medio segundo, y con eso se averigua la plantilla del departamento
  probando códigos de empleado. Se deriva contra esta huella de mentira para
  que las dos ramas cuesten lo mismo. La contraseña que la generó no la sabe
  nadie: se cifró una cadena aleatoria y se tiró.
*/
const HUELLA_SEÑUELO =
  'pbkdf2-sha256$600000$00000000000000000000000000000000$' +
  '0000000000000000000000000000000000000000000000000000000000000000';

interface FilaEntrada {
  id: string;
  usuario: string;
  clave_hash: string;
  debe_cambiar_clave: boolean;
}

/**
 * Entrar con usuario y contraseña.
 *
 * Un fallo no dice qué ha fallado. «El usuario no existe», «la contraseña no
 * es esa» y «te hemos dado de baja» son la misma pantalla a propósito: cada
 * mensaje distinto es una pista sobre quién trabaja aquí.
 */
export async function entrar(datos: FormData) {
  const usuario = normalizarUsuario(String(datos.get('usuario') ?? ''));
  const clave = String(datos.get('clave') ?? '');
  const destino = String(datos.get('destino') ?? '/');

  const secreto = limpiarSecreto(process.env['SESION_SECRETO']);
  if (!secreto || !usuario || !clave) redirect(`${RUTA_ENTRADA}?error=1`);

  const ahora = Date.now();
  if (frenado(usuario, ahora)) redirect(`${RUTA_ENTRADA}?error=espera`);

  const filas = await sql<FilaEntrada[]>`
    select id, usuario, clave_hash, debe_cambiar_clave
      from usuarios
     where usuario = ${usuario} and activo
  `;
  const fila = filas[0];

  const vale = await verificarClave(clave, fila?.clave_hash ?? HUELLA_SEÑUELO);
  if (!fila || !vale) {
    apuntarFallo(usuario, ahora);
    redirect(`${RUTA_ENTRADA}?error=1`);
  }

  intentos.delete(usuario);

  // Si la huella se derivó con menos coste del que se usa hoy, se rehace ahora
  // que la contraseña está a mano en claro. Es el único momento en que se puede.
  if (convieneRecifrar(fila.clave_hash)) {
    const nueva = await cifrarClave(clave);
    await sql`update usuarios set clave_hash = ${nueva} where id = ${fila.id}`;
  }

  await sql`update usuarios set ultimo_acceso_en = now() where id = ${fila.id}`;

  const expira = ahora + DURACION_SESION_S * 1000;
  (await cookies()).set(COOKIE_SESION, await firmarSesion(secreto, expira, fila.id), {
    httpOnly: true,
    sameSite: 'lax',
    // En desarrollo se entra por http, así que exigir https dejaría fuera.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_SESION_S,
  });

  // Con la contraseña provisional todavía puesta no se va a ningún dato.
  if (fila.debe_cambiar_clave) redirect(RUTA_CUENTA);

  redirect(destinoSeguro(destino) as never);
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect(RUTA_ENTRADA);
}

/**
 * Cambiar la propia contraseña.
 *
 * Se pide la actual aunque la sesión ya esté abierta. No es burocracia: un
 * ordenador desbloqueado un minuto en una sala de reuniones basta para que
 * alguien cambie la contraseña de quien lo dejó abierto y se quede con la
 * cuenta.
 */
export async function cambiarMiClave(datos: FormData) {
  const yo = await exigirUsuario();
  if (yo.ficticio) redirect(`${RUTA_CUENTA}?error=desarrollo`);

  const actual = String(datos.get('actual') ?? '');
  const nueva = String(datos.get('nueva') ?? '');
  const repetida = String(datos.get('repetida') ?? '');

  const filas = await sql<{ clave_hash: string }[]>`
    select clave_hash from usuarios where id = ${yo.id} and activo
  `;
  const guardada = filas[0]?.clave_hash;
  if (!guardada || !(await verificarClave(actual, guardada))) {
    redirect(`${RUTA_CUENTA}?error=actual`);
  }

  if (nueva !== repetida) redirect(`${RUTA_CUENTA}?error=repetida`);

  const motivo = motivoClaveInvalida(nueva, yo.usuario);
  if (motivo) redirect(`${RUTA_CUENTA}?error=${encodeURIComponent(motivo)}`);

  if (await verificarClave(nueva, guardada)) {
    redirect(`${RUTA_CUENTA}?error=${encodeURIComponent('La contraseña nueva es la de antes.')}`);
  }

  await sql`
    update usuarios
       set clave_hash = ${await cifrarClave(nueva)},
           debe_cambiar_clave = false,
           clave_cambiada_en = now()
     where id = ${yo.id}
  `;

  redirect(`${RUTA_CUENTA}?hecho=1`);
}

/** Para pintar la cabecera sin repetir la consulta en cada pantalla. */
export async function quienSoy() {
  return sesionActual();
}
