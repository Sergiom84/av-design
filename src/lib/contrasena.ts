/**
 * Contraseñas: cómo se guardan y cómo se comprueban.
 *
 * La clave de departamento se guardaba como SHA-256 a secas y estaba bien:
 * era un secreto largo y aleatorio, y probar el diccionario contra él no lleva
 * a ningún sitio. Una contraseña que elige una persona es otra cosa. Un SHA-256
 * pelado se prueba a miles de millones por segundo en una tarjeta gráfica, y
 * media plantilla usa la misma contraseña que en otros diez sitios.
 *
 * Por eso PBKDF2-HMAC-SHA256 con 600.000 iteraciones y sal por usuario:
 * - La sal impide la tabla precalculada y hace que dos personas con la misma
 *   contraseña tengan huellas distintas.
 * - Las iteraciones ponen precio a cada intento. 600.000 es lo que recomienda
 *   OWASP para PBKDF2-SHA256 y cuesta unos cientos de milisegundos, que en un
 *   login se nota poco y en un ataque por diccionario se nota todo.
 *
 * Se usa Web Crypto y no `node:crypto` por la misma razón que en `sesion.ts`:
 * el mismo código tiene que valer en el runtime de borde. Y por eso no hay
 * dependencia nueva: `bcrypt` y `argon2` son binarios nativos, no corren en
 * borde y hay que compilarlos en el despliegue.
 *
 * El formato guardado lleva dentro el algoritmo y las iteraciones. Subir el
 * coste dentro de tres años no invalida las contraseñas de hoy: se comprueba
 * con lo que diga cada fila y se vuelve a escribir con lo nuevo al entrar.
 */

export const ITERACIONES = 600_000;

const ETIQUETA = 'pbkdf2-sha256';
const BYTES_SAL = 16;
const BYTES_HUELLA = 32;

const codificar = (s: string) => new TextEncoder().encode(s);

const aHex = (b: ArrayBuffer | Uint8Array): string =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

function deHex(hex: string): Uint8Array {
  const salida = new Uint8Array(hex.length / 2);
  for (let i = 0; i < salida.length; i += 1) {
    salida[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return salida;
}

async function derivar(
  clave: string,
  sal: Uint8Array,
  iteraciones: number,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    codificar(clave),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones },
    material,
    BYTES_HUELLA * 8,
  );
  return aHex(bits);
}

/**
 * Lo que se guarda en la columna: `pbkdf2-sha256$600000$<sal>$<huella>`.
 *
 * La contraseña en claro no se guarda, no se registra y no sale de esta
 * función.
 */
export async function cifrarClave(
  clave: string,
  iteraciones: number = ITERACIONES,
): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  const huella = await derivar(clave, sal, iteraciones);
  return `${ETIQUETA}$${iteraciones}$${aHex(sal)}$${huella}`;
}

/**
 * Comprueba una contraseña contra lo guardado.
 *
 * Un formato que no se entiende devuelve `false`, nunca lanza: una fila
 * corrupta debe dejar a esa persona fuera, no tumbar la puerta para todos.
 */
export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 4) return false;

  const [etiqueta, iteracionesTexto, salHex, huellaHex] = partes;
  if (etiqueta !== ETIQUETA) return false;

  const iteraciones = Number(iteracionesTexto);
  if (!Number.isInteger(iteraciones) || iteraciones < 1000 || iteraciones > 5_000_000) {
    return false;
  }
  if (!/^[0-9a-f]+$/.test(salHex) || salHex.length % 2 !== 0) return false;
  if (!/^[0-9a-f]+$/.test(huellaHex)) return false;

  const calculada = await derivar(clave, deHex(salHex), iteraciones);
  return igualSinFiltrar(calculada, huellaHex);
}

/**
 * Comparación en tiempo constante, igual que en `sesion.ts`. Se repite aquí en
 * vez de importarse para que este módulo no dependa de la puerta: son dos
 * cosas distintas que casualmente necesitan lo mismo.
 */
export function igualSinFiltrar(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let distinto = 0;
  for (let i = 0; i < a.length; i += 1) {
    distinto |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return distinto === 0;
}

/** Si lo guardado se derivó con menos coste del actual, conviene rehacerlo. */
export function convieneRecifrar(guardado: string): boolean {
  const iteraciones = Number(guardado.split('$')[1]);
  return !Number.isInteger(iteraciones) || iteraciones < ITERACIONES;
}

export const LARGO_MINIMO = 8;

/**
 * Qué se acepta como contraseña.
 *
 * Largo mínimo y poco más. Las reglas de «una mayúscula, un número y un
 * símbolo» producen `Verano2026!` en toda la plantilla: obligan a un patrón que
 * el atacante también conoce. Lo que sí se rechaza es la contraseña igual al
 * usuario, que es el primer intento de cualquiera.
 *
 * Devuelve el motivo o `null` si vale.
 */
export function motivoClaveInvalida(clave: string, usuario: string): string | null {
  if (clave.length < LARGO_MINIMO) {
    return `La contraseña necesita al menos ${LARGO_MINIMO} caracteres.`;
  }
  if (clave.length > 200) {
    return 'La contraseña no puede pasar de 200 caracteres.';
  }
  if (clave.trim().toLowerCase() === usuario.trim().toLowerCase()) {
    return 'La contraseña no puede ser el propio usuario.';
  }
  return null;
}

/*
  Sin i, l, 1, O, 0: la contraseña provisional se dicta por teléfono o se copia
  de un papel, y ahí esos seis caracteres son el mismo garabato.
*/
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * La contraseña provisional que el administrador entrega en mano.
 *
 * Se genera con el generador criptográfico y no con `Math.random()`: la de
 * `Math.random()` se puede predecir sabiendo la hora, y estas se crean todas
 * seguidas en la misma tarde.
 *
 * El módulo se reparte de forma desigual entre los caracteres del alfabeto, así
 * que se descartan los valores del último tramo incompleto en vez de doblarlos.
 */
export function generarClaveProvisional(largo = 12): string {
  const limite = 256 - (256 % ALFABETO.length);
  let salida = '';

  while (salida.length < largo) {
    const bytes = crypto.getRandomValues(new Uint8Array(largo * 2));
    for (const b of bytes) {
      if (b >= limite) continue;
      salida += ALFABETO[b % ALFABETO.length];
      if (salida.length === largo) break;
    }
  }
  return salida;
}
