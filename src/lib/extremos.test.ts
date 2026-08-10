import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extremoPorCategoria } from './tipos';

/**
 * De la sección del catálogo al extremo del cable.
 *
 * Importa porque el extremo decide la holgura: una caja de conexiones de mesa
 * lleva 0,50 m y una toma de pared 0,30 m. Equivocarse aquí no da un error,
 * da unos metros de menos en el pedido.
 *
 * Las secciones son las que hay de verdad en `data/catalogo-equipos.csv`, no
 * las que convendría que hubiera.
 */
describe('el extremo que le toca a cada sección del catálogo', () => {
  it('reconoce la caja de conexiones tal y como la escribe el catálogo', () => {
    // El catálogo dice `CAJA DE CONEXIONES`, con «DE». Buscar la cadena
    // `CAJA CONEXIONES` no casaba con ninguna de las cuatro referencias.
    assert.equal(extremoPorCategoria('CAJA DE CONEXIONES'), 'caja_conexiones');
    assert.equal(extremoPorCategoria('CAJA CONEXIONES'), 'caja_conexiones');
    assert.equal(extremoPorCategoria('Caja de conexiones'), 'caja_conexiones');
  });

  it('una caja acústica es un altavoz, no una caja de mesa', () => {
    assert.equal(extremoPorCategoria('CAJA ACÚSTICA'), 'pared');
    assert.equal(extremoPorCategoria('CAJAS ACÚSTICAS'), 'pared');
  });

  it('las secciones habituales caen donde deben', () => {
    assert.equal(extremoPorCategoria('PANTALLA'), 'pantalla');
    assert.equal(extremoPorCategoria('MONITOR'), 'pantalla');
    assert.equal(extremoPorCategoria('VIDEOWALL'), 'pantalla');
    assert.equal(extremoPorCategoria('PROYECTOR'), 'proyector');
    assert.equal(extremoPorCategoria('ALTAVOZ DE TECHO'), 'techo');
    assert.equal(extremoPorCategoria('CÁMARA'), 'techo');
    assert.equal(extremoPorCategoria('PANEL TÁCTIL'), 'mesa');
    assert.equal(extremoPorCategoria('MICRÓFONO'), 'mesa');
    assert.equal(extremoPorCategoria('MATRIZ'), 'rack');
    assert.equal(extremoPorCategoria('CONTROLADORA'), 'rack');
    assert.equal(extremoPorCategoria('DSP'), 'rack');
  });

  it('lo que no se reconoce va a pared, que es la holgura más conservadora', () => {
    assert.equal(extremoPorCategoria('VIDEOCONFERENCIA'), 'pared');
    assert.equal(extremoPorCategoria(''), 'pared');
  });
});
