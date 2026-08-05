import 'server-only';
import { sql } from './db';
import {
  Articulo,
  Conexion,
  EquipoEnSala,
  Extremo,
  ParametrosCable,
  PARAMETROS_POR_DEFECTO,
  PlantillaSala,
  Sala,
} from './tipos';

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
    edificio: s(f.edificio),
    nivel: s(f.nivel),
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

export interface LineaPlantilla {
  id: string;
  articulo_id: string | null;
  categoria: string;
  cantidad: number;
  opcional: boolean;
  modelo_texto: string | null;
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
                 'modelo_texto', pa.modelo_texto
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
    lineas: (f.lineas as LineaPlantilla[]).map((l) => ({
      id: String(l.id),
      articulo_id: l.articulo_id ?? null,
      categoria: String(l.categoria),
      cantidad: Number(l.cantidad),
      opcional: Boolean(l.opcional),
      modelo_texto: l.modelo_texto ?? null,
    })),
  }));
}

export async function listarSalas(): Promise<Sala[]> {
  const filas = await sql<Fila[]>`select * from salas order by nombre`;
  return filas.map(aSala);
}

export interface SalaCompleta {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
}

export async function obtenerSala(id: string): Promise<SalaCompleta | null> {
  const [fila] = await sql<Fila[]>`select * from salas where id = ${id}`;
  if (!fila) return null;

  const equipos = await sql<Fila[]>`
    select * from sala_equipos where sala_id = ${id} order by nombre`;
  const conexiones = await sql<Fila[]>`
    select * from conexiones where sala_id = ${id}`;

  return {
    sala: aSala(fila),
    equipos: equipos.map((f) => ({
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
    })),
    conexiones: conexiones.map((f) => ({
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
                                                                  as cable_sin_precio`;
  return {
    equipos: Number(f.equipos),
    cables: Number(f.cables),
    consumibles: Number(f.consumibles),
    plantillas: Number(f.plantillas),
    salas: Number(f.salas),
    plantillasSinMedidas: Number(f.plantillas_sin_medidas),
    salasSinMedidas: Number(f.salas_sin_medidas),
    cableSinPrecio: Number(f.cable_sin_precio),
  };
}
