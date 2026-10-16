import { calcularConexion, agruparMaterialCable, type ResultadoCable } from './calculo-cable';
import { necesidadDeSala } from './compras';
import { PARAMETROS_POR_DEFECTO, type Articulo, type Conexion, type EquipoEnSala, type Sala } from './tipos';
/** El historial conserva datos, nunca un lienzo o hechos de almacén. */
export type ValorDiseno = string | number | boolean | null | ValorDiseno[] | { [clave: string]: ValorDiseno };
export type FilaDiseno = { [clave: string]: ValorDiseno };
export const TABLAS_DISENO = ['equipos', 'muebles', 'puertas', 'tomas', 'conexiones', 'bocas', 'puntos', 'material', 'anotaciones'] as const;
export type GrupoDiseno = typeof TABLAS_DISENO[number];
export interface SnapshotDiseno {
  formato: 1;
  salaId: string;
  sala: FilaDiseno;
  datos: Record<GrupoDiseno, FilaDiseno[]>;
  contexto: { articulos: FilaDiseno[]; puertos: FilaDiseno[]; parametros: FilaDiseno[]; mobiliario: FilaDiseno[] };
}
export interface BaseDiseno { version: number; hash: string }
export interface RevisionDiseno {
  id: string; salaId: string; numero: number; nombre: string;
  autorId: string; autor: string; creadoEn: string; hash: string;
  antecedenteId: string | null; restauradaDeId: string | null;
  snapshot?: SnapshotDiseno;
}
export interface ReferenciaRevisionDiseno {
  estado: 'revision' | 'borrador'; id: string | null; numero: number | null; nombre: string | null;
  autor: string | null; creadoEn: string | null; hash: string;
  antecedente: { id: string; numero: number; nombre: string; autor: string; creadoEn: string } | null;
  heredadaDe: { salaId: string; revisionId: string } | null;
}
export interface CambioDiseno {
  grupo: 'medidas' | GrupoDiseno | 'puertos' | 'catalogo' | 'catalogo_mobiliario' | 'parametros' | 'presentacion';
  id: string; estado: 'añadido' | 'retirado' | 'modificado'; campos: string[];
  antes: FilaDiseno | null; despues: FilaDiseno | null;
}
export interface DiferenciasDiseno { cambios: CambioDiseno[]; material: Array<{ articuloId: string; descripcion: string; unidad: string; antes: number; despues: number }> }
export const EXCLUSIONES_DUPLICACION = ['Seriales y activos', 'Existencias y movimientos de almacén', 'Reservas', 'Pedidos y recepciones', 'Cargas', 'Hitos y visitas de personas'] as const;
/** La dirección histórica depende de las revisiones, nunca del orden de clic. */
export function sentidoComparacionRevisiones(seleccion: Array<Pick<RevisionDiseno,'id'|'numero'>>) {
  if(seleccion.length!==2 || seleccion[0].id===seleccion[1].id)return null;
  const [anterior,posterior]=[...seleccion].sort((a,b)=>a.numero-b.numero);
  return {anterior,posterior};
}

