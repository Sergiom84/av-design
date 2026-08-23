import 'server-only';
import { sql } from './db';
import { esUuid } from './uuid';
import {
  Articulo,
  ArticuloElegible,
  Conexion,
  EquipoEnSala,
  Extremo,
  LineaPlantilla,
  MuebleCatalogo,
  MuebleEnSala,
  ParametrosCable,
  PARAMETROS_POR_DEFECTO,
  PlantillaSala,
  Puerto,
  Sala,
  TiradaPlantilla,
  TomaRed,
} from './tipos';

export type { LineaPlantilla } from './tipos';

type Fila = Record<string, unknown>;

const n = (v: unknown): number | null => (v == null ? null : Number(v));
const s = (v: unknown): string | null => (v == null ? null : String(v));

function aArticulo(f: Fila): Articulo {
  return {
    id: String(f.id),
    referencia: s(f.referencia),
    tipo: f.tipo as Articulo['tipo'],
    categoria: String(f.categoria),
    marca: s(f.marca),
    modelo: String(f.modelo),
    descripcion: s(f.descripcion),
    caracteristicas: s(f.caracteristicas),
    observaciones: s(f.observaciones),
    unidad: (f.unidad as Articulo['unidad']) ?? 'ud',
    coste: n(f.coste),
    coste_orientativo: f.coste_orientativo === true,
    pvp: n(f.pvp),
    proveedor: s(f.proveedor),
    plazo_dias: n(f.plazo_dias),
    stock_minimo: n(f.stock_minimo),
    senal: (f.senal as Articulo['senal']) ?? null,
    conector_a: s(f.conector_a),
    conector_b: s(f.conector_b),
    longitudes_comerciales_m: Array.isArray(f.longitudes_comerciales_m)
      ? (f.longitudes_comerciales_m as unknown[]).map(Number)
      : null,
    bobina_m: n(f.bobina_m),
    diametro_mm: n(f.diametro_mm),
    unidades_instaladas: n(f.unidades_instaladas),
    activo: f.activo !== false,
  };
}

function aSala(f: Fila): Sala {
  return {
    id: String(f.id),
    sede_id: s(f.sede_id),
    sede: s(f.sede),
    localizacion_id: s(f.localizacion_id),
    localizacion: s(f.localizacion),
    proyecto_id: s(f.proyecto_id),
    proyecto: s(f.proyecto),
    codigo: s(f.codigo),
    nombre: String(f.nombre),
    tipologia: s(f.tipologia),
    aforo: n(f.aforo),
    plantilla_id: s(f.plantilla_id),
    largo_m: Number(f.largo_m ?? 0),
    ancho_m: Number(f.ancho_m ?? 0),
    alto_m: Number(f.alto_m ?? 0),
    alto_falso_techo_m: n(f.alto_falso_techo_m),
    alto_canaleta_m: n(f.alto_canaleta_m),
    alto_suelo_tecnico_m: n(f.alto_suelo_tecnico_m),
    ruta_por_defecto: (f.ruta_por_defecto as Sala['ruta_por_defecto']) ?? 'falso_techo',
    notas: s(f.notas),
    mesa_largo_m: n(f.mesa_largo_m),
    mesa_ancho_m: n(f.mesa_ancho_m),
    mesa_alto_cm: n(f.mesa_alto_cm),
    mesa_x_m: n(f.mesa_x_m),
    mesa_y_m: n(f.mesa_y_m),
    mesa_rotacion_grados: Number(f.mesa_rotacion_grados ?? 0),
    diagrama_version: Number(f.diagrama_version ?? 0),
    diagrama_iniciado_en: f.diagrama_iniciado_en ? String(f.diagrama_iniciado_en) : null,
    diagrama_origen: (f.diagrama_origen as Sala['diagrama_origen']) ?? null,
    diagrama_plantilla_id: s(f.diagrama_plantilla_id),
    sillas_modo: f.sillas_modo === 'manuales' ? 'manuales' : 'derivadas',
  };
}

export async function listarArticulos(tipo?: Articulo['tipo']): Promise<Articulo[]> {
  const filas = tipo
    ? await sql<Fila[]>`
        select a.*, p.nombre as proveedor
        from articulos a
        left join proveedores p on p.id = a.proveedor_id
        where a.activo and a.tipo = ${tipo}
        order by a.unidades_instaladas desc nulls last, a.modelo`
    : await sql<Fila[]>`
        select a.*, p.nombre as proveedor
        from articulos a
        left join proveedores p on p.id = a.proveedor_id
        where a.activo
        order by a.unidades_instaladas desc nulls last, a.modelo`;
  return filas.map(aArticulo);
}

