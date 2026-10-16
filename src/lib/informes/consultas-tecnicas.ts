import { createHash } from 'node:crypto';
import { z } from 'zod';
import { puede, type Seccion } from '../usuarios';
import { autorizarAmbitoInforme, distribuye, exigirDistribucion, identidadActual,
  type ConexionLecturaInformes } from './autorizacion';
import { configuracionSchema, ErrorInforme, serializarCanonico, uuid, type ClaveInforme } from './modelo';
import { REGISTRO_INFORMES, seccionesInforme } from './registro';

/** Frontera de lectura03: no importa el repositorio que carga el snapshot completo. */
const ambitoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('sala'), id: uuid }).strict(),
  z.object({ tipo: z.literal('obra'), id: uuid, salaIds: z.array(uuid).min(1).max(20)
    .refine(a => new Set(a).size === a.length) }).strict(),
  z.object({ tipo: z.literal('catalogo') }).strict(),
]);
export type AmbitoConsultaInforme = z.infer<typeof ambitoSchema>;
export interface FuenteConsultaInforme {
  id: string; hash: string; observadoEn: string; href: string; etiqueta: string;
  requiere: Seccion[]; ambito: AmbitoConsultaInforme;
}
export interface HechoConsultaInforme {
  etiqueta: string; valor: string | number | null; unidad?: string; campo: string;
}
export interface TextoConsultaInforme extends FuenteConsultaInforme {
  hechos: HechoConsultaInforme[]; avisos: string[];
}
const origenSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('propietario'), revocadoEn: z.string().optional() }).strict(),
  z.object({ tipo: z.literal('directo'), revocadoEn: z.string().optional() }).strict(),
  z.object({ tipo: z.literal('grupo'), id: uuid, version: z.number().int().nonnegative().optional(),
    revocadoEn: z.string().optional() }).strict(),
]);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const instanteSchema = z.coerce.date();
const celdasPorClave: Record<ClaveInforme, string[]> = {
  material_actual: ['articulo_id', 'referencia', 'descripcion', 'origenes', 'unidad', 'necesidad', 'detalle'],
  material_movimientos: ['fecha', 'sala', 'articulo', 'tipo', 'cantidad', 'unidad', 'signo', 'cantidadNeta', 'motivo', 'quien'],
  carga_actual: ['sala', 'carga', 'estado', 'articulo', 'cantidad', 'unidad', 'cargado', 'instalado', 'devuelto', 'roto', 'lineas', 'pendientes'],
  carga_hechos: ['fecha', 'sala', 'carga', 'hecho'],
  estado_actual: ['tipo', 'nombre', 'codigo', 'estado'],
  estado_hitos: ['fecha', 'tipoEntidad', 'nombre', 'tipo', 'tecnico', 'nota'],
};
function noDisponible(): never {
  throw new ErrorInforme('FUENTE_NO_DISPONIBLE', 'El informe no está disponible para esta consulta.', 403);
}
function mismoConjunto(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().every((id, n) => id === [...b].sort()[n]);
}
async function autorizarFuente(sql: ConexionLecturaInformes, usuarioId: string, id: string,
  solicitado: AmbitoConsultaInforme) {
  if (!uuid.safeParse(usuarioId).success || !uuid.safeParse(id).success ||
      usuarioId === '00000000-0000-0000-0000-000000000000') noDisponible();
  const ambito = ambitoSchema.parse(solicitado);
  const lector = await identidadActual(sql, usuarioId);
  if (ambito.tipo === 'catalogo' || !puede(lector.permisos, 'salas', 'ver') ||
    ambito.tipo === 'obra' && !puede(lector.permisos, 'proyectos', 'ver')) noDisponible();
  // Sólo metadatos de ACL; no nombre, manifiesto, filas, preguntas o binarios.
  const [meta] = await sql`select e.id,e.propietario_id,e.estado,e.snapshot_sha256,
    e.observado_en,e.revocada_en,(e.caduca_en>clock_timestamp()) as vigente,
    e.definicion_snapshot->'configuracion' as configuracion,
    d.configuracion->'audiencia'->'usuarios' as directos,
    r.origenes,r.revocado_en,r.excluido_codigo
    from informes_ejecuciones e join informes_definiciones d on d.id=e.definicion_id
    join informes_receptores r on r.ejecucion_id=e.id and r.usuario_id=${usuarioId}
    where e.id=${id}`;
  if (!meta || meta.revocada_en || meta.revocado_en || meta.excluido_codigo ||
    meta.estado !== 'correcta' || !meta.vigente) noDisponible();
  const c = configuracionSchema.safeParse(meta.configuracion);
  const origenes = z.array(origenSchema).safeParse(meta.origenes);
  if (!c.success || !origenes.success || !hashSchema.safeParse(meta.snapshot_sha256).success ||
    !instanteSchema.safeParse(meta.observado_en).success) noDisponible();
  const configuracion = c.data;
  autorizarAmbitoInforme(lector, configuracion);
  const propietario = await identidadActual(sql, String(meta.propietario_id));
  autorizarAmbitoInforme(propietario, configuracion);
  if (distribuye(configuracion, propietario.id)) exigirDistribucion(propietario);
  let concede = usuarioId === propietario.id;
  for (const origen of origenes.data) {
    if (concede || origen.revocadoEn) continue;
    if (origen.tipo === 'directo' && z.array(uuid).safeParse(meta.directos).success &&
      (meta.directos as string[]).includes(usuarioId)) concede = true;
    if (origen.tipo === 'grupo') {
      const [grupo] = await sql`select g.ambito from informes_grupos g
        join informes_grupo_miembros m on m.grupo_id=g.id
        where g.id=${origen.id} and g.propietario_id=${propietario.id}
        and g.activo and m.usuario_id=${usuarioId}`;
      if (grupo && serializarCanonico(grupo.ambito) === serializarCanonico(configuracion.ambito)) concede = true;
    }
  }
  if (!concede || configuracion.ambito.tipo !== ambito.tipo || configuracion.ambito.id !== ambito.id) noDisponible();
  // Proyección de IDs del ámbito congelado sólo tras TODA la ACL03.
  const [captura] = await sql`select snapshot->>'versionModelo' as modelo,
    snapshot->>'versionGenerador' as generador,
    jsonb_path_query_array(snapshot,'$.ambito.salas[*].id') as sala_ids
    from informes_ejecuciones where id=${id}`;
  const salas = z.array(uuid).min(1).max(20).safeParse(captura?.sala_ids);
  if (captura?.modelo !== '1' || captura.generador !== 'rea03-1' || !salas.success) noDisponible();
  const seleccion = ambito.tipo === 'sala' ? [ambito.id] : ambito.salaIds;
  if (!mismoConjunto(salas.data, seleccion)) noDisponible();
  if (ambito.tipo === 'sala') {
    const [sala] = await sql`select id from salas where id=${ambito.id}`;
    if (!sala) noDisponible();
  } else {
    const presentes = await sql`select s.id from salas s left join localizaciones l on l.id=s.localizacion_id
      left join proyectos p on p.id=l.proyecto_id where p.id=${ambito.id} and s.id in ${sql(ambito.salaIds)}`;
    if (!mismoConjunto(presentes.map(s => String(s.id)), ambito.salaIds)) noDisponible();
  }
  const fuente: FuenteConsultaInforme = { id, hash: String(meta.snapshot_sha256),
    observadoEn: new Date(meta.observado_en as Date).toISOString(),
    href: `/cuenta/informes?ejecucion=${id}`, etiqueta: REGISTRO_INFORMES[configuracion.clave].nombre,
    requiere: seccionesInforme(configuracion.clave, configuracion.ambito), ambito };
  return { fuente, clave: configuracion.clave };
}

