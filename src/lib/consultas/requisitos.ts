import { autorizarMetadatosRequisito, leerFuenteRequisito, listarFuentesRequisito } from '../requisitos/consulta';
import { ErrorRequisito } from '../requisitos/modelo';
import { exigirConsulta, type IdentidadConsulta, type SqlConsulta } from './autorizacion';
import { ErrorConsulta, type AmbitoConsulta, type FuenteConsulta } from './modelo';
import type { ProyeccionConsulta } from './lectores';

type Seleccion = Pick<FuenteConsulta, 'extraccionId' | 'candidatoIds'>;
async function proyectoFuente(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta): Promise<string> {
    exigirConsulta(u, ['proyectos', 'salas']);
    if (a.tipo === 'catalogo') throw new ErrorConsulta('AMBITO', 'Elige una sala o selección de salas de la obra.', 400);
    if (a.tipo === 'obra') return a.id;
    const [s] = await sql`select l.proyecto_id from salas s join localizaciones l on l.id=s.localizacion_id where s.id=${a.id}`;
    if (!s?.proyecto_id) throw new ErrorConsulta('FUENTE', 'La sala no pertenece a una obra con esta fuente.', 409);
    return s.proyecto_id;
}
function traducir(e: unknown): never {
    if (e instanceof ErrorRequisito) throw new ErrorConsulta(e.codigo, 'La fuente ya no está disponible para esta consulta.', e.status);
    throw e;
}
export async function autorizarRequisitoConsulta(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string) {
    const proyectoId = await proyectoFuente(sql, u, a);
    try { return await autorizarMetadatosRequisito(sql, u.id, id, { proyectoId }); } catch (e) { traducir(e); }
}
/** La cabecera se autoriza antes de proyectar los fragmentos revisados elegidos. */
export async function proyectarRequisitoConsulta(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string, texto: boolean, seleccion?: Seleccion): Promise<ProyeccionConsulta> {
    const proyectoId = await proyectoFuente(sql, u, a);
    try {
        const elegida = seleccion?.extraccionId && seleccion.candidatoIds;
        const r = await leerFuenteRequisito(sql, u.id, id, { proyectoId, texto: Boolean(texto || elegida), ...(elegida ? { extraccionId: seleccion.extraccionId, candidatoIds: seleccion.candidatoIds } : {}) });
        const anclas = r.hechos.map(h => h.ancla);
        return { fuente: { tipo: 'documento_requisitos', id, ambito: a, hash: r.hash, secciones: r.requiere, version: r.version,
            ...(elegida ? { extraccionId: seleccion.extraccionId, candidatoIds: seleccion.candidatoIds, anclasDocumento: anclas } : {}) },
            datos: r, hechos: r.hechos.map(({ ancla, ...h }) => ({ ...h, fuenteId: id, anclaDocumento: ancla })), avisos: r.avisos,
            href: r.href, etiqueta: r.etiqueta, observadoEn: r.observadoEn };
    } catch (e) { traducir(e); }
}
export async function listarRequisitosConsulta(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta): Promise<ProyeccionConsulta[]> {
    // La integración puede convivir con una base local previa a la migración10.
    // Sólo el listado omite una capacidad sin instalar; una selección explícita falla.
    if (a.tipo === 'catalogo' || !(await sql`select to_regclass('public.requisitos_documentos') as tabla`)[0]?.tabla) return [];
    let metas;
    try { metas = await listarFuentesRequisito(sql, u.id, await proyectoFuente(sql, u, a)); } catch (e) {
        if (e instanceof ErrorConsulta && e.status === 403 || e instanceof ErrorRequisito && e.status === 403) return [];
        traducir(e);
    }
    const fuentes: ProyeccionConsulta[] = [];
    for (const m of metas) fuentes.push(await proyectarRequisitoConsulta(sql, u, a, m.id, false));
    return fuentes;
}