/** Cuántas referencias devuelve como mucho una búsqueda del catálogo. */
export const MAXIMO_SUGERENCIAS = 20;

/**
 * Buscar un mueble para el plano.
 *
 * Catálogo aparte del AV y consulta aparte: teclear «mesa» en el buscador de
 * equipamiento no puede sacar la mesa de reuniones, ni teclear «silla» sacar
 * un soporte. Son dos listas y dos cajas de búsqueda.
 *
 * Misma mecánica que `buscarArticulos()`: los términos se cruzan con Y
 * —«mesa redonda» exige las dos palabras—, `%` y `_` se escapan porque el
 * técnico los teclea como texto, y no salen más de veinte.
 */
export async function buscarMobiliario(
  consulta: string,
  categoria?: string,
): Promise<MuebleCatalogo[]> {
  const terminos = consulta
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => t.replace(/[\\%_]/g, (c) => `\\${c}`));

  const filas = await sql<Fila[]>`
    select id, clave, nombre, categoria, palabras_clave, forma, rol,
           largo_m_defecto, ancho_m_defecto, alto_m_defecto
    from catalogo_mobiliario
    where activo
      and (${categoria ?? null}::text is null or categoria = ${categoria ?? null})
      and coalesce((
        select bool_and(
          concat_ws(' ', nombre, categoria, palabras_clave) ilike '%' || t || '%'
        )
        from unnest(${terminos}::text[]) as t
      ), true)
    order by orden, nombre
    limit ${MAXIMO_SUGERENCIAS}`;

  return filas.map((f) => ({
    id: String(f.id),
    clave: String(f.clave),
    nombre: String(f.nombre),
    categoria: String(f.categoria),
    palabras_clave: s(f.palabras_clave),
    forma: f.forma === 'circulo' ? 'circulo' : 'rectangulo',
    // Un rol desconocido se lee como nulo: el mueble se comporta como
    // corriente, que es lo inocuo. Adivinarlo apagaría sillas de verdad.
    rol: f.rol === 'asiento' || f.rol === 'mesa_principal' ? f.rol : null,
    largo_m_defecto: n(f.largo_m_defecto),
    ancho_m_defecto: n(f.ancho_m_defecto),
    alto_m_defecto: n(f.alto_m_defecto),
  }));
}

/**
 * Lo que hace falta para elegir una plantilla con criterio: cómo se llama, de
 * qué tipología es, cuánto mide y qué trae dentro.
 *
 * Los recuentos van en la misma consulta porque son la previsualización: una
 * plantilla con cero conexiones y una con doce no se eligen igual, y saberlo
 * después de aplicarla ya no sirve.
 */
export interface PlantillaElegible {
  id: string;
  nombre: string;
  tipologia: string;
  largo_m: number | null;
  ancho_m: number | null;
  alto_m: number | null;
  muebles: number;
  lineas: number;
  conexiones: number;
}

export async function buscarPlantillas(consulta: string): Promise<PlantillaElegible[]> {
  const terminos = consulta
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => t.replace(/[\\%_]/g, (c) => `\\${c}`));

  const filas = await sql<Fila[]>`
    select p.id, p.nombre, p.tipologia, p.largo_m, p.ancho_m, p.alto_m,
           (select count(*) from plantilla_mobiliario m where m.plantilla_id = p.id) as muebles,
           (select count(*) from plantilla_articulos a where a.plantilla_id = p.id) as lineas,
           (select count(*) from plantilla_conexiones c where c.plantilla_id = p.id) as conexiones
    from plantillas_sala p
    where coalesce((
      select bool_and(concat_ws(' ', p.nombre, p.tipologia) ilike '%' || t || '%')
      from unnest(${terminos}::text[]) as t
    ), true)
    order by p.n_salas_reales desc nulls last, p.nombre
    limit ${MAXIMO_SUGERENCIAS}`;

  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    tipologia: String(f.tipologia),
    largo_m: n(f.largo_m),
    ancho_m: n(f.ancho_m),
    alto_m: n(f.alto_m),
    muebles: Number(f.muebles ?? 0),
    lineas: Number(f.lineas ?? 0),
    conexiones: Number(f.conexiones ?? 0),
  }));
}

