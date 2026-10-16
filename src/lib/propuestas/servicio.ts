import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { identidadActual, autorizar, exigir, type ConexionPropuestas, type IdentidadPropuesta } from './autorizacion';
import { ErrorPropuesta, entrada, entradaSchema, baseSchema, previaSchema, hash, hashBytes, canonico, LIMITES, fechaMadrid, type EntradaPropuesta, type BasePropuesta, type Previa, type ModeloPropuesta, type LineaFuente, type FuentePropuesta } from './modelo';
import { mismaIdentidadLinea, mismaSeleccionFuente, prepararRefresco } from './refresco';
import { resolverVariables } from './variables';
import { capturarFuente, resolverAmbito, diffFuentes } from './fuentes';
import { calcularValoracion, precioCatalogo } from './valoracion';
import { leerPlantilla } from './plantillas';
import { cabecera, leerRevision, type CabeceraPropuesta } from './repositorio';
import { renderizarPdf, type PdfPropuesta } from './pdf';
interface OpcionesServicio {
    secreto?: string;
    reloj?: () => Date;
    renderizar?: (m: ModeloPropuesta) => Promise<PdfPropuesta>;
}
interface Preparacion {
    modelo: ModeloPropuesta;
    previa: Previa;
    base: BasePropuesta;
}
export class ServicioPropuestas {
    constructor(public sql: ConexionPropuestas, private opciones: OpcionesServicio = {}) { }
    private ahora() { return (this.opciones.reloj?.() ?? new Date()).toISOString(); }
    private firmar(valor: unknown): string {
        const secreto = this.opciones.secreto ?? process.env.SESION_SECRETO;
        if (!secreto || secreto.length < 24)
            throw new ErrorPropuesta('La publicación necesita un secreto de sesión configurado.', 503);
        return createHmac('sha256', secreto).update(canonico(valor)).digest('hex');
    }
    private verificarPrevia(p: Previa, usuarioId: string, propuestaId: string | null, base: BasePropuesta) {
        const { firma, ...datos } = p;
        const correcta = this.firmar({ usuarioId, propuestaId, base, ...datos });
        if (!timingSafeEqual(Buffer.from(firma), Buffer.from(correcta)))
            throw new ErrorPropuesta('La vista previa no es válida para esta publicación.', 409);
        const edad = new Date(this.ahora()).getTime() - new Date(p.creadaEn).getTime();
        if (edad < 0 || edad > 600000)
            throw new ErrorPropuesta('La vista previa caducó. Revisa de nuevo antes de guardar.', 409);
    }
    private async modelo(c: ConexionPropuestas, u: IdentidadPropuesta, e: EntradaPropuesta, id: string, creadoEn: string, numero: number, p?: CabeceraPropuesta, fuenteCapturada?: FuentePropuesta): Promise<ModeloPropuesta> {
        autorizar(u, e.ambito, true);
        if (e.valoracion !== null || p?.contiene_valoracion)
            exigir(u, 'compras', 'editar');
        const contexto = await resolverAmbito(c, e.ambito);
        if (contexto.cerrado)
            throw new ErrorPropuesta('La obra está cerrada: sus propuestas son de sólo lectura.', 409);
        if (p && (p.ambito !== e.ambito.tipo || (p.sala_id ?? p.proyecto_id) !== e.ambito.id))
            throw new ErrorPropuesta('Una propuesta no cambia de ámbito.', 409);
        let anterior: Awaited<ReturnType<typeof leerRevision>> | undefined;
        if (p) {
            anterior = await leerRevision(c, u, p);
            if (canonico(anterior.fuente.ambito) !== canonico(e.ambito))
                throw new ErrorPropuesta('La selección de salas es inmutable. Crea otra propuesta.', 409);
        }
        if (anterior && !fuenteCapturada && !mismaSeleccionFuente(e.fuente, anterior.fuente))
            throw new ErrorPropuesta('Cambiaste la fuente seleccionada. Compara y decide sus líneas antes de guardar.', 409);
        // El documento propio es durable: editar texto conserva su captura,
        // incluso si el diseño o la BOM actuales ya tienen otras cantidades.
        const fuente = fuenteCapturada ?? anterior?.fuente ?? await capturarFuente(c, u, e, creadoEn);
        let plantillaSnapshot: ModeloPropuesta['tecnico']['plantillaSnapshot'] = null;
        if (e.plantilla && anterior?.tecnico.plantilla && hash(e.plantilla) === hash(anterior.tecnico.plantilla)) {
            plantillaSnapshot = anterior.tecnico.plantillaSnapshot;
        }
        else if (e.plantilla) {
            const plantilla = await leerPlantilla(c, u.id, e.plantilla.id);
            if (!plantilla.activo || plantilla.version !== e.plantilla.version || plantilla.hash !== e.plantilla.hash)
                throw new ErrorPropuesta('La plantilla cambió. Revisa de nuevo su copia.', 409);
            plantillaSnapshot = { nombre: plantilla.nombre, secciones: plantilla.secciones };
        }
        const permitidas = new Set(fuente.lineas.map(l => l.clave));
        if (e.incluidas?.some(k => !permitidas.has(k)))
            throw new ErrorPropuesta('La selección contiene líneas ajenas a su fuente.', 422);
        const lineas: LineaFuente[] = fuente.lineas.filter(l => e.incluidas === null || e.incluidas.includes(l.clave));
        const idsConceptos = new Set<string>();
        for (const l of e.conceptos) {
            if (idsConceptos.has(l.id))
                throw new ErrorPropuesta('Concepto documental repetido.', 422);
            idsConceptos.add(l.id);
            lineas.push({ clave: `manual:${l.id}`, articuloId: null, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, detalles: [], origen: 'concepto documental manual', enlace: '' });
        }
        if (lineas.length > LIMITES.lineas)
            throw new ErrorPropuesta('La propuesta supera dos mil líneas.', 413);
        const variables: Record<string, string | null> = { 'propuesta.titulo': e.titulo, 'proyecto.nombre': e.ambito.tipo === 'obra' ? fuente.nombre : null, 'proyecto.codigo': e.ambito.tipo === 'obra' ? fuente.codigo : null, 'sala.nombre': e.ambito.tipo === 'sala' ? fuente.salas[0].nombre : null, 'sala.codigo': e.ambito.tipo === 'sala' ? fuente.salas[0].codigo : null, 'salas.listado': fuente.salas.map(s => s.nombre).join(', '), 'destinatario.nombre': e.destinatario?.nombre || null, 'revision.fecha': fechaMadrid(creadoEn) };
        const tecnico = { titulo: e.titulo, secciones: e.secciones.map(s => { const r = resolverVariables(s.texto, variables); const titulo = resolverVariables(s.titulo, variables); return { ...s, tituloResuelto: titulo.texto, resuelto: r.texto, ausencias: [...titulo.ausencias, ...r.ausencias] }; }), destinatario: e.destinatario ? { ...e.destinatario, autorId: u.id, fecha: creadoEn, procedencia: 'manual' as const } : null, plantilla: e.plantilla, plantillaSnapshot, lineas, excluidas: fuente.lineas.length - lineas.filter(l => l.origen !== 'concepto documental manual').length, variables };
        let valoracion = null;
        if (e.valoracion !== null) {
            const fuentes = new Map<string, unknown>();
            for (const l of e.valoracion) {
                if (l.origenCoste?.tipo === 'catalogo') {
                    const linea = lineas.find(x => x.clave === l.clave);
                    if (!linea || linea.articuloId !== l.origenCoste.articuloId)
                        throw new ErrorPropuesta('El precio no pertenece al artículo de esta línea.', 422);
                    // La revisión íntegra del servidor acredita un precio ya elegido.
                    // Una edición de texto no consulta ni sustituye su coste por el vigente.
                    const previa = anterior?.valoracion?.lineas.find(x => x.clave === l.clave);
                    const origenAnterior = anterior?.tecnico.lineas.find(x => x.clave === l.clave);
                    if (previa && origenAnterior && mismaIdentidadLinea(origenAnterior, linea) &&
                        canonico(previa.origenCoste) === canonico(l.origenCoste) && previa.coste === l.coste && previa.moneda === l.moneda) {
                        exigir(u, 'catalogo');
                        fuentes.set(l.clave, previa.fuenteCongelada);
                        continue;
                    }
                    const precio = await precioCatalogo(c, u, l.origenCoste.articuloId, creadoEn);
                    if (precio.hash !== l.origenCoste.hash || precio.valor !== l.coste || l.moneda !== precio.moneda)
                        throw new ErrorPropuesta('Cambió el precio previsto seleccionado. Revisa su origen.', 409);
                    fuentes.set(l.clave, precio);
                }
                else if (l.origenCoste)
                    fuentes.set(l.clave, { ...l.origenCoste, autorId: u.id, fecha: creadoEn });
            }
            valoracion = calcularValoracion(lineas, e.valoracion, fuentes);
        }
        const nucleo = { id, numero, creadoEn, autorId: u.id, autor: u.nombre, tecnico, fuente, valoracion, fuenteHash: hash(fuente), tecnicoHash: hash(tecnico) };
        if (Buffer.byteLength(canonico(nucleo)) > LIMITES.snapshot)
            throw new ErrorPropuesta('El snapshot supera cuatro MiB.', 413);
        return { ...nucleo, sha256: hash({ versionModelo: 1, generador: 'rea06-1', ...nucleo }) };
    }
    async preparar(usuarioId: string, datos: unknown, propuestaId: string | null = null, baseDatos: unknown = { version: 0, revisionId: null, hash: null }, fuenteRevisada?: string): Promise<Preparacion> {
        const e = entrada(entradaSchema, datos), base = entrada(baseSchema, baseDatos), id = randomUUID(), creadaEn = this.ahora();
        return this.sql.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPropuestas, u = await identidadActual(c, usuarioId);
            const p = propuestaId ? await cabecera(c, u, propuestaId, true) : undefined;
            this.comprobarBase(p, base);
            const fuente = await this.capturaRevisada(c, u, e, creadaEn, fuenteRevisada);
            const modelo = await this.modelo(c, u, e, id, creadaEn, await this.numeroSiguiente(c, p), p, fuente);
            const datos = { id, creadaEn, hash: hash({ e, modelo }), fuenteHash: modelo.fuenteHash, permisosHash: hash(u.permisos), ...(fuenteRevisada ? { fuenteRevisada } : {}) };
            return { modelo, previa: { ...datos, firma: this.firmar({ usuarioId, propuestaId, base, ...datos }) }, base };
        }) as Promise<Preparacion>;
    }
    private async capturaRevisada(c: ConexionPropuestas, u: IdentidadPropuesta, e: EntradaPropuesta, fecha: string, fuenteRevisada?: string) {
        if (!fuenteRevisada) return undefined;
        const fuente = await capturarFuente(c, u, e, fecha);
        if (hash({ ...fuente, leidaEn: null }) !== fuenteRevisada)
            throw new ErrorPropuesta('Cambió la fuente comparada. Conserva tu edición y vuelve a comparar.', 409);
        return fuente;
    }
    private async numeroSiguiente(c: ConexionPropuestas, p?: CabeceraPropuesta) { if (!p)
        return 1; const [r] = await c `select numero from propuesta_revisiones where id=${p.actual_revision_id}`; return Number(r.numero) + 1; }
    private comprobarBase(p: CabeceraPropuesta | undefined, base: BasePropuesta) {
        if (!p) {
            if (base.version !== 0 || base.revisionId !== null || base.hash !== null)
                throw new ErrorPropuesta('Base de propuesta inválida.', 409);
            return;
        }
        if (p.archivada_en)
            throw new ErrorPropuesta('La propuesta está archivada.', 409);
        if (p.version !== base.version || p.actual_revision_id !== base.revisionId)
            throw new ErrorPropuesta('La propuesta cambió. Conserva tus textos y compara las revisiones.', 409);
    }
    async publicar(usuarioId: string, datos: unknown, previaDatos: unknown, baseDatos: unknown, clavePeticion: string, propuestaId: string | null = null) {
        const e = entrada(entradaSchema, datos), previa = entrada(previaSchema, previaDatos), base = entrada(baseSchema, baseDatos);
        entrada((await import('./modelo')).uuid, clavePeticion);
        const hashPeticion = hash({ e, previa, base, propuestaId });
        const repetida = await this.operacion(this.sql, usuarioId, clavePeticion, hashPeticion);
        if (repetida)
            return repetida;
        this.verificarPrevia(previa, usuarioId, propuestaId, base);
        const antes = await this.sql.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPropuestas, u = await identidadActual(c, usuarioId), p = propuestaId ? await cabecera(c, u, propuestaId, true) : undefined;
            this.comprobarBase(p, base);
            if (p) {
                const r = await leerRevision(c, u, p);
                if (r.sha256 !== base.hash)
                    throw new ErrorPropuesta('La revisión base cambió.', 409);
            }
            const fuente = await this.capturaRevisada(c, u, e, previa.creadaEn, previa.fuenteRevisada);
            const modelo = await this.modelo(c, u, e, previa.id, previa.creadaEn, await this.numeroSiguiente(c, p), p, fuente);
            this.comprobarPrevia(previa, u, e, modelo);
            return modelo;
        }) as ModeloPropuesta;
        const pdf = await (this.opciones.renderizar ?? renderizarPdf)(antes);
        if (!pdf.contenido.length || pdf.contenido.length > LIMITES.pdf || pdf.paginas < 1 || pdf.paginas > LIMITES.paginas || !pdf.contenido.subarray(0, 5).equals(Buffer.from('%PDF-')))
            throw new ErrorPropuesta('El generador no entregó un PDF válido.', 503);
        return this.sql.begin(async (tx) => {
            const c = tx as unknown as ConexionPropuestas;
            await resolverAmbito(c, e.ambito, true);
            // Evita carreras entre idempotencia/cuota y bloquea en orden común.
            await c `select pg_advisory_xact_lock(60606006)`;
            const repetida = await this.operacion(c, usuarioId, clavePeticion, hashPeticion);
            if (repetida)
                return repetida;
            const u = await identidadActual(c, usuarioId), p = propuestaId ? await cabecera(c, u, propuestaId, true, true) : undefined;
            this.comprobarBase(p, base);
            if (p) {
                const r = await leerRevision(c, u, p);
                if (r.sha256 !== base.hash)
                    throw new ErrorPropuesta('La revisión base cambió.', 409);
            }
            const fuente = await this.capturaRevisada(c, u, e, previa.creadaEn, previa.fuenteRevisada);
            const modelo = await this.modelo(c, u, e, previa.id, previa.creadaEn, await this.numeroSiguiente(c, p), p, fuente);
            this.comprobarPrevia(previa, u, e, modelo);
            if (modelo.sha256 !== antes.sha256)
                throw new ErrorPropuesta('La propuesta cambió durante el render. Revisa de nuevo.', 409);
            const id = p?.id ?? randomUUID();
            if (p) {
                // La fecha/autor de destinatario no convierten por sí solos un no-op en revisión.
                const actual = await leerRevision(c, u, p);
                const tecnicoSinFecha = (t: typeof modelo.tecnico) => ({ ...t, variables: { ...t.variables, 'revision.fecha': null }, secciones: t.secciones.map(s => ({ id: s.id, titulo: s.titulo, texto: s.texto })), destinatario: t.destinatario ? { entidad: t.destinatario.entidad, nombre: t.destinatario.nombre, contacto: t.destinatario.contacto, grupo: t.destinatario.grupo } : null });
                const valorSinFecha = (v: typeof modelo.valoracion) => v ? { ...v, lineas: v.lineas.map(l => ({ ...l, fuenteCongelada: l.fuenteCongelada ? { ...(l.fuenteCongelada as object), fecha: null, consultadoEn: null } : null })) } : null;
                if (hash({ ...actual.fuente, leidaEn: null }) === hash({ ...modelo.fuente, leidaEn: null }) && hash(tecnicoSinFecha(actual.tecnico)) === hash(tecnicoSinFecha(modelo.tecnico)) && hash(valorSinFecha(actual.valoracion)) === hash(valorSinFecha(modelo.valoracion))) {
                    await c `insert into propuesta_operaciones(autor_id,clave_peticion,hash_peticion,propuesta_id,revision_id,tipo) values(${u.id},${clavePeticion},${hashPeticion},${id},${actual.id},'revision')`;
                    return { id, revisionId: actual.id, version: p.version, sha256: actual.sha256, sinCambio: true };
                }
            }
            if (modelo.numero > LIMITES.revisiones)
                throw new ErrorPropuesta('Máximo cien revisiones por propuesta.', 413);
            const [cuota] = await c `select coalesce(sum(bytes),0)::text global,coalesce(sum(bytes) filter(where revision_id in(select id from propuesta_revisiones where propuesta_id=${id})),0)::text propia from propuesta_archivos`;
            if (BigInt(cuota.global) + BigInt(pdf.contenido.length) > BigInt(LIMITES.cuotaGlobal) || BigInt(cuota.propia) + BigInt(pdf.contenido.length) > BigInt(LIMITES.cuotaPropuesta))
                throw new ErrorPropuesta('No hay cuota documental disponible. Se conserva la última revisión.', 413);
            if (!p)
                await c `insert into propuestas(id,ambito,sala_id,proyecto_id,creado_por) values(${id},${e.ambito.tipo},${e.ambito.tipo === 'sala' ? e.ambito.id : null},${e.ambito.tipo === 'obra' ? e.ambito.id : null},${u.id})`;
            const pdfId = randomUUID();
            await c `insert into propuesta_revisiones(id,propuesta_id,numero,antecedente_id,titulo,tecnico,fuente,fuente_sha256,tecnico_sha256,sha256,contiene_valoracion,pdf_id,autor_id,autor_nombre,creado_en) values(${modelo.id},${id},${modelo.numero},${p?.actual_revision_id ?? null},${e.titulo},${c.json(modelo.tecnico as never)},${c.json(modelo.fuente as never)},${modelo.fuenteHash},${modelo.tecnicoHash},${modelo.sha256},${modelo.valoracion !== null},${pdfId},${u.id},${u.nombre},${modelo.creadoEn})`;
            if (modelo.valoracion)
                await c `insert into propuesta_valoraciones(revision_id,snapshot,estado,totales,sha256) values(${modelo.id},${c.json(modelo.valoracion as never)},${modelo.valoracion.estado},${c.json(modelo.valoracion.totales as never)},${hash(modelo.valoracion)})`;
            await c `insert into propuesta_archivos(id,revision_id,nombre,contenido,paginas,sha256) values(${pdfId},${modelo.id},${`propuesta-${pdfId}.pdf`},${pdf.contenido},${pdf.paginas},${hashBytes(pdf.contenido)})`;
            await c `update propuestas set version=${(p?.version ?? 0) + 1},actual_revision_id=${modelo.id},contiene_valoracion=${modelo.valoracion !== null} where id=${id}`;
            await c `insert into propuesta_operaciones(autor_id,clave_peticion,hash_peticion,propuesta_id,revision_id,tipo) values(${u.id},${clavePeticion},${hashPeticion},${id},${modelo.id},'revision')`;
            return { id, revisionId: modelo.id, version: (p?.version ?? 0) + 1, sha256: modelo.sha256, sinCambio: false };
        });
    }
    private comprobarPrevia(p: Previa, u: IdentidadPropuesta, e: EntradaPropuesta, m: ModeloPropuesta) {
        if (p.permisosHash !== hash(u.permisos) || p.hash !== hash({ e, modelo: m }) || p.fuenteHash !== m.fuenteHash)
            throw new ErrorPropuesta('Cambió la fuente, los permisos o el documento desde la vista previa. Conserva la edición y compara.', 409);
    }
    private async operacion(c: ConexionPropuestas, usuarioId: string, clave: string, hashPeticion: string) {
        const u = await identidadActual(c, usuarioId);
        const [o] = await c `select hash_peticion,propuesta_id,revision_id from propuesta_operaciones where autor_id=${usuarioId} and clave_peticion=${clave}`;
        if (!o)
            return null;
        const p = await cabecera(c, u, o.propuesta_id, true);
        const r = await leerRevision(c, u, p, o.revision_id);
        if (o.hash_peticion !== hashPeticion)
            throw new ErrorPropuesta('Esta clave de petición ya se utilizó para otro contenido.', 409);
        if (r.valoracion)
            exigir(u, 'compras', 'editar');
        return { id: p.id, revisionId: r.id, version: r.numero, sha256: r.sha256, sinCambio: true };
    }
    async actualizarFuente(usuarioId: string, id: string, datos: unknown, base: unknown) {
        const e = entrada(entradaSchema, datos), baseValidada = entrada(baseSchema, base), revisionId = randomUUID(), creadaEn = this.ahora();
        return this.sql.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPropuestas, u = await identidadActual(c, usuarioId), p = await cabecera(c, u, id, true), anterior = await leerRevision(c, u, p);
            this.comprobarBase(p, baseValidada);
            if (anterior.sha256 !== baseValidada.hash)
                throw new ErrorPropuesta('La revisión base cambió.', 409);
            const fuente = await capturarFuente(c, u, e, creadaEn);
            const diff = diffFuentes(anterior.fuente, fuente);
            const { entradaPreparada, elegibles } = prepararRefresco(e, anterior.tecnico.lineas, fuente.lineas);
            const modelo = await this.modelo(c, u, entradaPreparada, revisionId, creadaEn, await this.numeroSiguiente(c, p), p, fuente);
            // El formulario todavía no adopta este candidato. Primero revisa cada
            // decisión monetaria; el hash evita aplicar el diff a otra captura.
            return { diff, entradaPreparada, elegibles, modelo, fuenteRevisada: hash({ ...fuente, leidaEn: null }) };
        });
    }
    async archivar(usuarioId: string, id: string, version: number, archivada: boolean, motivo: string, clave: string) {
        if (!motivo.trim() || motivo.length > 500)
            throw new ErrorPropuesta('Indica el motivo del archivo o reactivación.', 400);
        entrada((await import('./modelo')).uuid, clave);
        const hashPeticion = hash({ id, version, archivada, motivo });
        const u = await identidadActual(this.sql, usuarioId), p = await cabecera(this.sql, u, id, true), r = await leerRevision(this.sql, u, p);
        return this.sql.begin(async (tx) => {
            const c = tx as unknown as ConexionPropuestas;
            const contexto = await resolverAmbito(c, r.fuente.ambito, true);
            if (contexto.cerrado)
                throw new ErrorPropuesta('La obra cerrada es de sólo lectura.', 409);
            await c `select pg_advisory_xact_lock(60606006)`;
            const rep = await this.operacion(c, usuarioId, clave, hashPeticion);
            if (rep)
                return rep;
            const actual = await cabecera(c, await identidadActual(c, usuarioId), id, true, true);
            if (actual.version !== version)
                throw new ErrorPropuesta('La propuesta cambió.', 409);
            await c `update propuestas set archivada_en=${archivada ? this.ahora() : null},version=version+1 where id=${id}`;
            await c `insert into propuesta_operaciones(autor_id,clave_peticion,hash_peticion,propuesta_id,revision_id,tipo) values(${usuarioId},${clave},${hashPeticion},${id},${actual.actual_revision_id},${archivada ? 'archivar' : 'reactivar'})`;
            return { id, archivada, version: version + 1 };
        });
    }
}
