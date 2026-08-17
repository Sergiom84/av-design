/**
 * Puerta de entrada de la aplicación.
 *
 * Antes había una sola clave para todo el departamento. Servía para lo que
 * hacía falta entonces —que no entrara quien pasara por la dirección— pero no
 * distinguía a nadie: ni quién tocó qué, ni qué puede ver cada uno. Ahora se
 * entra con usuario y contraseña, y la clave de departamento ya no existe.
 *
 * Este fichero es solo la mitad de la puerta, la que corre en el runtime de
 * borde: ahí no hay base de datos, así que aquí no se puede saber si alguien
 * sigue de alta ni qué permisos tiene. Lo único que se resuelve aquí es si la
 * cookie está firmada por este servidor y no ha caducado, y de quién dice ser.
 *
 * Quién es de verdad y qué puede ver lo resuelve `sesion-servidor.ts`
 * consultando la base en cada petición. Esa división es deliberada: un cambio
 * de rol o de permisos surte efecto en la petición siguiente, no en el login
 * siguiente. Meter los permisos dentro de la cookie los habría congelado hasta
 * que a la persona le caducara la sesión, doce horas después.
 *
 * Todo esto usa Web Crypto y no `node:crypto` a propósito: `node:crypto` no
 * existe en el runtime de borde.
 */

/** Cuánto dura la sesión. Una jornada larga: se entra por la mañana y se sale. */
export const DURACION_SESION_S = 12 * 60 * 60;

export const COOKIE_SESION = 'av_sesion';

/** A dónde se va quien no ha entrado. */
export const RUTA_ENTRADA = '/entrar';

/** Dónde cambia cada uno su propia contraseña. */
export const RUTA_CUENTA = '/cuenta';

/**
 * Rutas que no piden sesión. La de entrada, obviamente, y los recursos que
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

/**
 * Comparación en tiempo constante. Comparar con `===` filtra por cuánto tarda
 * cuántos caracteres llevas acertados, y eso permite adivinar la firma a
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

export interface Sesion {
  usuarioId: string;
  expiraEnMs: number;
}

/**
 * El contenido de la cookie: cuándo caduca, de quién es, y una firma de las dos
 * cosas juntas.
 *
 * El identificador va **dentro** de lo firmado. Si fuera aparte, cualquiera
 * podría coger su propia cookie válida y cambiar el identificador por el del
 * administrador. Firmar solo la fecha protegía la duración de la sesión, que
 * era lo único que había dentro; ahora hay una identidad y hay que firmarla.
 */
export async function firmarSesion(
  secreto: string,
  expiraEnMs: number,
  usuarioId: string,
): Promise<string> {
  const cuerpo = `${expiraEnMs}.${usuarioId}`;
  return `${cuerpo}.${await firma(secreto, cuerpo)}`;
}

/**
 * Lee la cookie y devuelve de quién es, o `null`.
 *
 * `null` cubre todos los casos —no hay cookie, está mal formada, la firma no
 * cuadra, ha caducado— y a propósito: quien la recibe no debe poder distinguir
 * «caducada» de «falsificada» para actuar distinto.
 */
export async function leerSesion(
  secreto: string,
  cookie: string | undefined,
  ahoraMs: number,
): Promise<Sesion | null> {
  if (!cookie) return null;

  const partes = cookie.split('.');
  if (partes.length !== 3) return null;

  const [expira, usuarioId, recibida] = partes;
  if (!usuarioId) return null;

  const esperada = await firma(secreto, `${expira}.${usuarioId}`);
  if (!igualSinFiltrar(recibida, esperada)) return null;

  const caducidad = Number(expira);
  if (!Number.isFinite(caducidad) || caducidad <= ahoraMs) return null;

  return { usuarioId, expiraEnMs: caducidad };
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
 * El secreto de firma solo se recorta: pasarlo a minúsculas lo cambiaría, y
 * cambiar el secreto echa a todo el mundo de golpe.
 *
 * Se recorta porque copiar un valor al portapapeles con `| clip` arrastra el
 * salto de línea final y Render lo guarda tal cual. Costó una tarde.
 */
export function limpiarSecreto(valor: string | undefined): string | undefined {
  const limpio = valor?.trim();
  return limpio ? limpio : undefined;
}

export type EstadoPuerta = 'abierta' | 'protegida' | 'sin_configurar';

/**
 * Qué hacer según lo que haya configurado.
 *
 * - `protegida`: hay secreto de firma. Lo normal en producción.
 * - `abierta`: no hay secreto y no estamos en producción. Es el desarrollo de
 *   todos los días. En ese modo `sesion-servidor.ts` devuelve un administrador
 *   ficticio, para no exigir una base sembrada con usuarios solo para abrir una
 *   página. Nunca ocurre en producción.
 * - `sin_configurar`: producción sin secreto. **No se deja pasar.** Es la única
 *   decisión defendible: un despliegue al que se le olvidó la variable es
 *   exactamente el caso en el que el inventario acaba abierto a internet.
 */
export function estadoPuerta(
  secreto: string | undefined,
  produccion: boolean,
): EstadoPuerta {
  if (secreto) return 'protegida';
  return produccion ? 'sin_configurar' : 'abierta';
}
