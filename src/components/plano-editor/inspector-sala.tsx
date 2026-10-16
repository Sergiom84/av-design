'use client';

import { Campo } from '@/components/ui';
import { cambiarMedidasSala, type BorradorPlano } from '@/lib/plano-editor';
import { DimensionesSala } from '@/components/medidas/dimensiones-sala';

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
  return (
    <div className="space-y-3">
      <DimensionesSala valores={{ largo_m: borrador.largo_m || null, ancho_m: borrador.ancho_m || null, alto_m: borrador.alto_m || null }} maximo={1000}
        deshabilitado={soloLectura} alCambiar={valores => alCambiar(cambiarMedidasSala(borrador, { largo_m: valores.largo_m ?? 0, ancho_m: valores.ancho_m ?? 0, alto_m: valores.alto_m ?? 0 }))} />
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