/** Cómo se llama la plantilla de la que salió el plano. Para el rótulo `Base:`. */
export async function nombreDePlantilla(id: string | null | undefined): Promise<string | null> {
  if (!id || !esUuid(id)) return null;
  const [f] = await sql<Fila[]>`select nombre from plantillas_sala where id = ${id}`;
  return f ? String(f.nombre) : null;
}

/** Las categorías que hay hoy en el catálogo de mobiliario, para el filtro. */
export async function categoriasDeMobiliario(): Promise<string[]> {
  const filas = await sql<Fila[]>`
    select distinct categoria from catalogo_mobiliario where activo order by categoria`;
  return filas.map((f) => String(f.categoria));
}

/**
 * Busca referencias del catálogo por marca, modelo, referencia o sección.
 *
 * Los términos se cruzan en `y`, no en `o`: "samsung 65" tiene que casar con
 * los dos, que es como busca quien sabe lo que quiere. El orden es el mismo
 * que en el resto de la aplicación —lo más instalado primero— para que teclear
 * poco baste en los equipos habituales.
 */
export async function buscarArticulos(
  consulta: string,
  tipo?: Articulo['tipo'],
): Promise<ArticuloElegible[]> {
  // `%` y `_` son comodines de ILIKE: si el técnico los teclea son texto.
  const terminos = consulta
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => t.replace(/[\\%_]/g, (c) => `\\${c}`));

  const filas = await sql<Fila[]>`
    select a.id,
           trim(concat_ws(' ', nullif(a.marca, ''), a.modelo)) as etiqueta,
           a.categoria,
           a.unidad
    from articulos a
    where a.activo
      and (${tipo ?? null}::text is null or a.tipo::text = ${tipo ?? null})
      and coalesce((
        select bool_and(
          concat_ws(' ', a.marca, a.modelo, a.referencia, a.categoria) ilike '%' || t || '%'
        )
        from unnest(${terminos}::text[]) as t
      ), true)
    order by a.unidades_instaladas desc nulls last, a.modelo
    limit ${MAXIMO_SUGERENCIAS}`;

  return filas.map((f) => ({
    id: String(f.id),
    etiqueta: String(f.etiqueta),
    categoria: String(f.categoria),
    unidad: (f.unidad as Articulo['unidad']) ?? 'ud',
  }));
}

/** Etiqueta con la que se agrupan los artículos sin marca en el catálogo. */
export const SIN_MARCA = 'Genérico';

export interface Marca {
  marca: string;
  referencias: number;
  categorias: number;
  unidades_instaladas: number;
  tipos: string[];
}

export async function listarMarcas(): Promise<Marca[]> {
  const filas = await sql<Fila[]>`
    select coalesce(nullif(marca, ''), ${SIN_MARCA}) as marca,
           count(*)                                  as referencias,
           count(distinct categoria)                 as categorias,
           coalesce(sum(unidades_instaladas), 0)     as unidades_instaladas,
           array_agg(distinct tipo::text)            as tipos
    from articulos
    where activo
    group by 1
    order by unidades_instaladas desc, referencias desc, marca`;
  return filas.map((f) => ({
    marca: String(f.marca),
    referencias: Number(f.referencias),
    categorias: Number(f.categorias),
    unidades_instaladas: Number(f.unidades_instaladas),
    tipos: (f.tipos as string[]) ?? [],
  }));
}

export interface CategoriaDeMarca {
  categoria: string;
  referencias: number;
  unidades_instaladas: number;
}

export async function listarCategoriasDeMarca(
  marca: string,
): Promise<CategoriaDeMarca[]> {
  const filas = await sql<Fila[]>`
    select categoria,
           count(*)                              as referencias,
           coalesce(sum(unidades_instaladas), 0) as unidades_instaladas
    from articulos
    where activo and coalesce(nullif(marca, ''), ${SIN_MARCA}) = ${marca}
    group by categoria
    order by unidades_instaladas desc, categoria`;
  return filas.map((f) => ({
    categoria: String(f.categoria),
    referencias: Number(f.referencias),
    unidades_instaladas: Number(f.unidades_instaladas),
  }));
}

