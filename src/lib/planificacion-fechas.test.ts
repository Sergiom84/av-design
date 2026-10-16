import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { instanteLocal, rangoMadrid } from './planificacion/fechas';
import { resumirAgenda } from './planificacion/agenda';
describe('Planificación: fechas Madrid y ocupación sin doble cómputo', () => {
    it('rechaza primavera inexistente y exige elegir cada alternativa de otoño', () => {
        assert.throws(() => instanteLocal({ fecha: '2026-03-29', hora: '02:30' }), /no existe/);
        assert.throws(() => instanteLocal({ fecha: '2026-10-25', hora: '02:30' }), /ambigua/);
        assert.equal(instanteLocal({ fecha: '2026-10-25', hora: '02:30', offset: '+02:00' }), '2026-10-25T00:30:00.000Z');
        assert.equal(instanteLocal({ fecha: '2026-10-25', hora: '02:30', offset: '+01:00' }), '2026-10-25T01:30:00.000Z');
    });
    it('día civil conserva sus23/25horas reales', () => {
        for (const [dia, horas] of [['2026-03-29', 23], ['2026-10-25', 25]] as const) {
            const r = rangoMadrid(dia, dia);
            assert.equal((+new Date(r.fin) - +new Date(r.inicio)) / 3600000, horas);
        }
    });
    it('unión09–11 y10–12 ocupa180min; una tarea compartida cuenta una vez', () => {
        const base = { planId: 'p', proyectoId: 'o', proyectoNombre: 'Obra', salaId: null, salaNombre: null, descripcion: '', notas: '', estado: 'pendiente' as const, venceFecha: null, duracionEstimadaMin: null, version: 0, tecnicos: [{ id: 'a', nombre: 'A', activo: true }], archivado: false };
        const tareas = [{ ...base, id: '1', titulo: 'Uno', inicio: '2026-10-15T07:00:00Z', fin: '2026-10-15T09:00:00Z' }, { ...base, id: '2', titulo: 'Dos', inicio: '2026-10-15T08:00:00Z', fin: '2026-10-15T10:00:00Z', tecnicos: [...base.tecnicos, { id: 'b', nombre: 'B', activo: true }] }];
        const r = resumirAgenda(tareas, { vista: 'hoy' }, new Date('2026-10-15T12:00:00Z'));
        assert.equal(r.contadores.hoy, 2);
        assert.equal(r.ocupacion.find(t => t.tecnicoId === 'a')?.minutos, 180);
        assert.equal(r.ocupacion.find(t => t.tecnicoId === 'b')?.minutos, 120);
        assert.equal(r.estimacion.sinEstimar, 2);
    });
});

it('el rango personalizado recorta ocupación y conserva las cuatro vistas y el historial', () => {
    const tareas = [{ id: 't', planId: 'p', proyectoId: 'o', proyectoNombre: 'Obra', salaId: null, salaNombre: null, titulo: 'Hoy', descripcion: '', notas: '', estado: 'pendiente' as const, venceFecha: null, duracionEstimadaMin: null, version: 0, tecnicos: [{ id: 'a', nombre: 'A', activo: true }], archivado: false, inicio: '2026-10-15T07:00:00Z', fin: '2026-10-15T09:00:00Z' }];
    const ahora = new Date('2026-10-15T12:00:00Z');
    const normal = resumirAgenda(tareas, { vista: 'hoy' }, ahora);
    const recortada = resumirAgenda(tareas, { vista: 'hoy', desde: '2026-10-16', hasta: '2026-10-16' }, ahora);
    assert.deepEqual(recortada.contadores, normal.contadores);
    assert.deepEqual(recortada.tareas, normal.tareas);
    assert.equal(normal.ocupacion[0].minutos, 120);
    assert.equal(recortada.ocupacion[0].minutos, 0);
});
