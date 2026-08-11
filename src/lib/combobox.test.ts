import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hayResultados,
  leerRespuesta,
  mensajeDeBusqueda,
  permiteReintentar,
  type EstadoBusqueda,
} from './combobox';

const TEXTOS = { vacio: 'Sin mobiliario que coincida', nombreColeccion: ['mueble', 'muebles'] as [string, string] };

describe('los estados del buscador remoto', () => {
  it('cargando lo dice, en vez de parecer que no hay nada', () => {
    assert.equal(mensajeDeBusqueda({ fase: 'cargando' }, TEXTOS), 'Buscando…');
  });

  it('cero resultados es una respuesta del servidor', () => {
    assert.equal(
      mensajeDeBusqueda({ fase: 'listo', resultados: 0 }, TEXTOS),
      'Sin mobiliario que coincida',
    );
  });

  it('un fallo NO se enseña como «sin coincidencias»', () => {
    const mensaje = mensajeDeBusqueda({ fase: 'error' }, TEXTOS);
    assert.doesNotMatch(mensaje, /coincida/i, 'decir que no hay es mentir: no se ha podido mirar');
    assert.match(mensaje, /no se ha podido buscar/i);
  });

  it('cuenta en singular y en plural, con el nombre de lo que lista', () => {
    assert.equal(mensajeDeBusqueda({ fase: 'listo', resultados: 1 }, TEXTOS), '1 mueble');
    assert.equal(mensajeDeBusqueda({ fase: 'listo', resultados: 7 }, TEXTOS), '7 muebles');
  });

  it('con la lista cerrada no anuncia nada', () => {
    assert.equal(mensajeDeBusqueda({ fase: 'inactivo' }, TEXTOS), '');
  });

  it('solo el error se reintenta', () => {
    const estados: EstadoBusqueda[] = [
      { fase: 'inactivo' },
      { fase: 'cargando' },
      { fase: 'listo', resultados: 0 },
      { fase: 'listo', resultados: 3 },
    ];
    for (const e of estados) assert.equal(permiteReintentar(e), false, e.fase);
    assert.equal(permiteReintentar({ fase: 'error' }), true);
  });

  it('las flechas solo recorren cuando hay algo que recorrer', () => {
    assert.equal(hayResultados({ fase: 'listo', resultados: 3 }), true);
    assert.equal(hayResultados({ fase: 'listo', resultados: 0 }), false);
    assert.equal(hayResultados({ fase: 'cargando' }), false);
    assert.equal(hayResultados({ fase: 'error' }), false);
  });
});

describe('la respuesta HTTP', () => {
  const respuesta = (estado: number, cuerpo: unknown) =>
    ({
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: async () => cuerpo,
    }) as Response;

  it('un 200 devuelve la lista', async () => {
    assert.deepEqual(await leerRespuesta(respuesta(200, [{ id: 'a' }])), [{ id: 'a' }]);
  });

  it('un 500 lanza en vez de devolver la lista vacía', async () => {
    await assert.rejects(() => leerRespuesta(respuesta(500, null)), /500/);
  });

  it('un 404 también', async () => {
    await assert.rejects(() => leerRespuesta(respuesta(404, null)), /404/);
  });
});