/** Recibe conexión de la captura MVCC; el coordinador09 revalida en lectura nueva. */
export async function leerFuenteConsultaInforme(sql: ConexionLecturaInformes, usuarioId: string,
  id: string, ambito: AmbitoConsultaInforme, opciones: { texto: boolean }): Promise<TextoConsultaInforme> {
  const { fuente, clave } = await autorizarFuente(sql, usuarioId, id, ambito);
  if (!opciones.texto) return { ...fuente, hechos: [], avisos: [] };
  const campos = celdasPorClave[clave];
  // Sólo claves técnicas cerradas: ni snapshot completo, ni resumen/precios/material/bytea.
  const filas = await sql`select f.posicion::int, f.fila->>'clave' as fila_id,
    c.key as campo,c.value as valor,f.fila->'valores'->>'unidad' as unidad
    from informes_ejecuciones e
    cross join lateral jsonb_array_elements(e.snapshot->'filas') with ordinality f(fila,posicion)
    cross join lateral jsonb_each(f.fila->'valores') c
    where e.id=${id} and c.key=any(${campos}::text[])
    order by f.posicion,c.key limit 1001`;
  if (filas.length > 1000) throw new ErrorInforme('LIMITE_EXCEDIDO', 'Reduce el ámbito del informe.', 413);
  const hechos: HechoConsultaInforme[] = filas.map(f => {
    if (!['string', 'number', 'boolean'].includes(typeof f.valor) && f.valor !== null) noDisponible();
    const valor = typeof f.valor === 'boolean' ? f.valor ? 'Sí' : 'No' : f.valor as string | number | null;
    const campo = `filas[${Number(f.posicion) - 1}].valores.${String(f.campo)}`;
    const unidad = ['necesidad', 'cantidad', 'cantidadNeta', 'instalado', 'devuelto', 'roto'].includes(String(f.campo)) &&
      typeof f.unidad === 'string' ? f.unidad : undefined;
    return { etiqueta: `${String(f.fila_id ?? f.posicion)} · ${String(f.campo)}`, valor, campo,
      ...(unidad ? { unidad } : {}) };
  });
  if (Buffer.byteLength(JSON.stringify(hechos), 'utf8') > 256 * 1024)
    throw new ErrorInforme('LIMITE_EXCEDIDO', 'Reduce el ámbito del informe.', 413);
  return { ...fuente, hechos, avisos: ['Texto técnico del informe guardado; no representa una lectura actual de sus hechos.'] };
}

