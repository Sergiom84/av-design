import type { Conexion, ExtremoConexion, TomaRed, TomaRedBoca } from './tipos';

type Fila = Record<string, unknown>;
const texto = (v: unknown): string | null => v == null ? null : String(v);
const numero = (v: unknown): number | null => v == null ? null : Number(v);

/** Ambos lectores reciben los mismos alias SQL; nunca completan bocas ausentes. */
export function leerDetalleConexion(fila: Fila): Conexion['detalle'] {
  if (fila.detalle_extremos === 'legacy') return { estado: 'legacy' };
  if (fila.detalle_extremos !== 'completo') {
    throw new Error(`La conexión ${fila.id} no tiene un estado de extremos documentado.`);
  }
  const lado = (nombre: 'origen' | 'destino'): ExtremoConexion => {
    const toma = texto(fila[`boca_toma_${nombre}_id`]);
    const equipo = texto(fila[`boca_equipo_${nombre}_id`]);
    const puerto = texto(fila[`boca_puerto_${nombre}_id`]);
    const ordinal = numero(fila[`puerto_${nombre}_ordinal`]);
    if (toma && equipo === null && puerto === null && ordinal === null) {
      return { tipo: 'roseta', toma_boca_id: toma };
    }
    if (!toma && equipo && puerto && ordinal !== null && Number.isInteger(ordinal) && ordinal > 0) {
      return { tipo: 'equipo', equipo_id: equipo, puerto_id: puerto, ordinal };
    }
    throw new Error(`La conexión ${fila.id} tiene el extremo ${nombre} incompleto.`);
  };
  return { estado: 'completo', origen: lado('origen'), destino: lado('destino') };
}

export function leerTomasRed(filas: Fila[], bocas: Fila[]): TomaRed[] {
  const porToma = new Map<string, TomaRedBoca[]>();
  for (const boca of bocas) {
    const id = String(boca.toma_red_id);
    const grupo = porToma.get(id) ?? [];
    grupo.push({
      id: String(boca.id), toma_red_id: id, ordinal: Number(boca.ordinal),
      etiqueta: texto(boca.etiqueta), conector: String(boca.conector),
      senal: boca.senal as TomaRedBoca['senal'],
    });
    porToma.set(id, grupo);
  }
  return filas.map((fila) => ({
    id: String(fila.id), sala_id: String(fila.sala_id), codigo: String(fila.codigo),
    ubicacion: texto(fila.ubicacion), notas: texto(fila.notas),
    x_m: numero(fila.x_m), y_m: numero(fila.y_m), z_m: numero(fila.z_m),
    esquema_x: numero(fila.esquema_x), esquema_y: numero(fila.esquema_y),
    capacidad_documentada: numero(fila.capacidad_documentada),
    codigo_referencia: texto(fila.codigo_referencia), codigo_confirmado: fila.codigo_confirmado === true,
    bocas: porToma.get(String(fila.id)) ?? [],
  }));
}
