import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectorSchema, manualSchema, confirmarSchema, filtroAgendaSchema, type Regla, type TareaPlan } from './planificacion/modelo';
import { generarCandidatas, type SalaFuente } from './planificacion/reglas';
import { compararPlan } from './planificacion/diff';
import { resumirAgenda } from './planificacion/agenda';
const regla: Regla = { id: 'r', version: 0, trabajoId: 'w', activo: true, selector: { tipo: 'equipo' }, trabajo: { id: 'w', version: 0, titulo: 'Instalar equipo', descripcion: 'Trabajo literal', duracionEstimadaMin: null, activo: true } };
const sala: SalaFuente = { id: 's', nombre: 'Sala', tipologia: 'TP', proyectoId: 'p', localizacionId: 'l', disenoVersion: 1, actualVersion: 1, tipo: 'actual', equipos: [{ id: 'e', articuloId: 'a', cantidad: 8, posicionConfirmada: false, categoria: 'PANTALLAS' }], conexiones: [{ id: 'c', senal: 'hdmi', identificadorCable: 'HD-1000' }], material: [{ id: 'b', articuloId: 'a', cantidad: 3, unidad: 'ud', revision: 2, loteId: null }] };
function tarea(): TareaPlan {
    return { id: 't', planId: 'p', proyectoId: 'o', proyectoNombre: 'Obra', salaId: 's', salaNombre: 'Sala', titulo: 'Instalar equipo', descripcion: 'Trabajo literal', notas: '', duracionEstimadaMin: null, estado: 'pendiente', venceFecha: null, inicio: null, fin: null, version: 0, versionPlan: 0, trabajoId: 'w', reglaId: 'r', claveOrigen: generarCandidatas([sala], [regla])[0].clave, fuenteId: 'f', origenPublico: {}, origenCatalogo: {}, baseGenerada: { titulo: 'Instalar equipo', descripcion: 'Trabajo literal', duracionEstimadaMin: null }, tecnicos: [], archivado: false, desactualizada: false };
}
describe('Planificación: reglas, diff y validación de decisiones', () => {
    it('una fila con cantidad8 produce una sola candidata y conserva posición estimada', () => {
        const c = generarCandidatas([sala], [regla]);
        assert.equal(c.length, 1);
        assert.equal(c[0].origenPublico.posicionEstimada, true);
        assert.equal(c[0].duracionEstimadaMin, null);
    });
    it('la clave no cambia con versión, revisión, cantidad o texto', () => {
        const a = generarCandidatas([sala], [regla])[0];
        const b = generarCandidatas([{ ...sala, disenoVersion: 9, tipo: 'revision', revisionId: 'rev', equipos: [{ ...sala.equipos[0], cantidad: 1 }] }], [{ ...regla, version: 2, trabajo: { ...regla.trabajo, titulo: 'Nuevo título', duracionEstimadaMin: 60 } }])[0];
        assert.equal(a.clave, b.clave);
        assert.notDeepEqual(a, b);
    });
    it('AND literal, sin fuzzy ni multiplicar una cantidad', () => {
        assert.equal(generarCandidatas([sala], [{ ...regla, selector: { tipo: 'equipo', categoria: 'pantallas' } }]).length, 0);
        assert.equal(generarCandidatas([sala], [{ ...regla, selector: { tipo: 'equipo', categoria: 'PANTALLAS', articuloId: 'otra' } }]).length, 0);
    });
    it('preserva campos manuales, anuladas y origen retirado en el diff', () => {
        const t = tarea();
        const c = generarCandidatas([sala], [regla]);
        const manual = { ...t, titulo: 'Título elegido a mano' };
        assert.equal(compararPlan(c, [manual])[0].estado, 'edicion_manual');
        assert.equal(compararPlan(c, [manual])[0].campos[0].manual, true);
        assert.equal(compararPlan(c, [{ ...t, estado: 'anulada' }])[0].estado, 'anulada_existente');
        assert.equal(compararPlan([], [t])[0].estado, 'origen_retirado');
    });
    it('selector estricto y formatos/duración inválidos no se reinterpretan', () => {
        for (const s of [{ tipo: 'sql', texto: 'select' }, { tipo: 'equipo', comodin: '%' }, { tipo: 'conexion', senal: 'displayport' }, { tipo: 'sala', usuarioId: 'otro' }])
            assert.equal(selectorSchema.safeParse(s).success, false);
        for (const duracion of [0, -1, 1.5, Infinity])
            assert.equal(manualSchema.safeParse({ titulo: 'Tarea', duracionEstimadaMin: duracion }).success, false);
        assert.equal(confirmarSchema.safeParse({ acciones: [] }).success, false);
        assert.equal(filtroAgendaSchema.safeParse({ vista: 'hoy', desde: '2026-10-15' }).success, false);
    });
    it('una tarea puede estar hoy, semana y vencida; hecha sólo aparece en historial', () => {
        const t = { ...tarea(), venceFecha: '2026-10-14', inicio: '2026-10-15T09:00:00Z', fin: '2026-10-15T10:00:00Z' };
        const sin = { ...tarea(), id: 'sin' };
        const hecha = { ...t, estado: 'hecha' as const, id: 'hecha' };
        const r = resumirAgenda([t, t, sin, hecha], { vista: 'hoy' }, new Date('2026-10-15T12:00:00Z'));
        assert.deepEqual(r.contadores, { hoy: 1, semana: 1, vencidas: 1, sin_fecha: 1 });
        assert.equal(r.tareas.length, 1);
        assert(resumirAgenda([hecha], { vista: 'hoy', historial: true }, new Date('2026-10-15T12:00:00Z')).tareas.some(t => t.id === 'hecha'));
    });
});
