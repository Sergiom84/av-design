import { NextResponse, type NextRequest } from 'next/server';
import {
  COOKIE_SESION,
  esRutaLibre,
  estadoPuerta,
  limpiarHuella,
  limpiarSecreto,
  RUTA_ENTRADA,
  sesionValida,
} from '@/lib/sesion';

/**
 * La puerta. Corre antes que cualquier página y antes que cualquier acción, así
 * que no hay forma de llegar a los datos sin pasar por aquí: ni por una
 * dirección adivinada ni por `/api/catalogo`.
 *
 * El criterio de quién pasa vive en `src/lib/sesion.ts`, que es lógica pura y
 * tiene pruebas. Aquí solo se lee la cookie y se redirige.
 */
export async function middleware(peticion: NextRequest) {
  const ruta = peticion.nextUrl.pathname;
  if (esRutaLibre(ruta)) return NextResponse.next();

  // Se leen con corchetes y no con punto a propósito. Con `process.env.X` el
  // compilador incrusta el valor en el código, así que cambiar la clave en el
  // servidor no cambia nada hasta que se vuelve a compilar entero. Costó una
  // tarde descubrirlo: la clave nueva no entraba y la vieja tampoco, porque la
  // aplicación seguía comparando contra la huella del despliegue anterior.
  const puerta = estadoPuerta(
    {
      huellaClave: limpiarHuella(process.env['CLAVE_ACCESO_HASH']),
      secreto: limpiarSecreto(process.env['SESION_SECRETO']),
    },
    process.env['NODE_ENV'] === 'production',
  );

  if (puerta === 'abierta') return NextResponse.next();

  // Producción sin clave configurada: no se pasa. Un despliegue al que se le
  // olvidó la variable es justo el caso en el que el inventario acaba abierto.
  if (puerta === 'sin_configurar') {
    return new NextResponse(
      'Falta configurar CLAVE_ACCESO_HASH y SESION_SECRETO en el servidor.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  const vale = await sesionValida(
    limpiarSecreto(process.env['SESION_SECRETO'])!,
    peticion.cookies.get(COOKIE_SESION)?.value,
    Date.now(),
  );
  if (vale) return NextResponse.next();

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
