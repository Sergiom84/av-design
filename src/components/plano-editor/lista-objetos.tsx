'use client';

import { ETIQUETA_EXTREMO } from '@/lib/tipos';
import type { BorradorPlano, Seleccion } from '@/lib/plano-editor';

/**
 * Los objetos de la sala, en una lista de botones de verdad.
 *
 * Es la vía accesible para seleccionar —Tab y Enter llegan a todo— y también
 * la práctica: dos equipos deducidos al centro de la mesa se tapan en el
 * dibujo y aquí no. No es un duplicado del lienzo, es su índice.
 */
export function ListaObjetos({
  borrador,
  seleccion,
  alSeleccionar,
}: {
  borrador: BorradorPlano;
  seleccion: Seleccion;
  alSeleccionar: (s: Seleccion) => void;
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

        {borrador.equipos.map((e) => (
          <li key={e.id}>
            <Fila
              activo={activo({ tipo: 'equipo', id: e.id })}
              onClick={() => alSeleccionar({ tipo: 'equipo', id: e.id })}
              titulo={e.cantidad > 1 ? `${e.nombre} ×${e.cantidad}` : e.nombre}
              detalle={
                e.posicion_confirmada
                  ? `${ETIQUETA_EXTREMO[e.extremo]} · X ${metros(e.x_m)} Y ${metros(e.y_m)}`
                  : `${ETIQUETA_EXTREMO[e.extremo]} · posición estimada`
              }
              tenue={!e.posicion_confirmada}
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
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
  tenue?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? 'true' : undefined}
      // 44 px de alto mínimo: es un objetivo táctil, no una fila de tabla.
      className={`w-full text-left px-3 py-2 min-h-[44px] border-l-2 ${
        activo
          ? 'border-acento bg-acento-suave'
          : 'border-transparent hover:bg-superficie-hundida'
      }`}
    >
      <span className="block font-medium [overflow-wrap:anywhere]">{titulo}</span>
      <span
        className={`block text-[0.75rem] tabular-nums ${tenue ? 'text-aviso-fuerte' : 'text-tinta-tenue'}`}
      >
        {detalle}
      </span>
    </button>
  );
}

const metros = (n: number): string => n.toFixed(2).replace('.', ',');
