import 'server-only';
import { sql } from './db';
import { esUuid } from './uuid';
import type { Conexion, EquipoEnSala, Sala, TomaRed } from './tipos';

/**
 * Lo que necesita el editor del plano y nada más.
 *
 * No pasa por `fichaDeSala()` a propósito: esa derivación carga el catálogo
 * entero, los parámetros, los puertos y la tabla de cables para poder dar
 * metros, y el editor no pinta metros —los pinta el croquis de Resumen—. Aquí
 * son tres consultas a tablas de la sala y ninguna al catálogo.
 *
 * Las conexiones sí vienen: sin ellas el plano no dibujaría las tiradas y
 * mover un equipo parecería un cambio estético.
 */
export interface DatosPlanoSala {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
  tomas: TomaRed[];
  /** La obra cerrada es de solo lectura, y eso se decide en el servidor. */
  cerrado: boolean;
}

type Fila = Record<string, unknown>;

const n = (v: unknown): number | null =>
  v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const s = (v: unknown): string | null => (v == null ? null : String(v));

export async function obtenerDatosPlanoSala(id: string): Promise<DatosPlanoSala | null> {
  if (!esUuid(id)) return null;

  const [fila] = await sql<Fila[]>`
    select s.*, sd.nombre as sede, l.nombre as localizacion,
           p.id as proyecto_id, p.nombre as proyecto,
           exists (
             select 1 from hitos_proyecto h
             where h.proyecto_id = p.id and h.tipo = 'cierre'
           ) as cerrado
    from salas s
    left join sedes sd on sd.id = s.sede_id
    left join localizaciones l on l.id = s.localizacion_id
    left join proyectos p on p.id = l.proyecto_id
    where s.id = ${id}`;
  if (!fila) return null;

  const [filasEquipos, filasConexiones, filasTomas] = await Promise.all([
    sql<Fila[]>`select id, sala_id, articulo_id, nombre, cantidad, extremo,
                       x_m, y_m, z_m, posicion_confirmada, rotacion_grados,
                       origen_plantilla_linea_id, toma_red_id
                from sala_equipos where sala_id = ${id} order by nombre`,
    sql<Fila[]>`select id, sala_id, origen_id, destino_id, senal, ruta,
                       longitud_manual_m, articulo_cable_id, notas
                from conexiones where sala_id = ${id} order by creado_en, id`,
    sql<Fila[]>`select id, sala_id, codigo, ubicacion, x_m, y_m, z_m, notas
                from tomas_red where sala_id = ${id} order by codigo`,
  ]);

  const sala: Sala = {
    id: String(fila.id),
    sede_id: s(fila.sede_id),
    sede: s(fila.sede),
    localizacion_id: s(fila.localizacion_id),
    localizacion: s(fila.localizacion),
    proyecto_id: s(fila.proyecto_id),
    proyecto: s(fila.proyecto),
    edificio: s(fila.edificio),
    nivel: s(fila.nivel),
    codigo: s(fila.codigo),
    nombre: String(fila.nombre),
    tipologia: s(fila.tipologia),
    aforo: n(fila.aforo),
    plantilla_id: s(fila.plantilla_id),
    largo_m: Number(fila.largo_m ?? 0),
    ancho_m: Number(fila.ancho_m ?? 0),
    alto_m: Number(fila.alto_m ?? 0),
    alto_falso_techo_m: n(fila.alto_falso_techo_m),
    alto_canaleta_m: n(fila.alto_canaleta_m),
    alto_suelo_tecnico_m: n(fila.alto_suelo_tecnico_m),
    ruta_por_defecto: (fila.ruta_por_defecto as Sala['ruta_por_defecto']) ?? 'falso_techo',
    notas: s(fila.notas),
    mesa_largo_m: n(fila.mesa_largo_m),
    mesa_ancho_m: n(fila.mesa_ancho_m),
    mesa_alto_cm: n(fila.mesa_alto_cm),
    mesa_x_m: n(fila.mesa_x_m),
    mesa_y_m: n(fila.mesa_y_m),
    mesa_rotacion_grados: Number(fila.mesa_rotacion_grados ?? 0),
    diagrama_version: Number(fila.diagrama_version ?? 0),
    diagrama_iniciado_en: fila.diagrama_iniciado_en ? String(fila.diagrama_iniciado_en) : null,
    diagrama_origen: (fila.diagrama_origen as Sala['diagrama_origen']) ?? null,
    diagrama_plantilla_id: s(fila.diagrama_plantilla_id),
    sillas_modo: fila.sillas_modo === 'manuales' ? 'manuales' : 'derivadas',
  };

  return {
    sala,
    cerrado: fila.cerrado === true,
    equipos: filasEquipos.map((f) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      articulo_id: s(f.articulo_id) ?? '',
      nombre: String(f.nombre),
      cantidad: Number(f.cantidad ?? 1),
      extremo: (f.extremo as EquipoEnSala['extremo']) ?? 'pared',
      posicion: {
        x_m: Number(f.x_m ?? 0),
        y_m: Number(f.y_m ?? 0),
        z_m: Number(f.z_m ?? 0),
      },
      posicion_confirmada: f.posicion_confirmada === true,
      rotacion_grados: Number(f.rotacion_grados ?? 0),
      origen_plantilla_linea_id: s(f.origen_plantilla_linea_id),
      toma_red_id: s(f.toma_red_id),
    })),
    conexiones: filasConexiones.map((f) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      origen_id: String(f.origen_id),
      destino_id: String(f.destino_id),
      articulo_cable_id: s(f.articulo_cable_id),
      senal: (f.senal as Conexion['senal']) ?? 'otro',
      ruta: (f.ruta as Conexion['ruta']) ?? null,
      longitud_manual_m: n(f.longitud_manual_m),
      notas: s(f.notas),
    })),
    tomas: filasTomas.map((f) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      codigo: String(f.codigo),
      ubicacion: s(f.ubicacion),
      x_m: n(f.x_m),
      y_m: n(f.y_m),
      z_m: n(f.z_m),
      notas: s(f.notas),
    })),
  };
}
