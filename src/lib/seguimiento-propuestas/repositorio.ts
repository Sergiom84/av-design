import { puede } from '../usuarios';
import { ErrorSeguimiento, LIMITES, identificador, type Evento, type Filtros, type Miembro } from './modelo';
import { autorizarAmbito, exigir, type Conexion, type Identidad } from './autorizacion';
import { derivarEstado } from './estados';
import { rango } from './cohorte';
export interface MetaRevision { id: string; propuesta_id: string; numero: number; sha256: string; titulo: string; autor_nombre: string; contiene_valoracion: boolean; tipo_fuente: string; requiere_catalogo: boolean | null; salas: Array<{ id: string; disenoVersion: number }>; ambito_fuente: { tipo: 'sala' | 'obra'; id: string; salaIds?: string[] }; }
export interface Cabecera { id: string; ambito: 'sala' | 'obra'; sala_id: string | null; proyecto_id: string | null; version: number; actual_revision_id: string; contiene_valoracion: boolean; archivada_en: Date | null; actual_requiere_catalogo: boolean | null; }
export async function cabecera(c: Conexion, u: Identidad, id: string, editar = false, lock = false): Promise<Cabecera> {
    identificador(id); exigir(u, 'salas');
    const lockSql = lock ? c`for update of p` : c``;
    const [p] = await c<Cabecera[]>`select p.id,p.ambito,p.sala_id,p.proyecto_id,p.version,p.actual_revision_id,p.contiene_valoracion,p.archivada_en,v.requiere_catalogo actual_requiere_catalogo from propuestas p left join propuesta_revision_visibilidad v on v.revision_id=p.actual_revision_id where p.id=${id} ${lockSql}`;
    if (!p) throw new ErrorSeguimiento('Propuesta no encontrada.', 404);
    autorizarAmbito(u, p.ambito, editar);
    if (p.contiene_valoracion) { exigir(u, 'compras', editar ? 'editar' : 'ver'); if (p.actual_requiere_catalogo === null) throw new ErrorSeguimiento('Metadatos de visibilidad incompletos.', 503); if (p.actual_requiere_catalogo) exigir(u, 'catalogo'); }
    return p;
}
export async function metaRevision(c: Conexion, u: Identidad, p: Cabecera, revisionId = p.actual_revision_id, editar = false): Promise<MetaRevision> {
    identificador(revisionId);
    const [r] = await c<MetaRevision[]>`select r.id,r.propuesta_id,r.numero,r.sha256,r.titulo,r.autor_nombre,r.contiene_valoracion,r.fuente->>'tipo' tipo_fuente,r.fuente->'salas' salas,r.fuente->'ambito' ambito_fuente,v.requiere_catalogo from propuesta_revisiones r left join propuesta_revision_visibilidad v on v.revision_id=r.id where r.id=${revisionId} and r.propuesta_id=${p.id}`;
    if (!r) throw new ErrorSeguimiento('Revisión no encontrada.', 404);
    if (r.contiene_valoracion) { exigir(u, 'compras', editar ? 'editar' : 'ver'); if (r.requiere_catalogo === null) throw new ErrorSeguimiento('Metadatos de visibilidad incompletos.', 503); if (r.requiere_catalogo) exigir(u, 'catalogo'); }
    if (r.tipo_fuente === 'bom') exigir(u, 'catalogo');
    if (!r.ambito_fuente || !Array.isArray(r.salas) || !r.salas.length) throw new ErrorSeguimiento('Ámbito de la revisión inconsistente.', 503);
    return r;
}
export async function publicacion(c: Conexion, propuestaId: string, revisionId: string) {
    const [o] = await c`select id,creado_en from propuesta_operaciones where propuesta_id=${propuestaId} and revision_id=${revisionId} and tipo='revision' order by creado_en,id limit 1`;
    if (!o) throw new ErrorSeguimiento('La revisión no tiene publicación registrada.', 503);
    return { id: String(o.id), fecha: new Date(o.creado_en).toISOString() };
}
export async function eventosRevision(c: Conexion, propuestaId: string, revisionId: string, corte?: string): Promise<Evento[]> {
    const filtro = corte ? c`and creado_en<=${corte}` : c``;
    const filas = await c`select id,propuesta_id,revision_id,revision_sha256,numero,antecedente_id,tipo,decision_revocada_id,motivo,referencia,autor_id,autor_nombre,creado_en from propuesta_eventos where propuesta_id=${propuestaId} and revision_id=${revisionId} ${filtro} order by numero limit ${LIMITES.eventos + 1}`;
    if (filas.length > LIMITES.eventos) throw new ErrorSeguimiento('El historial supera el límite de eventos.', 413);
    return filas.map(e => ({ id: String(e.id), propuestaId: String(e.propuesta_id), revisionId: String(e.revision_id), revisionHash: String(e.revision_sha256), numero: Number(e.numero), antecedenteId: e.antecedente_id, tipo: e.tipo, decisionRevocadaId: e.decision_revocada_id, motivo: String(e.motivo), referencia: String(e.referencia), autorId: String(e.autor_id), autor: String(e.autor_nombre), creadoEn: new Date(e.creado_en).toISOString() }));
}
export function filtroVisibilidad(c: Conexion, u: Identidad) {
    const compras = puede(u.permisos, 'compras', 'ver'), catalogo = puede(u.permisos, 'catalogo', 'ver'), obras = puede(u.permisos, 'proyectos', 'ver');
    return c`(${obras} or p.ambito='sala') and (${compras} or (not p.contiene_valoracion and not r.contiene_valoracion)) and (${catalogo} or (r.fuente->>'tipo'<>'bom' and not coalesce(v.requiere_catalogo,false) and not coalesce(vc.requiere_catalogo,false)))`;
}
function filtroAmbito(c: Conexion, f: Filtros) { return f.ambito.tipo === 'seleccion' ? c`p.id in ${c(f.ambito.ids)}` : f.ambito.tipo === 'sala' ? c`p.ambito='sala' and p.sala_id=${f.ambito.id}` : c`p.ambito='obra' and p.proyecto_id=${f.ambito.id}`; }
export async function leerCohorte(c: Conexion, u: Identidad, f: Filtros): Promise<Miembro[]> {
    const periodo = rango(f), ambito = filtroAmbito(c, f), visible = filtroVisibilidad(c, u);
    // Primero detecta publicaciones inconsistentes usando sólo metadatos autorizados.
    const [mal] = await c`select exists(select 1 from propuestas p join propuesta_revisiones r on r.propuesta_id=p.id left join propuesta_revision_visibilidad v on v.revision_id=r.id left join propuesta_revision_visibilidad vc on vc.revision_id=p.actual_revision_id where ${ambito} and ${visible} and ((r.contiene_valoracion and v.revision_id is null) or (p.contiene_valoracion and vc.revision_id is null) or not exists(select 1 from propuesta_operaciones o where o.propuesta_id=p.id and o.revision_id=r.id and o.tipo='revision') or ((p.archivada_en is not null) is distinct from coalesce((select op.tipo='archivar' from propuesta_operaciones op where op.propuesta_id=p.id and op.tipo in ('archivar','reactivar') order by op.creado_en desc,op.id desc limit 1),false)))) mal`;
    if (mal.mal) throw new ErrorSeguimiento('El conjunto contiene revisiones sin publicación o visibilidad íntegra.', 503);
    const archivo = f.archivo === 'todas' ? c`` : c`and coalesce(a.tipo='archivar',false)=${f.archivo === 'archivadas'}`;
    const filas = await c`select p.id propuesta_id,r.id revision_id,r.numero,r.sha256,r.titulo,o.id publicacion_operacion_id,o.creado_en publicada_en,primera.fecha primera_publicacion_en,coalesce(a.tipo='archivar',false) archivo_al_corte
      from propuestas p
      cross join lateral(select min(creado_en) fecha from propuesta_operaciones where propuesta_id=p.id and tipo='revision') primera
      cross join lateral(select rr.id,rr.numero,rr.sha256,rr.titulo,rr.contiene_valoracion,rr.fuente from propuesta_revisiones rr where rr.propuesta_id=p.id and exists(select 1 from propuesta_operaciones po where po.propuesta_id=p.id and po.revision_id=rr.id and po.tipo='revision' and po.creado_en<=${f.observadoEn}) order by rr.numero desc limit 1) r
      cross join lateral(select id,creado_en from propuesta_operaciones where propuesta_id=p.id and revision_id=r.id and tipo='revision' order by creado_en,id limit 1) o
      left join lateral(select tipo from propuesta_operaciones where propuesta_id=p.id and tipo in ('archivar','reactivar') and creado_en<=${f.observadoEn} order by creado_en desc,id desc limit 1) a on true
      left join propuesta_revision_visibilidad v on v.revision_id=r.id left join propuesta_revision_visibilidad vc on vc.revision_id=p.actual_revision_id
      where ${ambito} and ${visible} and primera.fecha>=${periodo.desdeUtc} and primera.fecha<${periodo.hastaUtcExclusivo} and primera.fecha<=${f.observadoEn} ${archivo} order by p.id limit ${LIMITES.propuestas + 1}`;
    if (filas.length > LIMITES.propuestas) throw new ErrorSeguimiento('La cohorte supera 10000 propuestas. Reduce el rango.', 413);
    if (!filas.length) return [];
    const ids = filas.map(r => r.revision_id), eventos = await c`select id,propuesta_id,revision_id,revision_sha256,numero,antecedente_id,tipo,decision_revocada_id,creado_en from propuesta_eventos where revision_id in ${c(ids)} and creado_en<=${f.observadoEn} order by revision_id,numero`;
    const grupos = new Map<string, Evento[]>();
    for (const e of eventos) { const lista = grupos.get(e.revision_id) ?? []; lista.push({ id: e.id, propuestaId: e.propuesta_id, revisionId: e.revision_id, revisionHash: e.revision_sha256, numero: e.numero, antecedenteId: e.antecedente_id, tipo: e.tipo, decisionRevocadaId: e.decision_revocada_id, motivo: '', referencia: '', autorId: '', autor: '', creadoEn: new Date(e.creado_en).toISOString() }); if (lista.length > LIMITES.eventos) throw new ErrorSeguimiento('El historial supera el límite de eventos.', 413); grupos.set(e.revision_id, lista); }
    return filas.map(r => { const es = grupos.get(r.revision_id) ?? [], ultimo = es.at(-1); if (es.some(e => e.revisionHash !== r.sha256 || e.propuestaId !== r.propuesta_id)) throw new ErrorSeguimiento('Eventos incompatibles con su revisión.', 503); return { propuestaId: r.propuesta_id, revisionId: r.revision_id, revisionHash: r.sha256, numeroRevision: r.numero, titulo: r.titulo, publicadaEn: new Date(r.publicada_en).toISOString(), primeraPublicacionEn: new Date(r.primera_publicacion_en).toISOString(), publicacionOperacionId: r.publicacion_operacion_id, ultimoEventoId: ultimo?.id ?? null, numeroEvento: ultimo?.numero ?? 0, archivoAlCorte: r.archivo_al_corte, estado: derivarEstado(es) }; });
}
export async function bloquearAmbito(c: Conexion, r: MetaRevision) {
    const ids = [...new Set(r.salas.map(s => identificador(s.id)))].sort();
    for (const id of ids) await c`select id from salas where id=${id} for update`;
    const salas = await c`select s.id,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${c(ids)} order by s.id`;
    if (salas.length !== ids.length) throw new ErrorSeguimiento('El ámbito de la revisión cambió.', 409);
    const proyectos = [...new Set(salas.map(s => s.proyecto_id).filter((id): id is string => Boolean(id)))].sort();
    if (r.ambito_fuente.tipo === 'obra' && (salas.some(s => s.proyecto_id !== r.ambito_fuente.id) || !proyectos.includes(r.ambito_fuente.id))) throw new ErrorSeguimiento('Cambió la selección de salas de la obra.', 409);
    for (const id of proyectos) await c`select id from proyectos where id=${id} for update`;
    if (proyectos.length) { const [h] = await c`select exists(select 1 from hitos_proyecto where proyecto_id in ${c(proyectos)} and tipo='cierre') cerrado`; if (h.cerrado) throw new ErrorSeguimiento('La obra está cerrada: el seguimiento es de consulta.', 409); }
}
