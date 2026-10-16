import React, { act } from 'react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montar, esperar } from '@/pruebas/dom';
import { fixturePlantilla } from '@/pruebas/plantilla-preview-fixture';
import { VistaPreviaDePlantilla } from './vista-previa';
import type { VistaPreviaPlantilla } from '@/lib/plantilla-preview';

Object.assign(globalThis, { React });
describe('vista previa real sin otra geometría', () => {
  it('una respuesta vieja no cambia la plantilla visible ni autoriza su huella', async () => {
    const original = globalThis.fetch;
    const pendientes = new Map<string, (r: Response) => void>();
    const recibidas: string[] = [];
    const recibir = (d: VistaPreviaPlantilla | null) => { if (d) recibidas.push(d.plantilla.id); };
    globalThis.fetch = async url => new Promise<Response>(resolver => pendientes.set(String(url), resolver));
    const uno = fixturePlantilla(); const dos = fixturePlantilla();
    dos.plantilla = { ...dos.plantilla, id: 'a1010000-0000-4000-8000-000000000002', nombre: 'Segunda plantilla' };
    const m = await montar(<VistaPreviaDePlantilla id={uno.plantilla.id} alRecibir={recibir} />);
    try {
      await m.repintar(<VistaPreviaDePlantilla id={dos.plantilla.id} alRecibir={recibir} />);
      await act(async () => pendientes.get(`/api/plantillas/${dos.plantilla.id}`)!(Response.json({ ...dos, huella: 'b'.repeat(64) })));
      await esperar();
      await act(async () => pendientes.get(`/api/plantillas/${uno.plantilla.id}`)!(Response.json({ ...uno, huella: 'a'.repeat(64) })));
      await esperar();
      assert.deepEqual(recibidas, [dos.plantilla.id]);
      assert.ok(m.contenedor.textContent?.includes('Segunda plantilla'));
      assert.ok(!m.contenedor.textContent?.includes('Vista previa: Prueba previa'));
      assert.equal(m.contenedor.querySelectorAll('svg[role="img"]').length, 1);
    } finally { await m.desmontar(); globalThis.fetch = original; }
  });
  it('medidas ausentes no crean una escala y una caída no se interpreta como lista vacía', async () => {
    const original = globalThis.fetch;
    const datos = fixturePlantilla(); datos.plantilla.largo_m = null;
    globalThis.fetch = async () => Response.json({ ...datos, huella: 'a'.repeat(64) });
    const m = await montar(<VistaPreviaDePlantilla id={datos.plantilla.id} />);
    try {
      await esperar();
      assert.equal(m.contenedor.querySelector('svg[role="img"]'), null);
      assert.ok(m.contenedor.textContent?.includes('Faltan el largo'));
      assert.ok(m.contenedor.textContent?.includes('Opcional; no se hereda'));
    } finally { await m.desmontar(); globalThis.fetch = original; }
  });
});
