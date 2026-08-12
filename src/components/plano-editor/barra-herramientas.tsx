'use client';

import { Boton, CampoCasilla } from '@/components/ui';
import { EstadoDeGuardado, type EstadoGuardado } from './estado-guardado';

export type Herramienta = 'seleccionar' | 'mover';

/**
 * La barra del editor. Todo lleva texto: no hay ningún control que sea solo un
 * icono, porque «mano» y «flecha» no significan lo mismo para quien entra por
 * primera vez y el departamento entra por primera vez cada pocos meses.
 *
 * Envuelve en varias líneas en vez de desbordar: el editor no puede ensanchar
 * la página ni siquiera con la barra.
 */
export function BarraHerramientas({
  herramienta,
  alCambiarHerramienta,
  zoom,
  alAcercar,
  alAlejar,
  alEncajar,
  rejilla,
  alCambiarRejilla,
  ajuste,
  alCambiarAjuste,
  puedeDeshacer,
  puedeRehacer,
  alDeshacer,
  alRehacer,
  hayCambios,
  guardando,
  alDescartar,
  alGuardar,
  estado,
  soloLectura,
}: {
  herramienta: Herramienta;
  alCambiarHerramienta: (h: Herramienta) => void;
  zoom: number;
  alAcercar: () => void;
  alAlejar: () => void;
  alEncajar: () => void;
  rejilla: boolean;
  alCambiarRejilla: (v: boolean) => void;
  ajuste: boolean;
  alCambiarAjuste: (v: boolean) => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  alDeshacer: () => void;
  alRehacer: () => void;
  hayCambios: boolean;
  guardando: boolean;
  alDescartar: () => void;
  alGuardar: () => void;
  estado: EstadoGuardado;
  soloLectura: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 border-b border-linea-suave">
      {!soloLectura && (
        <div className="flex items-center gap-1" role="group" aria-label="Herramienta">
          <Selector
            activo={herramienta === 'seleccionar'}
            onClick={() => alCambiarHerramienta('seleccionar')}
          >
            Seleccionar
          </Selector>
          <Selector
            activo={herramienta === 'mover'}
            onClick={() => alCambiarHerramienta('mover')}
          >
            Mover vista
          </Selector>
        </div>
      )}

      <div className="flex items-center gap-1" role="group" aria-label="Zoom">
        <Boton className="min-h-11 min-w-11" tipo="button" onClick={alAlejar} aria-label="Alejar">
          −
        </Boton>
        <span className="tabular-nums text-tinta-tenue min-w-[3.5rem] text-center">
          {Math.round(zoom * 100)} %
        </span>
        <Boton className="min-h-11 min-w-11" tipo="button" onClick={alAcercar} aria-label="Acercar">
          +
        </Boton>
        <Boton className="min-h-11" tipo="button" onClick={alEncajar}>
          Encajar sala
        </Boton>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CampoCasilla
          type="checkbox"
          checked={rejilla}
          onChange={(e) => alCambiarRejilla(e.target.checked)}
        >
          Rejilla
        </CampoCasilla>
        {!soloLectura && (
          <CampoCasilla
            type="checkbox"
            checked={ajuste}
            onChange={(e) => alCambiarAjuste(e.target.checked)}
          >
            Ajustar a rejilla
          </CampoCasilla>
        )}
      </div>

      {!soloLectura && (
        <>
          <div className="flex items-center gap-1" role="group" aria-label="Historial">
            <Boton className="min-h-11" tipo="button" onClick={alDeshacer} disabled={!puedeDeshacer}>
              Deshacer
            </Boton>
            <Boton className="min-h-11" tipo="button" onClick={alRehacer} disabled={!puedeRehacer}>
              Rehacer
            </Boton>
          </div>

          <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <span className="shrink-0 whitespace-nowrap">
              <EstadoDeGuardado estado={estado} />
            </span>
            <Boton className="min-h-11 whitespace-nowrap" tipo="button" onClick={alDescartar} disabled={!hayCambios || guardando}>
              Descartar
            </Boton>
            <Boton
              className="min-h-11 whitespace-nowrap"
              tipo="button"
              variante="principal"
              onClick={alGuardar}
              disabled={!hayCambios || guardando}
            >
              Guardar cambios
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}

function Selector({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Boton
      className="min-h-11"
      tipo="button"
      variante={activo ? 'principal' : 'secundario'}
      aria-pressed={activo}
      onClick={onClick}
    >
      {children}
    </Boton>
  );
}
