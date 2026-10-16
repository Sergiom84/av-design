'use client';

import { useRef, useState } from 'react';
import { Campo } from '@/components/ui';
import { convertirLongitud, textoEnUnidad, type Dimensiones, type UnidadLongitud } from '@/lib/longitudes';

const CLAVES = ['largo_m', 'ancho_m', 'alto_m'] as const;
const ETIQUETAS = ['Largo', 'Ancho', 'Alto'];
const iguales = (a: Dimensiones, b: Dimensiones) => CLAVES.every(k => a[k] === b[k]);
const textosDe = (v: Dimensiones, unidad: UnidadLongitud) => CLAVES.map(k => textoEnUnidad(v[k], unidad));

/** Unidad de entrada; ni el borrador ni la base abandonan los metros. */
export function DimensionesSala({ valores, alCambiar, maximo = 9999.99, deshabilitado = false }: {
  valores: Dimensiones; alCambiar?: (valores: Dimensiones) => void; maximo?: number; deshabilitado?: boolean;
}) {
  const [canonico, setCanonico] = useState(valores);
  const [unidad, setUnidad] = useState<UnidadLongitud>('m');
  const [textos, setTextos] = useState(() => textosDe(valores, 'm'));
  const [anteriores, setAnteriores] = useState(valores);
  const [error, setError] = useState('');
  const campos = useRef<Array<HTMLInputElement | null>>([]);
  // Deshacer, plantilla nueva o recarga: la fuente externa manda. Una edición
  // propia ya fija anteriores antes del callback y conserva el texto en pies.
  if (!iguales(anteriores, valores)) {
    setAnteriores(valores); setCanonico(valores); setTextos(textosDe(valores, unidad)); setError('');
  }
  const conversiones = textos.map(texto => {
    try { return convertirLongitud(texto, unidad, maximo); } catch { return undefined; }
  });
  return <fieldset disabled={deshabilitado} className="space-y-3 min-w-0">
    <Campo etiqueta="Unidad de las dimensiones" ayuda="Largo, ancho y alto. El resto de campos conserva la unidad indicada.">
      <select name="unidad_dimensiones" value={unidad} onChange={ev => {
        if (conversiones.some(v => v === undefined)) { setError('Corrige la medida antes de cambiar de unidad.'); return; }
        const nueva = ev.target.value as UnidadLongitud;
        setUnidad(nueva); setTextos(textosDe(canonico, nueva)); setError('');
        campos.current.forEach(c => c?.setCustomValidity(''));
      }}><option value="m">Metros (m)</option><option value="ft">Pies (ft)</option></select>
    </Campo>
    <div className="grid grid-cols-3 gap-2">{CLAVES.map((clave, i) => <Campo key={clave} etiqueta={`${ETIQUETAS[i]} (${unidad})`}>
      <input ref={el => { campos.current[i] = el; el?.setCustomValidity(conversiones[i] === undefined ? 'Corrige la longitud inválida.' : ''); }} name={`entrada_${['largo', 'ancho', 'alto'][i]}`} type="text" inputMode="decimal"
        value={textos[i]} aria-invalid={conversiones[i] === undefined} className="w-full num" onChange={ev => {
          const texto = ev.target.value;
          setTextos(v => v.map((s, n) => n === i ? texto : s));
          try {
            const medida = convertirLongitud(texto, unidad, maximo);
            ev.target.setCustomValidity(''); setError('');
            const siguientes = { ...canonico, [clave]: medida?.metrosPersistidos ?? null };
            setCanonico(siguientes);
            if (alCambiar) { setAnteriores(siguientes); alCambiar(siguientes); }
          } catch (e) {
            const mensaje = e instanceof Error ? e.message : 'Medida inválida.';
            ev.target.setCustomValidity(mensaje); setError(mensaje);
          }
        }} />
    </Campo>)}</div>
    {unidad === 'ft' && <div className="text-xs text-tinta-tenue space-y-1" aria-live="polite">{conversiones.map((v, i) => v && <p key={CLAVES[i]}>
      {ETIQUETAS[i]}: {textoEnUnidad(v.metrosExactos, 'm')} m. Se guardará {textoEnUnidad(v.metrosPersistidos, 'm')} m.
    </p>)}</div>}
    {error && <p role="alert" className="text-sm">{error}</p>}
  </fieldset>;
}
