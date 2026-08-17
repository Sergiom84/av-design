import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createElement } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { esperar, montar, pulsar, type Montaje } from '@/pruebas/dom';
import { GuardiaSalida } from '@/components/plano-editor/guardia-salida';

const montajes: Montaje[] = [];
after(async () => { for (const montaje of montajes) await montaje.desmontar(); });

async function guardia(activo: boolean) {
  const navegaciones: string[] = [];
  const router = {
    push: (ruta: string) => navegaciones.push(ruta),
    replace: (ruta: string) => navegaciones.push(ruta),
    refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {},
  } as unknown as AppRouterInstance;
  const montaje = await montar(createElement(AppRouterContext.Provider, { value: router },
    createElement('div', null,
      createElement(GuardiaSalida, { activo, superficie: 'diagrama' }),
      createElement('a', { href: '/salas/s1/plano' }, 'Plano'),
    ),
  ));
  montajes.push(montaje);
  return { montaje, navegaciones };
}

describe('guardia del borrador de Diagrama', () => {
  it('con cambios cubre enlace interno, cierre y botón atrás', async () => {
    const { montaje, navegaciones } = await guardia(true);
    const enlace = montaje.contenedor.querySelector('a')!;
    const clic = await pulsar(enlace);
    assert.equal(clic.defaultPrevented, true);
    const dialogo = montaje.contenedor.querySelector('[role="dialog"]');
    assert.ok(dialogo?.textContent?.includes('diagrama'));
    assert.deepEqual(navegaciones, []);

    await pulsar([...dialogo!.querySelectorAll('button')].find((b) => b.textContent === 'Seguir editando')!);
    const descarga = new (montaje.ventana as Window & typeof globalThis).Event('beforeunload', { cancelable: true });
    montaje.ventana.dispatchEvent(descarga);
    assert.equal(descarga.defaultPrevented, true, 'cerrar o recargar pregunta');

    montaje.ventana.history.back();
    await esperar(30);
    assert.ok(montaje.contenedor.querySelector('[role="dialog"]')?.textContent?.includes('Volver atrás'));
  });

  it('sin cambios no intercepta navegación ni cierre', async () => {
    const { montaje } = await guardia(false);
    let llego = false;
    montaje.documento.addEventListener('click', (evento) => { llego = true; evento.preventDefault(); });
    await pulsar(montaje.contenedor.querySelector('a')!);
    assert.equal(llego, true);
    assert.equal(montaje.contenedor.querySelector('[role="dialog"]'), null);
    const descarga = new (montaje.ventana as Window & typeof globalThis).Event('beforeunload', { cancelable: true });
    montaje.ventana.dispatchEvent(descarga);
    assert.equal(descarga.defaultPrevented, false);
  });
});
