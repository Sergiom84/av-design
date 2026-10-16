import { puede } from '../usuarios';
import { identidadActual, autorizar, exigir, type ConexionPropuestas, type IdentidadPropuesta } from './autorizacion';
import { z } from 'zod';
import { ErrorPropuesta, entrada, uuid, identificador, hash, hashBytes, type Ambito, type ModeloPropuesta } from './modelo';
import { frescura } from './fuentes';
export interface CabeceraPropuesta {
    id: string;
    ambito: 'sala' | 'obra';
    sala_id: string | null;
    proyecto_id: string | null;
    version: number;
    actual_revision_id: string;
    contiene_valoracion: boolean;
    archivada_en: Date | null;
}
async function exigirCatalogoValoracion(sql: ConexionPropuestas, u: IdentidadPropuesta, revisionId: string) {
    // El llamador ya exigió compras:ver antes de entrar en esta proyección.
    const [v] = await sql `select exists(select 1 from propuesta_valoraciones v cross join lateral jsonb_array_elements(v.snapshot->'lineas') l where v.revision_id=${revisionId} and l->'origenCoste'->>'tipo'='catalogo') requiere_catalogo`;
    if (v.requiere_catalogo)
        exigir(u, 'catalogo');
}
export const ambitoCabecera = (p: CabeceraPropuesta): Ambito => p.ambito === 'sala' ? { tipo: 'sala', id: p.sala_id! } : { tipo: 'obra', id: p.proyecto_id!, salaIds: [] };
export async function cabecera(sql: ConexionPropuestas, u: IdentidadPropuesta, id: string, editar = false, bloquear = false): Promise<CabeceraPropuesta> {
    identificador(id);
    const filas = bloquear
        ? await sql<CabeceraPropuesta[]> `select id,ambito,sala_id,proyecto_id,version,actual_revision_id,contiene_valoracion,archivada_en from propuestas where id=${id} for update`
        : await sql<CabeceraPropuesta[]> `select id,ambito,sala_id,proyecto_id,version,actual_revision_id,contiene_valoracion,archivada_en from propuestas where id=${id}`;
    const p = filas[0];
    if (!p)
        throw new ErrorPropuesta('Propuesta no encontrada.', 404);
    autorizar(u, ambitoCabecera(p), editar);
    // Guarda antes de consultar cualquier snapshot, incluida una revisión técnica antigua.
    if (p.contiene_valoracion) {
        exigir(u, 'compras', editar ? 'editar' : 'ver');
        await exigirCatalogoValoracion(sql, u, p.actual_revision_id);
    }
    return p;
}
export async function leerRevision(sql: ConexionPropuestas, u: IdentidadPropuesta, p: CabeceraPropuesta, revisionId = p.actual_revision_id): Promise<ModeloPropuesta & {
    pdfId: string;
}> {
    identificador(revisionId);
    const [meta] = await sql `select contiene_valoracion,fuente->>'tipo' as tipo_fuente from propuesta_revisiones where id=${revisionId} and propuesta_id=${p.id}`;
    if (!meta)
        throw new ErrorPropuesta('Revisión no encontrada.', 404);
    if (p.contiene_valoracion || meta.contiene_valoracion)
        exigir(u, 'compras');
    if (meta.tipo_fuente === 'bom')
        exigir(u, 'catalogo');
    if (meta.contiene_valoracion)
        await exigirCatalogoValoracion(sql, u, revisionId);
    const [r] = await sql `select id,numero,titulo,tecnico,fuente,fuente_sha256,tecnico_sha256,sha256,contiene_valoracion,pdf_id,autor_id,autor_nombre,creado_en from propuesta_revisiones where id=${revisionId} and propuesta_id=${p.id}`;
    let valoracion = null;
    if (meta.contiene_valoracion) {
        const [v] = await sql `select snapshot,sha256 from propuesta_valoraciones where revision_id=${revisionId}`;
        if (!v || hash(v.snapshot) !== v.sha256)
            throw new ErrorPropuesta('La valoración conservada no supera la comprobación de integridad.', 503);
        valoracion = v.snapshot;
    }
    const modelo = { id: r.id, numero: r.numero, creadoEn: new Date(r.creado_en).toISOString(), autorId: r.autor_id, autor: r.autor_nombre, tecnico: r.tecnico, fuente: r.fuente, valoracion, fuenteHash: r.fuente_sha256, tecnicoHash: r.tecnico_sha256 };
    if (hash(modelo.fuente) !== modelo.fuenteHash || hash(modelo.tecnico) !== modelo.tecnicoHash || hash({ versionModelo: 1, generador: 'rea06-1', ...modelo }) !== r.sha256)
        throw new ErrorPropuesta('La revisión conservada no supera la comprobación de integridad.', 503);
    return { ...modelo, sha256: r.sha256, pdfId: r.pdf_id };
}
export async function obtenerPropuesta(sql: ConexionPropuestas, usuarioId: string, id: string, revisionId?: string) {
    const u = await identidadActual(sql, usuarioId), p = await cabecera(sql, u, id);
    const revision = await leerRevision(sql, u, p, revisionId);
    return { cabecera: p, revision, frescura: await frescura(sql, u, revision.fuente) };
}
export async function listarPropuestas(sql: ConexionPropuestas, usuarioId: string, ambito: Pick<Ambito, 'tipo' | 'id'>) {
    const u = await identidadActual(sql, usuarioId);
    autorizar(u, ambito as Ambito);
    identificador(ambito.id);
    const monetario = puede(u.permisos, 'compras', 'ver'), catalogo = puede(u.permisos, 'catalogo', 'ver');
    const contexto = ambito.tipo === 'sala' ? sql `p.sala_id=${ambito.id} and p.ambito='sala'` : sql `p.proyecto_id=${ambito.id} and p.ambito='obra'`;
    const filtroCatalogo = monetario && !catalogo ? sql `and not exists(select 1 from propuesta_valoraciones v cross join lateral jsonb_array_elements(v.snapshot->'lineas') l where v.revision_id=r.id and l->'origenCoste'->>'tipo'='catalogo')` : sql ``;
    // Filtrado SQL previo a cargar snapshot o textos del documento.
    return sql `select p.id,p.version,p.archivada_en,r.numero,r.titulo,r.id revision_id,r.creado_en,r.contiene_valoracion from propuestas p join propuesta_revisiones r on r.id=p.actual_revision_id where ${contexto} and (${monetario} or not p.contiene_valoracion) and (${catalogo} or r.fuente->>'tipo'<>'bom') ${filtroCatalogo} order by r.creado_en desc,p.id limit 50`;
}
export async function historialPropuesta(sql: ConexionPropuestas, usuarioId: string, id: string) {
    const u = await identidadActual(sql, usuarioId), p = await cabecera(sql, u, id);
    const monetario = puede(u.permisos, 'compras', 'ver'), catalogo = puede(u.permisos, 'catalogo', 'ver');
    const filtroCatalogo = monetario && !catalogo ? sql `and not exists(select 1 from propuesta_valoraciones v cross join lateral jsonb_array_elements(v.snapshot->'lineas') l where v.revision_id=r.id and l->'origenCoste'->>'tipo'='catalogo')` : sql ``;
    return sql `select id,numero,titulo,sha256,creado_en,autor_nombre,contiene_valoracion,pdf_id from propuesta_revisiones r where propuesta_id=${p.id} and (${monetario} or not contiene_valoracion) and (${catalogo} or fuente->>'tipo'<>'bom') ${filtroCatalogo} order by numero desc limit 50`;
}
export async function descargarPdf(sql: ConexionPropuestas, usuarioId: string, id: string, revisionId: string) {
    const u = await identidadActual(sql, usuarioId), p = await cabecera(sql, u, id);
    const r = await leerRevision(sql, u, p, revisionId);
    const [a] = await sql `select id,nombre,mime,contenido,bytes,paginas,sha256 from propuesta_archivos where id=${r.pdfId} and revision_id=${r.id}`;
    if (!a || a.bytes !== a.contenido.length || hashBytes(a.contenido) !== a.sha256)
        throw new ErrorPropuesta('El PDF conservado no supera la comprobación de integridad.', 503);
    return { nombre: String(a.nombre), mime: 'application/pdf', contenido: a.contenido as Buffer, bytes: Number(a.bytes), sha256: String(a.sha256), revision: r.id };
}
const opcionesSalasSchema = z.object({ q: z.string().trim().max(100).default(''), pagina: z.number().int().min(0).max(100000).default(0), seleccionadas: z.array(uuid).max(20).default([]), revisionIds: z.array(uuid).max(20).default([]) }).strict();
export async function opcionesContexto(sql: ConexionPropuestas, usuarioId: string, tipo: 'sala' | 'obra', id: string, opciones: unknown = {}) {
    const o = entrada(opcionesSalasSchema, opciones), limite = 20;
    const u = await identidadActual(sql, usuarioId);
    identificador(id);
    autorizar(u, { tipo, id } as Ambito);
    let salas;
    if (tipo === 'sala')
        salas = await sql `select id,nombre,codigo from salas where id=${id}`;
    else
        salas = await sql `select s.id,s.nombre,s.codigo from salas s join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${id} and concat_ws(' ',s.nombre,s.codigo) ilike ${`%${o.q.replace(/[\\%_]/g, '\\$&')}%`} order by s.nombre,s.id limit ${limite + 1} offset ${o.pagina * limite}`;
    if (tipo === 'sala' && !salas.length)
        throw new ErrorPropuesta('No hay salas disponibles en este ámbito.', 404);
    const hayMas = salas.length > limite;
    salas = salas.slice(0, limite);
    const seleccionadas = tipo === 'obra' && o.seleccionadas.length ? await sql `select s.id,s.nombre,s.codigo from salas s join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${id} and s.id in ${sql(o.seleccionadas)} order by s.nombre,s.id` : [];
    if (seleccionadas.length !== new Set(o.seleccionadas).size && tipo === 'obra')
        throw new ErrorPropuesta('La selección contiene salas ajenas a la obra.', 409);
    const ids = [...new Set([...salas, ...seleccionadas].map(s => s.id))];
    const revisiones: Array<{ id: string; sala_id: string; numero: number; nombre: string; hash: string; diseno_version: number }> = ids.length ? await sql `select r.id,r.sala_id,r.numero,r.nombre,r.hash,r.diseno_version from salas s cross join lateral(select id,sala_id,numero,nombre,hash,diseno_version from revisiones_diseno where sala_id=s.id order by numero desc limit 50) r where s.id in ${sql(ids)} order by r.sala_id,r.numero desc` : [];
    // Conserva una revisión elegida aunque haya salido de las cincuenta recientes.
    if (o.revisionIds.length && ids.length) {
        const explicitas = await sql<Array<{ id: string; sala_id: string; numero: number; nombre: string; hash: string; diseno_version: number }>> `select id,sala_id,numero,nombre,hash,diseno_version from revisiones_diseno where id in ${sql(o.revisionIds)} and sala_id in ${sql(ids)}`;
        for (const r of explicitas)
            if (!revisiones.some(x => x.id === r.id)) revisiones.push(r);
    }
    const [cierre] = tipo === 'sala' ? await sql `select exists(select 1 from salas s join localizaciones l on l.id=s.localizacion_id join hitos_proyecto h on h.proyecto_id=l.proyecto_id where s.id=${id} and h.tipo='cierre') cerrado` : await sql `select exists(select 1 from hitos_proyecto where proyecto_id=${id} and tipo='cierre') cerrado`;
    return { salas, seleccionadas, pagina: o.pagina, hayMas, revisiones, puedeEditar: !cierre.cerrado && puede(u.permisos, tipo === 'sala' ? 'salas' : 'proyectos', 'editar'), puedeValorar: puede(u.permisos, 'compras', 'editar'), puedeVerValoracion: puede(u.permisos, 'compras', 'ver'), puedeCatalogo: puede(u.permisos, 'catalogo', 'ver'), puedeBom: ['salas', 'proyectos', 'catalogo', 'parametros', 'almacen', 'compras'].every(s => puede(u.permisos, s as keyof typeof u.permisos, 'ver')), identidad: u.id };
}
