import { normalizarGrados, type EntradaCroquis } from './croquis';
import { extremoPorCategoria, type Conexion, type EquipoEnSala, type LineaPlantilla, type MuebleEnSala, type PlantillaSala, type PuertaEnSala, type Sala, type TipoArticulo } from './tipos';
import { puede, type Permisos } from './usuarios';
import { coordenadasFueraDeSala, puertasFueraDePared } from './plano-editor';

export interface ReferenciaPlantillaPreview { id: string; etiqueta: string; activo: boolean; tipo: TipoArticulo; unidad: 'ud' | 'm'; revision: number }
export interface LineaPlantillaPreview extends LineaPlantilla { rotacion_grados: number; referencia: ReferenciaPlantillaPreview | null }
export interface DatosPlantillaPreview {
  plantilla: PlantillaSala;
  lineas: LineaPlantillaPreview[];
  muebles: Array<MuebleEnSala & { rol: 'asiento' | 'mesa_principal' | null }>;
  puertas: PuertaEnSala[];
  conexiones: Conexion[];
  referenciasCable: ReferenciaPlantillaPreview[];
  contextoPuertos?: Array<Record<string, unknown>>;
  avisos: string[];
}
export interface VistaPreviaPlantilla extends DatosPlantillaPreview { huella: string }
export type ContextoMontajePlantilla = Partial<Pick<PlantillaSala, 'aforo' | 'largo_m' | 'ancho_m' | 'alto_m' | 'alto_falso_techo_m' | 'mesa_largo_m' | 'mesa_ancho_m' | 'mesa_alto_cm' | 'ruta_por_defecto'>>;

export function puedeLeerPlantillas(yo: { permisos: Permisos; debeCambiarClave: boolean } | null): boolean {
  return Boolean(yo && !yo.debeCambiarClave && puede(yo.permisos, 'plantillas', 'ver'));
}

export function bloqueosPlantilla(datos: DatosPlantillaPreview): string[] {
  const problemas = datos.lineas.filter(l => !l.opcional && (!l.referencia || !l.referencia.activo || l.referencia.tipo !== 'equipo'))
    .map(l => `${l.modelo_texto ?? l.categoria}: falta una referencia de equipo activa.`);
  if (datos.muebles.some(m => m.rol === 'mesa_principal')) problemas.push('La mesa principal no puede ser una fila de mobiliario. Corrige la plantilla.');
  if (datos.referenciasCable.some(a => !a.activo || a.tipo !== 'cable')) problemas.push('Hay una referencia de cable inactiva o de tipo incompatible.');
  return problemas;
}

/** Misma guarda geométrica que el editor, también para medidas del formulario. */
export function limitesDeEntrada(entrada: EntradaCroquis): string[] {
  const { sala, equipos, muebles = [], puertas = [], conexiones, tomas } = entrada;
  const problemas = coordenadasFueraDeSala({ sala, equipos: equipos.map(e => ({ id: e.id, ...e.posicion, posicion_confirmada: e.posicion_confirmada })),
    mobiliario_cambio: muebles, tomas }, sala);
  problemas.push(...puertasFueraDePared(puertas, sala));
  for (const c of conexiones) for (const p of c.puntos_paso ?? []) {
    if (['x_m', 'y_m', 'z_m'].some((clave, i) => !Number.isFinite(p[clave as 'x_m']) || p[clave as 'x_m'] < 0 || p[clave as 'x_m'] > [sala.largo_m, sala.ancho_m, sala.alto_m][i])) {
      problemas.push(`Un punto del recorrido ${c.id} queda fuera de la sala.`);
    }
  }
  return problemas;
}

/** Un adaptador de datos, nunca otro dibujante ni una sala persistida. */
export function entradaDePlantilla(datos: DatosPlantillaPreview, contexto: ContextoMontajePlantilla = {}): EntradaCroquis {
  const p = { ...datos.plantilla, ...contexto }; const id = `plantilla:${p.id}`;
  const sala: Sala = { ...p, id, sede_id: null, localizacion_id: null, codigo: null, plantilla_id: p.id,
    largo_m: p.largo_m ?? 0, ancho_m: p.ancho_m ?? 0, alto_m: p.alto_m ?? 0,
    alto_canaleta_m: null, alto_suelo_tecnico_m: null, mesa_rotacion_grados: normalizarGrados(p.mesa_rotacion_grados), diagrama_version: 0,
    sillas_modo: datos.muebles.some(m => m.rol === 'asiento') ? 'manuales' : 'derivadas' };
  const equipos: EquipoEnSala[] = datos.lineas.filter(l => !l.opcional).map(l => ({
    id: l.id, sala_id: id, articulo_id: l.articulo_id ?? '', nombre: l.modelo_texto ?? l.categoria,
    cantidad: Math.max(1, Math.round(l.cantidad) || 1), extremo: l.extremo ?? extremoPorCategoria(l.categoria),
    posicion: { x_m: l.x_m ?? 0, y_m: l.y_m ?? 0, z_m: l.z_m ?? 0 },
    posicion_confirmada: l.posicion_confirmada ?? (Number(l.x_m ?? 0) !== 0 || Number(l.y_m ?? 0) !== 0 || Number(l.z_m ?? 0) !== 0),
    rotacion_grados: normalizarGrados(l.rotacion_grados),
  }));
  const ids = new Set(equipos.map(e => e.id));
  return { sala, equipos, conexiones: datos.conexiones.filter(c => ids.has(c.origen_id) && ids.has(c.destino_id)).map(c => ({ ...c, sala_id: id })),
    muebles: datos.muebles.map(m => ({ ...m, sala_id: id })), puertas: datos.puertas.map(puerta => ({ ...puerta, sala_id: id })), tomas: [] };
}

/** Canoniza claves y orden de colecciones para la misma huella en cada lectura. */
export function serializarPlantilla(datos: DatosPlantillaPreview): string {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, valor]) => [k, ordenar(valor)]));
    return v;
  };
  return JSON.stringify(ordenar(datos));
}
