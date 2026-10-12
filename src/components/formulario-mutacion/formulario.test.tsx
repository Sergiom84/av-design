import assert from 'node:assert/strict';
import Module from 'node:module';
import { before, test } from 'node:test';
import { act } from 'react';
import { montar } from '@/pruebas/dom';
import { ErrorConcurrencia } from '@/lib/control-escritura';

// Sustituye únicamente la sesión de Next; el adaptador y las acciones se ejecutan.
const cargador = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const original = cargador._load;
let accesos = 0;
cargador._load = (id, ...args) => id === '@/lib/sesion-servidor'
  ? { exigirUsuario: async () => { accesos++; return { id: 'qa' }; } }
  : original.call(Module, id, ...args);
let FormularioMutacion: typeof import('./formulario').FormularioMutacion;
let ejecutarAccionConEstado: typeof import('@/app/acciones-concurrencia').ejecutarAccionConEstado;
before(async () => {
  try {
    ({ FormularioMutacion } = await import('./formulario'));
    ({ ejecutarAccionConEstado } = await import('@/app/acciones-concurrencia'));
  } finally { cargador._load = original; }
});

test('Adaptador conserva el error de concurrencia y propaga negocio y redirect sin reintentar la acción', async () => {
  let llamadas = 0;
  const resultado = await ejecutarAccionConEstado(async () => {
    llamadas++; throw new ErrorConcurrencia();
  }, {error:null}, new FormData());
  assert.match(resultado.error ?? '', /Conserva los datos/);
  assert.equal(llamadas, 1);
  // Mismo código, prototipo distinto como en dos bundles de Server Actions.
  const otroBundle = Object.assign(new Error('Otra operación conserva datos'), {code:'AV_CONCURRENCIA_AGOTADA'});
  assert.equal(otroBundle instanceof ErrorConcurrencia, false);
  assert.deepEqual(await ejecutarAccionConEstado(async () => { throw otroBundle; }, {error:null}, new FormData()),
    {error:'Otra operación conserva datos'});
  for (const error of [new Error('negocio'), Object.assign(new Error('NEXT_REDIRECT'), {digest:'NEXT_REDIRECT;replace;/compras;303;'})]) {
    await assert.rejects(ejecutarAccionConEstado(async () => { throw error; }, {error:null}, new FormData()), e => e === error);
  }
  assert.equal(accesos, 4);
});

test('Formulario hidden conserva campos externos, submitter y token tras error; bloquea doble envío y permite reintentar', async () => {
  const envios: FormData[] = [];
  const resets: boolean[] = [];
  let exitos = 0;
  let resolver: (() => void) | undefined;
  const accion = async (datos: FormData) => {
    envios.push(datos);
    if (envios.length === 1) {
      await new Promise<void>(resolve => { resolver = resolve; });
      throw new ErrorConcurrencia();
    }
  };
  const m = await montar(<>
    <FormularioMutacion action={accion} id="externo" className="hidden" feedbackExterno
      onExito={() => { exitos++; }} onReset={e => { resets.push(e.defaultPrevented); }}>
      <input type="hidden" name="recepcion_id" value="token-original" />
    </FormularioMutacion>
    <input form="externo" name="cantidad" defaultValue="1" />
    <button form="externo" name="estado" value="enviado">Guardar</button>
  </>);
  const previa = globalThis.FormData;
  globalThis.FormData = (m.ventana as Window & typeof globalThis).FormData;
  try {
    const form = m.contenedor.querySelector('form')!;
    const campo = m.contenedor.querySelector('[name="cantidad"]') as HTMLInputElement;
    const boton = m.contenedor.querySelector('button')!;
    campo.value = '3';
    await act(async () => { form.requestSubmit(boton); });
    assert.equal(envios.length, 1);
    assert.equal(form.getAttribute('aria-busy'), 'true');
    await act(async () => { form.requestSubmit(boton); });
    assert.equal(envios.length, 1);
    await act(async () => { resolver!(); });
    assert.equal(campo.value, '3', JSON.stringify(resets));
    assert.equal(exitos, 0, 'El rechazo no limpia selecciones de componentes hijos');
    assert.equal(form.getAttribute('aria-busy'), 'false');
    const alerta = m.contenedor.querySelector('[role="alert"]');
    assert.ok(alerta);
    assert.equal(form.contains(alerta), false);
    await act(async () => { form.requestSubmit(boton); });
    assert.equal(envios.length, 2);
    assert.deepEqual(envios.map(d => [d.get('recepcion_id'),d.get('cantidad'),d.get('estado')]),
      [['token-original','3','enviado'],['token-original','3','enviado']]);
    assert.equal(m.contenedor.querySelector('[role="alert"]'), null);
    assert.equal(campo.value, '1', 'El éxito conserva el reset normal del formulario');
    assert.equal(exitos, 1);
  } finally { await m.desmontar(); globalThis.FormData = previa; }
});
