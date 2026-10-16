import 'server-only';
import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { sql, conLecturaConsistente } from './db';
import { esUuid } from './uuid';
import { bloqueosPlantilla, serializarPlantilla, type DatosPlantillaPreview, type ReferenciaPlantillaPreview, type VistaPreviaPlantilla } from './plantilla-preview';
import type { PlantillaSala, Conexion, PuertaEnSala, MuebleEnSala, LineaPlantilla } from './tipos';

type BasePlantillas = postgres.Sql<Record<string, unknown>> | postgres.TransactionSql<Record<string, unknown>>;
type Fila = Record<string, unknown>;
const n = (v: unknown) => v == null ? null : Number(v);
const s = (v: unknown) => v == null ? null : String(v);
const referencia = (f: Fila): ReferenciaPlantillaPreview => ({ id: String(f.ref_id), etiqueta: String(f.etiqueta), activo: f.activo === true,
  tipo: f.tipo as ReferenciaPlantillaPreview['tipo'], unidad: f.unidad as 'ud' | 'm', revision: Number(f.revision) });

/** Dentro de una copia se pasa su transacción para no mezclar versiones. */
export async function leerPlantillaPreview(id: string, db: BasePlantillas): Promise<VistaPreviaPlantilla | null> {
  if (!esUuid(id)) return null;
  // Una sola sentencia establece el punto de consistencia del DTO completo,
  // también en READ COMMITTED después de esperar el cerrojo de la sala.
  const [instantanea] = await db<Fila[]>`select to_jsonb(p) plantilla,
    (select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) from (
      select pa.*,a.id ref_id,a.activo,a.tipo,a.unidad,a.revision,trim(concat_ws(' ',a.marca,a.modelo)) etiqueta
      from plantilla_articulos pa left join articulos a on a.id=pa.articulo_id where pa.plantilla_id=p.id) l) lineas,
    (select coalesce(jsonb_agg(to_jsonb(m) order by m.orden,m.id),'[]'::jsonb) from (
      select pm.*,c.rol from plantilla_mobiliario pm left join catalogo_mobiliario c on c.id=pm.mobiliario_id where pm.plantilla_id=p.id) m) muebles,
    (select coalesce(jsonb_agg(to_jsonb(d) order by d.orden,d.id),'[]'::jsonb) from (
      select id,pared,posicion_m,anchura_m,altura_m,orden from puertas where plantilla_id=p.id) d) puertas,
    (select coalesce(jsonb_agg(to_jsonb(c) order by c.orden,c.creado_en,c.id),'[]'::jsonb) from plantilla_conexiones c where c.plantilla_id=p.id) tiradas,
    (select coalesce(jsonb_agg(to_jsonb(pp) order by pp.orden,pp.id),'[]'::jsonb) from plantilla_conexion_puntos_paso pp
      join plantilla_conexiones c on c.id=pp.plantilla_conexion_id where c.plantilla_id=p.id) puntos,
    (select coalesce(jsonb_agg(to_jsonb(b) order by b.plantilla_conexion_id,b.lado),'[]'::jsonb) from (
      select b.plantilla_conexion_id,b.lado,b.puerto_id,b.ordinal,to_jsonb(pu) puerto from plantilla_conexion_bocas b
      join plantilla_conexiones c on c.id=b.plantilla_conexion_id join puertos pu on pu.id=b.puerto_id where c.plantilla_id=p.id) b) puertos,
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.ref_id),'[]'::jsonb) from (
      select distinct a.id ref_id,a.activo,a.tipo,a.unidad,a.revision,trim(concat_ws(' ',a.marca,a.modelo)) etiqueta
      from plantilla_conexiones c join articulos a on a.id=c.articulo_cable_id where c.plantilla_id=p.id) a) cables
    from plantillas_sala p where p.id=${id}`;
  if (!instantanea) return null;
  const p=instantanea.plantilla as Fila;
  const lineas=instantanea.lineas as Fila[], muebles=instantanea.muebles as Fila[], puertas=instantanea.puertas as Fila[],
    tiradas=instantanea.tiradas as Fila[], puntos=instantanea.puntos as Fila[], puertos=instantanea.puertos as Fila[], cables=instantanea.cables as Fila[];
  const plantilla: PlantillaSala = { id: String(p.id), nombre: String(p.nombre), tipologia: String(p.tipologia), aforo: n(p.aforo), n_salas_reales: n(p.n_salas_reales),
    largo_m: n(p.largo_m), ancho_m: n(p.ancho_m), alto_m: n(p.alto_m), alto_falso_techo_m: n(p.alto_falso_techo_m),
    ruta_por_defecto: p.ruta_por_defecto as PlantillaSala['ruta_por_defecto'], notas: s(p.notas),
    mesa_largo_m: n(p.mesa_largo_m), mesa_ancho_m: n(p.mesa_ancho_m), mesa_alto_cm: n(p.mesa_alto_cm), mesa_x_m: n(p.mesa_x_m), mesa_y_m: n(p.mesa_y_m), mesa_rotacion_grados: n(p.mesa_rotacion_grados) };
  const datos: DatosPlantillaPreview = { plantilla,
    lineas: lineas.map(l => ({ id: String(l.id), articulo_id: s(l.articulo_id), categoria: String(l.categoria), cantidad: Number(l.cantidad), opcional: l.opcional === true,
      modelo_texto: s(l.modelo_texto), extremo: l.extremo as LineaPlantilla['extremo'], x_m: n(l.x_m), y_m: n(l.y_m), z_m: n(l.z_m), posicion_confirmada: l.posicion_confirmada == null ? null : l.posicion_confirmada === true,
      rotacion_grados: Number(l.rotacion_grados ?? 0), referencia: l.ref_id ? referencia(l) : null })),
    muebles: muebles.map(m => ({ id: String(m.id), sala_id: '', mobiliario_id: s(m.mobiliario_id), nombre: String(m.nombre), forma: m.forma as MuebleEnSala['forma'],
      largo_m: n(m.largo_m), ancho_m: n(m.ancho_m), alto_m: n(m.alto_m), x_m: n(m.x_m), y_m: n(m.y_m), z_m: n(m.z_m), rotacion_grados: Number(m.rotacion_grados ?? 0),
      posicion_confirmada: m.posicion_confirmada == null ? m.x_m != null && m.y_m != null : m.posicion_confirmada === true, orden: Number(m.orden), rol: m.rol as 'asiento' | 'mesa_principal' | null })),
    puertas: puertas.map(d => ({ id: String(d.id), sala_id: '', pared: d.pared as PuertaEnSala['pared'], posicion_m: Number(d.posicion_m), anchura_m: n(d.anchura_m), altura_m: n(d.altura_m), orden: Number(d.orden) })),
    conexiones: tiradas.map(c => ({ id: String(c.id), sala_id: '', origen_id: String(c.origen_linea_id), destino_id: String(c.destino_linea_id), articulo_cable_id: s(c.articulo_cable_id),
      senal: c.senal as Conexion['senal'], ruta: c.ruta as Conexion['ruta'], notas: s(c.notas), longitud_manual_m: null,
      puerto_origen_id: s(puertos.find(b => b.plantilla_conexion_id===c.id && b.lado==='origen')?.puerto_id),
      puerto_destino_id: s(puertos.find(b => b.plantilla_conexion_id===c.id && b.lado==='destino')?.puerto_id),
      puerto_origen_ordinal: n(puertos.find(b => b.plantilla_conexion_id===c.id && b.lado==='origen')?.ordinal),
      puerto_destino_ordinal: n(puertos.find(b => b.plantilla_conexion_id===c.id && b.lado==='destino')?.ordinal),
      puntos_paso: puntos.filter(punto => punto.plantilla_conexion_id === c.id).map(punto => ({ id: String(punto.id), orden: Number(punto.orden), x_m: Number(punto.x_m), y_m: Number(punto.y_m), z_m: Number(punto.z_m) })) })),
    referenciasCable: cables.map(referencia), contextoPuertos: puertos, avisos: [],
  };
  return { ...datos, huella: createHash('sha256').update(serializarPlantilla(datos)).digest('hex') };
}

