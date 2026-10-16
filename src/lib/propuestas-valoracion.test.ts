import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularValoracion } from './propuestas/valoracion';
import { resolverVariables, validarVariables } from './propuestas/variables';
import { entrada, entradaSchema, hash, type LineaFuente, type LineaValoracion } from './propuestas/modelo';
const linea = (clave = 'a', cantidad: string | null = '1'): LineaFuente => ({ clave, articuloId: null, descripcion: 'Línea', cantidad, unidad: 'ud', detalles: [], origen: 'manual', enlace: '' });
const valor = (clave = 'a'): LineaValoracion => ({ clave, moneda: 'EUR', coste: '100', origenCoste: { tipo: 'manual', motivo: 'Previsto' }, regla: 'recargo', precio: null, motivoPrecio: null, porcentaje: '20', impuesto: { tipo: 'no_aplica', motivo: 'Decisión explícita' } });
describe('Propuestas · importes previstos exactos', () => {
    it('recargo 20 da120 y margen20 da125', () => { for (const [regla, precio] of [['recargo', '120.0000'], ['margen', '125.0000']] as const)
        assert.equal(calcularValoracion([linea()], [{ ...valor(), regla }]).lineas[0].precioUnitario, precio); });
    it('margen100,negativo,precisión excesiva y recargo excesivo fallan', () => { for (const v of [{ ...valor(), regla: 'margen' as const, porcentaje: '100' }, { ...valor(), coste: '-1' }, { ...valor(), coste: '1.00001' }, { ...valor(), porcentaje: '1001' }])
        assert.throws(() => calcularValoracion([linea()], [v])); });
    it('coste ausente no completa precio basado en coste', () => { const r = calcularValoracion([linea()], [{ ...valor(), coste: null, origenCoste: null }]); assert.equal(r.lineas[0].base, null); assert.equal(r.totales.EUR.costePrevisto.estado, 'sin_datos'); });
    it('precio directo sin coste conoce venta y no coste', () => { const r = calcularValoracion([linea()], [{ ...valor(), coste: null, origenCoste: null, regla: 'directo', precio: '5', motivoPrecio: 'Prueba directa', porcentaje: null }]); assert.equal(r.lineas[0].total, '500'); assert.equal(r.lineas[0].costePrevisto, null); });
    it('cero escrito conserva fuente y cantidad ausente no es cero', () => { const r = calcularValoracion([linea()], [{ ...valor(), coste: '0' }]); assert.equal(r.lineas[0].costePrevisto, '0'); assert.equal(calcularValoracion([linea('a', null)], [valor()]).lineas[0].base, null); });
    it('impuesto 50% de dos bases0,01 redondea0,02 por línea', () => { const v = (k: string) => ({ ...valor(k), regla: 'directo' as const, precio: '0.01', motivoPrecio: 'Prueba directa', porcentaje: null, impuesto: { tipo: 'porcentaje' as const, porcentaje: '50', etiqueta: 'Prueba', fuente: 'Manual' } }); const r = calcularValoracion([linea('a'), linea('b')], [v('a'), v('b')]); assert.equal(r.totales.EUR.base.subtotal, '2'); assert.equal(r.totales.EUR.impuesto.subtotal, '2'); assert.equal(r.totales.EUR.total.subtotal, '4'); });
    it('impuesto sin configurar deja bruto desconocido; cero explícito sí completa', () => { const v = { ...valor(), impuesto: { tipo: 'sin_configurar' as const } }; assert.equal(calcularValoracion([linea()], [v]).lineas[0].total, null); assert.equal(calcularValoracion([linea()], [{ ...v, impuesto: { tipo: 'porcentaje', porcentaje: '0', etiqueta: 'Cero', fuente: 'Manual' } }]).lineas[0].impuestoMinor, '0'); });
    it('separa monedas,subtotal parcial y suma vacía null', () => { const r = calcularValoracion([linea('a'), linea('b'), linea('c')], [valor('a'), { ...valor('b'), moneda: 'USD' }, { ...valor('c'), coste: null, origenCoste: null }]); assert.equal(r.totales.EUR.base.estado, 'parcial'); assert.equal(r.totales.USD.base.subtotal, '12000'); assert.deepEqual(calcularValoracion([], []).totales, {}); });
    it('rechaza valoración de otra línea', () => assert.throws(() => calcularValoracion([linea()], [valor('b')])));
});
describe('Propuestas · esquema textual y fuente', () => {
    it('variable ausente visible,clave desconocida o sintaxis ejecutable rechazada', () => { assert.equal(resolverVariables('Para {{destinatario.nombre}}', {}).texto, 'Para [Sin dato: destinatario.nombre]'); for (const x of ['{{importe.total}}', '{{x.y()}}', '{{sala.nombre'])
        assert.throws(() => validarVariables(x)); });
    it('hash canónico independiente del orden de claves', () => assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 })));
    it('esquema estricto impide estados comerciales o BOM arbitraria', () => { assert.throws(() => entrada(entradaSchema, { aceptada: true })); });
});
