import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EntradaPropuesta, LineaFuente } from './propuestas/modelo';
import { mismaIdentidadLinea, prepararRefresco } from './propuestas/refresco';

const linea = (clave: string, articuloId = 'articulo', unidad = 'ud'): LineaFuente => ({ clave, articuloId, descripcion: clave, cantidad: '1.00', unidad, detalles: [], origen: 'equipo', enlace: '' });
const valoracion: NonNullable<EntradaPropuesta['valoracion']>[number] = { clave: 'estable', moneda: 'EUR', coste: '100', origenCoste: { tipo: 'manual', motivo: 'Revisado' }, regla: 'margen', precio: null, motivoPrecio: null, porcentaje: '20', impuesto: { tipo: 'no_aplica', motivo: 'Caso' } };
const entrada = { incluidas: null, conceptos: [], valoracion: [valoracion] } as unknown as EntradaPropuesta;

test('refresco idéntico propone decisiones sin mutar la valoración del borrador', () => {
    const antes = structuredClone(entrada);
    const r = prepararRefresco(entrada, [linea('estable')], [linea('estable')]);
    assert.deepEqual(entrada, antes);
    assert.deepEqual(r.elegibles, ['estable']);
    assert.equal(r.entradaPreparada.valoracion![0].coste, null);
    assert.equal(r.entradaPreparada.valoracion![0].regla, 'directo');
    assert.equal(r.entradaPreparada.valoracion![0].impuesto.tipo, 'sin_configurar');
});
test('líneas nuevas o con otro artículo/unidad no heredan importes de retiradas', () => {
    for (const nueva of [linea('nueva'), linea('estable', 'otro'), linea('estable', 'articulo', 'm')]) {
        const r = prepararRefresco(entrada, [linea('estable')], [nueva]);
        assert.deepEqual(r.elegibles, []);
        assert.equal(r.entradaPreparada.valoracion![0].origenCoste, null);
        assert.equal(r.entradaPreparada.valoracion![0].porcentaje, null);
    }
    assert.equal(mismaIdentidadLinea(linea('estable'), { ...linea('estable'), cantidad: '2.00' }), true);
});
test('refresco conserva exclusiones anteriores y selecciona nuevas sin valorarlas', () => {
    const r = prepararRefresco({ ...entrada, incluidas: ['estable'] }, [linea('estable'), linea('excluida')], [linea('estable'), linea('excluida'), linea('nueva')]);
    assert.deepEqual(r.entradaPreparada.incluidas, ['estable', 'nueva']);
    assert.deepEqual(r.entradaPreparada.valoracion!.map(l => l.clave), ['estable', 'nueva']);
    assert.deepEqual(r.elegibles, ['estable']);
});
