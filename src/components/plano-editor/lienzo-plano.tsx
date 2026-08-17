'use client';

import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { proyectar, type EscenaCroquis } from '@/lib/croquis';
import { comoViewBox, type Seleccion, type Vista } from '@/lib/plano-editor';
import {
  GeometriaPlano,
  cajaDelEquipo,
  cajaDelMueble,
  giroEnPantalla,
} from '@/components/croquis/plano-sala';
import type { Herramienta } from './barra-herramientas';

/**
 * El lienzo del editor.
 *
 * Pinta la MISMA geometría que el croquis de Resumen (`GeometriaPlano`) y le
 * añade dos capas: la rejilla debajo y las zonas de agarre encima. No hay un
 * segundo motor de dibujo, y por eso una posición confirmada da el mismo plano
 * aquí, en Resumen y después de recargar.
 *
 * El zoom y la panorámica mueven el `viewBox` del propio SVG: el lienzo nunca
 * ensancha la página, ni con una sala de veinte metros ni al 800 %.
 *
 * El SVG NO es la interfaz accesible. Es `role="img"` con su descripción, y
 * todo lo que se puede hacer arrastrando se puede hacer desde la lista de
 * objetos y el inspector, que son controles de verdad. Un `<rect>` arrastrable
 * no es un control por mucho `tabindex` que se le ponga.
 */

/** Ancho de referencia de la proyección. El SVG se estira por CSS. */
export const ANCHO_BASE_PX = 900;

export interface PuntoMetros {
  x_m: number;
  y_m: number;
}

