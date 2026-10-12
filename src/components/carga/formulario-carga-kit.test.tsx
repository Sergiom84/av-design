import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { act } from 'react';
import { montar } from '@/pruebas/dom';
import { FormularioCargaKit, type AccionCargaKit } from './formulario-carga-kit';

test('Error de confirmar conserva ubicación y token; un token nuevo del padre no los pisa', async () => {
  const envios: FormData[] = [];
  const accion: AccionCargaKit = async (_estado, datos) => {
    envios.push(datos);
    return {error: 'No hay una unidad en esa ubicacion'};
  };
  const pintar = (token: string) => (
    <FormularioCargaKit accion={accion} token={token} disabled={false} etiqueta="Confirmar salida">
      <select name="ubicacion_id" required defaultValue="">
        <option value="" disabled>Elige la ubicación</option>
        <option value="u1">Nave · 1</option>
        <option value="u2">Furgoneta · 1</option>
      </select>
    </FormularioCargaKit>
  );
  const m = await montar(pintar('token-original'));
  const anterior = globalThis.FormData;
  try {
    globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
    const select = () => m.contenedor.querySelector('[name="ubicacion_id"]') as HTMLSelectElement;
    select().value = 'u1';
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios.length, 1);
    assert.equal(select().value, 'u1');
    assert.equal((m.contenedor.querySelector('[name="operacion_id"]') as HTMLInputElement).value, 'token-original');
    assert.match(m.contenedor.querySelector('[role="alert"]')?.textContent ?? '', /No hay una unidad/);
    await m.repintar(pintar('token-nuevo-del-servidor'));
    assert.equal(select().value, 'u1', 'El reset de React 19 no puede vaciar la ubicación tras un error');
    assert.equal((m.contenedor.querySelector('[name="operacion_id"]') as HTMLInputElement).value, 'token-original');
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios.length, 2);
    assert.deepEqual(envios.map(d => [d.get('operacion_id'), d.get('ubicacion_id')]),
      [['token-original', 'u1'], ['token-original', 'u1']]);
  } finally { await m.desmontar(); globalThis.FormData = anterior; }
});

test('Marcar y desmarcar remontan con tokens distintos al cambiar el valor canónico', async () => {
  const envios: FormData[] = [];
  const accion: AccionCargaKit = async (_estado, datos) => {
    envios.push(datos);
    return {error: null};
  };
  const pintar = (cargado: boolean) => (
    <FormularioCargaKit
      key={`linea-A:${cargado}`}
      accion={accion}
      token={cargado ? 'token-desmarcar' : 'token-marcar'}
      disabled={false}
      etiqueta={cargado ? 'Desmarcar' : 'Marcar'}
    >
      <input type="hidden" name="linea_id" value="linea-A" />
      <input type="hidden" name="valor" value={cargado ? 'false' : 'true'} />
    </FormularioCargaKit>
  );
  const m = await montar(pintar(false));
  const anterior = globalThis.FormData;
  try {
    globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    await m.repintar(pintar(true));
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.deepEqual(envios.map(d => [d.get('operacion_id'), d.get('valor')]),
      [['token-marcar', 'true'], ['token-desmarcar', 'false']]);
    assert.notEqual(envios[0].get('operacion_id'), envios[1].get('operacion_id'));
  } finally { await m.desmontar(); globalThis.FormData = anterior; }
});

test('La lista de carga remonta el marcado con la línea y el valor, no en cada render', () => {
  const texto = readFileSync(new URL('./lista-carga.tsx', import.meta.url), 'utf8');
  assert.match(texto, /key=\{`\$\{l\.id\}:\$\{l\.cargado\}`\}/);
});
