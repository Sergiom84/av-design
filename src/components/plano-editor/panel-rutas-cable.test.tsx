import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { PanelRutasCable } from './panel-rutas-cable';
import type { Conexion, EquipoEnSala } from '@/lib/tipos';

const equipos = [
  { id: 'e1', nombre: 'Origen' },
  { id: 'e2', nombre: 'Destino' },
] as EquipoEnSala[];

const conexiones = [{
  id: 'c1',
  sala_id: 's1',
  origen_id: 'e1',
  destino_id: 'e2',
  articulo_cable_id: null,
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  puntos_paso: [],
}] satisfies Conexion[];

const props = {
  conexiones,
  equipos,
  rutas: [{ conexion_id: 'c1', puntos: [] }],
  conexionSeleccionada: null,
  puntoSeleccionado: null,
  largoSala: 5,
  anchoSala: 4,
  altoSala: 2.7,
  soloLectura: false,
  alSeleccionarConexion: () => {},
  alSeleccionarPunto: () => {},
  alCambiar: () => {},
};

describe('las dos superficies del editor de rutas', () => {
  it('cada panel tiene un título único y aria-labelledby resuelve dentro de su instancia', () => {
    const html = renderToStaticMarkup(
      <main>
        <div data-superficie="escritorio"><PanelRutasCable {...props} /></div>
        <div data-superficie="movil"><PanelRutasCable {...props} /></div>
      </main>,
    );
    const document = new JSDOM(html).window.document;
    const secciones = [...document.querySelectorAll<HTMLElement>('section[aria-labelledby]')];
    assert.equal(secciones.length, 2);

    const ids = secciones.map((seccion) => seccion.getAttribute('aria-labelledby'));
    assert.equal(new Set(ids).size, 2, 'las instancias no comparten id');
    for (const seccion of secciones) {
      const id = seccion.getAttribute('aria-labelledby')!;
      const titulo = document.getElementById(id);
      assert.equal(titulo?.textContent, 'Ruta del cable');
      assert.equal(seccion.contains(titulo), true, 'cada región nombra su propio título');
    }

    const idsDelDom = [...document.querySelectorAll<HTMLElement>('[id]')].map((nodo) => nodo.id);
    assert.equal(new Set(idsDelDom).size, idsDelDom.length, 'no hay otros ids fijos duplicados');
  });
});
