import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createElement } from 'react';
import { montar, pulsar } from '@/pruebas/dom';
import { PreparacionPlan } from './preparacion';
import type { Regla } from '@/lib/planificacion/modelo';
it('una proyección RSC que retira catálogo oculta el diff privado abierto y su confirmación', async () => {
    const regla: Regla = { id: 'regla', version: 0, trabajoId: 'trabajo', activo: true, selector: { tipo: 'equipo' }, trabajo: { id: 'trabajo', version: 0, titulo: 'Regla privada', descripcion: '', duracionEstimadaMin: null, activo: true } };
    const previa = { token: 'token', hash: 'hash', leidaEn: '2026-10-15T10:00:00Z', anteriores: [], seleccion: { reglas: [regla.id] }, diff: [{ clave: 'clave', estado: 'nueva', candidata: { titulo: 'Contenido privado del origen', origenPublico: { salaNombre: 'Sala' } }, tarea: null, campos: [] }] };
    const original = global.fetch;
    global.fetch = async () => Response.json(previa);
    const props = { proyectoId: 'obra', version: 1, salas: [{ id: 'sala', nombre: 'Sala' }], revisiones: [], reglas: [regla], puedeCatalogo: true, alGuardar: async () => {
        } };
    const m = await montar(createElement(PreparacionPlan, props));
    const boton = (nombre: string) => {
        const b = [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === nombre);
        assert(b);
        return b;
    };
    try {
        const cajas = [...m.contenedor.querySelectorAll('input[type=checkbox]')];
        await pulsar(cajas[0]);
        await pulsar(cajas.at(-1)!);
        await pulsar(boton('Preparar propuesta'));
        assert.match(m.contenedor.textContent ?? '', /Contenido privado del origen/);
        await m.repintar(createElement(PreparacionPlan, { ...props, reglas: [], puedeCatalogo: false }));
        assert.doesNotMatch(m.contenedor.textContent ?? '', /Contenido privado del origen|Regla privada/);
        assert.match(m.contenedor.textContent ?? '', /permisos que ya no están disponibles/);
        assert(![...m.contenedor.querySelectorAll('button')].some(b => b.textContent?.startsWith('Confirmar')));
    }
    finally {
        await m.desmontar();
        global.fetch = original;
    }
});
