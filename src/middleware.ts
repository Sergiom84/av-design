import { NextResponse, type NextRequest } from 'next/server';
import {
  COOKIE_SESION,
  esRutaLibre,
  estadoPuerta,
  leerSesion,
  limpiarSecreto,
  RUTA_ENTRADA,
} from '@/lib/sesion';

/**
 * La puerta. Corre antes que cualquier página y antes que cualquier acción, así
 * que no hay forma de llegar a los datos sin pasar por aquí: ni por una
 * dirección adivinada ni por `/api/catalogo`.
 *
 * Aquí solo se comprueba que **hay** sesión firmada y sin caducar. Quién es y
 * qué puede ver se resuelve en `src/lib/sesion-servidor.ts`, que sí puede
 * consultar la base: esto corre en el runtime de borde y allí no hay Postgres.
 * Que sean dos capas no es una duplicidad, es la única división posible.
 */
export async function middleware(peticion: NextRequest) {
  const ruta = peticion.nextUrl.pathname;
  if (esRutaLibre(ruta)) return NextResponse.next();

  // Se lee con corchetes y no con punto a propósito. Con `process.env.X` el
  // compilador incrusta el valor en el código, así que cambiar el secreto en el
  // servidor no cambia nada hasta que se vuelve a compilar entero. Costó una
  // tarde descubrirlo con la clave de departamento.
  const secreto = limpiarSecreto(process.env['SESION_SECRETO']);
  const puerta = estadoPuerta(secreto, process.env['NODE_ENV'] === 'production');

  if (puerta === 'abierta') return NextResponse.next();

  // Producción sin secreto configurado: no se pasa. Un despliegue al que se le
  // olvidó la variable es justo el caso en el que el inventario acaba abierto.
  if (puerta === 'sin_configurar') {
    return new NextResponse(
      'Falta configurar SESION_SECRETO en el servidor.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  const sesion = await leerSesion(
    secreto!,
    peticion.cookies.get(COOKIE_SESION)?.value,
    Date.now(),
  );
  if (sesion) return NextResponse.next();

  // A dónde iba, para devolverlo ahí después de entrar. Solo rutas de esta
  // aplicación: un destino con dominio propio convertiría la entrada en un
  // trampolín para mandar a la gente a cualquier sitio.
  const destino = `${ruta}${peticion.nextUrl.search}`;
  const entrada = new URL(RUTA_ENTRADA, peticion.nextUrl.origin);
  if (ruta !== '/') entrada.searchParams.set('destino', destino);

  return NextResponse.redirect(entrada);
}

export const config = {
  // Todo menos los recursos estáticos. `esRutaLibre` vuelve a filtrar: esto es
  // para no ejecutar el middleware de más, no para decidir quién pasa.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