export async function listarArticulosDeMarca(
  marca: string,
  categoria?: string,
): Promise<Articulo[]> {
  const filas = categoria
    ? await sql<Fila[]>`
        select a.*, p.nombre as proveedor
        from articulos a
        left join proveedores p on p.id = a.proveedor_id
        where a.activo
          and coalesce(nullif(a.marca, ''), ${SIN_MARCA}) = ${marca}
          and a.categoria = ${categoria}
        order by a.unidades_instaladas desc nulls last, a.modelo`
    : await sql<Fila[]>`
        select a.*, p.nombre as proveedor
        from articulos a
        left join proveedores p on p.id = a.proveedor_id
        where a.activo and coalesce(nullif(a.marca, ''), ${SIN_MARCA}) = ${marca}
        order by a.categoria, a.unidades_instaladas desc nulls last, a.modelo`;
  return filas.map(aArticulo);
}

export async function obtenerArticulo(id: string): Promise<Articulo | null> {
  const [f] = await sql<Fila[]>`
    select a.*, p.nombre as proveedor
    from articulos a
    left join proveedores p on p.id = a.proveedor_id
    where a.id = ${id}`;
  return f ? aArticulo(f) : null;
}

export interface PrecioOfertado {
  presupuesto: string;
  /** 'final' es una oferta real de proveedor. 'orientativo' es una referencia. */
  origen: 'final' | 'orientativo';
  moneda: string;
  proveedor: string | null;
  fecha: string | null;
  referencia: string | null;
  /** Por unidad del catálogo, sin IVA, en la moneda de la oferta. */
  precio: number;
  /** El mismo precio en euros, al tipo de cambio de `parametros`. */
  precio_eur: number;
  /** Lo que figura en la oferta: una bobina de 100 m se compra entera. */
  precio_compra: number | null;
  unidades_por_compra: number;
  cantidad: number | null;
  notas: string | null;
}

/**
 * Los precios de un artículo, del más barato al más caro.
 *
 * La misma referencia sale a precios distintos según el proveedor y la
 * antigüedad del presupuesto, así que se guardan todos. Los que vienen en otra
 * moneda se convierten aquí con el tipo de cambio de `parametros`, para que
 * cambiarlo no obligue a volver a sembrar.
 */
export async function preciosDeArticulo(id: string): Promise<PrecioOfertado[]> {
  const filas = await sql<Fila[]>`
    with cambio as (
      select coalesce(max(valor), 1) as usd_eur
      from parametros where clave = 'tipo_cambio_usd_eur'
    )
    select pr.presupuesto, pr.origen, pr.moneda, pv.nombre as proveedor,
           pr.fecha, pr.referencia, pr.precio, pr.precio_compra,
           pr.unidades_por_compra, pr.cantidad, pr.notas,
           pr.precio * case when pr.moneda = 'EUR' then 1 else c.usd_eur end
             as precio_eur
    from precios pr
    cross join cambio c
    left join proveedores pv on pv.id = pr.proveedor_id
    where pr.articulo_id = ${id}
    order by pr.origen, pr.precio`;
  return filas.map((f) => ({
    presupuesto: String(f.presupuesto),
    origen: f.origen === 'orientativo' ? 'orientativo' : 'final',
    moneda: String(f.moneda ?? 'EUR'),
    proveedor: s(f.proveedor),
    fecha: f.fecha instanceof Date ? f.fecha.toISOString().slice(0, 10) : s(f.fecha),
    referencia: s(f.referencia),
    precio: Number(f.precio),
    precio_eur: Number(f.precio_eur),
    precio_compra: n(f.precio_compra),
    unidades_por_compra: Number(f.unidades_por_compra ?? 1),
    cantidad: n(f.cantidad),
    notas: s(f.notas),
  }));
}

/**
 * Los puertos de un artículo, en el orden en que los pinta el fabricante.
 *
 * `orden` es opcional, así que las filas sin él van detrás y ordenadas por
 * nombre: es lo que hace que una lista a medio rellenar siga siendo legible.
 */
export async function puertosDeArticulo(id: string): Promise<Puerto[]> {
  const filas = await sql<Fila[]>`
    select * from puertos
    where articulo_id = ${id}
    order by orden nulls last, nombre`;
  return filas.map(aPuerto);
}

const aPuerto = (f: Fila): Puerto => ({
  id: String(f.id),
  articulo_id: String(f.articulo_id),
  nombre: String(f.nombre),
  total: Number(f.total ?? 1),
  sentido: f.sentido as Puerto['sentido'],
  senal: f.senal as Puerto['senal'],
  conector: s(f.conector),
  orden: n(f.orden),
  notas: s(f.notas),
  fuente: f.fuente === 'csv' ? 'csv' : 'app',
});

/**
 * Los puertos de varios artículos de golpe. Es lo que necesita la página de la
 * sala: una consulta para todo el equipamiento en vez de una por equipo.
 */
