'use client';

import { useId } from 'react';
import { Aviso } from '@/components/ui';
import {
  editarPuerta,
  estadoDeLaPuerta,
  longitudDePared,
  type BorradorPlano,
  type PuertaBorrador,
} from '@/lib/plano-editor';
import { aplicarOperacion } from './operaciones-plano';
import { ETIQUETA_PARED, PAREDES_SALA, type ParedSala } from '@/lib/tipos';
import { CampoMetros } from './campos-plano';

/**
 * Una puerta de la sala.
 *
 * Nace «Sin medir» y así se dice: la anchura y la altura no tienen valor por
 * defecto en ningún sitio, porque inventar la anchura de una puerta es dar por
 * medido lo que nadie ha medido, y esto acaba en un plano de obra. Se miden
 * las dos juntas o ninguna; una a medias se avisa aquí y el guardado la
 * rechaza.
 */
export function InspectorPuerta({
  puerta,
  borrador,
  alCambiar,
  alQuitar,
  soloLectura,
}: {
  puerta: PuertaBorrador;
  borrador: BorradorPlano;
  alCambiar: (b: BorradorPlano) => void;
  alQuitar: () => void;
  soloLectura: boolean;
}) {
  const base = useId();
  const editar = (cambios: Parameters<typeof editarPuerta>[2]) =>
    alCambiar(editarPuerta(borrador, puerta.id, cambios));

  const estado = estadoDeLaPuerta(puerta);
  const longitud = longitudDePared(puerta.pared, borrador);

  return (
    <div className="space-y-3">
      <div>
        <span className="font-medium">Puerta</span>
        <span className="text-tinta-tenue">
          {' '}
          · {estado === 'medida' ? 'Medida' : 'Sin medir'}
        </span>
      </div>

      {estado === 'sin_medir' && (
        <Aviso tono="neutro">
          Sin medir. El plano marca dónde está; la anchura y la altura se
          escriben cuando alguien las mide, no se inventan.
        </Aviso>
      )}
      {estado === 'a_medias' && (
        <Aviso tono="aviso">
          Tiene una medida sin la otra: se guarda entera o sin medir.
        </Aviso>
      )}

      <div>
        <label htmlFor={`${base}pared`} className="t-etiqueta block mb-1">
          Pared
        </label>
        <select
          id={`${base}pared`}
          value={puerta.pared}
          onChange={(e) => editar({ pared: e.target.value as ParedSala })}
          disabled={soloLectura}
          className="w-full min-h-11"
        >
          {PAREDES_SALA.map((par) => (
            <option key={par} value={par}>
              {ETIQUETA_PARED[par]}
            </option>
          ))}
        </select>
      </div>

      <CampoMetros
        etiqueta="Posición en la pared"
        valor={puerta.posicion_m}
        alCambiar={(n) => editar({ posicion_m: n ?? 0 })}
        ayuda={`Del origen de la pared al arranque del hueco. La pared mide ${longitud} m.`}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Anchura"
        valor={puerta.anchura_m}
        alCambiar={(n) => editar({ anchura_m: n })}
        admiteVacio
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Altura"
        valor={puerta.altura_m}
        alCambiar={(n) => editar({ altura_m: n })}
        admiteVacio
        deshabilitado={soloLectura}
      />

      {!soloLectura && (
        <button
          type="button"
          className="boton min-h-11 px-4"
          onClick={() => {
            // El mismo despachador que el menú contextual: quitar desde aquí y
            // quitar desde el botón derecho no pueden divergir.
            alCambiar(
              aplicarOperacion(borrador, { tipo: 'puerta', id: puerta.id }, {
                tipo: 'eliminar',
              }).borrador,
            );
            alQuitar();
          }}
        >
          Quitar del plano
        </button>
      )}
    </div>
  );
}
