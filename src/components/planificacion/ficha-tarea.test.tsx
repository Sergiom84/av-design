import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar, escribir } from '@/pruebas/dom';
import { FichaTarea } from './ficha-tarea';
import type { TareaPlan } from '@/lib/planificacion/modelo';
const tarea: TareaPlan = { id: 'd4000000-0000-4000-8000-000000000010', planId: 'plan', proyectoId: 'obra', proyectoNombre: 'Obra', salaId: null, salaNombre: null, titulo: 'Tarea', descripcion: '', notas: 'Original', duracionEstimadaMin: null, estado: 'pendiente', venceFecha: null, inicio: null, fin: null, version: 0, versionPlan: 1, trabajoId: null, reglaId: null, claveOrigen: null, fuenteId: null, origenPublico: {}, baseGenerada: null, tecnicos: [], archivado: false, desactualizada: false };
const boton = (c: HTMLElement, nombre: string) => {
    const b = [...c.querySelectorAll('button')].find(b => b.textContent === nombre);
    assert(b);
    return b;
};
const notas = (c: HTMLElement) => c.querySelector('textarea[aria-label="Editar tarea: notas"]') as HTMLTextAreaElement;
async function texto(campo: HTMLTextAreaElement, v: string) {
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(campo.ownerDocument.defaultView!.HTMLTextAreaElement.prototype, 'value')!.set!;
        setter.call(campo, v);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
async function enviar(c: HTMLElement) {
    await act(async () => {
        c.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
}
describe('Ficha de planificación montada conserva decisiones y borradores', () => {
    it('409ycomparación preservan notas hasta adopción explícita', async () => {
        const original = global.fetch;
        global.fetch = async (_u, o) => o?.method === 'PATCH' ? Response.json({ error: 'La tarea cambió. Recarga y compara.', codigo: 'VERSION_CAMBIADA' }, { status: 409 }) : Response.json({ ...tarea, notas: 'Servidor', version: 2 });
        const m = await montar(createElement(FichaTarea, { tarea, grupos: [], editar: true, agendaCompleta: false, alGuardar: async () => {
            } }));
        try {
            await texto(notas(m.contenedor), 'Borrador local');
            await enviar(m.contenedor);
            assert.equal(notas(m.contenedor).value, 'Borrador local');
            assert.match(m.contenedor.textContent ?? '', /Recarga y compara/);
            await pulsar(boton(m.contenedor, 'Recargar tarea y comparar'));
            assert.equal(notas(m.contenedor).value, 'Borrador local');
            await pulsar(boton(m.contenedor, 'Adoptar campos guardados'));
            assert.equal(notas(m.contenedor).value, 'Servidor');
        }
        finally {
            await m.desmontar();
            global.fetch = original;
        }
    });
    it('un200seguido de lectura tardía mantiene bloqueado hasta actualizar; propnueva no pisa edición posterior', async () => {
        const original = global.fetch;
        global.fetch = async () => Response.json({ versionPlan: 2, versionTarea: 1 });
        let liberar: () => void = () => {
        };
        const espera = new Promise<void>(r => liberar = r);
        const m = await montar(createElement(FichaTarea, { tarea, grupos: [], editar: true, agendaCompleta: false, alGuardar: () => espera }));
        try {
            await texto(notas(m.contenedor), 'Guardado');
            await enviar(m.contenedor);
            assert(notas(m.contenedor).matches(':disabled'));
            await act(async () => {
                liberar();
                await espera;
            });
            assert(!notas(m.contenedor).matches(':disabled'));
            await texto(notas(m.contenedor), 'Edición siguiente');
            await m.repintar(createElement(FichaTarea, { tarea: { ...tarea, notas: 'Guardado', version: 1, versionPlan: 2 }, grupos: [], editar: true, agendaCompleta: false, alGuardar: async () => {
                } }));
            assert.equal(notas(m.contenedor).value, 'Edición siguiente');
            assert.match(m.contenedor.querySelector('[role=status]')?.textContent ?? '', /Tarea guardada/);
        }
        finally {
            await m.desmontar();
            global.fetch = original;
        }
    });
    it('restauración explícita bloquea hasta recargar y presenta borrador sin intervalos', async () => {
        const original = global.fetch;
        global.fetch = async (url, o) => String(url).includes('historial') && o?.method !== 'POST' ? Response.json({ eventos: [{ id: 'evento', tipo: 'crear_manual', autor: 'Autor', creado_en: '2026-10-15T08:00:00Z', motivo: null, despues: { titulo: 'Origen', estado: 'borrador' } }] }) : o?.method === 'POST' ? Response.json({ versionPlan: 2 }) : Response.json({ ...tarea, estado: 'borrador', notas: 'Restaurada' });
        let pendiente = false;
        const m = await montar(createElement(FichaTarea, { tarea: { ...tarea, estado: 'hecha' }, grupos: [], editar: true, agendaCompleta: false, alGuardar: async () => {
                pendiente = true;
            } }));
        try {
            await pulsar(boton(m.contenedor, 'Consultar historial'));
            const motivo = [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.startsWith('Motivo de restauración'))!.querySelector('input') as HTMLInputElement;
            await escribir(motivo, 'Recuperar campos');
            const restaurar = boton(m.contenedor, 'Restaurar campos de este evento');
            assert.equal(restaurar.disabled, false);
            await pulsar(restaurar);
            assert(pendiente);
            assert.equal((m.contenedor.querySelector('select[aria-label="Editar tarea: estado"]') as HTMLSelectElement).value, 'borrador');
            assert.equal(notas(m.contenedor).value, 'Restaurada');
        }
        finally {
            await m.desmontar();
            global.fetch = original;
        }
    });
});

it('restaurar retira técnicos y grupos del borrador antes de permitir otra asignación', async () => {
    const tecnico = { id: 'persona', nombre: 'Técnico previo', activo: true };
    const grupo = { id: 'grupo', nombre: 'Grupo previo', version: 0, activo: true, miembros: [tecnico] };
    const original = global.fetch;
    let enviada: { tecnicos: string[]; grupos: unknown[] } | undefined;
    global.fetch = async (url, o) => {
        if (o?.method === 'PUT') { enviada = JSON.parse(String(o.body)); return Response.json({}); }
        if (String(url).includes('historial') && o?.method !== 'POST')
            return Response.json({ eventos: [{ id: 'evento', tipo: 'crear_manual', autor: 'Autor', creado_en: '2026-10-15T08:00:00Z', motivo: null, despues: { titulo: 'Origen', estado: 'borrador' } }] });
        return Response.json({ ...tarea, estado: 'borrador', tecnicos: [], version: 2, versionPlan: 3 });
    };
    const m = await montar(createElement(FichaTarea, { tarea: { ...tarea, tecnicos: [tecnico] }, grupos: [grupo], editar: true, agendaCompleta: true, alGuardar: async () => {} }));
    try {
        const checkbox = () => [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.includes('Grupo Grupo previo'))!.querySelector('input') as HTMLInputElement;
        await pulsar(checkbox());
        assert(checkbox().checked);
        assert(boton(m.contenedor, 'Quitar Técnico previo'));
        await pulsar(boton(m.contenedor, 'Consultar historial'));
        const motivo = [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.startsWith('Motivo de restauración'))!.querySelector('input') as HTMLInputElement;
        await escribir(motivo, 'Restaurar explícitamente sin recursos antiguos');
        await pulsar(boton(m.contenedor, 'Restaurar campos de este evento'));
        assert(![...m.contenedor.querySelectorAll('button')].some(b => b.textContent === 'Quitar Técnico previo'));
        assert.equal(checkbox().checked, false);
        await pulsar(boton(m.contenedor, 'Guardar asignación revisada'));
        assert.deepEqual(enviada?.tecnicos, []);
        assert.deepEqual(enviada?.grupos, []);
    } finally { await m.desmontar(); global.fetch = original; }
});

it('una recarga ordinaria y error409 conservan el borrador de técnicos y grupos', async () => {
    const tecnico = { id: 'persona', nombre: 'Técnico elegido', activo: true };
    const grupo = { id: 'grupo', nombre: 'Grupo elegido', version: 0, activo: true, miembros: [tecnico] };
    const original = global.fetch;
    global.fetch = async (url, o) => o?.method === 'PUT'
        ? Response.json({ error: 'La tarea cambió', codigo: 'VERSION_CAMBIADA' }, { status: 409 })
        : String(url).includes('/tecnicos') ? Response.json({ tecnicos: [tecnico] }) : Response.json({ ...tarea, version: 2, tecnicos: [] });
    const props = { tarea, grupos: [grupo], editar: true, agendaCompleta: true, alGuardar: async () => {} };
    const m = await montar(createElement(FichaTarea, props));
    try {
        await pulsar(boton(m.contenedor, 'Buscar técnicos'));
        await pulsar(boton(m.contenedor, 'Añadir Técnico elegido'));
        const checkbox = () => [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.includes('Grupo Grupo elegido'))!.querySelector('input') as HTMLInputElement;
        await pulsar(checkbox());
        await pulsar(boton(m.contenedor, 'Recargar tarea y comparar'));
        await m.repintar(createElement(FichaTarea, { ...props, tarea: { ...tarea, version: 2, tecnicos: [] } }));
        assert(boton(m.contenedor, 'Quitar Técnico elegido'));
        assert(checkbox().checked);
        await pulsar(boton(m.contenedor, 'Guardar asignación revisada'));
        assert(boton(m.contenedor, 'Quitar Técnico elegido'));
        assert(checkbox().checked);
        assert.match(m.contenedor.textContent ?? '', /La tarea cambió/);
    } finally { await m.desmontar(); global.fetch = original; }
});