export async function puertosDeArticulos(ids: string[]): Promise<Puerto[]> {
  if (ids.length === 0) return [];
  const filas = await sql<Fila[]>`
    select * from puertos
    where articulo_id in ${sql(ids)}
    order by articulo_id, orden nulls last, nombre`;
  return filas.map(aPuerto);
}

/** Qué artículos de una lista tienen ya puertos. Para marcarlo en el catálogo. */
export async function articulosConPuertos(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await sql<Fila[]>`
    select distinct articulo_id from puertos where articulo_id in ${sql(ids)}`;
  return new Set(filas.map((f) => String(f.articulo_id)));
}

/** Dónde se usa un artículo: plantillas y salas. Evita borrar algo en uso. */
export async function usosDeArticulo(id: string) {
  const [f] = await sql<Fila[]>`
    select
      (select count(*) from plantilla_articulos where articulo_id = ${id}) as plantillas,
      (select count(*) from sala_equipos        where articulo_id = ${id}) as salas,
      (select count(*) from conexiones          where articulo_cable_id = ${id}) as conexiones`;
  return {
    plantillas: Number(f.plantillas),
    salas: Number(f.salas),
    conexiones: Number(f.conexiones),
  };
}

export async function listarCategorias(): Promise<string[]> {
  const filas = await sql<Fila[]>`
    select distinct categoria from articulos where activo order by categoria`;
  return filas.map((f) => String(f.categoria));
}

export async function listarPlantillas(): Promise<
  Array<PlantillaSala & { lineas: LineaPlantilla[] }>
> {
  const filas = await sql<Fila[]>`
    select p.*,
           coalesce(
             json_agg(
               json_build_object(
                 'id', pa.id,
                 'articulo_id', pa.articulo_id,
                 'categoria', pa.categoria,
                 'cantidad', pa.cantidad,
                 'opcional', pa.opcional,
                 'modelo_texto', pa.modelo_texto,
                 'extremo', pa.extremo,
                 'x_m', pa.x_m,
                 'y_m', pa.y_m,
                 'z_m', pa.z_m,
                 'posicion_confirmada', pa.posicion_confirmada
               )
               order by pa.opcional, pa.categoria
             ) filter (where pa.id is not null),
             '[]'
           ) as lineas
    from plantillas_sala p
    left join plantilla_articulos pa on pa.plantilla_id = p.id
    group by p.id
    order by p.n_salas_reales desc nulls last, p.nombre`;

  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    tipologia: String(f.tipologia),
    aforo: n(f.aforo),
    n_salas_reales: n(f.n_salas_reales),
    largo_m: n(f.largo_m),
    ancho_m: n(f.ancho_m),
    alto_m: n(f.alto_m),
    alto_falso_techo_m: n(f.alto_falso_techo_m),
    ruta_por_defecto:
      (f.ruta_por_defecto as PlantillaSala['ruta_por_defecto']) ?? 'falso_techo',
    notas: s(f.notas),
    mesa_largo_m: n(f.mesa_largo_m),
    mesa_ancho_m: n(f.mesa_ancho_m),
    mesa_alto_cm: n(f.mesa_alto_cm),
    mesa_x_m: n(f.mesa_x_m),
    mesa_y_m: n(f.mesa_y_m),
    mesa_rotacion_grados: n(f.mesa_rotacion_grados),
    lineas: (f.lineas as LineaPlantilla[]).map((l) => ({
      id: String(l.id),
      articulo_id: l.articulo_id ?? null,
      categoria: String(l.categoria),
      cantidad: Number(l.cantidad),
      opcional: Boolean(l.opcional),
      modelo_texto: l.modelo_texto ?? null,
      extremo: (l.extremo as LineaPlantilla['extremo']) ?? null,
      x_m: n(l.x_m),
      y_m: n(l.y_m),
      z_m: n(l.z_m),
      posicion_confirmada: l.posicion_confirmada ?? null,
    })),
  }));
}

/**
 * Las tiradas tipo de todas las plantillas, ya con el nombre de los dos
 * extremos resuelto. Una consulta para la página entera y no una por plantilla:
 * `/plantillas` pinta las diecisiete de golpe.
 */
