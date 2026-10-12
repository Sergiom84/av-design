import type { Conexion, EquipoEnSala } from './tipos';

export type EstadoSuministroCable = 'incluido' | 'adicional' | 'por_determinar';

export interface LineaComposicion {
  id: string;
  clave: string;
  articulo_componente_id: string | null;
  identidad: string;
  rol: string;
  cantidad: number;
  inclusion: 'incluido' | 'opcional' | 'por_determinar';
  fuente: string;
}
export interface SuministroSala {
  id: string;
  sala_id: string;
  articulo_id: string;
  composicion_id: string;
  estado: 'activo' | 'cancelado' | 'retirado_del_diseno';
  snapshot: { sku: string; version: number; estado_documental: 'documentada' | 'parcial'; fuente: string; lineas: LineaComposicion[] };
}
export interface ComponenteSuministro {
  equipo_id: string;
  suministro_id: string;
  linea_id: string;
  ordinal: number;
}
export interface CableSuministrado {
  id: string;
  suministro_id: string;
  sala_id: string;
  linea_id: string | null;
  ordinal: number;
  tipo: 'libre' | 'unido';
  propietario_equipo_id: string | null;
  puerto_fijo_id: string | null;
  ordinal_fijo: number | null;
  articulo_cable_id: string | null;
  longitud_utilizable_m: number | null;
  snapshot: { referencia?: string; fuente?: string; tipo?: string; longitud_utilizable_m?: number | null; [k: string]: unknown };
}
export interface ContextoSuministros {
  suministros: SuministroSala[];
  componentes: ComponenteSuministro[];
  cables?: CableSuministrado[];
}
export const BLOQUEO_TRAZABILIDAD_KIT = 'Kits pendientes de atribución comercial. Reservas, compras y cargas todavía no acreditan estos suministros.';

export function estadoComercialCable(estado: Conexion['estado_suministro'] | null | undefined): EstadoSuministroCable {
  return estado ?? 'adicional';
}

/** Solo el adicional confirmado suma compra. Incluido y por_determinar no. */
export function sumaCompraCable(estado: Conexion['estado_suministro'] | null | undefined): boolean {
  return estadoComercialCable(estado) === 'adicional';
}

export function etiquetaLatiguillo(cable: CableSuministrado): string {
  const referencia = typeof cable.snapshot.referencia === 'string' ? cable.snapshot.referencia : null;
  const metros = cable.longitud_utilizable_m != null ? ` · ${cable.longitud_utilizable_m} m` : '';
  return `${referencia ?? (cable.tipo === 'unido' ? 'Latiguillo unido' : 'Latiguillo libre')}${metros}`;
}

/** Unido solo si la tirada ya contiene el extremo fijo; ocupado por otra tirada no se ofrece. */
export function latiguilloAsignableATirada(
  cable: CableSuministrado,
  conexion: Pick<Conexion, 'id' | 'detalle' | 'cable_suministrado_id'>,
  ocupados: ReadonlySet<string>,
): boolean {
  if (conexion.cable_suministrado_id === cable.id) return true;
  if (ocupados.has(cable.id)) return false;
  if (cable.tipo !== 'unido') return true;
  if (conexion.detalle.estado !== 'completo') return false;
  return [conexion.detalle.origen, conexion.detalle.destino].some((e) =>
    e.tipo === 'equipo'
    && e.equipo_id === cable.propietario_equipo_id
    && e.puerto_id === cable.puerto_fijo_id
    && e.ordinal === cable.ordinal_fijo);
}

export interface PendienteSuministro {
  suministro_id: string | null;
  clave: string;
  detalle: string;
}

/** El vínculo normalizado excluye compras, nunca elementos del plano. */
export function proyectarSuministros<T extends Pick<EquipoEnSala, 'id' | 'articulo_id' | 'nombre' | 'cantidad'>>(
  equipos: T[], contexto: ContextoSuministros,
) {
  const vinculados = new Set(contexto.componentes.map((p) => p.equipo_id));
  const independientes = equipos.filter((e) => !vinculados.has(e.id));
  const activos = contexto.suministros.filter((s) => s.estado === 'activo');
  const necesidades = [
    ...independientes.map((e) => ({ articulo_id: e.articulo_id, nombre: e.nombre, cantidad: e.cantidad, suministro_id: null as string | null })),
    ...activos.map((s) => ({ articulo_id: s.articulo_id, nombre: s.snapshot.sku, cantidad: 1, suministro_id: s.id })),
  ];
  const porSuministro = new Map(activos.map((s) => [s.id, s]));
  const pendientes: PendienteSuministro[] = activos.flatMap((s) => s.snapshot.lineas
    .filter((l) => l.inclusion === 'por_determinar' || (l.inclusion === 'incluido' && !l.articulo_componente_id && l.rol !== 'cable'))
    .map((l) => ({ suministro_id: s.id, clave: l.clave, detalle: `${s.snapshot.sku}: ${l.identidad} (${l.inclusion === 'por_determinar' ? 'inclusión por determinar' : 'identidad pendiente'})` })));
  for (const k of contexto.cables ?? []) {
    const sku = porSuministro.get(k.suministro_id)?.snapshot.sku ?? 'suministro';
    if (k.longitud_utilizable_m == null) {
      pendientes.push({ suministro_id: k.suministro_id, clave: `cable-longitud:${k.id}`, detalle: `${sku}: longitud suministrada pendiente` });
    }
  }
  return { necesidades, fisicos: equipos, componentes: contexto.componentes, cables: contexto.cables ?? [], pendientes,
    bloqueoComercial: contexto.suministros.length ? BLOQUEO_TRAZABILIDAD_KIT : null };
}

export function pendientesDeTiradas(
  conexiones: Array<Pick<Conexion, 'id' | 'estado_suministro' | 'cable_suministrado_id' | 'etiqueta_cable'>>,
  cables: CableSuministrado[],
): PendienteSuministro[] {
  const porId = new Map(cables.map((k) => [k.id, k]));
  const asignados = new Set(conexiones.map((c) => c.cable_suministrado_id).filter((id): id is string => Boolean(id)));
  const pendientes: PendienteSuministro[] = [];
  for (const c of conexiones) {
    const etiqueta = c.etiqueta_cable ?? c.id;
    const estado = estadoComercialCable(c.estado_suministro);
    if (estado === 'por_determinar') {
      pendientes.push({ suministro_id: null, clave: `tirada-pendiente:${c.id}`, detalle: `${etiqueta}: suministro del cable por determinar` });
    }
    if (estado === 'incluido') {
      const k = c.cable_suministrado_id ? porId.get(c.cable_suministrado_id) : undefined;
      if (!k) pendientes.push({ suministro_id: null, clave: `incluido-sin-fila:${c.id}`, detalle: `${etiqueta}: incluido sin latiguillo físico` });
    }
  }
  for (const k of cables) {
    if (!asignados.has(k.id)) {
      pendientes.push({ suministro_id: k.suministro_id, clave: `cable-libre:${k.id}`, detalle: 'Latiguillo suministrado sin asignar a una tirada' });
    }
  }
  return pendientes;
}
