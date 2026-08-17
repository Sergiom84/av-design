import type { EscenaDiagrama, FilaPuertoDiagrama, BloqueDiagrama } from '@/lib/diagrama';
import { MEDIDAS_DIAGRAMA } from '@/lib/diagrama';
import type { Senal } from '@/lib/tipos';
import { ContenedorTabla } from '@/components/ui';

/**
 * El SVG del esquema. Se pinta en el servidor, sin JavaScript, como el plano
 * del croquis: la escena ya trae todas las coordenadas.
 *
 * La anatomía del bloque es la de XTEN-AV, que el técnico ya conoce:
 * categoría encima, entradas a la izquierda y salidas a la derecha con su
 * serigrafía dentro, el conector fuera del borde, marca y modelo al pie, y el
 * identificador del cable sobre la línea.
 */

/**
 * Color por señal, compartido entre la línea y el punto del puerto para que
 * el esquema se lea igual que la tabla de cables. Tonos con contraste
 * suficiente sobre blanco; el HDMI usa el acento.
 */
const COLOR_SENAL: Record<Senal, string> = {
  hdmi: '#3669d9',
  red: '#298d74',
  usb: '#7c3aed',
  audio_linea: '#b45309',
  audio_altavoz: '#0e7490',
  microfono: '#be185d',
  alimentacion: '#b3261e',
  control: '#57606f',
  otro: '#57606f',
};

const TIPO = {
  serigrafia: 10.5,
  conector: 8.5,
  rotulo: 11,
  pie: 11,
  etiquetaCable: 10.5,
} as const;

function Puerto({
  fila,
  lado,
  bloque,
}: {
  fila: FilaPuertoDiagrama;
  lado: 'izquierda' | 'derecha';
  bloque: BloqueDiagrama;
}) {
  const m = MEDIDAS_DIAGRAMA;
  const izq = lado === 'izquierda';
  const xBorde = izq ? bloque.x : bloque.x + bloque.ancho;
  const xFuera = izq ? xBorde - m.largo_conector : xBorde + m.largo_conector;

  return (
    <g>
      {/* Muñón del conector, fuera del borde como en XTEN-AV. */}
      <line
        x1={xBorde}
        y1={fila.y}
        x2={xFuera}
        y2={fila.y}
        stroke={fila.conectado ? COLOR_SENAL[fila.senal] : 'var(--linea-fuerte)'}
        strokeWidth={1.25}
      />
      {fila.conectado && (
        <circle cx={xFuera} cy={fila.y} r={2.5} fill={COLOR_SENAL[fila.senal]} />
      )}
      {/* El tipo de conector, encima del muñón. */}
      {fila.conector && (
        <text
          x={izq ? xFuera + 2 : xFuera - 2}
          y={fila.y - 3}
          textAnchor={izq ? 'start' : 'end'}
          fontSize={TIPO.conector}
          fill="var(--tinta-tenue)"
          fontFamily="var(--fuente-mono)"
        >
          {fila.conector}
        </text>
      )}
      {/* La serigrafía, dentro del bloque. */}
      <text
        x={izq ? bloque.x + 8 : bloque.x + bloque.ancho - 8}
        y={fila.y + 3.5}
        textAnchor={izq ? 'start' : 'end'}
        fontSize={TIPO.serigrafia}
        fill={fila.conectado ? 'var(--tinta)' : 'var(--tinta-tenue)'}
        fontFamily="var(--fuente-mono)"
      >
        {fila.nombre}
        {fila.total > 1 ? ` ×${fila.total}` : ''}
      </text>
    </g>
  );
}