export async function tiradasDePlantillas(): Promise<TiradaPlantilla[]> {
  const filas = await sql<Fila[]>`
    select pc.*,
           coalesce(o.modelo_texto, o.categoria) as origen,
           coalesce(d.modelo_texto, d.categoria) as destino
    from plantilla_conexiones pc
    join plantilla_articulos o on o.id = pc.origen_linea_id
    join plantilla_articulos d on d.id = pc.destino_linea_id
    order by pc.plantilla_id, pc.orden, pc.creado_en`;

  return filas.map((f) => ({
    id: String(f.id),
    plantilla_id: String(f.plantilla_id),
    origen_linea_id: String(f.origen_linea_id),
    destino_linea_id: String(f.destino_linea_id),
    origen: String(f.origen),
    destino: String(f.destino),
    articulo_cable_id: s(f.articulo_cable_id),
    senal: f.senal as TiradaPlantilla['senal'],
    ruta: (f.ruta as TiradaPlantilla['ruta']) ?? null,
    notas: s(f.notas),
    orden: Number(f.orden ?? 0),
  }));
}

export async function listarSalas(proyectoId?: string): Promise<Sala[]> {
  // Los joins son left a propósito: una sala sin proyecto es legado válido.
  const filas = proyectoId
    ? await sql<Fila[]>`
        select s.*, sd.nombre as sede, l.nombre as localizacion,
               p.id as proyecto_id, p.nombre as proyecto
        from salas s
        left join sedes sd on sd.id = s.sede_id
        left join localizaciones l on l.id = s.localizacion_id
        left join proyectos p on p.id = l.proyecto_id
        where p.id = ${proyectoId}
        order by s.nombre`
    : await sql<Fila[]>`
        select s.*, sd.nombre as sede, l.nombre as localizacion,
               p.id as proyecto_id, p.nombre as proyecto
        from salas s
        left join sedes sd on sd.id = s.sede_id
        left join localizaciones l on l.id = s.localizacion_id
        left join proyectos p on p.id = l.proyecto_id
        order by s.nombre`;
  return filas.map(aSala);
}

/** `Sala` más el estado ligero de la portada (medidas + hitos). Solo para
 *  pantallas que necesitan mostrar ese estado; `Sala` en sí no cambia. */
export interface SalaConEstado extends Sala {
  n_conexiones: number;
  instalada: boolean;
  entregada: boolean;
}

function aSalaConEstado(f: Fila): SalaConEstado {
  return {
    ...aSala(f),
    n_conexiones: Number(f.n_conexiones ?? 0),
    instalada: Boolean(f.instalada),
    entregada: Boolean(f.entregada),
  };
}

/**
 * Como `listarSalas`, pero enriquecida con el mismo estado ligero que ya
 * calcula la portada del proyecto (medidas + hitos): Sin medidas / En
 * diseño / Instalada / Entregada. Es una función aparte, no un cambio de
 * `listarSalas`, para no arrastrar la consulta de hitos a checkin ni
 * almacén, que no la necesitan.
 *
 * Los mismos joins left que `listarSalas`: una sala sin proyecto sigue
 * siendo legado válido. Si la migración de hitos aún no llegó (42P01),
 * instalada/entregada degradan a falso, igual que en la portada.
 */
export async function listarSalasConEstado(proyectoId?: string): Promise<SalaConEstado[]> {
  const consulta = (conHitos: boolean) => {
    const camposHitos = conHitos
      ? sql`exists (select 1 from hitos_sala h
              where h.sala_id = s.id and h.tipo = 'instalacion') as instalada,
            exists (select 1 from hitos_sala h
              where h.sala_id = s.id and h.tipo = 'entrega') as entregada`
      : sql`false as instalada, false as entregada`;

    return proyectoId
      ? sql<Fila[]>`
          select s.*, sd.nombre as sede, l.nombre as localizacion,
                 p.id as proyecto_id, p.nombre as proyecto,
                 (select count(*) from conexiones c where c.sala_id = s.id) as n_conexiones,
                 ${camposHitos}
          from salas s
          left join sedes sd on sd.id = s.sede_id
          left join localizaciones l on l.id = s.localizacion_id
          left join proyectos p on p.id = l.proyecto_id
          where p.id = ${proyectoId}
          order by s.nombre`
      : sql<Fila[]>`
          select s.*, sd.nombre as sede, l.nombre as localizacion,
                 p.id as proyecto_id, p.nombre as proyecto,
                 (select count(*) from conexiones c where c.sala_id = s.id) as n_conexiones,
                 ${camposHitos}
          from salas s
          left join sedes sd on sd.id = s.sede_id
          left join localizaciones l on l.id = s.localizacion_id
          left join proyectos p on p.id = l.proyecto_id
          order by s.nombre`;
  };

  const filas = await consulta(true).catch((e) => {
    if ((e as { code?: string }).code !== '42P01') throw e;
    return consulta(false);
  });
  return filas.map(aSalaConEstado);
}