export function LienzoPlano({
  escena,
  vista,
  seleccion,
  herramienta,
  rejilla,
  soloLectura,
  alSeleccionar,
  alMenuContextual,
  alArrastrar,
  alSoltar,
  alDesplazarVista,
  alSoltarDesdeBandeja,
  previsualizacion,
  svgRef,
}: {
  escena: EscenaCroquis;
  vista: Vista;
  seleccion: Seleccion;
  herramienta: Herramienta;
  rejilla: boolean;
  soloLectura: boolean;
  alSeleccionar: (s: Seleccion) => void;
  /**
   * Botón derecho sobre un objeto. El punto llega en coordenadas de ventana
   * porque el menú se ancla ahí, no dentro del SVG: un menú dibujado en el
   * lienzo se recorta con el `viewBox` y se escala con el zoom.
   *
   * Es opcional a propósito: el lienzo tiene que seguir funcionando sin menú,
   * porque el botón derecho nunca puede ser el único camino a una operación.
   */
  alMenuContextual?: (s: Exclude<Seleccion, null>, punto: { x: number; y: number }) => void;
  alArrastrar: (s: Exclude<Seleccion, null>, punto: PuntoMetros) => void;
  alSoltar: () => void;
  alDesplazarVista: (dx: number, dy: number) => void;
  /**
   * Dónde se ha soltado algo que venía de la bandeja lateral. Devuelve `true`
   * si lo ha recogido, para que el lienzo no lo confunda con un clic al aire y
   * quite la selección.
   */
  alSoltarDesdeBandeja?: (punto: PuntoMetros) => boolean;
  /** Dónde caería lo que se está arrastrando desde la bandeja lateral. */
  previsualizacion?: PuntoMetros | null;
  /** El editor necesita el SVG para convertir el puntero a metros. */
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const propio = useRef<SVGSVGElement>(null);
  const svg = svgRef ?? propio;
  const arrastre = useRef<
    | { tipo: 'objeto'; objetivo: Exclude<Seleccion, null>; dx_m: number; dy_m: number }
    | { tipo: 'vista'; x: number; y: number }
    | null
  >(null);

  const p = proyectar(escena, { ancho_px: ANCHO_BASE_PX });

  /** Del puntero a coordenadas del `viewBox`. */
  const enLienzo = (ev: { clientX: number; clientY: number }) => {
    const elemento = svg.current;
    if (!elemento) return { x: 0, y: 0 };
    const ctm = elemento.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const punto = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return { x: punto.x, y: punto.y };
  };

  const enMetros = (ev: { clientX: number; clientY: number }): PuntoMetros => {
    const { x, y } = enLienzo(ev);
    return { x_m: p.aMetrosX(x), y_m: p.aMetrosY(y) };
  };

  const empezarObjeto = (
    ev: ReactPointerEvent,
    objetivo: Exclude<Seleccion, null>,
    ancla: PuntoMetros,
  ) => {
    alSeleccionar(objetivo);
    if (soloLectura || herramienta !== 'seleccionar') return;
    ev.stopPropagation();
    const punto = enMetros(ev);
    // Se guarda el desfase entre el puntero y el ancla del objeto: sin esto,
    // agarrar una pantalla por la esquina la centraría de golpe bajo el dedo.
    arrastre.current = {
      tipo: 'objeto',
      objetivo,
      dx_m: ancla.x_m - punto.x_m,
      dy_m: ancla.y_m - punto.y_m,
    };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };

  const empezarVista = (ev: ReactPointerEvent) => {
    if (herramienta !== 'mover') {
      // Un puntero que viene de la bandeja no está haciendo clic al aire:
      // está soltando algo. Se coloca ahí y no se pierde la selección.
      if (alSoltarDesdeBandeja?.(enMetros(ev))) return;
      alSeleccionar(null);
      return;
    }
    const { x, y } = enLienzo(ev);
    arrastre.current = { tipo: 'vista', x, y };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  };

  const mover = (ev: ReactPointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    if (a.tipo === 'vista') {
      const { x, y } = enLienzo(ev);
      alDesplazarVista(a.x - x, a.y - y);
      return;
    }
    const punto = enMetros(ev);
    alArrastrar(a.objetivo, { x_m: punto.x_m + a.dx_m, y_m: punto.y_m + a.dy_m });
  };

  const soltar = () => {
    if (arrastre.current?.tipo === 'objeto') alSoltar();
    arrastre.current = null;
  };

  /**
   * El botón derecho sobre un objeto: lo selecciona y pide el menú.
   *
   * Selecciona antes de abrir porque el menú actúa sobre lo seleccionado, y
   * porque quien pulsa con el derecho sobre una silla espera que el menú hable
   * de esa silla y no de lo que hubiera antes. `preventDefault` quita el menú
   * del navegador, que aquí no ofrece nada útil.
   *
   * Sin `alMenuContextual` no se intercepta nada: el navegador hace lo suyo y
   * el lienzo se comporta como siempre.
   */
  const menuDe = (objetivo: Exclude<Seleccion, null>) =>
    alMenuContextual
      ? (ev: ReactMouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          alSeleccionar(objetivo);
          alMenuContextual(objetivo, { x: ev.clientX, y: ev.clientY });
        }
      : undefined;

  const seleccionado = (s: Exclude<Seleccion, null>) =>
    seleccion?.tipo === s.tipo &&
    ('id' in s ? 'id' in seleccion && seleccion.id === s.id : true);

  const cursor =
    herramienta === 'mover' ? 'cursor-grab' : soloLectura ? 'cursor-default' : 'cursor-pointer';

  return (
    <svg
      ref={svg}
      viewBox={comoViewBox(vista)}
      // `touch-none` es lo que hace que el arrastre táctil funcione: sin él el
      // navegador se queda el gesto para hacer scroll de la página.
      className={`w-full h-auto block touch-none ${cursor}`}
      role="img"
      aria-label={`Plano en planta de ${escena.titulo}. Los objetos se seleccionan y se mueven desde la lista y el inspector de la derecha.`}
      xmlns="http://www.w3.org/2000/svg"
      onPointerDown={empezarVista}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <rect width="100%" height="100%" fill="var(--fondo)" />
      {rejilla && <Rejilla p={p} escena={escena} />}

      <GeometriaPlano p={p} escena={escena} />

      {/* Previsualización de colocación: dónde caería lo que viene de la
          bandeja. Discontinua y sin relleno, para que no se confunda con algo
          que ya está puesto. */}
      {previsualizacion && (
        <g pointerEvents="none" aria-hidden="true">
          <circle
            cx={p.x(previsualizacion.x_m)}
            cy={p.y(previsualizacion.y_m)}
            r={14}
            fill="none"
            stroke="var(--acento)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <line
            x1={p.x(previsualizacion.x_m) - 20}
            y1={p.y(previsualizacion.y_m)}
            x2={p.x(previsualizacion.x_m) + 20}
            y2={p.y(previsualizacion.y_m)}
            stroke="var(--acento)"
            strokeWidth={1}
          />
          <line
            x1={p.x(previsualizacion.x_m)}
            y1={p.y(previsualizacion.y_m) - 20}
            x2={p.x(previsualizacion.x_m)}
            y2={p.y(previsualizacion.y_m) + 20}
            stroke="var(--acento)"
            strokeWidth={1}
          />
        </g>
      )}

      {/* Zonas de agarre. Transparentes y encima del dibujo: lo que se ve lo
          pinta la geometría compartida; esto solo recoge el puntero. */}
      <g>
        {escena.mesa && (
          <Agarre
            activo={seleccionado({ tipo: 'mesa' })}
            x={p.x(escena.mesa.centro.x_m) - p.d(escena.mesa.largo_m) / 2}
            y={p.y(escena.mesa.centro.y_m) - p.d(escena.mesa.ancho_m) / 2}
            ancho={p.d(escena.mesa.largo_m)}
            alto={p.d(escena.mesa.ancho_m)}
            giro={
              escena.mesa.rotacion_grados
                ? `rotate(${-escena.mesa.rotacion_grados} ${p.x(escena.mesa.centro.x_m)} ${p.y(escena.mesa.centro.y_m)})`
                : undefined
            }
            onPointerDown={(ev) =>
              empezarObjeto(ev, { tipo: 'mesa' }, {
                x_m: escena.mesa!.centro.x_m,
                y_m: escena.mesa!.centro.y_m,
              })
            }
            onContextMenu={menuDe({ tipo: 'mesa' })}
          />
        )}

        {escena.muebles.map((m) => {
          const caja = cajaDelMueble(p, m);
          return (
            <Agarre
              key={m.id}
              activo={seleccionado({ tipo: 'mueble', id: m.id })}
              x={caja.x}
              y={caja.y}
              ancho={caja.ancho}
              alto={caja.alto}
              giro={giroEnPantalla(p, m.rotacion_grados, m.x_m, m.y_m)}
              onPointerDown={(ev) =>
                empezarObjeto(ev, { tipo: 'mueble', id: m.id }, { x_m: m.x_m, y_m: m.y_m })
              }
              onContextMenu={menuDe({ tipo: 'mueble', id: m.id })}
            />
          );
        })}

        {escena.equipos.map((e) => {
          const caja = cajaDelEquipo(p, escena, e);
          return (
            <Agarre
              key={e.id}
              activo={seleccionado({ tipo: 'equipo', id: e.id })}
              x={caja.x}
              y={caja.y}
              ancho={caja.ancho}
              alto={caja.alto}
              giro={giroEnPantalla(p, e.rotacion_grados, e.x_m, e.y_m)}
              onPointerDown={(ev) =>
                empezarObjeto(ev, { tipo: 'equipo', id: e.id }, { x_m: e.x_m, y_m: e.y_m })
              }
              onContextMenu={menuDe({ tipo: 'equipo', id: e.id })}
            />
          );
        })}

        {escena.tomas.map((t) => (
          <Agarre
            key={t.id}
            activo={seleccionado({ tipo: 'toma', id: t.id })}
            x={p.x(t.x_m) - 9}
            y={p.y(t.y_m) - 9}
            ancho={18}
            alto={18}
            onPointerDown={(ev) =>
              empezarObjeto(ev, { tipo: 'toma', id: t.id }, { x_m: t.x_m, y_m: t.y_m })
            }
            onContextMenu={menuDe({ tipo: 'toma', id: t.id })}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * La zona de agarre de un objeto y, cuando está seleccionado, su contorno.
 *
 * El contorno se dibuja con trazo doble —uno claro debajo y el de acento
 * encima— para que se vea igual sobre la mesa clara y sobre el relleno oscuro
 * de un equipo colocado, sin depender solo del color.
 */
function Agarre({
  activo,
  x,
  y,
  ancho,
  alto,
  giro,
  onPointerDown,
  onContextMenu,
}: {
  activo: boolean;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  giro?: string;
  onPointerDown: (ev: ReactPointerEvent) => void;
  onContextMenu?: (ev: ReactMouseEvent) => void;
}) {
  const margen = 3;
  return (
    <g transform={giro}>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={alto}
        fill="transparent"
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      />
      {activo && (
        <>
          <rect
            x={x - margen}
            y={y - margen}
            width={ancho + margen * 2}
            height={alto + margen * 2}
            fill="none"
            stroke="var(--superficie)"
            strokeWidth={4}
            pointerEvents="none"
          />
          <rect
            x={x - margen}
            y={y - margen}
            width={ancho + margen * 2}
            height={alto + margen * 2}
            fill="none"
            stroke="var(--acento)"
            strokeWidth={2}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  );
}

/** Medio metro entre líneas: es como se lee un plano de sala a esta escala. */
const PASO_REJILLA_DIBUJO_M = 0.5;

function Rejilla({ p, escena }: { p: ReturnType<typeof proyectar>; escena: EscenaCroquis }) {
  const { largo_m, ancho_m } = escena.sala;
  if (!largo_m || !ancho_m) return null;

  const verticales: number[] = [];
  for (let m = 0; m <= largo_m + 1e-9; m += PASO_REJILLA_DIBUJO_M) verticales.push(m);
  const horizontales: number[] = [];
  for (let m = 0; m <= ancho_m + 1e-9; m += PASO_REJILLA_DIBUJO_M) horizontales.push(m);

  return (
    <g stroke="var(--linea)" strokeWidth={0.5} aria-hidden="true">
      {verticales.map((m) => (
        <line key={`v${m}`} x1={p.x(m)} y1={p.y(0)} x2={p.x(m)} y2={p.y(ancho_m)} />
      ))}
      {horizontales.map((m) => (
        <line key={`h${m}`} x1={p.x(0)} y1={p.y(m)} x2={p.x(largo_m)} y2={p.y(m)} />
      ))}
    </g>
  );
}
