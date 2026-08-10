'use client';

import { useId, useState } from 'react';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { BuscadorMobiliario } from '@/components/catalogo/buscador-mobiliario';
import { MAXIMO_ALTA_MOBILIARIO } from '@/lib/plano-editor';
import type { ArticuloElegible, MuebleCatalogo } from '@/lib/tipos';

/**
 * `Añadir elementos`: las dos cajas de búsqueda del lateral del editor.
 *
 * Son dos y no una porque son dos catálogos. Una silla no se pide a un
 * proveedor de audiovisuales y no está en `articulos`; un soporte de pantalla
 * no es mobiliario. Buscar «mesa» en la caja de equipamiento devolviendo
 * soportes sería el mismo error que meter las sillas en el catálogo AV.
 *
 * Las dos secciones se pliegan con `<details>` y no con estado: así el
 * navegador se encarga del teclado y del anuncio de abierto/cerrado, y la
 * pestaña sigue funcionando mientras el JavaScript carga.
 *
 * Añadir no escribe en la base: entra en el borrador y se guarda con el
 * resto. Por eso el botón dice `Añadir` y no `Guardar`.
 */
export function BibliotecaElementos({
  categorias,
  alAnadirMuebles,
  alAnadirEquipo,
}: {
  /** Las secciones del catálogo de mobiliario, para el filtro. */
  categorias: string[];
  alAnadirMuebles: (mueble: MuebleCatalogo, cantidad: number) => void;
  alAnadirEquipo: (articulo: ArticuloElegible) => void;
}) {
  const [categoria, setCategoria] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [elegido, setElegido] = useState<MuebleCatalogo | null>(null);
  const [anadido, setAnadido] = useState<string | null>(null);
  const base = useId();

  const anadirMuebles = () => {
    if (!elegido) return;
    alAnadirMuebles(elegido, cantidad);
    setAnadido(
      cantidad === 1 ? `${elegido.nombre} añadida` : `${cantidad} × ${elegido.nombre} añadidas`,
    );
    setElegido(null);
    setCantidad(1);
  };

  return (
    <div className="p-4 border-b border-linea space-y-3">
      <h3 className="t-subtitulo">Añadir elementos</h3>

      <details className="group">
        <summary className="cursor-pointer py-2 min-h-11 flex items-center">
          Mobiliario
        </summary>

        <div className="space-y-3 pb-2">
          <div>
            <label htmlFor={`${base}cat`} className="t-etiqueta block mb-1">
              Sección
            </label>
            <select
              id={`${base}cat`}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full min-h-11"
            >
              <option value="">Todo el mobiliario</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <BuscadorMobiliario
            categoria={categoria || undefined}
            alElegir={(m) => setElegido(m)}
          />

          {elegido && (
            <p className="text-tinta-tenue">
              Elegido: <strong className="text-tinta">{elegido.nombre}</strong>
            </p>
          )}

          <div className="flex items-end gap-2">
            <div className="w-24">
              <label htmlFor={`${base}n`} className="t-etiqueta block mb-1">
                Cantidad
              </label>
              {/* Cada unidad será una fila arrastrable: ocho sillas son ocho
                  sillas, no una línea con cantidad ocho. */}
              <input
                id={`${base}n`}
                type="number"
                min={1}
                max={MAXIMO_ALTA_MOBILIARIO}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
                className="w-full min-h-11"
              />
            </div>
            <button
              type="button"
              onClick={anadirMuebles}
              disabled={!elegido}
              className="boton min-h-11 px-4 disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer py-2 min-h-11 flex items-center">
          Equipamiento
        </summary>

        <div className="pb-2">
          <BuscadorArticulo
            etiqueta="Buscar equipamiento"
            marcador="Marca, modelo o referencia"
            // Solo equipos: un cable o un consumible no va en el plano, va en
            // la tabla de cables y en la lista de material.
            tipo="equipo"
            className="w-full"
            vaciarAlElegir
            alElegir={(a) => {
              if (!a) return;
              alAnadirEquipo(a);
              setAnadido(`${a.etiqueta} añadido`);
            }}
          />
          <p className="mt-2 text-tinta-tenue text-[0.75rem]">
            Entra sin colocar: se sitúa arrastrándolo o con `Colocar en el centro`.
          </p>
        </div>
      </details>

      {/* Quien no ve la lista tiene que enterarse igual de que se añadió. */}
      <span className="sr-only" role="status" aria-live="polite">
        {anadido ?? ''}
      </span>
      {anadido && <p className="text-tinta-tenue">{anadido}. Sin guardar todavía.</p>}
    </div>
  );
}
