import type { ElevacionSala } from '@/lib/acotaciones';

const metros = (valor: number) => `${valor.toFixed(2).replace('.', ',')} m`;

export function ElevacionSalaSvg({ vista }: { vista: ElevacionSala }) {
  const margenX = 54;
  const margenY = 38;
  const ancho = 760;
  const alto = 330;
  const dibujoAncho = ancho - margenX * 2;
  const dibujoAlto = alto - margenY * 2;
  const x = (m: number) => margenX + (Math.max(0, Math.min(m, vista.ancho_m)) / vista.ancho_m) * dibujoAncho;
  const y = (m: number) => alto - margenY - (Math.max(0, Math.min(m, vista.alto_m)) / vista.alto_m) * dibujoAlto;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={`${vista.titulo}, ${metros(vista.ancho_m)} por ${metros(vista.alto_m)}`}
      className="w-full h-auto min-w-[36rem]"
    >
      <rect width={ancho} height={alto} fill="var(--fondo)" />
      <rect x={margenX} y={margenY} width={dibujoAncho} height={dibujoAlto} fill="var(--superficie)" stroke="var(--tinta)" />

      {vista.puertas.map((puerta) => puerta.anchura_m != null && puerta.altura_m != null ? (
        <g key={puerta.id}>
          <rect x={x(puerta.desde_m)} y={y(puerta.altura_m)} width={x(puerta.desde_m + puerta.anchura_m) - x(puerta.desde_m)} height={y(0) - y(puerta.altura_m)} fill="var(--fondo)" stroke="var(--tinta)" strokeWidth={1.5} />
          <text x={(x(puerta.desde_m) + x(puerta.desde_m + puerta.anchura_m)) / 2} y={y(puerta.altura_m) - 7} textAnchor="middle" fontSize={10} fill="var(--tinta-tenue)">
            {metros(puerta.anchura_m)} × {metros(puerta.altura_m)}
          </text>
        </g>
      ) : (
        <g key={puerta.id} transform={`translate(${x(puerta.desde_m)} ${y(0) - 12})`}>
          <path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" fill="none" stroke="var(--alerta)" strokeDasharray="3 2" />
          <text x={12} y={4} fontSize={10} fill="var(--alerta)">Puerta sin medir</text>
        </g>
      ))}

      {vista.puntos.map((punto) => (
        <g key={`${punto.tipo}-${punto.id}`}>
          <line x1={x(punto.horizontal_m)} y1={y(0)} x2={x(punto.horizontal_m)} y2={y(punto.altura_m)} stroke="var(--linea-fuerte)" strokeDasharray="3 3" />
          {punto.tipo === 'toma' ? (
            <rect x={x(punto.horizontal_m) - 5} y={y(punto.altura_m) - 5} width={10} height={10} fill="var(--superficie)" stroke="var(--acento)" strokeWidth={2} />
          ) : (
            <circle cx={x(punto.horizontal_m)} cy={y(punto.altura_m)} r={6} fill="var(--acento)" stroke="var(--superficie)" strokeWidth={2} />
          )}
          <text x={x(punto.horizontal_m) + 9} y={y(punto.altura_m) - 8} fontSize={11} fill="var(--tinta)">{punto.etiqueta}</text>
          <text x={x(punto.horizontal_m) + 9} y={y(punto.altura_m) + 7} fontSize={10} fill="var(--tinta-tenue)">
            x {metros(punto.horizontal_m)} · z {metros(punto.altura_m)}
          </text>
        </g>
      ))}

      <line x1={margenX} y1={alto - 18} x2={ancho - margenX} y2={alto - 18} stroke="var(--tinta-tenue)" />
      <line x1={margenX} y1={alto - 23} x2={margenX} y2={alto - 13} stroke="var(--tinta-tenue)" />
      <line x1={ancho - margenX} y1={alto - 23} x2={ancho - margenX} y2={alto - 13} stroke="var(--tinta-tenue)" />
      <text x={ancho / 2} y={alto - 5} textAnchor="middle" fontSize={11} fill="var(--tinta-tenue)">{metros(vista.ancho_m)}</text>

      <line x1={24} y1={margenY} x2={24} y2={alto - margenY} stroke="var(--tinta-tenue)" />
      <line x1={19} y1={margenY} x2={29} y2={margenY} stroke="var(--tinta-tenue)" />
      <line x1={19} y1={alto - margenY} x2={29} y2={alto - margenY} stroke="var(--tinta-tenue)" />
      <text x={17} y={alto / 2} textAnchor="middle" fontSize={11} fill="var(--tinta-tenue)" transform={`rotate(-90 17 ${alto / 2})`}>{metros(vista.alto_m)}</text>
    </svg>
  );
}
