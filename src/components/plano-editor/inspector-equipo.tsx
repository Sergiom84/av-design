'use client';

import { Aviso, Boton, Campo, Estado } from '@/components/ui';
import { ETIQUETA_EXTREMO, type Extremo } from '@/lib/tipos';
import { editarEquipo, type BorradorPlano, type EquipoBorrador } from '@/lib/plano-editor';
import { CampoMetros } from './campos-plano';

const EXTREMOS = Object.keys(ETIQUETA_EXTREMO) as Extremo[];

/**
 * Un equipo del plano.
 *
 * La posición estimada se dice con texto, no solo con el trazo discontinuo del
 * dibujo: es la diferencia entre orientarse y taladrar. Y se dice también que
 * moverlo cambia los metros, porque en esta aplicación mover un equipo no es
 * un retoque estético: cambia la tirada, el material y el pedido.
 */
export function InspectorEquipo({
  equipo,
  borrador,
  posicionDibujada,
  alCambiar,
  soloLectura,
}: {
  equipo: EquipoBorrador;
  borrador: BorradorPlano;
  /** Dónde lo pinta el croquis mientras está estimado. */
  posicionDibujada: { x_m: number; y_m: number; z_m: number } | null;
  alCambiar: (b: BorradorPlano) => void;
  soloLectura: boolean;
}) {
  const editar = (cambios: Parameters<typeof editarEquipo>[2]) =>
    alCambiar(editarEquipo(borrador, equipo.id, cambios));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium [overflow-wrap:anywhere]">{equipo.nombre}</span>
        {equipo.cantidad > 1 && <Estado tono="informacion">×{equipo.cantidad}</Estado>}
      </div>

      {equipo.cantidad > 1 && (
        <Aviso tono="neutro">
          Esta línea son {equipo.cantidad} unidades con una sola posición. Para colocarlas
          por separado hay que separarlas en líneas distintas desde Equipamiento.
        </Aviso>
      )}

      {!equipo.posicion_confirmada && (
        <Aviso tono="aviso">
          Posición estimada: está donde suele ir, no donde se ha medido. Sirve para
          orientarse, no para taladrar.
          {!soloLectura && posicionDibujada && (
            <div className="mt-2">
              <Boton
                tipo="button"
                onClick={() =>
                  editar({
                    x_m: posicionDibujada.x_m,
                    y_m: posicionDibujada.y_m,
                    z_m: posicionDibujada.z_m,
                    posicion_confirmada: true,
                  })
                }
              >
                Confirmar esta posición
              </Boton>
            </div>
          )}
        </Aviso>
      )}

      <CampoMetros
        etiqueta="X"
        valor={equipo.x_m}
        alCambiar={(n) => editar({ x_m: n ?? 0 })}
        ayuda="Desde la esquina inferior izquierda, a lo largo de la sala."
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Y"
        valor={equipo.y_m}
        alCambiar={(n) => editar({ y_m: n ?? 0 })}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Z"
        valor={equipo.z_m}
        alCambiar={(n) => editar({ z_m: n ?? 0 })}
        ayuda="Altura desde el suelo. Cambia los metros de la tirada."
        deshabilitado={soloLectura}
      />

      <Campo
        etiqueta="Extremo"
        ayuda="Decide la holgura que se deja y, si no está colocado, dónde lo dibuja el plano."
      >
        <select
          value={equipo.extremo}
          disabled={soloLectura}
          onChange={(ev) => editar({ extremo: ev.target.value as Extremo })}
        >
          {EXTREMOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_EXTREMO[e]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Toma de red" ayuda="En qué roseta de la sala pincha este equipo.">
        <select
          value={equipo.toma_red_id ?? ''}
          disabled={soloLectura}
          onChange={(ev) => editar({ toma_red_id: ev.target.value || null })}
        >
          <option value="">Ninguna</option>
          {borrador.tomas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo}
            </option>
          ))}
        </select>
      </Campo>
    </div>
  );
}
