/**
 * Cada pestaña de la ficha tiene ruta, y cada ruta tiene pestaña.
 *
 * `next build` con `typedRoutes` caza el enlace a una ruta que no existe, pero
 * no caza lo contrario: una ruta que existe y a la que no lleva ninguna
 * pestaña es una pantalla inalcanzable salvo tecleando la dirección. Eso pasó
 * al partir la antigua pestaña `Diagrama` en `Plano` y `Diagrama`, y no lo vio
 * ni el compilador ni la suite.
 *
 * La comprobación barre el árbol de verdad: lee los directorios que hay bajo
 * `src/app/salas/[id]/` y exige que el barrido encuentre algo antes de
 * comparar. Una guarda que recorre una lista escrita a mano, o que aprueba
 * porque no encontró ficheros, es peor que no tener guarda: convierte un fallo
 * vivo en una casilla marcada.
 */

import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { PESTANAS } from '@/components/sala/lista-pestanas';

const FICHA = fileURLToPath(new URL('../app/salas/[id]/', import.meta.url));
const BARRA = fileURLToPath(new URL('../components/sala/pestanas.tsx', import.meta.url));

/** Los segmentos que de verdad tienen página bajo `salas/[id]/`. */
function segmentosConRuta(): string[] {
  const entradas = readdirSync(FICHA, { withFileTypes: true });
  assert.ok(
    entradas.length > 0,
    'el barrido no encontró nada bajo src/app/salas/[id]/: la ruta de la guarda está mal',
  );
  return entradas
    .filter((e) => e.isDirectory() && existsSync(`${FICHA}${e.name}/page.tsx`))
    .map((e) => e.name)
    .sort();
}

describe('las pestañas de la ficha de sala', () => {
  it('barre el árbol y encuentra páginas', () => {
    assert.ok(
      segmentosConRuta().length > 0,
      'ninguna subruta de la ficha tiene page.tsx: el barrido no está mirando donde cree',
    );
  });

  it('la pestaña Resumen es la raíz de la ficha, sin segmento', () => {
    assert.equal(PESTANAS[0].segmento, null);
    assert.ok(existsSync(`${FICHA}page.tsx`), 'falta la página raíz de la ficha');
  });

  it('cada pestaña con segmento apunta a una ruta que existe', () => {
    const rutas = new Set(segmentosConRuta());
    for (const { segmento, etiqueta } of PESTANAS) {
      if (segmento === null) continue;
      assert.ok(
        rutas.has(segmento),
        `la pestaña «${etiqueta}» apunta a /${segmento}, que no tiene page.tsx`,
      );
    }
  });

  it('ninguna ruta de la ficha se queda sin pestaña que lleve a ella', () => {
    const enBarra = new Set<string>(
      PESTANAS.map((p) => p.segmento).filter((s) => s !== null),
    );
    for (const segmento of segmentosConRuta()) {
      assert.ok(
        enBarra.has(segmento),
        `/${segmento} existe pero ninguna pestaña lleva a ella: es una pantalla inalcanzable`,
      );
    }
  });

  it('Plano y Diagrama son pestañas distintas, y Acotaciones existe', () => {
    const segmentos = PESTANAS.map((p) => p.segmento);
    assert.ok(segmentos.includes('plano'), 'la posición física necesita su propia pestaña');
    assert.ok(segmentos.includes('diagrama'), 'el editor de conexiones necesita su pestaña');
    assert.ok(segmentos.includes('acotaciones'), 'falta la pestaña de acotaciones');
  });

  it('no lleva la activa a la vista con desplazamiento suave', () => {
    // Esto no mide píxeles: mide se puede medir en el navegador y allí se
    // midió. Lo que fija aquí es la decisión que salió de esa medida. Con
    // `behavior: 'smooth'` la barra no se movía ni un píxel —el navegador
    // ignoraba la petición y la pestaña activa se quedaba fuera de la vista
    // sin ningún aviso— y con `auto` se coloca. Volver a poner `smooth` deja
    // la barra rota otra vez, y sin esta línea no lo caza nadie.
    const fuente = readFileSync(BARRA, 'utf8');
    assert.ok(
      fuente.includes('scrollIntoView'),
      'la barra ya no lleva la activa a la vista: esta guarda está mirando el fichero equivocado',
    );
    assert.ok(
      !/behavior:\s*(['"])smooth\1/.test(fuente),
      'la barra volvió a pedir desplazamiento suave, que en el navegador no movía nada',
    );
  });

  it('no hay etiquetas ni segmentos repetidos', () => {
    const etiquetas = PESTANAS.map((p) => p.etiqueta);
    assert.equal(new Set(etiquetas).size, etiquetas.length, 'dos pestañas con el mismo nombre');
    const segmentos = PESTANAS.map((p) => p.segmento);
    assert.equal(new Set(segmentos).size, segmentos.length, 'dos pestañas con el mismo segmento');
  });
});
