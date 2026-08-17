import type { Conexion, PuntoPasoCable } from '@/lib/tipos';

export interface RutaCableBorrador {
  conexion_id: string;
  puntos: PuntoPasoCable[];
}

export function rutasDesdeConexiones(conexiones: readonly Conexion[]): RutaCableBorrador[] {
  return conexiones.map((conexion) => ({
    conexion_id: conexion.id,
    puntos: (conexion.puntos_paso ?? []).map((punto, indice) => ({
      ...punto,
      orden: indice,
    })),
  }));
}

export function rutaDe(
  rutas: readonly RutaCableBorrador[],
  conexionId: string,
): RutaCableBorrador | undefined {
  return rutas.find((ruta) => ruta.conexion_id === conexionId);
}

export function cambiarPuntos(
  rutas: readonly RutaCableBorrador[],
  conexionId: string,
  puntos: readonly PuntoPasoCable[],
): RutaCableBorrador[] {
  const normalizados = puntos.map((punto, orden) => ({ ...punto, orden }));
  return rutas.map((ruta) =>
    ruta.conexion_id === conexionId ? { ...ruta, puntos: normalizados } : ruta,
  );
}

export function anadirPunto(
  rutas: readonly RutaCableBorrador[],
  conexionId: string,
  punto: Omit<PuntoPasoCable, 'orden'>,
): RutaCableBorrador[] {
  const ruta = rutaDe(rutas, conexionId);
  if (!ruta) return [...rutas];
  return cambiarPuntos(rutas, conexionId, [...ruta.puntos, { ...punto, orden: ruta.puntos.length }]);
}

export function moverPunto(
  rutas: readonly RutaCableBorrador[],
  conexionId: string,
  orden: number,
  punto: Pick<PuntoPasoCable, 'x_m' | 'y_m' | 'z_m'>,
): RutaCableBorrador[] {
  const ruta = rutaDe(rutas, conexionId);
  if (!ruta || !ruta.puntos[orden]) return [...rutas];
  return cambiarPuntos(
    rutas,
    conexionId,
    ruta.puntos.map((actual, indice) => (indice === orden ? { ...actual, ...punto } : actual)),
  );
}

export function borrarPunto(
  rutas: readonly RutaCableBorrador[],
  conexionId: string,
  orden: number,
): RutaCableBorrador[] {
  const ruta = rutaDe(rutas, conexionId);
  if (!ruta) return [...rutas];
  return cambiarPuntos(
    rutas,
    conexionId,
    ruta.puntos.filter((_, indice) => indice !== orden),
  );
}

export function rutasCambiadas(
  original: readonly RutaCableBorrador[],
  actual: readonly RutaCableBorrador[],
): RutaCableBorrador[] {
  const antes = new Map(original.map((ruta) => [ruta.conexion_id, ruta.puntos]));
  return actual.filter((ruta) => JSON.stringify(antes.get(ruta.conexion_id) ?? []) !== JSON.stringify(ruta.puntos));
}

export function limitarPuntoRuta(
  punto: Pick<PuntoPasoCable, 'x_m' | 'y_m' | 'z_m'>,
  sala: { largo_m: number; ancho_m: number; alto_m: number },
): Pick<PuntoPasoCable, 'x_m' | 'y_m' | 'z_m'> {
  const limite = (valor: number, maximo: number) =>
    Math.round(Math.min(Math.max(Number.isFinite(valor) ? valor : 0, 0), Math.max(maximo, 0)) * 100) / 100;
  return {
    x_m: limite(punto.x_m, sala.largo_m),
    y_m: limite(punto.y_m, sala.ancho_m),
    z_m: limite(punto.z_m, sala.alto_m),
  };
}
