'use client';

import { CampoCasilla } from '@/components/ui';
import { CAPAS, ETIQUETA_CAPA, type CapaPlano, type CapasPlano } from './capas-plano';

/**
 * Qué capas del plano se están mirando.
 *
 * Va aparte de `BarraHerramientas` y no dentro: esa barra ya lleva veinte
 * propiedades y es la que decide herramienta, zoom, rejilla, historial y
 * guardado. Meter aquí las capas la habría convertido en el cajón donde acaba
 * todo control que no tiene casa.
 *
 * Son dos casillas y no dos pestañas porque no se excluyen: se puede estar
 * mirando solo el mobiliario, solo el equipamiento, o los dos, que es como se
 * entra.
 *
 * El rótulo dice «Ver», no «Incluir»: apagar una capa no quita nada de la
 * sala, ni de lo que se guarda, ni de la lista de material. Es importante que
 * eso se lea, porque una casilla apagada junto a un botón de guardar invita a
 * pensar lo contrario.
 */
export function ControlesCapas({
  capas,
  alAlternar,
}: {
  capas: CapasPlano;
  alAlternar: (capa: CapaPlano) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <legend className="sr-only">Capas visibles del plano</legend>
      <span aria-hidden className="text-tinta-tenue">
        Ver
      </span>
      {CAPAS.map((capa) => (
        <CampoCasilla
          key={capa}
          type="checkbox"
          checked={capas[capa]}
          onChange={() => alAlternar(capa)}
        >
          {ETIQUETA_CAPA[capa]}
        </CampoCasilla>
      ))}
    </fieldset>
  );
}
