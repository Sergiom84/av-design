'use client';

import { useId } from 'react';
import { Boton, Campo } from '@/components/ui';
import type { Conexion, EquipoEnSala } from '@/lib/tipos';
import { anadirPunto, borrarPunto, limitarPuntoRuta, moverPunto, rutaDe, type RutaCableBorrador } from './rutas-cable';

export function PanelRutasCable({
  conexiones,
  equipos,
  rutas,
  conexionSeleccionada,
  puntoSeleccionado,
  altoSala,
  largoSala,
  anchoSala,
  soloLectura,
  alSeleccionarConexion,
  alSeleccionarPunto,
  alCambiar,
}: {
  conexiones: readonly Conexion[];
  equipos: readonly EquipoEnSala[];
  rutas: readonly RutaCableBorrador[];
  conexionSeleccionada: string | null;
  puntoSeleccionado: number | null;
  altoSala: number;
  largoSala: number;
  anchoSala: number;
  soloLectura: boolean;
  alSeleccionarConexion: (id: string | null) => void;
  alSeleccionarPunto: (orden: number | null) => void;
  alCambiar: (rutas: RutaCableBorrador[]) => void;
}) {
  // Plano monta el rail de escritorio y el panel móvil a la vez; CSS decide
  // cuál se ve. El id tiene que pertenecer a esta instancia o las dos
  // regiones acabarían apuntando al mismo título en el DOM.
  const tituloId = useId();
  const nombres = new Map(equipos.map((equipo) => [equipo.id, equipo.nombre]));
  const ruta = conexionSeleccionada ? rutaDe(rutas, conexionSeleccionada) : undefined;
  const punto = puntoSeleccionado == null ? undefined : ruta?.puntos[puntoSeleccionado];

  const etiqueta = (conexion: Conexion) =>
    `${nombres.get(conexion.origen_id) ?? 'Origen'} → ${nombres.get(conexion.destino_id) ?? 'Destino'} · ${conexion.senal}`;

  const cambiarCoordenada = (clave: 'x_m' | 'y_m' | 'z_m', valor: number) => {
    if (!ruta || !punto || puntoSeleccionado == null || !Number.isFinite(valor)) return;
    const limitado = limitarPuntoRuta(
      { ...punto, [clave]: valor },
      { largo_m: largoSala, ancho_m: anchoSala, alto_m: altoSala },
    );
    alCambiar(moverPunto(rutas, ruta.conexion_id, puntoSeleccionado, limitado));
  };

  return (
    <section className="space-y-3" aria-labelledby={tituloId}>
      <div>
        <h3 id={tituloId} className="font-semibold">Ruta del cable</h3>
        <p className="text-sm text-tinta-tenue">Los puntos siguen el recorrido desde el origen hasta el destino.</p>
      </div>

      <Campo etiqueta="Conexión">
        <select
          className="control min-h-11 w-full"
          value={conexionSeleccionada ?? ''}
          onChange={(ev) => {
            alSeleccionarConexion(ev.target.value || null);
            alSeleccionarPunto(null);
          }}
        >
          <option value="">Selecciona una conexión</option>
          {conexiones.map((conexion) => <option key={conexion.id} value={conexion.id}>{etiqueta(conexion)}</option>)}
        </select>
      </Campo>

      {ruta && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Puntos de paso">
            {ruta.puntos.map((actual, indice) => (
              <Boton
                key={actual.id ?? `${ruta.conexion_id}-${indice}`}
                tipo="button"
                variante={puntoSeleccionado === indice ? 'principal' : 'secundario'}
                className="min-h-11"
                aria-pressed={puntoSeleccionado === indice}
                onClick={() => alSeleccionarPunto(indice)}
              >
                Punto {indice + 1}
              </Boton>
            ))}
            {!soloLectura && (
              <Boton
                tipo="button"
                className="min-h-11"
                onClick={() => {
                  const ultimo = ruta.puntos.at(-1);
                  const siguiente = anadirPunto(rutas, ruta.conexion_id, {
                    x_m: ultimo?.x_m ?? largoSala / 2,
                    y_m: ultimo?.y_m ?? anchoSala / 2,
                    z_m: ultimo?.z_m ?? Math.min(2.4, altoSala),
                  });
                  alCambiar(siguiente);
                  alSeleccionarPunto(ruta.puntos.length);
                }}
              >
                Añadir punto
              </Boton>
            )}
          </div>

          {ruta.puntos.length === 0 && <p className="text-sm text-tinta-tenue">Ruta automática, sin puntos manuales.</p>}

          {punto && puntoSeleccionado != null && (
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="sr-only">Coordenadas del punto {puntoSeleccionado + 1}</legend>
              {(['x_m', 'y_m', 'z_m'] as const).map((clave) => (
                <Campo key={clave} etiqueta={`${clave[0].toUpperCase()} (m)`}>
                  <input
                    className="control min-h-11 w-full"
                    type="number"
                    min={0}
                    max={clave === 'x_m' ? largoSala : clave === 'y_m' ? anchoSala : altoSala}
                    step="0.01"
                    value={punto[clave]}
                    disabled={soloLectura}
                    onChange={(ev) => cambiarCoordenada(clave, Number(ev.target.value))}
                  />
                </Campo>
              ))}
              {!soloLectura && (
                <Boton
                  tipo="button"
                  className="col-span-3 min-h-11"
                  onClick={() => {
                    alCambiar(borrarPunto(rutas, ruta.conexion_id, puntoSeleccionado));
                    alSeleccionarPunto(null);
                  }}
                >
                  Borrar punto
                </Boton>
              )}
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
