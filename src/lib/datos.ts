import 'server-only';
import { clienteServidor } from './supabase/servidor';
import {
  Articulo,
  Conexion,
  EquipoEnSala,
  ParametrosCable,
  PARAMETROS_POR_DEFECTO,
  PlantillaSala,
  Sala,
  Extremo,
} from './tipos';

type Fila = Record<string, unknown>;

function aArticulo(f: Fila): Articulo {
  return {
    id: String(f.id),
    referencia: (f.referencia as string) ?? null,
    tipo: f.tipo as Articulo['tipo'],
    categoria: String(f.categoria),
    marca: (f.marca as string) ?? null,
    modelo: String(f.modelo),
    descripcion: (f.descripcion as string) ?? null,
    unidad: (f.unidad as Articulo['unidad']) ?? 'ud',
    coste: f.coste != null ? Number(f.coste) : null,
    pvp: f.pvp != null ? Number(f.pvp) : null,
    proveedor: (f.proveedor as string) ?? null,
    plazo_dias: f.plazo_dias != null ? Number(f.plazo_dias) : null,
    stock_minimo: f.stock_minimo != null ? Number(f.stock_minimo) : null,
    senal: (f.senal as Articulo['senal']) ?? null,
    conector_a: (f.conector_a as string) ?? null,
    conector_b: (f.conector_b as string) ?? null,
    longitudes_comerciales_m: Array.isArray(f.longitudes_comerciales_m)
      ? (f.longitudes_comerciales_m as unknown[]).map(Number)
      : null,
    bobina_m: f.bobina_m != null ? Number(f.bobina_m) : null,
    diametro_mm: f.diametro_mm != null ? Number(f.diametro_mm) : null,
    unidades_instaladas:
      f.unidades_instaladas != null ? Number(f.unidades_instaladas) : null,
    activo: f.activo !== false,
  };
}

function aSala(f: Fila): Sala {
  return {
    id: String(f.id),
    sede_id: (f.sede_id as string) ?? null,
    edificio: (f.edificio as string) ?? null,
    nivel: (f.nivel as string) ?? null,
    codigo: (f.codigo as string) ?? null,
    nombre: String(f.nombre),
    tipologia: (f.tipologia as string) ?? null,
    aforo: f.aforo != null ? Number(f.aforo) : null,
    plantilla_id: (f.plantilla_id as string) ?? null,
    largo_m: Number(f.largo_m ?? 0),
    ancho_m: Number(f.ancho_m ?? 0),
    alto_m: Number(f.alto_m ?? 0),
    alto_falso_techo_m: f.alto_falso_techo_m != null ? Number(f.alto_falso_techo_m) : null,
    alto_canaleta_m: f.alto_canaleta_m != null ? Number(f.alto_canaleta_m) : null,
    alto_suelo_tecnico_m:
      f.alto_suelo_tecnico_m != null ? Number(f.alto_suelo_tecnico_m) : null,
    ruta_por_defecto: (f.ruta_por_defecto as Sala['ruta_por_defecto']) ?? 'falso_techo',
    notas: (f.notas as string) ?? null,
  };
}

export async function listarArticulos(tipo?: Articulo['tipo']): Promise<Articulo[]> {
  const sb = await clienteServidor();
  let q = sb
    .from('articulos')
    .select('*')
    .eq('activo', true)
    .order('unidades_instaladas', { ascending: false, nullsFirst: false })
    .order('modelo');
  if (tipo) q = q.eq('tipo', tipo);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(aArticulo);
}

export async function listarPlantillas(): Promise<
  Array<PlantillaSala & { lineas: Array<{ categoria: string; cantidad: number; opcional: boolean; modelo_texto: string | null }> }>
> {
  const sb = await clienteServidor();
  const { data, error } = await sb
    .from('plantillas_sala')
    .select('*, plantilla_articulos(categoria, cantidad, opcional, modelo_texto)')
    .order('n_salas_reales', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((f: Fila) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    tipologia: String(f.tipologia),
    aforo: f.aforo != null ? Number(f.aforo) : null,
    n_salas_reales: f.n_salas_reales != null ? Number(f.n_salas_reales) : null,
    largo_m: f.largo_m != null ? Number(f.largo_m) : null,
    ancho_m: f.ancho_m != null ? Number(f.ancho_m) : null,
    alto_m: f.alto_m != null ? Number(f.alto_m) : null,
    alto_falso_techo_m: f.alto_falso_techo_m != null ? Number(f.alto_falso_techo_m) : null,
    ruta_por_defecto: (f.ruta_por_defecto as PlantillaSala['ruta_por_defecto']) ?? 'falso_techo',
    notas: (f.notas as string) ?? null,
    lineas: ((f.plantilla_articulos as Fila[]) ?? []).map((l) => ({
      categoria: String(l.categoria),
      cantidad: Number(l.cantidad),
      opcional: Boolean(l.opcional),
      modelo_texto: (l.modelo_texto as string) ?? null,
    })),
  }));
}

