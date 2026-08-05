import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { expandirPatron, resumirSerie, serieDeNombres } from './nombres-serie';

describe('nombres de una serie de salas', () => {
  it('una sola sala conserva el nombre escrito', () => {
    assert.equal(expandirPatron('África 001', 1, 1), 'África 001');
  });

  it('sin almohadilla numera al final con dos cifras como mínimo', () => {
    assert.deepEqual(serieDeNombres('África', 3), [
      'África 01',
      'África 02',
      'África 03',
    ]);
  });

  it('con 144 salas el número lleva tres cifras, para que ordenen bien', () => {
    const serie = serieDeNombres('SALA TP', 144);
    assert.equal(serie[0], 'SALA TP 001');
    assert.equal(serie[143], 'SALA TP 144');
  });

  it('la almohadilla manda sobre la posición y el ancho', () => {
    assert.deepEqual(serieDeNombres('P#-Madrid', 2), ['P1-Madrid', 'P2-Madrid']);
    assert.deepEqual(serieDeNombres('P###-Madrid', 2), [
      'P001-Madrid',
      'P002-Madrid',
    ]);
  });

  it('todas las almohadillas del patrón llevan el mismo número', () => {
    assert.equal(expandirPatron('SALA ## · código ##', 7, 12), 'SALA 07 · código 07');
  });

  it('la serie se limita al máximo de copias', () => {
    assert.equal(serieDeNombres('Sala', 5000).length, 200);
    assert.equal(serieDeNombres('Sala', 0).length, 1);
  });

  it('el resumen enseña principio y final', () => {
    assert.equal(resumirSerie(['a', 'b', 'c']), 'a, b, c');
    assert.equal(resumirSerie(['a', 'b', 'c', 'd', 'e']), 'a, b … d, e');
  });
});
