'use client';

import type { BorradorPlano, Seleccion } from '@/lib/plano-editor';
import { InspectorSala } from './inspector-sala';
import { InspectorMesa } from './inspector-mesa';
import { InspectorEquipo } from './inspector-equipo';
import { InspectorMueble } from './inspector-mueble';
import { InspectorToma } from './inspector-toma';
import { InspectorPuerta } from './inspector-puerta';

/**
 * El inspector que toca según lo que esté seleccionado.
 *
 * Estaba dentro de `editor-plano-sala.tsx`, que ya pasaba de las setecientas
 * líneas y coordina borrador, historial, arrastre, altas, teclado y guardado.
 * Elegir qué ficha se pinta no es coordinación: es una sola decisión sobre la
 * selección, y aquí se ve entera de un vistazo. Sacarla es también lo que
 * evita que el fascículo de las puertas añada su rama a un fichero que ya no
 * se puede leer de una sentada.
 *
 * No decide nada más. Quién puede editar, qué pasa al quitar algo y cómo se
 * aplica un borrador nuevo siguen siendo del coordinador: esto solo reparte.
 */
export function PanelPropiedadesPlano({
  seleccion,
  borrador,
  posicionesDibujadas,
  soloLectura,
  alCambiar,
  alQuitar,
}: {
  /** Ya comprobada contra el borrador: aquí no se valida otra vez. */
  seleccion: Seleccion;
  borrador: BorradorPlano;
  /** Dónde ha quedado dibujado cada equipo, para los que no tienen posición confirmada. */
  posicionesDibujadas: Map<string, { x_m: number; y_m: number; z_m: number }>;
  soloLectura: boolean;
  alCambiar: (siguiente: BorradorPlano) => void;
  alQuitar: () => void;
}) {
  if (seleccion === null || seleccion.tipo === 'sala') {
    return <InspectorSala borrador={borrador} alCambiar={alCambiar} soloLectura={soloLectura} />;
  }

  if (seleccion.tipo === 'mesa') {
    return <InspectorMesa borrador={borrador} alCambiar={alCambiar} soloLectura={soloLectura} />;
  }

  if (seleccion.tipo === 'equipo') {
    const equipo = borrador.equipos.find((x) => x.id === seleccion.id);
    if (!equipo) return null;
    return (
      <InspectorEquipo
        equipo={equipo}
        borrador={borrador}
        posicionDibujada={posicionesDibujadas.get(equipo.id) ?? null}
        alCambiar={alCambiar}
        alQuitar={alQuitar}
        soloLectura={soloLectura}
      />
    );
  }

  if (seleccion.tipo === 'mueble') {
    return (
      <InspectorMueble
        borrador={borrador}
        id={seleccion.id}
        alCambiar={alCambiar}
        alQuitar={alQuitar}
        soloLectura={soloLectura}
      />
    );
  }

  if (seleccion.tipo === 'puerta') {
    const puerta = borrador.puertas.find((x) => x.id === seleccion.id);
    if (!puerta) return null;
    return (
      <InspectorPuerta
        puerta={puerta}
        borrador={borrador}
        alCambiar={alCambiar}
        alQuitar={alQuitar}
        soloLectura={soloLectura}
      />
    );
  }

  const toma = borrador.tomas.find((x) => x.id === seleccion.id);
  if (!toma) return null;
  return (
    <InspectorToma toma={toma} borrador={borrador} alCambiar={alCambiar} soloLectura={soloLectura} />
  );
}

/**
 * De qué habla el panel cuando está plegado en móvil.
 *
 * La rama final no puede ser «Toma» a secas: con un mueble seleccionado el
 * panel decía «Toma» y el inspector de debajo enseñaba una silla. Cada tipo
 * dice su nombre.
 */
export function resumenDeSeleccion(seleccion: Seleccion, borrador: BorradorPlano): string {
  if (seleccion === null || seleccion.tipo === 'sala') return 'Medidas de la sala';
  if (seleccion.tipo === 'mesa') return 'Mesa principal';
  if (seleccion.tipo === 'equipo') {
    return borrador.equipos.find((x) => x.id === seleccion.id)?.nombre ?? 'Equipo';
  }
  if (seleccion.tipo === 'mueble') {
    return borrador.mobiliario.find((x) => x.id === seleccion.id)?.nombre ?? 'Mueble';
  }
  if (seleccion.tipo === 'puerta') return 'Puerta';
  return `Toma ${borrador.tomas.find((x) => x.id === seleccion.id)?.codigo ?? ''}`.trim();
}
