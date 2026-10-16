import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { convertirLongitud, leerDimensiones, textoEnUnidad } from './longitudes';

describe('dimensiones del recinto en m/pies', () => {
  it('conserva conversión exacta y muestra el centímetro que se guarda', () => {
    assert.deepEqual(convertirLongitud('10', 'ft'), { metrosExactos: 3.048, metrosPersistidos: 3.05 });
    assert.deepEqual(convertirLongitud('3,05', 'm'), { metrosExactos: 3.05, metrosPersistidos: 3.05 });
    assert.equal(convertirLongitud('', 'ft'), null);
  });
  it('rechaza números o unidades que no se pueden guardar sin reinterpretar', () => {
    for (const [texto, unidad] of [['-1', 'm'], ['Infinity', 'ft'], ['NaN', 'm'], ['1,2,3', 'm'], ['1e3', 'm'], ['1', 'yard'], ['0.001', 'ft'], ['10000', 'm']]) {
      assert.throws(() => convertirLongitud(texto, unidad));
    }
    assert.deepEqual(convertirLongitud('0', 'm'), { metrosExactos: 0, metrosPersistidos: 0 });
  });
  it('el servidor convierte las entradas y no cree un campo canónico manipulado', () => {
    const datos = new FormData();
    datos.set('unidad_dimensiones', 'ft'); datos.set('entrada_largo', '10'); datos.set('entrada_ancho', ''); datos.set('entrada_alto', '8');
    datos.set('largo_m', '900');
    assert.deepEqual(leerDimensiones(datos), { largo_m: 3.05, ancho_m: null, alto_m: 2.44 });
    datos.set('unidad_dimensiones', 'yard'); assert.throws(() => leerDimensiones(datos));
  });
  it('la representación no redondea de nuevo los metros ni presenta ausencia como medida', () => {
    assert.equal(textoEnUnidad(null, 'ft'), '');
    assert.equal(textoEnUnidad(3.05, 'm'), '3,05');
    assert.ok(Number(textoEnUnidad(3.05, 'ft').replace(',', '.')) > 10);
  });
});

// Regresión del máximo SQL: el texto generado debe ser aceptado sin relajar el límite.
it('ida y vuelta de máximos válidos sin admitir un desbordamiento real', () => {
  for (const maximo of [9999.99, 1000]) {
    const texto = textoEnUnidad(maximo, 'ft');
    assert.equal(convertirLongitud(texto, 'ft', maximo)?.metrosPersistidos, maximo);
    assert.throws(() => convertirLongitud(String(maximo + .00001), 'm', maximo));
    assert.throws(() => convertirLongitud(String((maximo + .00001) / .3048), 'ft', maximo));
  }
});
