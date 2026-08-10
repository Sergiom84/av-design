'use client';

import { useCallback } from 'react';
import { ComboboxRemoto, type OpcionCombobox } from './combobox-remoto';
import type { MuebleCatalogo } from '@/lib/tipos';

type OpcionMueble = OpcionCombobox & { mueble: MuebleCatalogo };

/** `0,50 × 0,50 m`, o el aviso de que todavía no tiene medidas. */
export function medidasDeMueble(m: {
  largo_m_defecto: number | null;
  ancho_m_defecto: number | null;
}): string {
  if (m.largo_m_defecto == null || m.ancho_m_defecto == null) return 'Sin medir';
  const n = (v: number) => v.toFixed(2).replace('.', ',');
  return `${n(m.largo_m_defecto)} × ${n(m.ancho_m_defecto)} m`;
}

/**
 * Elegir un mueble para el plano.
 *
 * Es el gemelo de `BuscadorArticulo` y comparte con él todo el combobox; lo
 * único distinto es que pregunta a `/api/mobiliario`. Son dos cajas separadas
 * a propósito: una silla no está en el catálogo AV, y mezclarlas devolvería
 * soportes de pantalla al teclear «mesa».
 *
 * El resultado enseña la sección y las medidas, o `Sin medir` cuando el
 * departamento todavía no ha medido esa referencia: así se sabe antes de
 * añadirla que habrá que darle largo y ancho.
 */
export function BuscadorMobiliario({
  etiqueta = 'Buscar mobiliario',
  categoria,
  marcador = 'Silla, mesa…',
  className = 'w-full',
  alElegir,
}: {
  etiqueta?: string;
  /** Filtro de sección. Vacío = todo el mobiliario. */
  categoria?: string;
  marcador?: string;
  className?: string;
  alElegir: (mueble: MuebleCatalogo | null) => void;
}) {
  const buscar = useCallback(
    async (consulta: string, signal: AbortSignal): Promise<OpcionMueble[]> => {
      const parametros = new URLSearchParams({ q: consulta });
      if (categoria) parametros.set('categoria', categoria);
      const respuesta = await fetch(`/api/mobiliario?${parametros}`, { signal });
      const lista: MuebleCatalogo[] = respuesta.ok ? await respuesta.json() : [];
      return lista.map((m) => ({
        id: m.id,
        etiqueta: m.nombre,
        detalle: `${m.categoria} · ${medidasDeMueble(m)}`,
        mueble: m,
      }));
    },
    [categoria],
  );

  return (
    <ComboboxRemoto
      etiqueta={etiqueta}
      marcador={marcador}
      className={className}
      buscar={buscar}
      // Elegir aquí es añadir: dejar el texto puesto invita a añadir dos veces
      // lo mismo sin darse cuenta.
      vaciarAlElegir
      etiquetaLista="Mobiliario"
      nombreColeccion={['mueble', 'muebles']}
      vacio="Sin mobiliario que coincida"
      mensajeInvalido="Elige un mueble de la lista."
      alElegir={(o) => alElegir(o ? (o as OpcionMueble).mueble : null)}
    />
  );
}
