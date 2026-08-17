import type { EquipoEnSala, ParedSala, PuertaEnSala, Sala, TomaRed } from './tipos';

export interface PuntoElevacion {
  id: string;
  etiqueta: string;
  horizontal_m: number;
  altura_m: number;
  tipo: 'equipo' | 'toma';
}

export interface HuecoElevacion {
  id: string;
  desde_m: number;
  anchura_m: number | null;
  altura_m: number | null;
}

export interface ElevacionSala {
  pared: ParedSala;
  titulo: string;
  ancho_m: number;
  alto_m: number;
  puntos: PuntoElevacion[];
  puertas: HuecoElevacion[];
}

export interface EscenaAcotaciones {
  elevaciones: ElevacionSala[];
  equiposSinPosicion: number;
  tomasSinPosicion: number;
  sinMedidas: boolean;
}

const TITULO: Record<ParedSala, string> = {
  sur: 'Frontal · Sur',
  norte: 'Trasera · Norte',
  oeste: 'Lateral izquierda · Oeste',
  este: 'Lateral derecha · Este',
};

/**
 * Proyección ortográfica del estado físico de la sala.
 *
 * Cada pared usa el mismo origen que las puertas: norte/sur recorren `x` y
 * este/oeste recorren `y`. No se deduce ninguna posición; una ausencia sigue
 * siendo ausencia y se cuenta para que la vista no parezca completa.
 */
export function construirAcotaciones({
  sala,
  equipos,
  tomas,
  puertas,
}: {
  sala: Sala;
  equipos: EquipoEnSala[];
  tomas: TomaRed[];
  puertas: PuertaEnSala[];
}): EscenaAcotaciones {
  const sinMedidas = !(sala.largo_m > 0 && sala.ancho_m > 0 && sala.alto_m > 0);
  const colocados = equipos.filter((equipo) => equipo.posicion_confirmada);
  const tomasColocadas = tomas.filter(
    (toma) => toma.x_m != null && toma.y_m != null && toma.z_m != null,
  );
  const paredes: ParedSala[] = ['sur', 'norte', 'oeste', 'este'];

  const horizontal = (pared: ParedSala, x: number, y: number) =>
    pared === 'sur' || pared === 'norte' ? x : y;

  const elevaciones = paredes.map((pared): ElevacionSala => ({
    pared,
    titulo: TITULO[pared],
    ancho_m: pared === 'sur' || pared === 'norte' ? sala.largo_m : sala.ancho_m,
    alto_m: sala.alto_m,
    puntos: [
      ...colocados.map((equipo): PuntoElevacion => ({
        id: equipo.id,
        etiqueta: equipo.nombre,
        horizontal_m: horizontal(pared, equipo.posicion.x_m, equipo.posicion.y_m),
        altura_m: equipo.posicion.z_m,
        tipo: 'equipo',
      })),
      ...tomasColocadas.map((toma): PuntoElevacion => ({
        id: toma.id,
        etiqueta: toma.codigo,
        horizontal_m: horizontal(pared, toma.x_m as number, toma.y_m as number),
        altura_m: toma.z_m as number,
        tipo: 'toma',
      })),
    ],
    puertas: puertas
      .filter((puerta) => puerta.pared === pared)
      .map((puerta) => ({
        id: puerta.id,
        desde_m: puerta.posicion_m,
        anchura_m: puerta.anchura_m,
        altura_m: puerta.altura_m,
      })),
  }));

  return {
    elevaciones,
    equiposSinPosicion: equipos.length - colocados.length,
    tomasSinPosicion: tomas.length - tomasColocadas.length,
    sinMedidas,
  };
}
