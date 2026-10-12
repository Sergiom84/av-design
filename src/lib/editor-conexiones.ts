import type { Conexion, ExtremoConexion, Puerto, Ruta, Senal, TomaRed } from './tipos';

export interface ConexionBorrador extends Conexion {
  temporal: boolean;
  extremos_borrador?: { origen: ExtremoConexion | null; destino: ExtremoConexion | null };
}

export interface CambioConexionEditor {
  id: string;
  origen: ExtremoConexion;
  destino: ExtremoConexion;
  senal: Senal;
  articulo_cable_id: string | null;
  ruta: Ruta | null;
  estado_suministro?: 'incluido' | 'adicional' | 'por_determinar';
  cable_suministrado_id?: string | null;
}

export interface AltaConexionEditor extends Omit<CambioConexionEditor, 'id'> {
  temporal_id: string;
}

export interface EntradaGuardarEditorConexiones {
  sala_id: string;
  versionEsperada: number;
  equipos_alta?: { temporal_id: string; articulo_id: string }[];
  posiciones?: { equipo_id: string; x: number; y: number }[];
  posiciones_rosetas?: { toma_id: string; x: number; y: number }[];
  altas: AltaConexionEditor[];
  cambios: CambioConexionEditor[];
  bajas: string[];
}

export type ResultadoGuardarEditorConexiones =
  | { ok: true; version: number; ids: Record<string, string>; etiquetas: Record<string, string>; equipos_ids?: Record<string, string> }
  | { ok: false; motivo: 'conflicto' | 'ajeno' | 'invalido' | 'cerrado' | 'no_existe'; detalle: string };

export type GuardarEditorConexiones = (
  entrada: EntradaGuardarEditorConexiones,
) => Promise<ResultadoGuardarEditorConexiones>;

export function crearBorrador(conexiones: Conexion[]): ConexionBorrador[] {
  return conexiones.map((conexion) => ({ ...conexion, temporal: false }));
}

export function bocaCodificada(
  equipoId: string | null,
  puertoId: string | null | undefined,
  ordinal: number | null | undefined,
): string {
  return equipoId && puertoId && ordinal ? `${equipoId}|${puertoId}|${ordinal}` : '';
}

export function decodificarBoca(valor: string): {
  equipo_id: string;
  puerto_id: string;
  ordinal: number;
} | null {
  const [equipo_id, puerto_id, textoOrdinal, sobra] = valor.split('|');
  const ordinal = Number(textoOrdinal);
  return equipo_id && puerto_id && !sobra && Number.isInteger(ordinal) && ordinal > 0
    ? { equipo_id, puerto_id, ordinal }
    : null;
}

export function extremoCodificado(extremo: ExtremoConexion | null): string {
  return !extremo ? '' : extremo.tipo === 'roseta' ? `roseta|${extremo.toma_boca_id}`
    : bocaCodificada(extremo.equipo_id, extremo.puerto_id, extremo.ordinal);
}

export function decodificarExtremo(valor: string): ExtremoConexion | null {
  const partes = valor.split('|');
  if (partes.length === 2 && partes[0] === 'roseta' && partes[1]) return { tipo: 'roseta', toma_boca_id: partes[1] };
  const boca = decodificarBoca(valor);
  return boca ? { tipo: 'equipo', ...boca } : null;
}

export function extremoDelBorrador(conexion: ConexionBorrador, lado: 'origen' | 'destino'): ExtremoConexion | null {
  if (conexion.detalle.estado === 'completo') return conexion.detalle[lado];
  if (conexion.extremos_borrador) return conexion.extremos_borrador[lado];
  const equipo_id = conexion[`${lado}_id`], puerto_id = conexion[`puerto_${lado}_id`], ordinal = conexion[`puerto_${lado}_ordinal`];
  return equipo_id && puerto_id && ordinal != null ? { tipo: 'equipo', equipo_id, puerto_id, ordinal } : null;
}

