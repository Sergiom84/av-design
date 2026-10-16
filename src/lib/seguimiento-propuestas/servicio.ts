import { randomUUID } from 'node:crypto';
import { puede } from '../usuarios';
import { identidadActual, autorizarFiltros, autorizarAmbito, exigir, exigirFinanzas, type Conexion, type Identidad } from './autorizacion';
import { ErrorSeguimiento, LIMITES, validar, comandoSchema, identificador, hash, estados, type Estado } from './modelo';
import { derivarEstado, transicion } from './estados';
import { resolverFiltros, crearToken, verificarToken, manifiesto, ratio, compararRatios, rango, huellaConjunto } from './cohorte';
import { cabecera, metaRevision, publicacion, eventosRevision, bloquearAmbito, leerCohorte, filtroVisibilidad } from './repositorio';
import { enlaceResultados } from './enlaces-resultados';
interface Opciones { secreto?: string; reloj?: () => Date; antesDeGuardar?: () => Promise<void>; }
export class ServicioSeguimiento {
    constructor(public sql: Conexion, private opciones: Opciones = {}) {}
    private ahora() { return +(this.opciones.reloj?.() ?? new Date()); }
    private secreto() { const s = this.opciones.secreto ?? process.env.SESION_SECRETO ?? ''; if (s.length < 24) throw new ErrorSeguimiento('Falta configuración segura del seguimiento.', 503); return s; }
    private async lectura<T>(leer: (c: Conexion, u: Identidad) => Promise<T>, usuarioId: string): Promise<T> { return this.sql.begin('isolation level repeatable read read only', async tx => { const c = tx as unknown as Conexion; return leer(c, await identidadActual(c, usuarioId)); }) as Promise<T>; }
    async detalle(usuarioId: string, propuestaId: string, revisionId?: string) {
        return this.lectura(async (c, u) => {
            const p = await cabecera(c, u, propuestaId), r = await metaRevision(c, u, p, revisionId), publicada = await publicacion(c, p.id, r.id), eventos = await eventosRevision(c, p.id, r.id), estado = derivarEstado(eventos);
            const [flujo] = await c`select version,ultimo_evento_id from propuesta_seguimientos where revision_id=${r.id}`;
            const ultimo = eventos.at(-1);
            if ((flujo?.version ?? 0) !== eventos.length || (flujo?.ultimo_evento_id ?? null) !== (ultimo?.id ?? null) || eventos.some(e => e.revisionHash !== r.sha256)) throw new ErrorSeguimiento('El flujo conservado es inconsistente.', 503);
            const salas = await c`select s.id,s.diseno_version,exists(select 1 from hitos_proyecto h join localizaciones l on l.proyecto_id=h.proyecto_id where l.id=s.localizacion_id and h.tipo='cierre') cerrado from salas s where s.id in ${c(r.salas.map(s => s.id))}`;
            const cerrado = salas.some(s => s.cerrado), frescura = salas.length !== r.salas.length ? 'no_comprobable' : salas.some(s => Number(s.diseno_version) !== r.salas.find(x => x.id === s.id)?.disenoVersion) ? 'desactualizada' : r.tipo_fuente === 'diseno' ? 'actual' : 'no_comprobable';
            const visible = filtroVisibilidad(c, u);
            const revisiones = await c`select r.id,r.numero,r.sha256,r.titulo from propuestas p join propuesta_revisiones r on r.propuesta_id=p.id left join propuesta_revision_visibilidad v on v.revision_id=r.id left join propuesta_revision_visibilidad vc on vc.revision_id=p.actual_revision_id where p.id=${p.id} and ${visible} order by r.numero desc`;
            const puedeEditar = !cerrado && !p.archivada_en && r.id === p.actual_revision_id && puede(u.permisos, p.ambito === 'sala' ? 'salas' : 'proyectos', 'editar') && (!(p.contiene_valoracion || r.contiene_valoracion) || puede(u.permisos, 'compras', 'editar'));
            return { propuestaId: p.id, ambito: p.ambito, versionPropuesta: p.version, actualRevisionId: p.actual_revision_id, revision: { id: r.id, numero: r.numero, hash: r.sha256, titulo: r.titulo, autor: r.autor_nombre, publicadaEn: publicada.fecha, publicacionOperacionId: publicada.id }, estado, versionSeguimiento: eventos.length, ultimoEventoId: ultimo?.id ?? null, eventos, revisiones, archivada: Boolean(p.archivada_en), cerrado, frescura, avisos: r.contiene_valoracion ? ['La decisión interna conserva la valoración exacta y sus ausencias; no acredita firma ni cobro.'] : ['Documento técnico sin valoración; la aceptación no genera importe aprobado conocido.'], puedeEditar, capacidadResultados: await enlaceResultados(c, u, p, r) };
        }, usuarioId);
    }
    async autorizarRegistro(usuarioId: string, propuestaId: unknown) {
        return this.lectura(async (c, u) => {
            exigir(u, 'salas');
            if (!puede(u.permisos, 'salas', 'editar') && !puede(u.permisos, 'proyectos', 'editar')) throw new ErrorSeguimiento('No tienes permiso para modificar el seguimiento.', 403);
            if (typeof propuestaId !== 'string') throw new ErrorSeguimiento('Selecciona la propuesta.', 400);
            const p = await cabecera(c, u, propuestaId, true);
            await metaRevision(c, u, p, undefined, true);
        }, usuarioId);
    }
    async registrar(usuarioId: string, datos: unknown) {
        await this.autorizarRegistro(usuarioId, datos && typeof datos === 'object' ? (datos as { propuestaId?: unknown }).propuestaId : undefined);
        const e = validar(comandoSchema, datos), huella = hash(e);
        return this.sql.begin('isolation level read committed', async tx => {
            const c = tx as unknown as Conexion;
            let u = await identidadActual(c, usuarioId), p = await cabecera(c, u, e.propuestaId, true), r = await metaRevision(c, u, p, e.revisionId, true);
            await bloquearAmbito(c, r);
            p = await cabecera(c, await identidadActual(c, usuarioId), e.propuestaId, true, true);
            u = await identidadActual(c, usuarioId); autorizarAmbito(u, p.ambito, true); r = await metaRevision(c, u, p, e.revisionId, true);
            const [repetida] = await c`select hash_peticion,propuesta_id,revision_id,evento_id from propuesta_seguimiento_operaciones where autor_id=${u.id} and clave_peticion=${e.clavePeticion}`;
            if (repetida) {
                if (repetida.hash_peticion !== huella || repetida.propuesta_id !== p.id || repetida.revision_id !== r.id) throw new ErrorSeguimiento('La clave de petición pertenece a otro contenido.', 409);
                return { propuestaId: p.id, revisionId: r.id, eventoId: String(repetida.evento_id), repetida: true };
            }
            if (p.actual_revision_id !== r.id || p.version !== e.versionPropuesta || r.sha256 !== e.revisionHash || p.archivada_en) throw new ErrorSeguimiento('La propuesta cambió o está archivada. Conserva el motivo y compara.', 409);
            await publicacion(c, p.id, r.id);
            await c`insert into propuesta_seguimientos(revision_id) values(${r.id}) on conflict(revision_id) do nothing`;
            const [flujo] = await c`select version,ultimo_evento_id from propuesta_seguimientos where revision_id=${r.id} for update`;
            if (flujo.version !== e.versionSeguimiento || flujo.ultimo_evento_id !== e.ultimoEventoId) throw new ErrorSeguimiento('Otra decisión cambió el seguimiento. Conserva el motivo y recarga.', 409);
            const eventos = await eventosRevision(c, p.id, r.id), estado = derivarEstado(eventos), ultimo = eventos.at(-1);
            if (eventos.length !== flujo.version || (ultimo?.id ?? null) !== flujo.ultimo_evento_id || eventos.some(x => x.revisionHash !== r.sha256)) throw new ErrorSeguimiento('El flujo conservado es inconsistente.', 503);
            if (eventos.length >= LIMITES.eventos) throw new ErrorSeguimiento('Máximo 1000 eventos por revisión.', 413);
            const nuevoEstado = transicion(estado, e.comando);
            if (e.comando === 'revocar_decision' ? e.decisionRevocadaId !== ultimo?.id : e.decisionRevocadaId !== null) throw new ErrorSeguimiento('Selecciona exactamente la decisión vigente que vas a revocar.', 409);
            const id = randomUUID(), numero = flujo.version + 1;
            await c`insert into propuesta_eventos(id,propuesta_id,revision_id,revision_sha256,numero,antecedente_id,tipo,decision_revocada_id,motivo,referencia,autor_id,autor_nombre) values(${id},${p.id},${r.id},${r.sha256},${numero},${flujo.ultimo_evento_id},${e.comando},${e.decisionRevocadaId},${e.motivo},${e.referencia},${u.id},${u.nombre})`;
            const actualizada = await c`update propuesta_seguimientos set version=${numero},ultimo_evento_id=${id} where revision_id=${r.id} and version=${e.versionSeguimiento} and ultimo_evento_id is not distinct from ${e.ultimoEventoId} returning revision_id`;
            if (!actualizada.length) throw new ErrorSeguimiento('El seguimiento cambió durante el guardado.', 409);
            await c`insert into propuesta_seguimiento_operaciones(autor_id,clave_peticion,hash_peticion,propuesta_id,revision_id,tipo,evento_id) values(${u.id},${e.clavePeticion},${huella},${p.id},${r.id},'evento',${id})`;
            await this.opciones.antesDeGuardar?.();
            return { propuestaId: p.id, revisionId: r.id, eventoId: id, numero, estado: nuevoEstado, repetida: false };
        });
    }
    async embudo(usuarioId: string, datos: unknown, opciones: { token?: string; etapa?: Estado; cursor?: string; comparar?: { desde: string; hasta: string } } = {}) {
        const filtros = resolverFiltros(datos);
        return this.lectura(async (c, u) => {
            autorizarFiltros(u, filtros);
            if (+new Date(filtros.observadoEn) > this.ahora()) throw new ErrorSeguimiento('La observación no puede estar en el futuro.', 400);
            const miembros = await leerCohorte(c, u, filtros), permisosHash = hash(u.permisos);
            const filtrosComparados = opciones.comparar ? resolverFiltros({ ...filtros, desde: opciones.comparar.desde, hasta: opciones.comparar.hasta }) : null;
            const miembrosComparados = filtrosComparados ? await leerCohorte(c, u, filtrosComparados) : [];
            const contextoComparado = filtrosComparados ? { desde: filtrosComparados.desde, hasta: filtrosComparados.hasta, manifiestoHash: hash(manifiesto(miembrosComparados)) } : null;
            const conjuntoHash = huellaConjunto(miembros, contextoComparado);
            if (opciones.token) verificarToken(opciones.token, u.id, filtros, miembros, permisosHash, this.secreto(), this.ahora(), contextoComparado);
            else if (opciones.cursor || opciones.etapa) throw new ErrorSeguimiento('El detalle requiere token del embudo.', 400);
            const token = opciones.token ?? crearToken({ modelo: 1, usuarioId: u.id, filtros, manifiestoHash: conjuntoHash, comparacion: contextoComparado, permisosHash, creadoEn: this.ahora() }, this.secreto());
            const conteos = Object.fromEntries(estados.map(e => [e, miembros.filter(m => m.estado === e).length])) as Record<Estado, number>;
            const seleccionados = opciones.etapa ? miembros.filter(m => m.estado === opciones.etapa) : miembros;
            let posicion = 0;
            if (opciones.cursor) { identificador(opciones.cursor); const i = seleccionados.findIndex(m => m.propuestaId === opciones.cursor); if (i < 0) throw new ErrorSeguimiento('Cursor ajeno a este conjunto y etapa.', 409); posicion = i + 1; }
            const lista = seleccionados.slice(posicion, posicion + LIMITES.pagina), siguienteCursor = posicion + lista.length < seleccionados.length ? lista.at(-1)!.propuestaId : null;
            const monetario = filtros.importes ? await (await import('./monedas')).leerMonedas(c, u, miembros) : undefined;
            let comparacion;
            if (filtrosComparados) { const tasa = ratio(miembrosComparados.filter(m => m.estado === 'aceptada').length, miembrosComparados.length), actual = ratio(conteos.aceptada, miembros.length); comparacion = { filtros: filtrosComparados, manifiestoHash: contextoComparado!.manifiestoHash, tasa, diferenciaPuntosPorcentuales: compararRatios(actual, tasa) }; }
            return { filtros, rango: rango(filtros), denominador: miembros.length, conteos, tasa: ratio(conteos.aceptada, miembros.length), token, manifiestoHash: conjuntoHash, etapa: opciones.etapa ?? null, totalEtapa: seleccionados.length, lista, siguienteCursor, ...(monetario ? { importes: monetario } : {}), ...(comparacion ? { comparacion } : {}) };
        }, usuarioId);
    }
    async opcionesPropuestas(usuarioId: string, q = '', pagina = 0) {
        if (q.length > 100 || !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 10000) throw new ErrorSeguimiento('Búsqueda inválida.', 400);
        return this.lectura(async (c, u) => { exigir(u, 'salas'); const visible = filtroVisibilidad(c, u); const filas = await c`select p.id,r.id revision_id,r.numero,r.titulo,r.fuente->>'nombre' nombre_ambito,p.ambito,p.sala_id,p.proyecto_id from propuestas p join propuesta_revisiones r on r.id=p.actual_revision_id left join propuesta_revision_visibilidad v on v.revision_id=r.id left join propuesta_revision_visibilidad vc on vc.revision_id=p.actual_revision_id where ${visible} and (not p.contiene_valoracion or vc.revision_id is not null) and concat_ws(' ',r.titulo,p.id::text) ilike ${`%${q.replace(/[\\%_]/g, '\\$&')}%`} order by r.titulo,p.id limit 21 offset ${pagina * 20}`; return { propuestas: filas.slice(0, 20), hayMas: filas.length > 20, pagina }; }, usuarioId);
    }
    async capacidadResultados(usuarioId: string) { return this.lectura(async (_c, u) => { exigirFinanzas(u); return { disponible: true, estado: 'disponible', ruta: '/proyectos', mensaje: 'Abre una obra y elige la propuesta y el corte real para revisar su comparación.' }; }, usuarioId); }
}
