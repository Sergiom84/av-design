import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { hashConsulta, proyectarSala, proyectarCatalogo, type ProyeccionConsulta } from './lectores';
import { exigirConsulta, resolverAmbito, type IdentidadConsulta, type SqlConsulta } from './autorizacion';
import { ErrorConsulta, canonico, uuidConsulta, type AmbitoConsulta, type FuenteConsulta, type EntradaPregunta, type ClasificacionConsulta } from './modelo';
import type { Seccion } from '../usuarios';
import { ErrorInforme } from '../informes/modelo';
import { listarFuentesConsultaInforme, leerFuenteConsultaInforme } from '../informes/consultas-tecnicas';
import { autorizarRequisitoConsulta, listarRequisitosConsulta, proyectarRequisitoConsulta } from './requisitos';
const E1 = join(tmpdir(), 'av-design-documentos-e1');
const completas = (a: AmbitoConsulta): Seccion[] => ['salas', 'catalogo', 'parametros', 'almacen', 'compras', ...(a.tipo === 'obra' ? ['proyectos' as const] : [])];
function coincide(a: AmbitoConsulta, b: AmbitoConsulta): boolean { return canonico(a) === canonico(b); }
const propietarioE1 = z.object({ usuarioId: uuidConsulta, esObra: z.boolean(), caducaEn: z.iso.datetime() });
/** Autoriza el propietario y el ámbito sin consultar binarios ni borrar el paquete original. */
async function e1(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string): Promise<ProyeccionConsulta> {
    exigirConsulta(u, completas(a));
    const p = propietarioE1.parse(JSON.parse(await readFile(join(E1, id, 'propietario.json'), 'utf8').catch(() => { throw new ErrorConsulta('FUENTE', 'La fuente ya no está disponible.', 409); })));
    if (p.usuarioId !== u.id || Date.parse(p.caducaEn) <= Date.now())
        throw new ErrorConsulta('FUENTE', 'La fuente ya no está disponible.', 409);
    const m = JSON.parse(await readFile(join(E1, id, 'manifiesto.json'), 'utf8'));
    if (m.id !== id || m.caducaEn !== p.caducaEn || !Array.isArray(m.salas) || !Array.isArray(m.archivos))
        throw new ErrorConsulta('INTEGRIDAD', 'La fuente no está disponible.', 503);
    const ids = m.salas.map((s: {
        id: string;
    }) => uuidConsulta.parse(s.id)).sort();
    if (a.tipo === 'catalogo' || (a.tipo === 'sala' ? (ids.length !== 1 || ids[0] !== a.id || p.esObra) : (m.proyecto?.id !== a.id || canonico(ids) !== canonico([...a.salaIds].sort()))))
        throw new ErrorConsulta('FUENTE', 'La fuente pertenece a otra selección.', 409);
    await resolverAmbito(sql, u, a);
    const datos = { id, caducaEn: m.caducaEn, revision: m.revision, archivos: m.archivos.map((f: {
            nombre: string;
            documento: string;
            salaId: string | null;
            sha256?: string;
            estado: string;
        }) => ({ nombre: f.nombre, documento: f.documento, salaId: f.salaId, sha256: f.sha256 ?? null, estado: f.estado })) };
    return { fuente: { tipo: 'documento_e1', id, ambito: a, hash: hashConsulta(datos), secciones: completas(a) }, datos, hechos: [{ etiqueta: 'Paquete técnico E1 · sin texto consultable', valor: 'Puedes abrir el original autorizado mientras conserve su vigencia de 30 minutos.', fuenteId: id, campo: 'manifiesto' }], avisos: [], href: `/api/documentos/${id}`, etiqueta: 'Paquete técnico E1', observadoEn: m.creadoEn };
}
async function propuesta(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string, texto: boolean): Promise<ProyeccionConsulta> {
    exigirConsulta(u, a.tipo === 'obra' ? ['salas', 'proyectos'] : ['salas']);
    if (a.tipo === 'catalogo')
        throw new ErrorConsulta('FUENTE', 'La fuente no corresponde al ámbito.', 409);
    const [p] = await sql `select id,ambito,sala_id,proyecto_id,version,actual_revision_id,contiene_valoracion,archivada_en from propuestas where id=${id}`;
    if (!p || p.archivada_en || p.contiene_valoracion || p.ambito !== a.tipo || (a.tipo === 'sala' ? p.sala_id !== a.id : p.proyecto_id !== a.id))
        throw new ErrorConsulta('FUENTE', 'La fuente técnica ya no está disponible.', 409);
    const [r] = await sql `select id,numero,sha256,contiene_valoracion,fuente->>'tipo' as tipo_fuente,fuente->'ambito' as ambito_fuente,creado_en from propuesta_revisiones where id=${p.actual_revision_id} and propuesta_id=${id}`;
    if (!r || r.contiene_valoracion || !coincide(a, r.ambito_fuente))
        throw new ErrorConsulta('FUENTE', 'La fuente técnica ya no está disponible.', 409);
    const requisitos = r.tipo_fuente === 'bom' ? completas(a) : (a.tipo === 'obra' ? ['salas', 'proyectos'] as Seccion[] : ['salas'] as Seccion[]);
    exigirConsulta(u, requisitos);
    await resolverAmbito(sql, u, a);
    // Proyección técnica por claves. Nunca se lee valoración, PDF, destinatarios o variables globales.
    const [t] = await sql `select titulo,tecnico->'secciones' as secciones from propuesta_revisiones where id=${r.id} and propuesta_id=${id} and not contiene_valoracion`;
    const partes = z.array(z.object({ id: uuidConsulta, titulo: z.string(), texto: z.string(), resuelto: z.string(), ausencias: z.array(z.string()), tituloResuelto: z.string().optional() }).strict()).max(30).parse(t?.secciones);
    const datos = { version: Number(p.version), revisionId: r.id, revisionNumero: Number(r.numero), revisionHash: r.sha256, titulo: t.titulo, secciones: partes };
    return { fuente: { tipo: 'propuesta_06', id, hash: hashConsulta(datos), secciones: requisitos, ambito: a, version: Number(p.version), revisionId: r.id, revisionNumero: Number(r.numero), revisionHash: r.sha256 }, datos, hechos: texto ? partes.map(s => ({ etiqueta: s.tituloResuelto ?? s.titulo, valor: s.resuelto, fuenteId: id, campo: `propuesta_revisiones:${r.id}.secciones:${s.id}` })) : [{ etiqueta: 'Documento técnico REA06', valor: t.titulo, fuenteId: id, campo: `propuesta_revisiones:${r.id}.titulo` }], avisos: [], href: `/api/propuestas/${id}/revisiones/${r.id}/pdf`, etiqueta: t.titulo, observadoEn: new Date(r.creado_en).toISOString() };
}
async function informe(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string, texto: boolean): Promise<ProyeccionConsulta> {
    let r;
    try {
        r = await leerFuenteConsultaInforme(sql, u.id, id, a, { texto });
    }
    catch (e) {
        if (e instanceof ErrorInforme)
            throw new ErrorConsulta(e.codigo, 'La fuente ya no está disponible para esta consulta.', e.status === 404 ? 409 : e.status);
        throw e;
    }
    return { fuente: { tipo: 'informe_03', id: r.id, hash: r.hash, secciones: r.requiere, ambito: a }, datos: r, hechos: r.hechos.map(h => ({ ...h, fuenteId: r.id })), avisos: r.avisos, href: r.href, etiqueta: r.etiqueta, observadoEn: r.observadoEn };
}
/** Registro cerrado; una futura fuente requiere su propio adaptador y ACL antes de contenido. */
export const RegistroFuentesConsulta = Object.freeze({ documento_e1: e1, informe_03: informe, propuesta_06: propuesta, documento_requisitos: proyectarRequisitoConsulta });
export async function leerDocumentoSeleccionado(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, f: NonNullable<EntradaPregunta['fuente']>, texto: boolean) {
    if (f.tipo === 'catalogo')
        throw new ErrorConsulta('ENTRADA_INVALIDA', 'Elige una fuente documental.', 400);
    return RegistroFuentesConsulta[f.tipo](sql, u, a, f.id, texto, f.tipo === 'documento_requisitos' ? f : undefined);
}
export async function listarDocumentosConsulta(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta): Promise<ProyeccionConsulta[]> {
    if (a.tipo === 'catalogo')
        return [];
    const resultado: ProyeccionConsulta[] = [];
    const candidatos = await sql `select p.id from propuestas p join propuesta_revisiones r on r.id=p.actual_revision_id where not p.contiene_valoracion and not r.contiene_valoracion and p.archivada_en is null and p.ambito=${a.tipo} and (${a.tipo === 'sala'} and p.sala_id=${a.id} or ${a.tipo === 'obra'} and p.proyecto_id=${a.id}) order by p.id limit 20`;
    for (const c of candidatos)
        try {
            resultado.push(await propuesta(sql, u, a, c.id, false));
        }
        catch (e) {
            if (!(e instanceof ErrorConsulta) || e.status === 503)
                throw e;
        }
    const entradas = await readdir(E1, { withFileTypes: true }).catch(() => []);
    for (const d of entradas.filter(e => e.isDirectory() && uuidConsulta.safeParse(e.name).success).slice(0, 200)) {
        try {
            const p = propietarioE1.parse(JSON.parse(await readFile(join(E1, d.name, 'propietario.json'), 'utf8')));
            if (p.usuarioId === u.id && Date.parse(p.caducaEn) > Date.now())
                resultado.push(await e1(sql, u, a, d.name));
        }
        catch (e) {
            if (e instanceof ErrorConsulta && e.status === 503)
                throw e;
        }
    }
    const metas = await listarFuentesConsultaInforme(sql, u.id, a);
    for (const m of metas)
        resultado.push(await informe(sql, u, a, m.id, false));
    resultado.push(...await listarRequisitosConsulta(sql, u, a));
    if (resultado.length > 100)
        throw new ErrorConsulta('LIMITE', 'Reduce la selección de documentos.', 413);
    return resultado;
}
/** Autorización de TODAS las fuentes antes de leer preguntas o respuestas conservadas. */
export async function comprobarFuente(sql: SqlConsulta, u: IdentidadConsulta, f: FuenteConsulta): Promise<boolean> {
    exigirConsulta(u, f.secciones);
    await resolverAmbito(sql, u, f.ambito);
    let actual: FuenteConsulta;
    if (f.tipo === 'preferencias') {
        const p = await proyectarCatalogo(sql, u, f.ambito);
        actual = p[0].fuente;
    }
    else if (f.tipo === 'catalogo') {
        const p = await proyectarCatalogo(sql, u, f.ambito, f.seleccionId);
        actual = p[1].fuente;
    }
    else if (f.tipo in RegistroFuentesConsulta) {
        const t = f.tipo as keyof typeof RegistroFuentesConsulta;
        actual = (await RegistroFuentesConsulta[t](sql, u, f.ambito, f.id, false, t === 'documento_requisitos' ? f : undefined)).fuente;
    }
    else {
        const intent = f.tipo === 'sala' ? 'medidas' : f.tipo;
        actual = (await proyectarSala(sql, u, f.ambito, f.id, { motor: 'local-1', intent: intent as ClasificacionConsulta['intent'], ...(f.cableId ? { cableId: f.cableId } : {}) })).fuente;
    }
    return actual.hash === f.hash && actual.version === f.version && actual.disenoVersion === f.disenoVersion && actual.revisionId === f.revisionId;
}
/** Primera fase: metadatos y requisitos de TODO el turno, sin contenidos. */
export async function autorizarMetadatosConsulta(sql: SqlConsulta, u: IdentidadConsulta, f: FuenteConsulta): Promise<void> {
    exigirConsulta(u, f.secciones);
    await resolverAmbito(sql, u, f.ambito);
    if (f.tipo === 'preferencias' && f.id !== u.id || f.tipo === 'catalogo' && !f.seleccionId && f.id !== u.id)
        throw new ErrorConsulta('INTEGRIDAD', 'Fuente no disponible.', 503);
    if (f.tipo === 'informe_03') {
        await informe(sql, u, f.ambito, f.id, false);
        return;
    }
    if (f.tipo === 'documento_requisitos') {
        if (Boolean(f.extraccionId) !== Boolean(f.candidatoIds) || Boolean(f.candidatoIds) !== Boolean(f.anclasDocumento))
            throw new ErrorConsulta('INTEGRIDAD', 'La selección de fragmentos no está disponible.', 503);
        await autorizarRequisitoConsulta(sql, u, f.ambito, f.id);
        return;
    }
    if (f.tipo === 'documento_e1') {
        await e1(sql, u, f.ambito, f.id);
        return;
    }
    if (f.tipo === 'propuesta_06') {
        const [p] = await sql `select id,ambito,sala_id,proyecto_id,contiene_valoracion,actual_revision_id,archivada_en from propuestas where id=${f.id}`;
        if (!p || p.contiene_valoracion || p.archivada_en || p.ambito !== f.ambito.tipo || f.ambito.tipo === 'sala' && p.sala_id !== f.ambito.id || f.ambito.tipo === 'obra' && p.proyecto_id !== f.ambito.id)
            throw new ErrorConsulta('FUENTE', 'Fuente no disponible.', 409);
        const [r] = await sql `select contiene_valoracion,fuente->>'tipo' as tipo_fuente,fuente->'ambito' as ambito_fuente from propuesta_revisiones where id=${p.actual_revision_id} and propuesta_id=${p.id}`;
        if (!r || r.contiene_valoracion || !coincide(f.ambito, r.ambito_fuente))
            throw new ErrorConsulta('FUENTE', 'Fuente no disponible.', 409);
        if (r.tipo_fuente === 'bom')
            exigirConsulta(u, completas(f.ambito));
        return;
    }
    // Un turno antiguo sin anclas completas no acredita qué filas autorizaban su texto.
    if (f.tipo !== 'sala' && (f.versionAnclas !== 1 || !f.filas))
        throw new ErrorConsulta('FUENTE', 'Los metadatos de esta fuente requieren una consulta nueva.', 409);
    if (f.revisionId && !(await sql`select id from revisiones_diseno where id=${f.revisionId} and sala_id=${f.id}`).length)
        throw new ErrorConsulta('FUENTE', 'La revisión de origen ya no está disponible.', 409);
    for (const tabla of ['sala_equipos', 'conexiones', 'puertos', 'sala_material_bom', 'articulos', 'tomas_red'] as const) {
        const ids = f.filas?.flatMap(r => r.tabla === tabla && 'id' in r ? [r.id] : []) ?? [];
        if (!ids.length) continue;
        // Tabla cerrada, identificadores parametrizados, ámbito y vigencia antes del contenido.
        const filtro = tabla === 'articulos' ? sql`activo` : ['sala_equipos', 'conexiones', 'sala_material_bom', 'tomas_red'].includes(tabla) ? sql`sala_id=${f.id}` : sql`true`;
        const filas = await sql`select id from ${sql(tabla)} where id in ${sql(ids)} and ${filtro}`;
        if (filas.length !== new Set(ids).size)
            throw new ErrorConsulta('FUENTE', 'Una fila de origen ya no está disponible.', 409);
    }
    const puntos = f.filas?.flatMap(r => r.tabla === 'conexion_puntos_paso' ? [r.id] : []) ?? [];
    if (puntos.length && (await sql`select p.id from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id where p.id in ${sql(puntos)} and c.sala_id=${f.id}`).length !== new Set(puntos).size)
        throw new ErrorConsulta('FUENTE', 'Un punto de origen ya no está disponible.', 409);
    for (const boca of f.filas?.filter(r => r.tabla === 'conexion_bocas') ?? []) {
        if (!(await sql`select b.conexion_id from conexion_bocas b join conexiones c on c.id=b.conexion_id where b.conexion_id=${boca.id} and b.lado=${boca.lado} and c.sala_id=${f.id}`).length)
            throw new ErrorConsulta('FUENTE', 'Una boca de origen ya no está disponible.', 409);
    }
    const parametros = f.filas?.flatMap(r => r.tabla === 'parametros' ? [r.clave] : []) ?? [];
    if (parametros.length && (await sql`select clave from parametros where clave in ${sql(parametros)}`).length !== new Set(parametros).size)
        throw new ErrorConsulta('FUENTE', 'Un parámetro de origen ya no está disponible.', 409);
    const fichas = f.filas?.flatMap(r => r.tabla === 'articulos_tecnicos' ? [r.id] : []) ?? [];
    if (fichas.length && (await sql`select articulo_id from articulos_tecnicos where articulo_id in ${sql(fichas)}`).length !== new Set(fichas).size)
        throw new ErrorConsulta('FUENTE', 'La ficha técnica de origen ya no está disponible.', 409);
    const preferencias = f.filas?.flatMap(r => r.tabla === 'preferencias_usuario' ? [r.id] : []) ?? [];
    if (preferencias.some(id => id !== u.id) || preferencias.length && !(await sql`select usuario_id from preferencias_usuario where usuario_id=${u.id}`).length)
        throw new ErrorConsulta('FUENTE', 'La preferencia de origen ya no está disponible.', 409);
}
