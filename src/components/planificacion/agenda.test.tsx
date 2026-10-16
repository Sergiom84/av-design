import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar } from '@/pruebas/dom';
import { resumirAgenda } from '@/lib/planificacion/agenda';
import { AgendaPlan } from './agenda';
it('la búsqueda tardía conserva el técnico elegido mientras estaba pendiente', async () => {
    const original = global.fetch, selfOriginal = Object.getOwnPropertyDescriptor(globalThis, 'self');
    Object.defineProperty(globalThis, 'self', { value: globalThis, configurable: true });
    let resolver: (r: Response) => void = () => {};
    global.fetch = () => new Promise<Response>(r => resolver = r);
    const datos = { solicitudId: randomUUID(), ...resumirAgenda([], { vista: 'sin_fecha', tecnicoId: 'fuera20' }, new Date('2026-10-15T12:00:00Z')) };
    const m = await montar(createElement(AgendaPlan, { datos, obras: [], tecnicos: [{ id: 'primero', nombre: 'A', activo: true }, { id: 'fuera20', nombre: 'Z', activo: true }] }));
    try {
        const selector = m.contenedor.querySelector('select[name="tecnicoId"]') as HTMLSelectElement;
        assert.equal(selector.value, 'fuera20');
        const buscar = [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === 'Buscar en técnicos');
        assert(buscar);
        await pulsar(buscar);
        await act(async () => { selector.value = 'primero'; selector.dispatchEvent(new Event('change', { bubbles: true })); });
        await act(async () => { resolver(Response.json({ tecnicos: [] })); });
        assert.equal(selector.value, 'primero');
        assert.equal(selector.selectedOptions[0].textContent?.trim(), 'A');
    } finally { await m.desmontar(); global.fetch = original; if (selfOriginal) Object.defineProperty(globalThis, 'self', selfOriginal); else Reflect.deleteProperty(globalThis, 'self'); }
});
