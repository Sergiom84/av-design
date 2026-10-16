import type postgres from 'postgres';
import { esAcceso, esRol, esSeccion, puede, resolverPermisos, type Acceso, type Permisos, type Seccion } from '../usuarios';
import { ErrorRequisito, hashBytes, metadatosSchema, referenciaSchema, validar, type Destino } from './modelo';
export type Conexion = postgres.Sql<Record<string, unknown>> | postgres.TransactionSql<Record<string, unknown>>;
export type Base = postgres.Sql<Record<string, unknown>>;
export interface Identidad { id: string; permisos: Permisos }
export interface Documento { id: string; proyectoId: string; autorId: string; version: number; tipo: 'archivo_obra' | 'ficha_e2' | 'lote_e2'; sha256: string; estado: string; creadoEn: string; referencia: ReturnType<typeof referenciaSchema.parse> | null }
export async function identidad(db: Conexion, id: string): Promise<Identidad> {
  if (id === '00000000-0000-0000-0000-000000000000') throw new ErrorRequisito('IDENTIDAD', 'Se necesita un usuario real.', 403);
  const [u] = await db`select id,rol::text as rol,activo,debe_cambiar_clave from usuarios where id=${id}`;
  if (!u?.activo) throw new ErrorRequisito('IDENTIDAD', 'Sin sesión activa.', 401);
  if (u.debe_cambiar_clave || !esRol(u.rol)) throw new ErrorRequisito('IDENTIDAD', 'Se necesita una contraseña definitiva.', 403);
  const ajustes: Partial<Record<Seccion, Acceso>> = {};
  for (const a of await db`select seccion,acceso from usuario_permisos where usuario_id=${id}`) if (esSeccion(a.seccion) && esAcceso(a.acceso)) ajustes[a.seccion] = a.acceso;
  return { id, permisos: resolverPermisos(u.rol, ajustes) };
}
export function exigir(u: Identidad, requisitos: readonly Seccion[], acceso: 'ver' | 'editar' = 'ver') {
  if (requisitos.some(s => !puede(u.permisos, s, acceso))) throw new ErrorRequisito('PERMISO', 'No tienes acceso a todas las fuentes o destinos de esta operación.', 403);
}
export function exigirDestino(u: Identidad, destino: Destino) {
  exigir(u, ['proyectos', 'salas']);
  if (destino === 'areas_bom') { exigir(u, ['proyectos', 'salas'], 'editar'); exigir(u, ['catalogo']); }
  else { exigir(u, ['catalogo'], 'editar'); if (destino === 'ofertas') { exigir(u, ['compras'], 'editar'); exigir(u, ['parametros']); } }
}
export function seccionesFuente(d: Pick<Documento, 'tipo' | 'referencia'>): Seccion[] {
  return [...new Set<Seccion>(['proyectos', 'salas', ...(d.tipo === 'archivo_obra' ? ['compras' as const] : d.tipo === 'ficha_e2' ? ['catalogo' as const] : d.referencia?.tipo === 'lote_e2' && d.referencia.destino === 'precios' ? ['catalogo' as const, 'compras' as const, 'parametros' as const] : ['catalogo' as const])])];
}
/** Cabecera sin título, contenido, texto ni bytes. Siempre primero propietario y después ACL. */
export async function autorizarDocumento(db: Conexion, u: Identidad, id: string, opciones: { permitirRetirado?: boolean; bloquear?: boolean; verificarOrigen?:boolean } = {}): Promise<Documento> {
  const filas = opciones.bloquear
    ? await db`select id,proyecto_id,autor_id,version,tipo,sha256,estado,origen_ref,creado_en from requisitos_documentos where id=${id} for update`
    : await db`select id,proyecto_id,autor_id,version,tipo,sha256,estado,origen_ref,creado_en from requisitos_documentos where id=${id}`;
  const d = filas[0];
  if (!d || d.autor_id !== u.id) throw new ErrorRequisito('NO_EXISTE', 'La fuente no está disponible.', 404);
  const documento: Documento = { id: String(d.id), proyectoId: String(d.proyecto_id), autorId: String(d.autor_id), version: Number(d.version), tipo: d.tipo, sha256: String(d.sha256), estado: String(d.estado), creadoEn: new Date(d.creado_en).toISOString(), referencia: d.origen_ref == null ? null : validar(referenciaSchema, d.origen_ref) };
  exigir(u, seccionesFuente(documento));
  exigirPermisosReferencia(u,documento.referencia);
  if (!opciones.permitirRetirado && documento.estado !== 'activo') throw new ErrorRequisito('FUENTE_RETIRADA', 'La fuente ya no está disponible.', 409);
  if (documento.estado === 'activo'&&opciones.verificarOrigen!==false) await autorizarReferencia(db, u, documento.referencia);
  return documento;
}
/** Sólo IDs/hash/revisiones; no carga ni siquiera el nombre privado del origen. */
export async function autorizarReferencia(db: Conexion, u: Identidad, r: Documento['referencia']) {
  if (!r) return;
  exigirPermisosReferencia(u,r);
  if (r.tipo === 'ficha_e2') {
    exigir(u, ['catalogo']);
    const [f] = await db`select f.id,f.sha256,f.revision_fuente,f.tipo,f.modelo,a.modelo as modelo_actual,f.marca,a.marca as marca_actual
      from articulos_archivos_tecnicos f join articulos a on a.id=f.articulo_id where f.id=${r.archivoId} and f.articulo_id=${r.articuloId}`;
    if (!f || f.tipo !== 'ficha' || f.sha256 !== r.sha256 || String(f.revision_fuente) !== r.revisionFuente || f.modelo !== f.modelo_actual || f.marca !== f.marca_actual) throw new ErrorRequisito('FUENTE_CAMBIADA', 'La referencia técnica cambió o fue retirada.', 409);
  } else {
    exigir(u, ['catalogo'], r.destino === 'bom' ? 'ver' : 'editar');
    if (r.destino === 'bom') exigir(u, ['salas'], 'editar');
    if (r.destino === 'precios') { exigir(u, ['compras'], 'editar'); exigir(u, ['parametros']); }
    const [l] = await db`select usuario_id,destino,archivo_sha256 from importacion_lotes where id=${r.loteId}`;
    if (!l || l.usuario_id !== u.id) throw new ErrorRequisito('NO_EXISTE', 'La fuente no está disponible.', 404);
    if (l.destino !== r.destino || l.archivo_sha256 !== r.sha256) throw new ErrorRequisito('FUENTE_CAMBIADA', 'El lote de origen cambió.', 409);
  }
}
function exigirPermisosReferencia(u:Identidad,r:Documento['referencia']){
  if(!r)return;exigir(u,['catalogo'],r.tipo==='lote_e2'&&r.destino!=='bom'?'editar':'ver');
  if(r.tipo==='lote_e2'&&r.destino==='bom')exigir(u,['salas'],'editar');
  if(r.tipo==='lote_e2'&&r.destino==='precios'){exigir(u,['compras'],'editar');exigir(u,['parametros']);}
}
export async function contenido(db: Conexion, u: Identidad, d: Documento, bytes = false) {
  // Reautorizar inmediatamente antes de la primera proyección privada.
  await autorizarDocumento(db, u, d.id);
  const [c] = bytes ? await db`select metadatos,bytes from requisitos_contenidos where documento_id=${d.id}` : await db`select metadatos from requisitos_contenidos where documento_id=${d.id}`;
  if (!c?.metadatos) throw new ErrorRequisito('INTEGRIDAD', 'La fuente no está disponible.', 503);
  const metadatos = validar(metadatosSchema, c.metadatos);
  if (!bytes) return { metadatos, bytes: null };
  let original: Uint8Array;
  if (d.tipo === 'archivo_obra') original = c.bytes;
  else if (d.referencia?.tipo === 'ficha_e2') {
    const [f] = await db`select bytes from articulos_archivos_tecnicos where id=${d.referencia.archivoId} and articulo_id=${d.referencia.articuloId}`; original = f?.bytes;
  } else if (d.referencia?.tipo === 'lote_e2') {
    const [l] = await db`select archivo from importacion_lotes where id=${d.referencia.loteId} and usuario_id=${u.id}`; original = l?.archivo;
  } else throw new ErrorRequisito('INTEGRIDAD', 'La fuente no está disponible.', 503);
  if (!original || original.length !== metadatos.tamano || hashBytes(original) !== d.sha256) throw new ErrorRequisito('INTEGRIDAD', 'La fuente no coincide con su integridad registrada.', 503);
  return { metadatos, bytes: Buffer.from(original) };
}