export async function listarSalas(): Promise<Sala[]> {
  const sb = await clienteServidor();
  const { data, error } = await sb.from('salas').select('*').order('nombre');
  if (error) throw error;
  return (data ?? []).map(aSala);
}

export interface SalaCompleta {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
}

export async function obtenerSala(id: string): Promise<SalaCompleta | null> {
  const sb = await clienteServidor();
  const { data: sala } = await sb.from('salas').select('*').eq('id', id).maybeSingle();
  if (!sala) return null;

  const { data: equipos } = await sb
    .from('sala_equipos')
    .select('*')
    .eq('sala_id', id)
    .order('nombre');

  const { data: conexiones } = await sb.from('conexiones').select('*').eq('sala_id', id);

  return {
    sala: aSala(sala),
    equipos: (equipos ?? []).map((f: Fila) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      articulo_id: (f.articulo_id as string) ?? '',
      nombre: String(f.nombre),
      cantidad: Number(f.cantidad ?? 1),
      extremo: (f.extremo as Extremo) ?? 'pared',
      posicion: {
        x_m: Number(f.x_m ?? 0),
        y_m: Number(f.y_m ?? 0),
        z_m: Number(f.z_m ?? 0),
      },
    })),
    conexiones: (conexiones ?? []).map((f: Fila) => ({
      id: String(f.id),
      sala_id: String(f.sala_id),
      origen_id: String(f.origen_id),
      destino_id: String(f.destino_id),
      articulo_cable_id: (f.articulo_cable_id as string) ?? null,
      senal: (f.senal as Conexion['senal']) ?? 'otro',
      ruta: (f.ruta as Conexion['ruta']) ?? null,
      longitud_manual_m:
        f.longitud_manual_m != null ? Number(f.longitud_manual_m) : null,
      notas: (f.notas as string) ?? null,
    })),
  };
}

export async function obtenerParametros(): Promise<ParametrosCable> {
  const sb = await clienteServidor();
  const { data } = await sb.from('parametros').select('clave, valor');
  const mapa = new Map((data ?? []).map((f: Fila) => [String(f.clave), Number(f.valor)]));
  const h = { ...PARAMETROS_POR_DEFECTO.holguras };
  (Object.keys(h) as Array<keyof typeof h>).forEach((k) => {
    const v = mapa.get(`holgura_${k}`);
    if (v != null && Number.isFinite(v)) h[k] = v;
  });
  return {
    holguras: h,
    margen: mapa.get('margen') ?? PARAMETROS_POR_DEFECTO.margen,
    cables_por_canalizacion:
      mapa.get('cables_por_canalizacion') ?? PARAMETROS_POR_DEFECTO.cables_por_canalizacion,
    ocupacion_maxima_canaleta:
      mapa.get('ocupacion_maxima_canaleta') ??
      PARAMETROS_POR_DEFECTO.ocupacion_maxima_canaleta,
  };
}

export async function contarPanel() {
  const sb = await clienteServidor();

  const porTipo = async (tipo: Articulo['tipo']) => {
    const { count } = await sb
      .from('articulos')
      .select('*', { count: 'exact', head: true })
      .eq('tipo', tipo);
    return count ?? 0;
  };
  const total = async (tabla: string) => {
    const { count } = await sb.from(tabla).select('*', { count: 'exact', head: true });
    return count ?? 0;
  };

  const [equipos, cables, consumibles, plantillas, salas] = await Promise.all([
    porTipo('equipo'),
    porTipo('cable'),
    porTipo('consumible'),
    total('plantillas_sala'),
    total('salas'),
  ]);

  const { count: plantillasSinMedidas } = await sb
    .from('plantillas_sala')
    .select('*', { count: 'exact', head: true })
    .is('largo_m', null);

  const { count: salasSinMedidas } = await sb
    .from('salas')
    .select('*', { count: 'exact', head: true })
    .eq('largo_m', 0);

  const { count: cableSinPrecio } = await sb
    .from('articulos')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'cable')
    .is('coste', null);

  return {
    equipos,
    cables,
    consumibles,
    plantillas,
    salas,
    plantillasSinMedidas: plantillasSinMedidas ?? 0,
    salasSinMedidas: salasSinMedidas ?? 0,
    cableSinPrecio: cableSinPrecio ?? 0,
  };
}