/**
 * Las sedes que ya existen, para ofrecerlas al escribir una sala nueva. Es
 * texto libre con sugerencias: si el departamento abre una sede, se escribe y
 * se da de alta sola, sin pasar por una pantalla de mantenimiento.
 */
export async function listarSedes(): Promise<string[]> {
  const filas = await sql<Fila[]>`select nombre from sedes order by nombre`;
  return filas.map((f) => String(f.nombre));
}

/**
 * Solo la fila de la sala con sus nombres resueltos, para la cabecera del
 * layout de la ficha: las pestañas no pueden pagar equipos y conexiones que
 * no van a pintar.
 */
export async function obtenerSalaCabecera(id: string): Promise<Sala | null> {
  if (!esUuid(id)) return null;
  const [fila] = await sql<Fila[]>`
    select s.*, sd.nombre as sede, l.nombre as localizacion,
           p.id as proyecto_id, p.nombre as proyecto
    from salas s
    left join sedes sd on sd.id = s.sede_id
    left join localizaciones l on l.id = s.localizacion_id
    left join proyectos p on p.id = l.proyecto_id
    where s.id = ${id}`;
  return fila ? aSala(fila) : null;
}

export interface SalaCompleta {
  sala: Sala;
  equipos: EquipoEnSala[];
  /** Sillas y mesas de la sala. El croquis las dibuja igual que el editor. */
  muebles: MuebleEnSala[];
  conexiones: Conexion[];
  /** Rosetas del edificio en esta sala. */
  tomas: TomaRed[];
  /** Puertos de los artículos que hay puestos en la sala, ya resueltos. */
  puertos: Puerto[];
  /**
   * Marca, modelo y categoría de los artículos de catálogo puestos en la
   * sala, por `articulo_id`. Consulta acotada a los artículos de esta sala
   * (como `puertosDeArticulos`): el catálogo entero no viaja al navegador.
   * Un equipo cuyo id no está aquí es un equipo suelto, sin ficha de
   * catálogo.
   */
  catalogoEquipos: Map<string, { marca: string | null; modelo: string; categoria: string }>;
}

export async function obtenerSala(id: string): Promise<SalaCompleta | null> {
  if (!esUuid(id)) return null;
  const [fila] = await sql<Fila[]>`
    select s.*, sd.nombre as sede, l.nombre as localizacion,
           p.id as proyecto_id, p.nombre as proyecto
    from salas s
    left join sedes sd on sd.id = s.sede_id
    left join localizaciones l on l.id = s.localizacion_id
    left join proyectos p on p.id = l.proyecto_id
    where s.id = ${id}`;
  if (!fila) return null;

  const [filasEquipos, filasConexiones, filasPuntos, filasTomas, filasMuebles] = await Promise.all([
    sql<Fila[]>`select * from sala_equipos where sala_id = ${id} order by nombre`,
    sql<Fila[]>`
      select c.*,
             bo.puerto_id as boca_puerto_origen_id, bo.ordinal as puerto_origen_ordinal,
             bd.puerto_id as boca_puerto_destino_id, bd.ordinal as puerto_destino_ordinal
      from conexiones c
      left join conexion_bocas bo on bo.conexion_id = c.id and bo.lado = 'origen'
      left join conexion_bocas bd on bd.conexion_id = c.id and bd.lado = 'destino'
      where c.sala_id = ${id}
      order by c.creado_en, c.id`,
    sql<Fila[]>`select p.id, p.conexion_id, p.orden, p.x_m, p.y_m, p.z_m
      from conexion_puntos_paso p
      join conexiones c on c.id = p.conexion_id
      where c.sala_id = ${id}
      order by p.conexion_id, p.orden`,
    sql<Fila[]>`select * from tomas_red where sala_id = ${id} order by codigo`,
    // El mobiliario viene aquí y no solo en `datos-plano.ts` porque el croquis
    // de Resumen tiene que dibujar exactamente lo mismo que el editor. Sin
    // esto, las sillas se veían en Diagrama y desaparecían en Resumen.
    sql<Fila[]>`select * from sala_mobiliario where sala_id = ${id} order by orden, creado_en`,
  ]);

  const muebles: MuebleEnSala[] = filasMuebles.map((f) => ({
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
  }));

  const equipos: EquipoEnSala[] = filasEquipos.map((f) => ({
    id: String(f.id),
    sala_id: String(f.sala_id),
    articulo_id: s(f.articulo_id) ?? '',
    nombre: String(f.nombre),
    cantidad: Number(f.cantidad ?? 1),
    extremo: (f.extremo as Extremo) ?? 'pared',
    posicion: {
      x_m: Number(f.x_m ?? 0),
      y_m: Number(f.y_m ?? 0),
      z_m: Number(f.z_m ?? 0),
    },
    posicion_confirmada: f.posicion_confirmada === true,
    rotacion_grados: Number(f.rotacion_grados ?? 0),
    origen_plantilla_linea_id: s(f.origen_plantilla_linea_id),
    toma_red_id: s(f.toma_red_id),
  }));

  const articulos = [...new Set(equipos.map((e) => e.articulo_id).filter(Boolean))];

  const filasCatalogo = articulos.length
    ? await sql<Fila[]>`select id, marca, modelo, categoria from articulos where id in ${sql(articulos)}`
    : [];
  const catalogoEquipos = new Map(
    filasCatalogo.map((f) => [
      String(f.id),
      { marca: s(f.marca), modelo: String(f.modelo), categoria: String(f.categoria) },
    ]),
  );

  return {
    sala: aSala(fila),
    equipos,
    muebles,
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
      puerto_origen_id: s(f.boca_puerto_origen_id) ?? s(f.puerto_origen_id),
      puerto_destino_id: s(f.boca_puerto_destino_id) ?? s(f.puerto_destino_id),
      puerto_origen_ordinal: n(f.puerto_origen_ordinal),
      puerto_destino_ordinal: n(f.puerto_destino_ordinal),
      creado_en:
        f.creado_en instanceof Date ? f.creado_en.toISOString() : s(f.creado_en),
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
    puertos: await puertosDeArticulos(articulos),
    catalogoEquipos,
  };
}

