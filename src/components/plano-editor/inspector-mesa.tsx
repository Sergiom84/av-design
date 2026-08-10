'use client';

import { Vacio } from '@/components/ui';
import {
  cambiarMesa,
  girarMesa,
  moverMesa,
  type BorradorPlano,
} from '@/lib/plano-editor';
import { CampoMetros } from './campos-plano';
import { ControlRotacion } from './control-rotacion';

/**
 * La mesa: medidas, altura, centro y giro.
 *
 * El centro se enseña siempre con un número, aunque en la base esté nulo:
 * nulo significa «centrada», y quien lo mira quiere leer dónde está, no
 * enterarse de cómo se guarda. Se escribe cuando se toca.
 */
export function InspectorMesa({
  borrador,
  alCambiar,
  soloLectura,
}: {
  borrador: BorradorPlano;
  alCambiar: (b: BorradorPlano) => void;
  soloLectura: boolean;
}) {
  if (!borrador.mesa_largo_m || !borrador.mesa_ancho_m) {
    return (
      <div className="space-y-3">
        <Vacio>Sin las medidas de la mesa no se dibujan ni la mesa ni las sillas.</Vacio>
        <CampoMetros
          etiqueta="Largo de la mesa"
          valor={borrador.mesa_largo_m}
          alCambiar={(n) => alCambiar(cambiarMesa(borrador, { mesa_largo_m: n }))}
          admiteVacio
          minimo={0}
          deshabilitado={soloLectura}
        />
        <CampoMetros
          etiqueta="Ancho de la mesa"
          valor={borrador.mesa_ancho_m}
          alCambiar={(n) => alCambiar(cambiarMesa(borrador, { mesa_ancho_m: n }))}
          admiteVacio
          minimo={0}
          deshabilitado={soloLectura}
        />
      </div>
    );
  }

  const centroX = borrador.mesa_x_m ?? borrador.largo_m / 2;
  const centroY = borrador.mesa_y_m ?? borrador.ancho_m / 2;

  return (
    <div className="space-y-3">
      <CampoMetros
        etiqueta="Largo"
        valor={borrador.mesa_largo_m}
        alCambiar={(n) => alCambiar(cambiarMesa(borrador, { mesa_largo_m: n }))}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Ancho"
        valor={borrador.mesa_ancho_m}
        alCambiar={(n) => alCambiar(cambiarMesa(borrador, { mesa_ancho_m: n }))}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Altura"
        unidad="cm"
        paso={1}
        valor={borrador.mesa_alto_cm}
        alCambiar={(n) => alCambiar(cambiarMesa(borrador, { mesa_alto_cm: n }))}
        ayuda="Se mide en centímetros, como en obra."
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Centro X"
        valor={redondear(centroX)}
        alCambiar={(n) => alCambiar(moverMesa(borrador, { x_m: n ?? 0, y_m: centroY }, { ajustar: false }))}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Centro Y"
        valor={redondear(centroY)}
        alCambiar={(n) => alCambiar(moverMesa(borrador, { x_m: centroX, y_m: n ?? 0 }, { ajustar: false }))}
        deshabilitado={soloLectura}
      />
      <ControlRotacion
        grados={borrador.mesa_rotacion_grados}
        deshabilitado={soloLectura}
        alGirar={(g) => alCambiar(girarMesa(borrador, g))}
        ayuda="0 = alineada con las paredes. Con la mesa girada, sus cotas no se dibujan: medirían la proyección."
      />
    </div>
  );
}

const redondear = (n: number): number => Math.round(n * 100) / 100;
