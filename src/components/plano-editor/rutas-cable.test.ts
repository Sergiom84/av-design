import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { anadirPunto, borrarPunto, limitarPuntoRuta, moverPunto, rutasCambiadas } from './rutas-cable';

const base = [{ conexion_id: 'c1', puntos: [{ orden: 0, x_m: 1, y_m: 2, z_m: 3 }] }];

describe('borrador accesible de rutas de cable', () => {
  it('añade, mueve y borra sin mutar el borrador anterior', () => {
    const conAlta = anadirPunto(base, 'c1', { x_m: 4, y_m: 5, z_m: 2 });
    assert.equal(base[0].puntos.length, 1);
    assert.deepEqual(conAlta[0].puntos.map((p) => p.orden), [0, 1]);

    const movido = moverPunto(conAlta, 'c1', 0, { x_m: 1.5, y_m: 2.5, z_m: 2.7 });
    assert.deepEqual(movido[0].puntos[0], { orden: 0, x_m: 1.5, y_m: 2.5, z_m: 2.7 });

    const borrado = borrarPunto(movido, 'c1', 0);
    assert.deepEqual(borrado[0].puntos, [{ orden: 0, x_m: 4, y_m: 5, z_m: 2 }]);
  });

  it('solo incluye en el patch las conexiones realmente cambiadas', () => {
    assert.deepEqual(rutasCambiadas(base, base), []);
    const actual = moverPunto(base, 'c1', 0, { x_m: 2, y_m: 2, z_m: 3 });
    assert.deepEqual(rutasCambiadas(base, actual), actual);
  });

  it('recorta los tres ejes contra las medidas efectivas', () => {
    assert.deepEqual(
      limitarPuntoRuta({ x_m: -1, y_m: 9, z_m: 2.876 }, { largo_m: 5, ancho_m: 4, alto_m: 2.7 }),
      { x_m: 0, y_m: 4, z_m: 2.7 },
    );
  });
});