export function actualizarExtremoBorrador(conexion: ConexionBorrador, lado: 'origen' | 'destino', extremo: ExtremoConexion | null): ConexionBorrador {
  const pareja = { origen: extremoDelBorrador(conexion, 'origen'), destino: extremoDelBorrador(conexion, 'destino'), [lado]: extremo };
  return { ...conexion,
    [`${lado}_id`]: extremo?.tipo === 'equipo' ? extremo.equipo_id : null,
    [`puerto_${lado}_id`]: extremo?.tipo === 'equipo' ? extremo.puerto_id : null,
    [`puerto_${lado}_ordinal`]: extremo?.tipo === 'equipo' ? extremo.ordinal : null,
    extremos_borrador: pareja,
    detalle: pareja.origen && pareja.destino ? { estado: 'completo', origen: pareja.origen, destino: pareja.destino } : { estado: 'legacy' },
  };
}

export function conexionCompleta(conexion: ConexionBorrador, puertos: Map<string, Puerto>, tomas: TomaRed[] = []): boolean {
  if (conexion.detalle.estado !== 'completo') return false;
  return [conexion.detalle.origen, conexion.detalle.destino].every((extremo) => {
    if (extremo.tipo === 'roseta') return tomas.some((t) => t.sala_id === conexion.sala_id && t.capacidad_documentada !== null && t.bocas.some((b) => b.id === extremo.toma_boca_id));
    const puerto = puertos.get(extremo.puerto_id);
    return Boolean(puerto && Number.isInteger(extremo.ordinal) && extremo.ordinal > 0 && extremo.ordinal <= puerto.total);
  });
}

function camposGuardables(conexion: ConexionBorrador): Omit<CambioConexionEditor, 'id'> {
  if (conexion.detalle.estado !== 'completo') throw new Error('Completa las dos bocas antes de guardar.');
  return {
    origen: conexion.detalle.origen,
    destino: conexion.detalle.destino,
    senal: conexion.senal,
    articulo_cable_id: conexion.articulo_cable_id,
    ruta: conexion.ruta,
    estado_suministro: conexion.estado_suministro ?? 'por_determinar',
    cable_suministrado_id: conexion.cable_suministrado_id ?? null,
  };
}

const firma = (conexion: Conexion) =>
  JSON.stringify({
    detalle: conexion.detalle,
    origen_id: conexion.origen_id,
    destino_id: conexion.destino_id,
    puerto_origen_id: conexion.puerto_origen_id ?? null,
    puerto_origen_ordinal: conexion.puerto_origen_ordinal ?? null,
    puerto_destino_id: conexion.puerto_destino_id ?? null,
    puerto_destino_ordinal: conexion.puerto_destino_ordinal ?? null,
    senal: conexion.senal,
    articulo_cable_id: conexion.articulo_cable_id,
    ruta: conexion.ruta,
    estado_suministro: conexion.estado_suministro ?? 'por_determinar',
    cable_suministrado_id: conexion.cable_suministrado_id ?? null,
  });

export function prepararGuardado({
  salaId,
  versionEsperada,
  originales,
  borrador,
  puertos,
  tomas = [],
}: {
  salaId: string;
  versionEsperada: number;
  originales: Conexion[];
  borrador: ConexionBorrador[];
  puertos: Map<string, Puerto>;
  tomas?: TomaRed[];
}): EntradaGuardarEditorConexiones {
  const originalPorId = new Map(originales.map((conexion) => [conexion.id, conexion]));
  const persistentes = new Set(borrador.filter((c) => !c.temporal).map((c) => c.id));
  const completas = borrador.filter((conexion) => conexionCompleta(conexion, puertos, tomas));
  return {
    sala_id: salaId,
    versionEsperada,
    altas: completas
      .filter((conexion) => conexion.temporal)
      .map((conexion) => ({ temporal_id: conexion.id, ...camposGuardables(conexion) })),
    cambios: completas
      .filter((conexion) => {
        const original = originalPorId.get(conexion.id);
        return !conexion.temporal && original && firma(original) !== firma(conexion);
      })
      .map((conexion) => ({ id: conexion.id, ...camposGuardables(conexion) })),
    bajas: originales.filter((conexion) => !persistentes.has(conexion.id)).map((conexion) => conexion.id),
  };
}

export function tieneCambios(entrada: EntradaGuardarEditorConexiones): boolean {
  return entrada.altas.length + entrada.cambios.length + entrada.bajas.length + (entrada.equipos_alta?.length ?? 0) + (entrada.posiciones?.length ?? 0) + (entrada.posiciones_rosetas?.length ?? 0) > 0;
}