export async function listarFuentesConsultaInforme(sql: ConexionLecturaInformes, usuarioId: string,
  solicitado: AmbitoConsultaInforme): Promise<FuenteConsultaInforme[]> {
  const ambito = ambitoSchema.parse(solicitado), u = await identidadActual(sql, usuarioId);
  if (ambito.tipo === 'catalogo') return [];
  if (!puede(u.permisos, 'salas', 'ver') || ambito.tipo === 'obra' && !puede(u.permisos, 'proyectos', 'ver')) noDisponible();
  const candidatos = await sql`select e.id from informes_ejecuciones e
    join informes_receptores r on r.ejecucion_id=e.id and r.usuario_id=${usuarioId}
    where e.estado='correcta' and e.revocada_en is null and e.caduca_en>clock_timestamp()
    and r.revocado_en is null and r.excluido_codigo is null
    and e.definicion_snapshot->'configuracion'->'ambito'->>'tipo'=${ambito.tipo}
    and e.definicion_snapshot->'configuracion'->'ambito'->>'id'=${ambito.id}
    order by e.creado_en desc,e.id desc limit 20`;
  const salida: FuenteConsultaInforme[] = [];
  for (const candidato of candidatos) {
    try { salida.push((await autorizarFuente(sql, usuarioId, String(candidato.id), ambito)).fuente); }
    catch (error) {
      if (!(error instanceof ErrorInforme) || ![401, 403, 404].includes(error.status)) throw error;
    }
  }
  return salida;
}

/** Útil para ligar la selección técnica exacta sin inventar un hash del PDF. */
export function hashProyeccionConsultaInforme(texto: TextoConsultaInforme) {
  return createHash('sha256').update(serializarCanonico(texto)).digest('hex');
}