export async function obtenerPlantillaPreview(id: string): Promise<VistaPreviaPlantilla | null> {
  return conLecturaConsistente(() => leerPlantillaPreview(id, sql));
}

export class ErrorCambioPlantilla extends Error {
  constructor(mensaje: string, readonly motivo: 'catalogo' | 'conflicto' = 'conflicto') { super(mensaje); }
}
/** Se llama dentro de la transacción de copia, tras bloquear su sala. */
export async function comprobarPlantillaParaCopiar(id: string, huella: string, db: BasePlantillas) {
  if (!/^[a-f0-9]{64}$/.test(huella)) throw new ErrorCambioPlantilla('Revisa la plantilla antes de aplicarla.');
  await db`select id from plantillas_sala where id=${id} for share`;
  const inicial = await leerPlantillaPreview(id, db);
  if (!inicial) throw new ErrorCambioPlantilla('La plantilla ya no existe.', 'catalogo');
  const articulos=[...new Set([...inicial.lineas.flatMap(l=>l.articulo_id?[l.articulo_id]:[]),...inicial.referenciasCable.map(a=>a.id)])].sort();
  const muebles=[...new Set(inicial.muebles.flatMap(m=>m.mobiliario_id?[m.mobiliario_id]:[]))].sort();
  const puertos=[...new Set((inicial.contextoPuertos ?? []).map(p=>String(p.puerto_id)))].sort();
  if(articulos.length) await db`select id from articulos where id in ${db(articulos)} order by id for share`;
  if(muebles.length) await db`select id from catalogo_mobiliario where id in ${db(muebles)} order by id for share`;
  // Las bocas se guardan bajo FOR UPDATE; adquirirlo ya evita que dos copias
  // intenten elevar simultáneamente un bloqueo compartido del mismo puerto.
  if(puertos.length) await db`select id from puertos where id in ${db(puertos)} order by id for update`;
  const vista = await leerPlantillaPreview(id, db);
  if (!vista || vista.huella !== huella || inicial.huella !== vista.huella) throw new ErrorCambioPlantilla('La plantilla o sus referencias cambiaron. Vuelve a revisar la vista previa.');
  const bloqueos = bloqueosPlantilla(vista);
  if (bloqueos.length) throw new ErrorCambioPlantilla(bloqueos[0], 'catalogo');
  return vista;
}

/** Antes del commit: cualquier alteración del origen deshace toda la copia. */
export async function comprobarPlantillaSinCambios(vista: VistaPreviaPlantilla, db: BasePlantillas) {
  const actual=await leerPlantillaPreview(vista.plantilla.id,db);
  if(!actual || actual.huella!==vista.huella) throw new ErrorCambioPlantilla('La plantilla o sus referencias cambiaron durante la copia. Vuelve a revisar la vista previa.');
}
