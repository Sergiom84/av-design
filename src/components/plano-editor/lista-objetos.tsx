'use client';

import { ETIQUETA_EXTREMO } from '@/lib/tipos';
import { estadoDelMueble, type BorradorPlano, type MuebleBorrador, type Seleccion } from '@/lib/plano-editor';

/**
 * Los objetos de la sala, en una lista de botones de verdad.
 *
 * Es la vía accesible para seleccionar —Tab y Enter llegan a todo— y también
 * la práctica: dos equipos deducidos al centro de la mesa se tapan en el
 * dibujo y aquí no. No es un duplicado del lienzo, es su índice.
 *
 * El mobiliario y el equipamiento se parten en `Por colocar` y `Colocados`.
 * Añadir ocho sillas y no volver a saber cuáles faltan por poner es
 * exactamente el momento en el que se pierde la cuenta.
 */
export function ListaObjetos({
  borrador,
  seleccion,
  alSeleccionar,
  arrastreDeBandeja,
}: {
  borrador: BorradorPlano;
  seleccion: Seleccion;
  alSeleccionar: (s: Seleccion) => void;
  /**
   * Los manejadores de puntero para arrastrar una fila hasta el lienzo. Los
   * pone el editor, que es quien sabe convertir la pantalla a metros.
   *
   * Van en un tirador aparte y no en la fila entera: la fila es un botón de
   * selección y tiene que seguir siéndolo con teclado y con lector de
   * pantalla. Arrastrar es un extra del ratón y del dedo, nunca el único
   * camino.
   */
  arrastreDeBandeja?: (objetivo: Exclude<Seleccion, null>) => {
    onPointerDown: (ev: React.PointerEvent) => void;
    onPointerMove: (ev: React.PointerEvent) => void;
    onPointerUp: (ev: React.PointerEvent) => void;
    onPointerCancel: (ev: React.PointerEvent) => void;
  };
}) {
  const activo = (s: Exclude<Seleccion, null>) =>
    seleccion?.tipo === s.tipo && ('id' in s ? 'id' in seleccion && seleccion.id === s.id : true);

  return (
    <nav aria-label="Objetos de la sala" className="min-w-0">
      <ul className="divide-y divide-linea-suave">
        <li>
          <Fila
            activo={activo({ tipo: 'sala' })}
            onClick={() => alSeleccionar({ tipo: 'sala' })}
            titulo="Sala"
            detalle={
              borrador.largo_m && borrador.ancho_m
                ? `${metros(borrador.largo_m)} × ${metros(borrador.ancho_m)} m`
                : 'sin medir'
            }
          />
        </li>

        {borrador.mesa_largo_m && borrador.mesa_ancho_m ? (
          <li>
            <Fila
              activo={activo({ tipo: 'mesa' })}
              onClick={() => alSeleccionar({ tipo: 'mesa' })}
              titulo="Mesa"
              detalle={`${metros(borrador.mesa_largo_m)} × ${metros(borrador.mesa_ancho_m)} m${
                borrador.mesa_rotacion_grados ? ` · ${borrador.mesa_rotacion_grados}°` : ''
              }`}
            />
          </li>
        ) : null}

        {grupos(borrador.mobiliario).map(({ titulo, muebles }) => (
          <li key={titulo}>
            <p className="px-3 pt-3 pb-1 t-etiqueta text-tinta-tenue">
              {titulo} ({muebles.length})
            </p>
            <ul>
              {muebles.map((m) => (
                <li key={m.id}>
                  <Fila
                    activo={activo({ tipo: 'mueble', id: m.id })}
                    onClick={() => alSeleccionar({ tipo: 'mueble', id: m.id })}
                    titulo={m.nombre}
                    detalle={detalleDeMueble(m)}
                    tenue={estadoDelMueble(m) !== 'colocado'}
                    arrastre={
                      estadoDelMueble(m) === 'sin_medir'
                        ? undefined
                        : arrastreDeBandeja?.({ tipo: 'mueble', id: m.id })
                    }
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}

        {borrador.equipos.map((e) => (
          <li key={e.id}>
            <Fila
              activo={activo({ tipo: 'equipo', id: e.id })}
              onClick={() => alSeleccionar({ tipo: 'equipo', id: e.id })}
              titulo={e.cantidad > 1 ? `${e.nombre} ×${e.cantidad}` : e.nombre}
              detalle={
                (e.posicion_confirmada
                  ? `${ETIQUETA_EXTREMO[e.extremo]} · X ${metros(e.x_m)} Y ${metros(e.y_m)}`
                  : `${ETIQUETA_EXTREMO[e.extremo]} · posición estimada`) +
                (e.rotacion_grados ? ` · ${e.rotacion_grados}°` : '') +
                (e.es_nuevo ? ' · sin guardar' : '')
              }
              tenue={!e.posicion_confirmada}
              arrastre={arrastreDeBandeja?.({ tipo: 'equipo', id: e.id })}
            />
          </li>
        ))}

        {borrador.tomas.map((t) => (
          <li key={t.id}>
            <Fila
              activo={activo({ tipo: 'toma', id: t.id })}
              onClick={() => alSeleccionar({ tipo: 'toma', id: t.id })}
              titulo={`Toma ${t.codigo}`}
              detalle={
                t.x_m != null && t.y_m != null
                  ? `X ${metros(t.x_m)} Y ${metros(t.y_m)}`
                  : 'sin situar en el plano'
              }
              tenue={t.x_m == null || t.y_m == null}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Fila({
  activo,
  onClick,
  titulo,
  detalle,
  tenue = false,
  arrastre,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
  tenue?: boolean;
  arrastre?: {
    onPointerDown: (ev: React.PointerEvent) => void;
    onPointerMove: (ev: React.PointerEvent) => void;
    onPointerUp: (ev: React.PointerEvent) => void;
    onPointerCancel: (ev: React.PointerEvent) => void;
  };
}) {
  return (
    <div
      className={`flex items-stretch border-l-2 ${
        activo
          ? 'border-acento bg-acento-suave'
          : 'border-transparent hover:bg-superficie-hundida'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={activo ? 'true' : undefined}
        // 44 px de alto mínimo: es un objetivo táctil, no una fila de tabla.
        className="flex-1 min-w-0 text-left px-3 py-2 min-h-[44px]"
      >
        <span className="block font-medium [overflow-wrap:anywhere]">{titulo}</span>
        <span
          className={`block text-[0.75rem] tabular-nums ${tenue ? 'text-aviso-fuerte' : 'text-tinta-tenue'}`}
        >
          {detalle}
        </span>
      </button>

      {arrastre && (
        // `touch-none` para que el navegador no se quede el gesto y lo
        // convierta en scroll de la página, igual que en el lienzo.
        <span
          role="presentation"
          aria-hidden="true"
          {...arrastre}
          className="shrink-0 w-11 min-h-[44px] flex items-center justify-center touch-none cursor-grab text-tinta-tenue select-none"
          title="Arrastrar al plano"
        >
          ⠿
        </span>
      )}
    </div>
  );
}

const metros = (n: number): string => n.toFixed(2).replace('.', ',');

/** Los muebles partidos en dos: lo que falta por poner y lo que ya está. */
function grupos(
  mobiliario: MuebleBorrador[],
): Array<{ titulo: string; muebles: MuebleBorrador[] }> {
  const colocados = mobiliario.filter((m) => estadoDelMueble(m) === 'colocado');
  const pendientes = mobiliario.filter((m) => estadoDelMueble(m) !== 'colocado');
  return [
    { titulo: 'Por colocar', muebles: pendientes },
    { titulo: 'Colocados', muebles: colocados },
  ].filter((g) => g.muebles.length > 0);
}

/** Qué le falta a este mueble, o dónde está. Y si todavía no está guardado. */
function detalleDeMueble(m: MuebleBorrador): string {
  const giro = m.rotacion_grados ? ` · ${m.rotacion_grados}°` : '';
  const nuevo = m.es_nuevo ? ' · sin guardar' : '';
  switch (estadoDelMueble(m)) {
    case 'sin_medir':
      return `Sin medir${giro}${nuevo}`;
    case 'sin_colocar':
      return `Sin colocar${giro}${nuevo}`;
    default:
      return `X ${metros(m.x_m ?? 0)} Y ${metros(m.y_m ?? 0)}${giro}${nuevo}`;
  }
}
