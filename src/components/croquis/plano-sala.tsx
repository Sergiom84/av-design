import { proyectar, type EscenaCroquis, type Proyeccion } from '@/lib/croquis';
import type { Senal } from '@/lib/tipos';

/**
 * El croquis de la sala en SVG, dibujado en el servidor y sin JavaScript.
 *
 * Es el plano que el departamento hacía a mano, hecho con los datos que ya
 * están en la base: si mañana la sala pasa a medir 5,20 m, el dibujo mide 5,20
 * m sin que nadie redibuje nada. La escena la construye `src/lib/croquis.ts`;
 * aquí solo se pinta.
 *
 * Sin JavaScript a propósito: se imprime, se guarda como imagen y se abre en el
 * móvil de quien está en la sala sin esperar a que cargue nada.
 */

/** Las tiradas van en color por señal, como en el plano de mano. */
const COLOR_SENAL: Record<Senal, string> = {
  hdmi: 'var(--alerta)',
  red: 'var(--acento)',
  usb: 'var(--aviso)',
  audio_linea: '#4a5b7a',
  audio_altavoz: '#4a5b7a',
  microfono: '#6b3f7a',
  alimentacion: 'var(--tinta-tenue)',
  control: 'var(--tinta-tenue)',
  otro: 'var(--tinta-tenue)',
};

