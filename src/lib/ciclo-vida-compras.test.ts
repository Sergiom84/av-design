import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumirComprasCiclo, type LineaCompraCiclo } from './ciclo-vida-compras';
const linea: LineaCompraCiclo = { id: 'a', pedido_id: 'p', referencia: 'P', articulo: 'HDMI', unidad: 'ud', cantidad: 10, cantidad_recibida: 1, recibida_trazada: 1, comprado_en: '2026-09-08' };
test('una recepción parcial nunca completa la recepción', () => {
  assert.equal(resumirComprasCiclo([linea]).recepcion, 'parcial');
  assert.equal(resumirComprasCiclo([{ ...linea, cantidad_recibida: 10 }]).recepcion, 'parcial');
  assert.equal(resumirComprasCiclo([{ ...linea, cantidad_recibida: 10, recibida_trazada: 10 }]).recepcion, 'total');
});
test('históricos sin FK y ausencia de pedidos no acreditan recepción', () => {
  assert.equal(resumirComprasCiclo([{ ...linea, recibida_trazada: 0 }]).recepcion, 'sin_acreditar');
  assert.equal(resumirComprasCiclo([]).recepcion, 'sin_datos');
  assert.equal(resumirComprasCiclo([linea], false).recepcion, 'sin_datos');
});
test('compra completa solo cuando todas las líneas están compradas', () => {
  assert.equal(resumirComprasCiclo([linea]).compra, 'total');
  assert.equal(resumirComprasCiclo([linea, { ...linea, comprado_en: null }]).compra, 'parcial');
  assert.equal(resumirComprasCiclo([{ ...linea, comprado_en: null }]).compra, 'pendiente');
});