export interface FilaParametro {
  clave: string;
  valor: number;
  unidad: string | null;
  descripcion: string | null;
}

export async function listarParametros(): Promise<FilaParametro[]> {
  const filas = await sql<Fila[]>`select * from parametros order by clave`;
  return filas.map((f) => ({
    clave: String(f.clave),
    valor: Number(f.valor),
    unidad: s(f.unidad),
    descripcion: s(f.descripcion),
  }));
}

export async function obtenerParametros(): Promise<ParametrosCable> {
  const filas = await listarParametros();
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  const holguras = { ...PARAMETROS_POR_DEFECTO.holguras };
  (Object.keys(holguras) as Array<keyof typeof holguras>).forEach((k) => {
    const v = mapa.get(`holgura_${k}`);
    if (v != null && Number.isFinite(v)) holguras[k] = v;
  });
  return {
    holguras,
    margen: mapa.get('margen') ?? PARAMETROS_POR_DEFECTO.margen,
    cables_por_canalizacion:
      mapa.get('cables_por_canalizacion') ??
      PARAMETROS_POR_DEFECTO.cables_por_canalizacion,
    ocupacion_maxima_canaleta:
      mapa.get('ocupacion_maxima_canaleta') ??
      PARAMETROS_POR_DEFECTO.ocupacion_maxima_canaleta,
  };
}

export async function contarPanel() {
  const [f] = await sql<Fila[]>`
    select
      (select count(*) from articulos where tipo = 'equipo')      as equipos,
      (select count(*) from articulos where tipo = 'cable')       as cables,
      (select count(*) from articulos where tipo = 'consumible')  as consumibles,
      (select count(*) from plantillas_sala)                      as plantillas,
      (select count(*) from salas)                                as salas,
      (select count(*) from plantillas_sala where largo_m is null) as plantillas_sin_medidas,
      (select count(*) from salas where largo_m = 0)              as salas_sin_medidas,
      (select count(*) from articulos where tipo = 'cable' and coste is null)
                                                                  as cable_sin_precio,
      (select count(*) from articulos where coste_orientativo)    as coste_orientativo`;
  return {
    equipos: Number(f.equipos),
    cables: Number(f.cables),
    consumibles: Number(f.consumibles),
    plantillas: Number(f.plantillas),
    salas: Number(f.salas),
    plantillasSinMedidas: Number(f.plantillas_sin_medidas),
    salasSinMedidas: Number(f.salas_sin_medidas),
    cableSinPrecio: Number(f.cable_sin_precio),
    costeOrientativo: Number(f.coste_orientativo),
  };
}