function Bloque({ bloque }: { bloque: BloqueDiagrama }) {
  const m = MEDIDAS_DIAGRAMA;
  const yPie = bloque.y + bloque.alto - m.alto_pie;

  return (
    <g>
      {/* Rótulo de categoría sobre el bloque. */}
      {bloque.categoria && (
        <text
          x={bloque.x}
          y={bloque.y - 6}
          fontSize={TIPO.rotulo}
          fill="var(--tinta-tenue)"
          style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {bloque.categoria}
        </text>
      )}

      <rect
        x={bloque.x}
        y={bloque.y}
        width={bloque.ancho}
        height={bloque.alto}
        rx={8}
        fill="var(--superficie)"
        stroke="var(--tinta)"
        strokeWidth={1.25}
      />

      {/* Separador y pie con la etiqueta del equipo y su marca y modelo. */}
      <line
        x1={bloque.x}
        y1={yPie}
        x2={bloque.x + bloque.ancho}
        y2={yPie}
        stroke="var(--linea)"
        strokeWidth={1}
      />
      <text
        x={bloque.x + bloque.ancho / 2}
        y={yPie + 14}
        textAnchor="middle"
        fontSize={TIPO.pie}
        fontWeight={600}
        fill="var(--acento)"
      >
        {bloque.etiqueta}
      </text>
      {bloque.marca_modelo && bloque.marca_modelo !== bloque.etiqueta && (
        <text
          x={bloque.x + bloque.ancho / 2}
          y={yPie + 27}
          textAnchor="middle"
          fontSize={TIPO.conector}
          fill="var(--tinta-tenue)"
        >
          {bloque.marca_modelo}
        </text>
      )}

      {bloque.entradas.map((f) => (
        <Puerto key={`${f.puerto_id}:${f.ordinal}`} fila={f} lado="izquierda" bloque={bloque} />
      ))}
      {bloque.salidas.map((f) => (
        <Puerto key={`${f.puerto_id}:${f.ordinal}`} fila={f} lado="derecha" bloque={bloque} />
      ))}
    </g>
  );
}

export function DibujoEsquema({
  escena,
  conexionSeleccionada,
  onSeleccionarConexion,
}: {
  escena: EscenaDiagrama;
  conexionSeleccionada?: string | null;
  onSeleccionarConexion?: (conexionId: string) => void;
}) {
  return (
    <ContenedorTabla etiqueta="Esquema de conexiones">
      <svg
        viewBox={`0 0 ${escena.ancho} ${escena.alto}`}
        className="h-auto"
        style={{ minWidth: Math.min(escena.ancho, 900), width: '100%' }}
        role="img"
        aria-label="Esquema de conexiones de la sala"
        xmlns="http://www.w3.org/2000/svg"
      >
        {escena.lineas.map((l) => (
          <g
            key={l.conexion_id}
            role={onSeleccionarConexion ? 'button' : undefined}
            tabIndex={onSeleccionarConexion ? 0 : undefined}
            aria-label={onSeleccionarConexion ? `Seleccionar cable ${l.identificador}` : undefined}
            aria-pressed={onSeleccionarConexion ? conexionSeleccionada === l.conexion_id : undefined}
            onClick={onSeleccionarConexion ? () => onSeleccionarConexion(l.conexion_id) : undefined}
            onKeyDown={onSeleccionarConexion ? (evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                onSeleccionarConexion(l.conexion_id);
              }
            } : undefined}
            className={onSeleccionarConexion ? 'cursor-pointer focus:outline-none' : undefined}
          >
            {onSeleccionarConexion && (
              <polyline
                points={l.puntos.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                pointerEvents="stroke"
              />
            )}
            <polyline
              points={l.puntos.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={COLOR_SENAL[l.senal]}
              strokeWidth={conexionSeleccionada === l.conexion_id ? 4 : 1.5}
              pointerEvents="none"
            />
            {/* El identificador, el mismo de la brida y de la tabla de cables. */}
            <text
              x={l.etiqueta_x}
              y={l.etiqueta_y - 4}
              textAnchor="middle"
              fontSize={TIPO.etiquetaCable}
              fontWeight={500}
              fill={COLOR_SENAL[l.senal]}
              fontFamily="var(--fuente-mono)"
              pointerEvents="none"
            >
              {l.identificador}
            </text>
          </g>
        ))}

        {escena.bloques.map((b) => (
          <Bloque key={b.equipo_id} bloque={b} />
        ))}
      </svg>
    </ContenedorTabla>
  );
}
