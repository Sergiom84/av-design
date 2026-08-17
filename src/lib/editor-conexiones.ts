import type { Conexion, Puerto, Ruta, Senal } from './tipos';

export interface ConexionBorrador extends Conexion {
  temporal: boolean;
}

export interface CambioConexionEditor {
  id: string;
  origen_id: string;
  destino_id: string;
  puerto_origen_id: string;
  puerto_origen_ordinal: number;
  puerto_destino_id: string;
  puerto_destino_ordinal: number;
  senal: Senal;
  articulo_cable_id: string | null;
  ruta: Ruta | null;
}

export interface AltaConexionEditor extends Omit<CambioConexionEditor, 'id'> {
  temporal_id: string;
}

export interface EntradaGuardarEditorConexiones {
  sala_id: string;
  versionEsperada: number;
  altas: AltaConexionEditor[];
  cambios: CambioConexionEditor[];
  bajas: string[];
}

export type ResultadoGuardarEditorConexiones =
  | { ok: true; version: number; ids: Record<string, string> }
  | { ok: false; motivo: 'conflicto' | 'ajeno' | 'invalido' | 'cerrado' | 'no_existe'; detalle: string };

export type GuardarEditorConexiones = (
  entrada: EntradaGuardarEditorConexiones,
) => Promise<ResultadoGuardarEditorConexiones>;

export function crearBorrador(conexiones: Conexion[]): ConexionBorrador[] {
  return conexiones.map((conexion) => ({ ...conexion, temporal: false }));
}

export function bocaCodificada(
  equipoId: string,
  puertoId: string | null | undefined,
  ordinal: number | null | undefined,
): string {
  return puertoId && ordinal ? `${equipoId}|${puertoId}|${ordinal}` : '';
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

export function conexionCompleta(conexion: ConexionBorrador, puertos: Map<string, Puerto>): boolean {
  const origen = conexion.puerto_origen_id ? puertos.get(conexion.puerto_origen_id) : null;
  const destino = conexion.puerto_destino_id ? puertos.get(conexion.puerto_destino_id) : null;
  return Boolean(
    origen &&
      destino &&
      conexion.puerto_origen_ordinal &&
      conexion.puerto_origen_ordinal <= origen.total &&
      conexion.puerto_destino_ordinal &&
      conexion.puerto_destino_ordinal <= destino.total &&
      origen.articulo_id &&
      destino.articulo_id,
  );
}

function camposGuardables(conexion: ConexionBorrador): Omit<CambioConexionEditor, 'id'> {
  return {
    origen_id: conexion.origen_id,
    destino_id: conexion.destino_id,
    puerto_origen_id: conexion.puerto_origen_id!,
    puerto_origen_ordinal: conexion.puerto_origen_ordinal!,
    puerto_destino_id: conexion.puerto_destino_id!,
    puerto_destino_ordinal: conexion.puerto_destino_ordinal!,
    senal: conexion.senal,
    articulo_cable_id: conexion.articulo_cable_id,
    ruta: conexion.ruta,
  };
}

const firma = (conexion: Conexion) =>
  JSON.stringify({
    origen_id: conexion.origen_id,
    destino_id: conexion.destino_id,
    puerto_origen_id: conexion.puerto_origen_id ?? null,
    puerto_origen_ordinal: conexion.puerto_origen_ordinal ?? null,
    puerto_destino_id: conexion.puerto_destino_id ?? null,
    puerto_destino_ordinal: conexion.puerto_destino_ordinal ?? null,
    senal: conexion.senal,
    articulo_cable_id: conexion.articulo_cable_id,
    ruta: conexion.ruta,
  });

export function prepararGuardado({
  salaId,
  versionEsperada,
  originales,
  borrador,
  puertos,
}: {
  salaId: string;
  versionEsperada: number;
  originales: Conexion[];
  borrador: ConexionBorrador[];
  puertos: Map<string, Puerto>;
}): EntradaGuardarEditorConexiones {
  const originalPorId = new Map(originales.map((conexion) => [conexion.id, conexion]));
  const persistentes = new Set(borrador.filter((c) => !c.temporal).map((c) => c.id));
  const completas = borrador.filter((conexion) => conexionCompleta(conexion, puertos));
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
  return entrada.altas.length + entrada.cambios.length + entrada.bajas.length > 0;
}
