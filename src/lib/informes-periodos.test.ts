import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaCivil, instantesMadrid, resolverPeriodo } from './informes/periodos';
import { proximasOcurrencias, validarCalendario } from './informes/calendario';
import { configuracionSchema, entrada, serializarCanonico } from './informes/modelo';
for (const [dia, horas] of [['2026-03-29', 23], ['2026-10-25', 25], ['2026-01-01', 24]] as const)
    test(`rango civil ${dia}: ${horas} horas`, () => {
        const p = resolverPeriodo({ modo: 'rango', desde: dia, hasta: dia }, new Date());
        assert.equal(p.modo, 'rango');
        if (p.modo === 'rango')
            assert.equal((+new Date(p.hastaUtcExclusivo) - +new Date(p.desdeUtc)) / 3600000, horas);
    });
test('primavera omite y otoño usa primera aparición', () => {
    assert.deepEqual(instantesMadrid('2026-03-29', '02:30'), []);
    assert.deepEqual(instantesMadrid('2026-10-25', '02:30').map(f => f.toISOString()), ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
    const p = proximasOcurrencias({ frecuencia: 'diaria', inicio: '2026-03-29', fin: null, hora: '02:30' }, new Date('2026-03-28T23:00Z'), 2);
    assert.equal(p.ocurrencias[0].utc, '2026-03-30T00:30:00.000Z');
    assert.equal(p.omisiones.length, 1);
    const o = proximasOcurrencias({ frecuencia: 'diaria', inicio: '2026-10-25', fin: null, hora: '02:30' }, new Date('2026-10-24T22:00Z'), 2);
    assert.equal(o.ocurrencias[0].utc, '2026-10-25T00:30:00.000Z');
    assert.equal(o.ocurrencias[1].utc, '2026-10-26T01:30:00.000Z');
});
for (const invalida of ['', '0', '2026-02-31', '2026-13-01', '2025-02-29'])
    test(`rechaza fecha ${JSON.stringify(invalida)}`, () => assert.throws(() => fechaCivil(invalida)));
test('mes y semana anteriores cruzan año según ocurrencia prevista', () => {
    const fecha = new Date('2026-01-01T12:00Z');
    const p = resolverPeriodo({ modo: 'relativo', intervalo: 'mes_anterior' }, fecha);
    assert.equal(p.modo, 'rango');
    if (p.modo === 'rango') {
        assert.equal(p.desde, '2025-12-01');
        assert.equal(p.hasta, '2025-12-31');
    }
    const w = resolverPeriodo({ modo: 'relativo', intervalo: 'semana_anterior' }, fecha);
    if (w.modo === 'rango') {
        assert.equal(w.desde, '2025-12-22');
        assert.equal(w.hasta, '2025-12-28');
    }
});
test('rango inverso y mayor de 366 días se rechazan', () => {
    assert.throws(() => resolverPeriodo({ modo: 'rango', desde: '2026-02-01', hasta: '2026-01-31' }, new Date()));
    assert.throws(() => resolverPeriodo({ modo: 'rango', desde: '2025-01-01', hasta: '2026-01-02' }, new Date()));
});
test('calendario una vez exige futuro y omisión no tiene ocurrencia', () => {
    assert.throws(() => validarCalendario({ frecuencia: 'una_vez', inicio: '2026-03-29', fin: null, hora: '02:30' }, new Date('2026-03-28T00:00Z')));
    assert.throws(() => validarCalendario({ frecuencia: 'una_vez', inicio: '2026-01-01', fin: null, hora: '12:00' }, new Date('2026-02-01T00:00Z')));
});
const c = { versionModelo: 1, versionRegistro: 1, clave: 'estado_actual', ambito: { tipo: 'sala', id: 'd3000000-0000-4000-8000-000000000001' }, periodo: { modo: 'actual' }, formatos: ['csv'], audiencia: { usuarios: [], grupos: [] } };
test('configuración estricta sin propietario, SQL, formatos repetidos ni pasado actual', () => {
    assert.doesNotThrow(() => entrada(configuracionSchema, c));
    for (const cambio of [{ propietario: 'otro' }, { sql: 'select 1' }, { formatos: ['csv', 'csv'] }, { periodo: { modo: 'rango', desde: '2026-01-01', hasta: '2026-01-02' } }, { versionRegistro: 2 }])
        assert.throws(() => entrada(configuracionSchema, { ...c, ...cambio }));
});
test('serialización estable, null y cero conservados y números finitos', () => {
    assert.equal(serializarCanonico({ z: 0, a: null }), '{"a":null,"z":0}');
    assert.equal(serializarCanonico({ b: 1, a: 2 }), serializarCanonico({ a: 2, b: 1 }));
    assert.throws(() => serializarCanonico({ a: Infinity }));
});