/** Orden estable incluso cuando Postgres devuelve claves JSON en otro orden. */
export function serializarDiseno(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarDiseno).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    return `{${Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${serializarDiseno(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}
const IGUALES_IGNORADOS = new Set(['sala_id', 'creado_en', 'actualizado_en', 'revision']);
function camposCambio(a: FilaDiseno, b: FilaDiseno): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !IGUALES_IGNORADOS.has(k) && serializarDiseno(a[k]) !== serializarDiseno(b[k]));
}
function claveFila(f: FilaDiseno): string {
  return String(f.id ?? `${f.conexion_id}:${f.lado}`);
}
function necesidad(snapshot: SnapshotDiseno) {
  const equipos = snapshot.datos.equipos.map(e => ({ ...e, articulo_id:e.articulo_id ?? '', posicion:{x_m:e.x_m,y_m:e.y_m,z_m:e.z_m} })) as unknown as EquipoEnSala[];
  const conexiones = snapshot.datos.conexiones.map(c => ({ ...c, puntos_paso:snapshot.datos.puntos.filter(p=>p.conexion_id===c.id) })) as unknown as Conexion[];
  const articulos = new Map(snapshot.contexto.articulos.map(a => [String(a.id), a as unknown as Articulo]));
  const filas = new Map(snapshot.contexto.parametros.map(p=>[String(p.clave), Number(p.valor)]));
  const holguras = { ...PARAMETROS_POR_DEFECTO.holguras };
  for(const k of Object.keys(holguras) as Array<keyof typeof holguras>)if(filas.has(`holgura_${k}`))holguras[k]=filas.get(`holgura_${k}`)!;
  const parametros={holguras,margen:filas.get('margen')??PARAMETROS_POR_DEFECTO.margen,cables_por_canalizacion:filas.get('cables_por_canalizacion')??PARAMETROS_POR_DEFECTO.cables_por_canalizacion,ocupacion_maxima_canaleta:filas.get('ocupacion_maxima_canaleta')??PARAMETROS_POR_DEFECTO.ocupacion_maxima_canaleta};
  const porId=new Map(equipos.map(e=>[e.id,e]));const sala=snapshot.sala as unknown as Sala;
  const resultados=!sala.largo_m||!sala.ancho_m||!sala.alto_m ? [] : conexiones.map(c=>calcularConexion(c,sala,porId,articulos,parametros)).filter((r):r is ResultadoCable=>r!==null);
  const cable=agruparMaterialCable(resultados,conexiones,articulos);
  const bom=snapshot.datos.material.map(m=>({articulo_id:String(m.articulo_id),descripcion:String(articulos.get(String(m.articulo_id))?.modelo??m.articulo_id),unidad:m.unidad as 'ud'|'m',cantidad:Number(m.cantidad)}));
  return new Map(necesidadDeSala(equipos,cable,articulos,bom).map(n=>[n.articulo_id,n.cantidad]));
}
/** mapa convierte IDs de una alternativa a las identidades de su sala origen. */
export function compararDisenos(a: SnapshotDiseno, b: SnapshotDiseno, mapa: Record<string, string> = {}): DiferenciasDiseno {
  const remap = (v: ValorDiseno): ValorDiseno => {
    if (typeof v === 'string') return Object.prototype.hasOwnProperty.call(mapa,v) ? mapa[v] : v;
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, valor]) => [k, remap(valor)]));
    return v;
  };
  const cambios: CambioDiseno[] = [];
  const comparar = (grupo: CambioDiseno['grupo'], aa: FilaDiseno[], bb: FilaDiseno[]) => {
    const anterior = new Map(aa.map(f => [claveFila(f), f]));
    const posterior = new Map(bb.map(f => [claveFila(f), f]));
    for (const id of [...new Set([...anterior.keys(), ...posterior.keys()])].sort()) {
      const antes = anterior.get(id) ?? null; const despues = posterior.get(id) ?? null;
      const campos = antes && despues ? camposCambio(antes, despues) : [];
      if (!antes || !despues || campos.length) cambios.push({ grupo, id, estado: !antes ? 'añadido' : !despues ? 'retirado' : 'modificado', campos, antes, despues });
    }
  };
  const salaA: FilaDiseno = { ...a.sala, id: 'sala' }; const salaB: FilaDiseno = { ...b.sala, id: 'sala' };
  for (const k of ['nombre', 'codigo']) { delete salaA[k]; delete salaB[k]; }
  comparar('medidas', [salaA], [salaB]);
  for (const grupo of TABLAS_DISENO) {
    const filas = b.datos[grupo].map(f => remap(f) as FilaDiseno);
    if (grupo === 'equipos') {
      const fisico = (f: FilaDiseno) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'esquema_x' && k !== 'esquema_y'));
      comparar(grupo, a.datos[grupo].map(fisico), filas.map(fisico));
      const visual = (f: FilaDiseno) => ({ id: f.id, esquema_x: f.esquema_x, esquema_y: f.esquema_y });
      comparar('presentacion', a.datos[grupo].map(visual), filas.map(visual));
    } else comparar(grupo, a.datos[grupo], filas);
  }
  comparar('puertos', a.contexto.puertos, b.contexto.puertos);
  comparar('catalogo', a.contexto.articulos, b.contexto.articulos);
  comparar('catalogo_mobiliario', a.contexto.mobiliario, b.contexto.mobiliario);
  comparar('parametros', a.contexto.parametros.map(f => ({ ...f, id: f.clave })), b.contexto.parametros.map(f => ({ ...f, id: f.clave })));
  const na = necesidad(a); const nb = necesidad(b);
  const articulos = new Map([...a.contexto.articulos, ...b.contexto.articulos].map(f => [String(f.id), f]));
  const material = [...new Set([...na.keys(), ...nb.keys()])].sort().map(articuloId => {
    const ar = articulos.get(articuloId); return { articuloId, descripcion: ar ? [ar.marca, ar.modelo].filter(Boolean).join(' ') : articuloId,
      unidad: String(ar?.unidad ?? 'ud'), antes: na.get(articuloId) ?? 0, despues: nb.get(articuloId) ?? 0 };
  });
  return { cambios, material };
}