export function PlanoSala({
  escena,
  ancho_px = 900,
}: {
  escena: EscenaCroquis;
  ancho_px?: number;
}) {
  const p = proyectar(escena, { ancho_px });

  return (
    <svg
      viewBox={p.viewBox}
      className="w-full h-auto"
      role="img"
      aria-label={`Croquis en planta de ${escena.titulo}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100%" height="100%" fill="var(--fondo)" />

      <Paredes p={p} escena={escena} />
      <Mesa p={p} escena={escena} />
      <Sillas p={p} escena={escena} />
      <Tiradas p={p} escena={escena} />
      <Equipos p={p} escena={escena} />
      <Rosetas p={p} escena={escena} />
      <Cotas p={p} escena={escena} />
    </svg>
  );
}

function Paredes({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  const { largo_m, ancho_m } = escena.sala;
  if (!largo_m || !ancho_m) return null;

  return (
    <rect
      x={p.x(0)}
      y={p.y(ancho_m)}
      width={p.d(largo_m)}
      height={p.d(ancho_m)}
      fill="none"
      stroke="var(--tinta)"
      strokeWidth={2}
    />
  );
}

function Mesa({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  const mesa = escena.mesa;
  if (!mesa) return null;

  return (
    <rect
      x={p.x(mesa.x_m)}
      y={p.y(mesa.y_m + mesa.ancho_m)}
      width={p.d(mesa.largo_m)}
      height={p.d(mesa.ancho_m)}
      fill="var(--superficie-hundida)"
      stroke="var(--tinta)"
      strokeWidth={1.25}
    />
  );
}

function Sillas({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  return (
    <g fill="none" stroke="var(--linea-fuerte)" strokeWidth={1.25}>
      {escena.sillas.map((s, i) => (
        <circle key={i} cx={p.x(s.x_m)} cy={p.y(s.y_m)} r={p.d(s.radio_m)} />
      ))}
    </g>
  );
}

/**
 * Las tiradas se dibujan en ortogonal, no en diagonal, porque así van por
 * bandeja o canaleta y así las cuenta `calculo-cable.ts`. Una diagonal en el
 * plano haría creer que el cable va por el aire.
 */
function Tiradas({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  return (
    <g>
      {escena.tiradas.map((t) => {
        const color = COLOR_SENAL[t.senal];
        const camino = `M ${p.x(t.desde.x_m)} ${p.y(t.desde.y_m)} H ${p.x(t.hasta.x_m)} V ${p.y(t.hasta.y_m)}`;
        const medioX = p.x(t.hasta.x_m);
        const medioY = (p.y(t.desde.y_m) + p.y(t.hasta.y_m)) / 2;

        return (
          <g key={t.id}>
            <path d={camino} fill="none" stroke={color} strokeWidth={1.5} />
            {t.metros != null && (
              <text
                x={medioX + 6}
                y={medioY}
                fill={color}
                fontSize={10}
                fontFamily="var(--font-mono)"
              >
                {t.metros.toFixed(2).replace('.', ',')} m
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Equipos({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  return (
    <g>
      {escena.equipos.map((e) => {
        const ancho = p.d(e.largo_m);
        const alto = p.d(e.ancho_m);
        // El equipo se dibuja centrado en su punto, y se recorta contra la
        // pared: una pantalla colocada en x = 0 se saldría media anchura.
        const x = Math.min(
          Math.max(p.x(e.x_m) - ancho / 2, p.x(0)),
          p.x(escena.sala.largo_m) - ancho,
        );
        const y = Math.min(
          Math.max(p.y(e.y_m) - alto / 2, p.y(escena.sala.ancho_m)),
          p.y(0) - alto,
        );

        return (
          <g key={e.id}>
            <rect
              x={x}
              y={y}
              width={ancho}
              height={alto}
              fill="var(--tinta)"
              stroke="var(--tinta)"
              strokeWidth={1}
              // La posición deducida va con trazo discontinuo: sirve para
              // orientarse, no para taladrar.
              strokeDasharray={e.estimada ? '3 2' : undefined}
              fillOpacity={e.estimada ? 0.12 : 0.85}
            />
            <text
              x={x + ancho / 2}
              y={y - 4}
              textAnchor="middle"
              fill="var(--tinta)"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {e.nombre}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Rosetas({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  return (
    <g>
      {escena.tomas.map((t) => (
        <g key={t.id}>
          <rect
            x={p.x(t.x_m) - 5}
            y={p.y(t.y_m) - 5}
            width={10}
            height={10}
            fill="none"
            stroke="var(--acento)"
            strokeWidth={1.25}
          />
          <text
            x={p.x(t.x_m)}
            y={p.y(t.y_m) + 18}
            textAnchor="middle"
            fill="var(--acento)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            {t.codigo}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Cuánto se despega la línea de cota del objeto que mide. */
const SEPARACION_COTA = 22;

function Cotas({ p, escena }: { p: Proyeccion; escena: EscenaCroquis }) {
  return (
    <g stroke="var(--tinta-tenue)" strokeWidth={0.75} fill="var(--tinta-tenue)">
      {escena.cotas.map((c) => {
        const dx = c.lado === 'izquierda' ? -SEPARACION_COTA : c.lado === 'derecha' ? SEPARACION_COTA : 0;
        const dy = c.lado === 'arriba' ? -SEPARACION_COTA : c.lado === 'abajo' ? SEPARACION_COTA : 0;

        const x1 = p.x(c.desde.x_m) + dx;
        const y1 = p.y(c.desde.y_m) + dy;
        const x2 = p.x(c.hasta.x_m) + dx;
        const y2 = p.y(c.hasta.y_m) + dy;

        return (
          <g key={c.clave}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <Tope x={x1} y={y1} vertical={c.lado === 'izquierda' || c.lado === 'derecha'} />
            <Tope x={x2} y={y2} vertical={c.lado === 'izquierda' || c.lado === 'derecha'} />
            <text
              x={(x1 + x2) / 2 + (dx === 0 ? 0 : dx > 0 ? 6 : -6)}
              y={(y1 + y2) / 2 + (dy === 0 ? -4 : dy > 0 ? 12 : -5)}
              textAnchor={dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end'}
              stroke="none"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {c.texto}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** El trazo corto de los extremos de una cota. */
function Tope({ x, y, vertical }: { x: number; y: number; vertical: boolean }) {
  return vertical ? (
    <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
  ) : (
    <line x1={x} y1={y - 4} x2={x} y2={y + 4} />
  );
}
