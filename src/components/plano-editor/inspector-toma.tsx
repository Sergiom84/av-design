'use client';

import { Aviso } from '@/components/ui';
import { editarToma, type BorradorPlano, type TomaBorrador } from '@/lib/plano-editor';
import { CampoMetros } from './campos-plano';

/**
 * Una roseta del edificio.
 *
 * Su código y su ubicación se editan en Equipamiento, que es donde se dan de
 * alta; aquí solo se sitúa en el plano. Vaciar X o Y la saca del dibujo sin
 * borrar la roseta: la placa sigue en la pared aunque nadie sepa aún dónde.
 */
export function InspectorToma({
  toma,
  borrador,
  alCambiar,
  soloLectura,
}: {
  toma: TomaBorrador;
  borrador: BorradorPlano;
  alCambiar: (b: BorradorPlano) => void;
  soloLectura: boolean;
}) {
  const editar = (cambios: Parameters<typeof editarToma>[2]) =>
    alCambiar(editarToma(borrador, toma.id, cambios));

  return (
    <div className="space-y-3">
      <div>
        <span className="font-medium">Toma {toma.codigo}</span>
        {toma.ubicacion && (
          <span className="text-tinta-tenue"> · {toma.ubicacion}</span>
        )}
      </div>

      {(toma.x_m == null || toma.y_m == null) && (
        <Aviso tono="neutro">
          Sin situar en el plano. Sigue dada de alta en la sala: escribe X e Y o
          arrástrala desde el lienzo cuando se sepa dónde está.
        </Aviso>
      )}

      <CampoMetros
        etiqueta="X"
        valor={toma.x_m}
        alCambiar={(n) => editar({ x_m: n })}
        admiteVacio
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Y"
        valor={toma.y_m}
        alCambiar={(n) => editar({ y_m: n })}
        admiteVacio
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Z"
        valor={toma.z_m}
        alCambiar={(n) => editar({ z_m: n })}
        ayuda="Altura de la roseta desde el suelo."
        admiteVacio
        deshabilitado={soloLectura}
      />

      {toma.notas && <p className="text-tinta-tenue">{toma.notas}</p>}
    </div>
  );
}
