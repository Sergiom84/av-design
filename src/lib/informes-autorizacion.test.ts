import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autorizarAmbitoInforme, exigirDistribucion, identidadActual, type IdentidadInforme, type ConexionInformes } from './informes/autorizacion';
import { REGISTRO_INFORMES, seccionesInforme } from './informes/registro';
import { errorSeguro, CLAVES } from './informes/modelo';
import { resolverPermisos } from './usuarios';
const u: IdentidadInforme = { id: 'd3000000-0000-4000-8000-000000000001', usuario: 'prueba', nombre: 'Prueba', rol: 'tecnico_avanzado', activo: true, provisional: false, permisos: resolverPermisos('tecnico_avanzado') };
for (const clave of CLAVES) {
    for (const tipo of ['sala', 'obra', 'sede'] as const) {
        test(`${clave}/${tipo} exige cada fuente declarada antes de leer`, () => {
            const ambito = { tipo, id: u.id };
            assert.doesNotThrow(() => autorizarAmbitoInforme(u, { clave, ambito }));
            for (const seccion of seccionesInforme(clave, ambito))
                assert.throws(() => autorizarAmbitoInforme({ ...u, permisos: { ...u.permisos, [seccion]: 'oculto' } }, { clave, ambito }), { status: 403 });
        });
    }
}
test('estado y hechos de carga no exigen catálogo, almacén, compras ni parámetros', () => {
    assert.deepEqual(REGISTRO_INFORMES.estado_actual.secciones, ['salas']);
    assert.deepEqual(REGISTRO_INFORMES.carga_hechos.secciones, ['carga', 'salas']);
});
test('distribución exige administrador, incluso con editar usuarios por excepción', () => {
    assert.throws(() => exigirDistribucion({ ...u, permisos: { ...u.permisos, usuarios: 'editar' } }), { status: 403 });
});
test('inactivo, provisional y ficticio no se autorizan', () => {
    for (const cambio of [{ activo: false }, { provisional: true }, { id: '00000000-0000-0000-0000-000000000000' }])
        assert.throws(() => autorizarAmbitoInforme({ ...u, ...cambio }, { clave: 'estado_actual', ambito: { tipo: 'sala', id: u.id } }), { status: 403 });
});
test('infraestructura de identidad no se disfraza de permiso retirado', async () => {
    const conexion = (async () => {
        throw new Error('Detalle SQL secreto');
    }) as unknown as ConexionInformes;
    try {
        await identidadActual(conexion, u.id);
        assert.fail('Debe fallar');
    }
    catch (error) {
        const seguro = errorSeguro(error);
        assert.equal(seguro.status, 503);
        assert.equal(seguro.codigo, 'FUENTE_NO_DISPONIBLE');
        assert.ok(!seguro.message.includes('SQL'));
    }
});
