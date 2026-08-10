'use client';

import { useEffect, useRef, useState } from 'react';
import { Campo } from '@/components/ui';

/**
 * Un número del inspector, en metros.
 *
 * Guarda su propio texto mientras se escribe y solo publica el número cuando
 * es un número: sin esto, escribir «2,» en un campo controlado por el valor
 * numérico borraría la coma en cuanto se teclea, y en obra las medidas se
 * escriben con coma.
 *
 * Se puede vaciar cuando el dato admite ausencia (`admiteVacio`): una roseta
 * sin situar es un estado real, no un cero.
 */
export function CampoMetros({
  etiqueta,
  valor,
  alCambiar,
  ayuda,
  admiteVacio = false,
  unidad = 'm',
  paso = 0.1,
  minimo,
  maximo,
  deshabilitado = false,
}: {
  etiqueta: string;
  valor: number | null;
  alCambiar: (n: number | null) => void;
  ayuda?: string;
  admiteVacio?: boolean;
  unidad?: string;
  paso?: number;
  minimo?: number;
  maximo?: number;
  deshabilitado?: boolean;
}) {
  const [texto, setTexto] = useState(() => formatear(valor));
  const enFoco = useRef(false);

  // Mientras el campo tiene el foco manda lo que se está escribiendo; cuando
  // no, manda el borrador (lo ha podido mover un arrastre o un deshacer).
  useEffect(() => {
    if (!enFoco.current) setTexto(formatear(valor));
  }, [valor]);

  return (
    <Campo etiqueta={`${etiqueta} (${unidad})`} ayuda={ayuda}>
      <input
        type="text"
        inputMode="decimal"
        className="tabular-nums"
        value={texto}
        disabled={deshabilitado}
        step={paso}
        onFocus={() => {
          enFoco.current = true;
        }}
        onBlur={() => {
          enFoco.current = false;
          setTexto(formatear(valor));
        }}
        onChange={(ev) => {
          const bruto = ev.target.value;
          setTexto(bruto);
          if (bruto.trim() === '') {
            if (admiteVacio) alCambiar(null);
            return;
          }
          const n = Number(bruto.replace(',', '.'));
          if (!Number.isFinite(n)) return;
          if (minimo != null && n < minimo) return;
          if (maximo != null && n > maximo) return;
          alCambiar(n);
        }}
      />
    </Campo>
  );
}

const formatear = (n: number | null): string =>
  n == null ? '' : String(n).replace('.', ',');
