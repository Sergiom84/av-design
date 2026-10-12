import 'server-only';
import { leerDetalleConexion, leerTomasRed } from './lectura-extremos';
import { sql } from './db';
import { exigirEtiquetaCable } from './cable-schedule';
import { esUuid } from './uuid';
import type {
  Conexion,
  EquipoEnSala,
  MuebleEnSala,
  PuertaEnSala,
  Sala,
  TomaRed,
} from './tipos';

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
  muebles: MuebleEnSala[];
  puertas: PuertaEnSala[];
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

  const [filasEquipos, filasConexiones, filasPuntos, filasTomas, filasMuebles, filasPuertas, filasBocasTomas] =
    await Promise.all([
    sql<Fila[]>`select id, sala_id, articulo_id, nombre, cantidad, extremo,
                       x_m, y_m, z_m, posicion_confirmada, rotacion_grados,
                       origen_plantilla_linea_id, toma_red_id, toma_red_conexion_id
                from sala_equipos where sala_id = ${id} order by nombre`,
    sql<Fila[]>`select c.*,
                  bo.equipo_id as boca_equipo_origen_id, bo.toma_boca_id as boca_toma_origen_id,
                  bo.puerto_id as boca_puerto_origen_id, bo.ordinal as puerto_origen_ordinal,
                  bd.equipo_id as boca_equipo_destino_id, bd.toma_boca_id as boca_toma_destino_id,
                  bd.puerto_id as boca_puerto_destino_id, bd.ordinal as puerto_destino_ordinal
                from conexiones c
                left join conexion_bocas bo on bo.conexion_id = c.id and bo.lado = 'origen'
                left join conexion_bocas bd on bd.conexion_id = c.id and bd.lado = 'destino'
                where c.sala_id = ${id} order by c.creado_en, c.id`,
    sql<Fila[]>`select p.id, p.conexion_id, p.orden, p.x_m, p.y_m, p.z_m
                from conexion_puntos_paso p
                join conexiones c on c.id = p.conexion_id
                where c.sala_id = ${id} order by p.conexion_id, p.orden`,
    sql<Fila[]>`select *
                from tomas_red where sala_id = ${id} order by codigo`,
    sql<Fila[]>`select id, sala_id, mobiliario_id, nombre, forma,
                       largo_m, ancho_m, alto_m, x_m, y_m, z_m,
                       rotacion_grados, posicion_confirmada,
                       origen_plantilla_mobiliario_id, orden
                from sala_mobiliario where sala_id = ${id} order by orden, creado_en`,
    sql<Fila[]>`select id, sala_id, pared, posicion_m, anchura_m, altura_m, orden
                from puertas where sala_id = ${id} order by orden, creado_en`,
    sql<Fila[]>`select b.* from toma_red_bocas b join tomas_red t on t.id = b.toma_red_id
                where t.sala_id = ${id} order by b.toma_red_id, b.ordinal`,
  ]);

  const sala: Sala = {
    id: String(fila.id),
    sede_id: s(fila.sede_id),
    sede: s(fila.sede),
    localizacion_id: s(fila.localizacion_id),
    localizacion: s(fila.localizacion),
    proyecto_id: s(fila.proyecto_id),
    proyecto: s(fila.proyecto),
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
      toma_red_conexion_id: s(f.toma_red_conexion_id),
    })),
    conexiones: filasConexiones.map((f) => ({
      id: String(f.id),
      etiqueta_cable: exigirEtiquetaCable(f.etiqueta_cable, f.id),
      detalle: leerDetalleConexion(f),
      creado_en: f.creado_en instanceof Date ? f.creado_en.toISOString() : s(f.creado_en),
      sala_id: String(f.sala_id),
      origen_id: s(f.origen_id),
      destino_id: s(f.destino_id),
      articulo_cable_id: s(f.articulo_cable_id),
      senal: (f.senal as Conexion['senal']) ?? 'otro',
      ruta: (f.ruta as Conexion['ruta']) ?? null,
      longitud_manual_m: n(f.longitud_manual_m),
      notas: s(f.notas),
      puntos_paso: filasPuntos
        .filter((p) => String(p.conexion_id) === String(f.id))
        .map((p) => ({
          id: String(p.id),
          orden: Number(p.orden),
          x_m: Number(p.x_m),
          y_m: Number(p.y_m),
          z_m: Number(p.z_m),
        })),
    })),
    muebles: filasMuebles.map((f) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      mobiliario_id: s(f.mobiliario_id),
      nombre: String(f.nombre),
      forma: f.forma === 'circulo' ? 'circulo' : 'rectangulo',
      largo_m: n(f.largo_m),
      ancho_m: n(f.ancho_m),
      alto_m: n(f.alto_m),
      x_m: n(f.x_m),
      y_m: n(f.y_m),
      z_m: n(f.z_m),
      rotacion_grados: Number(f.rotacion_grados ?? 0),
      posicion_confirmada: f.posicion_confirmada === true,
      origen_plantilla_mobiliario_id: s(f.origen_plantilla_mobiliario_id),
      orden: Number(f.orden ?? 100),
    })),
    puertas: filasPuertas.map((f) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      pared: (f.pared as PuertaEnSala['pared']) ?? 'sur',
      posicion_m: Number(f.posicion_m ?? 0),
      anchura_m: n(f.anchura_m),
      altura_m: n(f.altura_m),
      orden: Number(f.orden ?? 100),
    })),
    tomas: leerTomasRed(filasTomas, filasBocasTomas),
  };
}

