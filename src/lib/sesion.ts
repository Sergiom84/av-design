/**
 * Puerta de entrada de la aplicación.
 *
 * Una sola clave para todo el departamento, no un usuario por persona. Es lo
 * que corresponde hoy: la aplicación está en una dirección pública de internet
 * con el inventario real dentro, y lo que hace falta es que no entre quien pase
 * por ahí. Saber quién tocó qué es otro problema y llegará con `rol_usuario`,
 * que ya está en el esquema esperando.
 *
 * La clave NO se guarda en ningún sitio: se guarda su huella SHA-256. Ni en la
 * configuración de Render, ni en un fichero, ni aquí. Se compara huella contra
 * huella.
 *
 * Todo esto usa Web Crypto y no `node:crypto` a propósito: el middleware corre
 * en el runtime de borde, donde `node:crypto` no existe.
 */

/** Cuánto dura la sesión. Una jornada larga: se entra por la mañana y se sale. */
export const DURACION_SESION_S = 12 * 60 * 60;

export const COOKIE_SESION = 'av_sesion';

/** A dónde se va quien no ha entrado. */
export const RUTA_ENTRADA = '/entrar';

/**
 * Rutas que no piden clave. La de entrada, obviamente, y los recursos que
 * necesita para pintarse. Todo lo demás pasa por la puerta.
 */
export function esRutaLibre(ruta: string): boolean {
  return (
    ruta === RUTA_ENTRADA ||
    ruta.startsWith('/_next/') ||
    ruta === '/favicon.ico' ||
    ruta === '/robots.txt'
  );
}

/**
 * A dónde se puede devolver a alguien después de entrar.
 *
 * Solo rutas de esta aplicación. Sin esto, un enlace a
 * `/entrar?destino=https://loquesea` convertiría la propia puerta en un
 * trampolín: el técnico ve una dirección que reconoce, mete su clave y acaba
 * en otro sitio. Se cuela por `//otro.sitio`, que el navegador entiende como
 * dominio y a simple vista parece una ruta.
 */
export function destinoSeguro(destino: string | undefined): string {
  if (!destino) return '/';
  if (!destino.startsWith('/')) return '/';
  if (destino.startsWith('//')) return '/';
  // `/\otro.sitio` lo interpretan como dominio algunos navegadores.
  if (destino.startsWith('/\\')) return '/';
  return destino;
}

const codificar = (s: string) => new TextEncoder().encode(s);

const aHex = (b: ArrayBuffer): string =>
  Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

/** Huella de la clave. Es lo que se configura en el servidor, no la clave. */
export async function huella(clave: string): Promise<string> {
  return aHex(await crypto.subtle.digest('SHA-256', codificar(clave)));
}

/**
 * Comparación en tiempo constante. Comparar con `===` filtra por cuánto tarda
 * cuántos caracteres llevas acertados, y eso permite adivinar la clave a
 * ciegas. Cuesta cuatro líneas evitarlo.
 */
export function igualSinFiltrar(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let distinto = 0;
  for (let i = 0; i < a.length; i += 1) {
    distinto |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return distinto === 0;
}

/**
 * El contenido de la cookie: cuándo caduca y una firma de esa fecha.
 *
 * Se firma con el secreto del servidor, así que nadie puede fabricarse una
 * cookie con la fecha que le convenga. Y como la fecha va dentro de lo firmado,
 * tampoco puede estirar una sesión caducada.
 */
export async function firmarSesion(
  secreto: string,
  expiraEnMs: number,
): Promise<string> {
  return `${expiraEnMs}.${await firma(secreto, String(expiraEnMs))}`;
}

export async function sesionValida(
  secreto: string,
  cookie: string | undefined,
  ahoraMs: number,
): Promise<boolean> {
  if (!cookie) return false;

  const corte = cookie.indexOf('.');
  if (corte <= 0) return false;

  const expira = cookie.slice(0, corte);
  const recibida = cookie.slice(corte + 1);

  const esperada = await firma(secreto, expira);
  if (!igualSinFiltrar(recibida, esperada)) return false;

  const caducidad = Number(expira);
  return Number.isFinite(caducidad) && caducidad > ahoraMs;
}

async function firma(secreto: string, mensaje: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    'raw',
    codificar(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return aHex(await crypto.subtle.sign('HMAC', llave, codificar(mensaje)));
}

/**
 * Limpia lo que llega de la configuración del servidor.
 *
 * Copiar una huella al portapapeles con `| clip` arrastra el salto de línea
 * final, y Render lo guarda tal cual: 65 caracteres en vez de 64, y la clave
 * correcta deja de entrar sin que nada explique por qué. Costó una tarde.
 *
 * Se recorta y se pasa a minúsculas porque una huella es hexadecimal: `3F` y
 * `3f` son el mismo valor, y quien la pega de un sitio a otro no tiene por qué
 * saberlo.
 */
export function limpiarHuella(valor: string | undefined): string | undefined {
  const limpio = valor?.trim().toLowerCase();
  return limpio ? limpio : undefined;
}

/**
 * El secreto de firma solo se recorta: pasarlo a minúsculas lo cambiaría, y
 * cambiar el secreto echa a todo el mundo de golpe.
 */
export function limpiarSecreto(valor: string | undefined): string | undefined {
  const limpio = valor?.trim();
  return limpio ? limpio : undefined;
}

export interface Configuracion {
  huellaClave: string | undefined;
  secreto: string | undefined;
}

export type EstadoPuerta = 'abierta' | 'protegida' | 'sin_configurar';

/**
 * Qué hacer según lo que haya configurado.
 *
 * - `protegida`: hay clave y secreto. Lo normal en producción.
 * - `abierta`: no hay nada configurado y no estamos en producción. Es el
 *   desarrollo de todos los días, y pedir clave ahí solo estorba.
 * - `sin_configurar`: producción sin clave. **No se deja pasar.** Es la única
 *   decisión defendible: un despliegue al que se le olvidó la variable es
 *   exactamente el caso en el que el inventario acaba abierto a internet.
 */
export function estadoPuerta(
  { huellaClave, secreto }: Configuracion,
  produccion: boolean,
): EstadoPuerta {
  if (huellaClave && secreto) return 'protegida';
  return produccion ? 'sin_configurar' : 'abierta';
}
