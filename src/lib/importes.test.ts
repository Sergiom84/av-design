import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorImporte, esMoneda, parsearDecimal, formatearDecimal, dividirRedondeando,
  importeMaterialMinor, importeLaboralMinor, sumarImportesConocidos,
  precioVentaU4, importePorcentajeMinor,
} from './importes';

describe('importes exactos de imputaciones y propuestas', () => {
  it('conserva decimales y cifras que Number no representa exactamente', () => {
    assert.equal(parsearDecimal('0.10', 4), BigInt('1000'));
    assert.equal(formatearDecimal(parsearDecimal('9007199254740993.1234', 4), 4), '9007199254740993.1234');
    assert.equal(formatearDecimal(parsearDecimal('-0.0000', 4), 4), '0.0000');
    assert.equal(formatearDecimal(-BigInt('1'), 2), '-0.01');
    assert.equal(formatearDecimal(BigInt('123'), 0), '123');
  });

  it('rechaza textos ambiguos, precisión perdida y entradas desmedidas antes de convertir', () => {
    for (const texto of ['', ' 1', '1 ', '+1', '01', '.5', '1.', '1,20', '1e3', 'NaN', 'Infinity', '1.001']) {
      assert.throws(() => parsearDecimal(texto, 2), ErrorImporte, texto);
    }
    assert.throws(() => parsearDecimal('9'.repeat(100000), 2), ErrorImporte);
    assert.throws(() => parsearDecimal('9'.repeat(30), 2), ErrorImporte);
    assert.throws(() => parsearDecimal('1', -1), ErrorImporte);
    assert.throws(() => parsearDecimal('1', 1.5), ErrorImporte);
    assert.throws(() => parsearDecimal('1', 13), ErrorImporte);
    assert.throws(() => parsearDecimal(1 as unknown as string, 2), ErrorImporte);
  });

  it('redondea mitades simétricamente y no desplaza los valores inferiores', () => {
    for (const [numerador, esperado] of [[BigInt('14'), BigInt('1')], [BigInt('15'), BigInt('2')], [BigInt('16'), BigInt('2')], [-BigInt('14'), -BigInt('1')], [-BigInt('15'), -BigInt('2')], [-BigInt('16'), -BigInt('2')], [BigInt('0'), BigInt('0')]]) {
      assert.equal(dividirRedondeando(numerador, BigInt('10')), esperado);
    }
    assert.throws(() => dividirRedondeando(BigInt('1'), BigInt('0')), ErrorImporte);
    assert.throws(() => dividirRedondeando(BigInt('1'), -BigInt('1')), ErrorImporte);
    assert.equal(dividirRedondeando(BigInt('10') ** BigInt('60') - BigInt('1'), BigInt('1')), BigInt('10') ** BigInt('60') - BigInt('1'));
    assert.throws(() => dividirRedondeando(BigInt('10') ** BigInt('60'), BigInt('1')), ErrorImporte);
    assert.throws(() => dividirRedondeando(-(BigInt('10') ** BigInt('60')), BigInt('1')), ErrorImporte);
  });

  it('imputa material y minutos sin errores de coma flotante', () => {
    assert.equal(formatearDecimal(importeMaterialMinor(parsearDecimal('0.10', 4), parsearDecimal('3', 2)), 2), '0.30');
    assert.equal(formatearDecimal(importeLaboralMinor(parsearDecimal('20', 4), BigInt('90')), 2), '30.00');
    assert.equal(importeLaboralMinor(parsearDecimal('1', 4), BigInt('1')), BigInt('2'));
    assert.equal(importeMaterialMinor(parsearDecimal('0.0050', 4), parsearDecimal('1', 2)), BigInt('1'));
    assert.equal(importeMaterialMinor(BigInt('0'), parsearDecimal('10', 2)), BigInt('0'));
    assert.throws(() => importeMaterialMinor(-BigInt('1'), BigInt('100')), ErrorImporte);
    assert.throws(() => importeLaboralMinor(BigInt('1000'), -BigInt('1')), ErrorImporte);
  });

  it('cuesta una sola vez el circuito salida/sobrante/roto/baja de la misma capa', () => {
    const precio = parsearDecimal('10', 4);
    const apuntes = [
      importeMaterialMinor(precio, parsearDecimal('10', 2)),
      -importeMaterialMinor(precio, parsearDecimal('3', 2)),
      -importeMaterialMinor(precio, parsearDecimal('2', 2)),
      importeMaterialMinor(precio, parsearDecimal('2', 2)),
    ];
    assert.equal(formatearDecimal(sumarImportesConocidos(apuntes)!, 2), '70.00');
  });

  it('distingue ausencia, subtotal parcial y cero explícito', () => {
    assert.equal(sumarImportesConocidos([]), null);
    assert.equal(sumarImportesConocidos([null, null]), null);
    assert.equal(sumarImportesConocidos([null, BigInt('0')]), BigInt('0'));
    assert.equal(sumarImportesConocidos([null, BigInt('10'), -BigInt('10')]), BigInt('0'));
    assert.equal(sumarImportesConocidos([null, BigInt('10')]), BigInt('10'));
    assert.equal(esMoneda('EUR'), true);
    assert.equal(esMoneda('USD'), true);
    assert.equal(esMoneda('GBP'), false);
  });

  it('diferencia recargo de margen antes de valorar la línea', () => {
    const coste = parsearDecimal('100', 4), porcentaje = parsearDecimal('20', 4);
    assert.equal(formatearDecimal(precioVentaU4(coste, 'recargo', porcentaje), 4), '120.0000');
    assert.equal(formatearDecimal(precioVentaU4(coste, 'margen', porcentaje), 4), '125.0000');
    assert.equal(precioVentaU4(coste, 'margen', BigInt('0')), coste);
    assert.equal(precioVentaU4(BigInt('0'), 'margen', porcentaje), BigInt('0'));
    assert.throws(() => precioVentaU4(coste, 'margen', parsearDecimal('100', 4)), ErrorImporte);
    assert.throws(() => precioVentaU4(coste, 'margen', parsearDecimal('101', 4)), ErrorImporte);
    assert.throws(() => precioVentaU4(coste, 'recargo', -BigInt('1')), ErrorImporte);
  });

  it('redondea impuesto por línea conservando la política declarada', () => {
    const mitad = parsearDecimal('50', 4), iva = parsearDecimal('21', 4);
    assert.equal(importePorcentajeMinor(BigInt('1'), mitad), BigInt('1'));
    assert.equal(importePorcentajeMinor(-BigInt('1'), mitad), -BigInt('1'));
    assert.equal(importePorcentajeMinor(BigInt('12500'), iva), BigInt('2625'));
    assert.equal(importePorcentajeMinor(BigInt('0'), iva), BigInt('0'));
    assert.throws(() => importePorcentajeMinor(BigInt('100'), parsearDecimal('100.0001', 4)), ErrorImporte);
  });

  it('mantiene límites de almacenamiento incluso con productos e importes grandes', () => {
    const maximo = parsearDecimal('9'.repeat(30), 0);
    assert.equal(formatearDecimal(maximo, 0), '9'.repeat(30));
    assert.equal(sumarImportesConocidos([maximo, maximo, -maximo]), maximo);
    assert.throws(() => sumarImportesConocidos([maximo, BigInt('1')]), ErrorImporte);
    assert.throws(() => importeMaterialMinor(maximo, maximo), ErrorImporte);
    assert.throws(() => precioVentaU4(maximo, 'recargo', parsearDecimal('1', 4)), ErrorImporte);
  });
});
