'use client';

import { useId } from 'react';

/** Los cuartos de vuelta y los retoques. Es como se orienta algo en obra. */
const DIRECTOS = [0, 90, 180, 270];
const RETOQUES = [-15, 15];

/**
 * El giro de un elemento del plano.
 *
 * Uno solo, compartido por la mesa, el mobiliario y el equipamiento: tres
 * controles distintos para el mismo dato acabarían normalizando de tres
 * maneras, y `-15°` guardado como `-15` en un sitio y como `345` en otro es
 * el mismo plano escrito de dos formas.
 *
 * No aparece en lo que no tiene orientación visible —la sala, una roseta cuyo
 * símbolo es un círculo—: un control que no cambia nada es un control falso, y
 * quien lo pulsa se queda buscando el cambio.
 *
 * Girar no mueve: X, Y y Z se quedan como están. El ancla sigue dentro de la
 * sala aunque el dibujo sobresalga, igual que la pantalla pegada a la pared.
 *
 * Los botones son de 44 px porque se usan con el dedo en la sala, con el móvil
 * en una mano.
 */
export function ControlRotacion({
  grados,
  alGirar,
  deshabilitado = false,
  ayuda,
}: {
  grados: number;
  alGirar: (grados: number) => void;
  deshabilitado?: boolean;
  ayuda?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="t-etiqueta block mb-1">
        Giro (°)
      </label>
      <input
        id={id}
        type="number"
        step={1}
        min={0}
        max={359}
        className="tabular-nums w-full min-h-11"
        disabled={deshabilitado}
        value={grados}
        onChange={(ev) => {
          const n = Number(ev.target.value);
          if (!Number.isFinite(n)) return;
          alGirar(n);
        }}
      />

      <div className="mt-2 flex flex-wrap gap-1">
        {DIRECTOS.map((g) => (
          <button
            key={g}
            type="button"
            disabled={deshabilitado}
            aria-pressed={grados === g}
            onClick={() => alGirar(g)}
            className={`min-h-11 min-w-11 px-2 border rounded-md tabular-nums disabled:opacity-50 ${
              grados === g
                ? 'border-acento bg-acento-suave'
                : 'border-linea hover:border-acento'
            }`}
          >
            {g}°
          </button>
        ))}
        {RETOQUES.map((paso) => (
          <button
            key={paso}
            type="button"
            disabled={deshabilitado}
            // El signo se dice en el nombre accesible: «−15°» leído en voz
            // alta se pierde si el menos es un guion decorativo.
            aria-label={paso < 0 ? `Girar ${-paso} grados a la derecha` : `Girar ${paso} grados a la izquierda`}
            onClick={() => alGirar(grados + paso)}
            className="min-h-11 min-w-11 px-2 border border-linea rounded-md tabular-nums hover:border-acento disabled:opacity-50"
          >
            {paso < 0 ? `−${-paso}°` : `+${paso}°`}
          </button>
        ))}
      </div>

      {ayuda && <p className="mt-1 text-tinta-tenue text-[0.75rem]">{ayuda}</p>}
    </div>
  );
}
