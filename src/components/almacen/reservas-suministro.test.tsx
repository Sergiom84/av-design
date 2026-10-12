import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { montar } from '@/pruebas/dom';
import { FormularioReservaKit, type AccionReservaKit } from './formulario-reserva-kit';
import { ReservasPorSuministro, type FilaReservaSuministro } from './reservas-suministro';

test('Error de reserva conserva identidad y token al repintar y reintentar el formulario real', async () => {
  const envios: FormData[] = [];
  const accion: AccionReservaKit = async (_estado, datos) => {
    envios.push(datos);
    return {error: envios.length === 1 ? 'Operación ocupada. Vuelve a intentarlo.' : null};
  };
  const pintar = (token: string) => <FormularioReservaKit accion={accion} token={token}
    suministroId="suministro-A" reservaId={null} disabled={false} />;
  const m = await montar(pintar('token-original'));
  const anterior = globalThis.FormData;
  try {
    globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios.length, 1);
    assert.match(m.contenedor.querySelector('[role="alert"]')?.textContent ?? '', /Operación ocupada/);
    await m.repintar(pintar('token-nuevo-del-servidor'));
    assert.equal((m.contenedor.querySelector('[name="operacion_id"]') as HTMLInputElement).value, 'token-original');
    await act(async () => { m.contenedor.querySelector('form')!.requestSubmit(); });
    assert.equal(envios.length, 2);
    assert.deepEqual(envios.map(d => [d.get('operacion_id'), d.get('suministro_id'), d.get('reserva_id')]),
      [['token-original', 'suministro-A', null], ['token-original', 'suministro-A', null]]);
    assert.equal(m.contenedor.querySelector('[role="alert"]'), null);
  } finally { await m.desmontar(); globalThis.FormData = anterior; }
});

test('Tabla separa reserva gestionada, histórica y pendiente sin stock; lectura no ofrece escritura activa', () => {
  const filas: FilaReservaSuministro[] = [
    {suministroId:'A',referencia:'Kit',reservado:1,servido:0,pendiente:0,disponible:0,reservaGestionadaId:'reserva-A',reservasVinculadas:['reserva-A'],cargaId:null},
    {suministroId:'B',referencia:'Kit',reservado:0,servido:0,pendiente:1,disponible:0,reservaGestionadaId:null,reservasVinculadas:[],cargaId:null},
    {suministroId:'C',referencia:'Kit histórico',reservado:1,servido:0,pendiente:0,disponible:0,reservaGestionadaId:null,reservasVinculadas:[],cargaId:null},
  ];
  const accion: AccionReservaKit = async () => ({error:null});
  for (const editable of [true,false]) {
    const dom = new JSDOM(renderToStaticMarkup(<ReservasPorSuministro filas={filas}
      editable={editable} reservar={accion} liberar={accion} />));
    const rows = [...dom.window.document.querySelectorAll('tbody tr')];
    assert.equal(rows.length, 3);
    assert.equal(rows[0].querySelector('button')?.textContent, 'Liberar');
    assert.equal(rows[0].querySelector('button')?.disabled, !editable);
    assert.equal(rows[0].querySelector('input[name="reserva_id"]')?.getAttribute('value'), 'reserva-A');
    assert.equal(rows[1].querySelector('button')?.textContent, 'Reservar');
    assert.equal(rows[1].querySelector('button')?.disabled, true);
    assert.equal(rows[2].querySelector('form'), null);
    assert.match(rows[2].textContent ?? '', /Reserva histórica/);
    assert.deepEqual(rows.map(r => [...r.querySelectorAll('td')].slice(1,5).map(td => td.textContent)),
      [['1','0','0','0'],['0','0','1','0'],['1','0','0','0']]);
    dom.window.close();
  }
});
