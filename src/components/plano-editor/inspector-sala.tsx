'use client';

import { Campo } from '@/components/ui';
import { cambiarMedidasSala, type BorradorPlano } from '@/lib/plano-editor';
import { CampoMetros } from './campos-plano';

/**
 * Las medidas de la sala. Es lo que se ve sin nada seleccionado, y lo primero
 * que se abre cuando la sala no está medida: un lienzo a escala inventada es
 * peor que decir que faltan las medidas.
 */
export function InspectorSala({
  borrador,
  alCambiar,
  soloLectura,
}: {
  borrador: BorradorPlano;
  alCambiar: (b: BorradorPlano) => void;
  soloLectura: boolean;
}) {
  const medida = (campo: 'largo_m' | 'ancho_m' | 'alto_m') => (n: number | null) =>
    alCambiar(cambiarMedidasSala(borrador, { [campo]: n ?? 0 }));

  return (
    <div className="space-y-3">
      <CampoMetros
        etiqueta="Largo"
        valor={borrador.largo_m || null}
        alCambiar={medida('largo_m')}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Ancho"
        valor={borrador.ancho_m || null}
        alCambiar={medida('ancho_m')}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Alto"
        valor={borrador.alto_m || null}
        alCambiar={medida('alto_m')}
        ayuda="Sin el alto no se calculan las subidas del cable."
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <Campo etiqueta="Aforo" ayuda="Reparte las sillas alrededor de la mesa.">
        <input
          type="number"
          min={0}
          step={1}
          className="tabular-nums"
          disabled={soloLectura}
          value={borrador.aforo ?? ''}
          onChange={(ev) => {
            const bruto = ev.target.value.trim();
            const n = bruto === '' ? null : Math.round(Number(bruto));
            if (n != null && (!Number.isFinite(n) || n < 0)) return;
            alCambiar(cambiarMedidasSala(borrador, { aforo: n }));
          }}
        />
      </Campo>
    </div>
  );
}
