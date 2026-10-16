import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type postgres from 'postgres';
import { REGISTRO_INFORMES, seccionesInforme } from '../informes/registro';
import { clasificarConsulta } from './intenciones';
import { identidadConsulta, exigirConsulta, resolverAmbito, requisitosConsulta, type SqlConsulta, type IdentidadConsulta } from './autorizacion';
import { proyectarSala, proyectarCatalogo, hashConsulta, type ProyeccionConsulta } from './lectores';
import { autorizarMetadatosConsulta, comprobarFuente, leerDocumentoSeleccionado, listarDocumentosConsulta } from './fuentes';
import { aclConsultaSchema, ambitoConsultaSchema, canonico, crearConsultaSchema, preguntarConsultaSchema, respuestaConsultaSchema, integridad, validar, normalizarAmbito, ErrorConsulta, LIMITES_CONSULTA as L, type AmbitoConsulta, type EntradaPregunta, type CapturaConsulta, type AclConsulta } from './modelo';
interface Conversacion {
    id: string;
    propietario_id: string;
    ambito: AmbitoConsulta;
    version: number;
    retencion_dias: 7 | 30 | 90;
    creado_en: Date;
    caduca_en: Date;
}
interface Turno {
    id: string;
    conversacion_id: string;
    propietario_id: string;
    numero: number;
    clave_peticion: string;
    entrada_sha256: string;
    acl_fuentes: AclConsulta;
    captura_sha256: string;
    observado_en: Date;
}
export interface BarrerasConsulta {
    despuesCaptura?: () => Promise<void>;
    antesContenido?: () => Promise<void>;
}
const objetoJson = (v: unknown) => v as postgres.JSONValue;
export class RepositorioConsultas {
    constructor(readonly sql: SqlConsulta, readonly barreras: BarrerasConsulta = {}) { }
    async lectura<T>(fn: (sql: SqlConsulta) => Promise<T>): Promise<T> { return this.sql.begin('isolation level repeatable read read only', tx => fn(tx as unknown as SqlConsulta)) as Promise<T>; }
    async escritura<T>(fn: (sql: SqlConsulta) => Promise<T>): Promise<T> { return this.sql.begin(tx => fn(tx as unknown as SqlConsulta)) as Promise<T>; }
    async bloquear(sql: SqlConsulta, id: string) { await sql `select pg_advisory_xact_lock(hashtextextended(${`consultas:${id}`},0))`; }
    async purgar(sql: SqlConsulta, id?: string) {
        const predicado = id ? sql `propietario_id=${id}` : sql `true`;
        const filas = await sql `select id from consultas_conversaciones where caduca_en<=clock_timestamp() and ${predicado} order by caduca_en,id for update skip locked limit 100`;
        if (filas.length)
            await sql `delete from consultas_conversaciones where id in ${sql(filas.map(f => f.id))} and caduca_en<=clock_timestamp()`;
        return filas.length;
    }
    async propia(sql: SqlConsulta, id: string, propietarioId: string, bloquear = false): Promise<Conversacion> {
        const filas = bloquear ? await sql `select id,propietario_id,ambito,version,retencion_dias,creado_en,caduca_en from consultas_conversaciones where id=${id} and propietario_id=${propietarioId} and caduca_en>clock_timestamp() for update` : await sql `select id,propietario_id,ambito,version,retencion_dias,creado_en,caduca_en from consultas_conversaciones where id=${id} and propietario_id=${propietarioId} and caduca_en>clock_timestamp()`;
        if (!filas[0])
            throw new ErrorConsulta('NO_ENCONTRADO', 'Consulta no encontrada.', 404);
        const f = filas[0];
        return { ...f, ambito: integridad(ambitoConsultaSchema, f.ambito) } as Conversacion;
    }
    async crear(usuarioId: string, entrada: unknown) {
        const e = validar(crearConsultaSchema, entrada), a = normalizarAmbito(e.ambito);
        return this.escritura(async (sql) => {
            await identidadConsulta(sql, usuarioId);
            await this.bloquear(sql, usuarioId);
            const u = await identidadConsulta(sql, usuarioId);
            await resolverAmbito(sql, u, a);
            await this.purgar(sql, u.id);
            const [q] = await sql `select count(*)::int as n from consultas_conversaciones where propietario_id=${u.id} and caduca_en>clock_timestamp()`;
            if (q.n >= L.conversaciones)
                throw new ErrorConsulta('CUOTA', 'Puedes conservar veinte conversaciones vigentes. Borra alguna o espera a su caducidad.', 429);
            const [r] = await sql `insert into consultas_conversaciones(propietario_id,ambito,retencion_dias,caduca_en) values(${u.id},${sql.json(objetoJson(a))},${e.retencionDias},transaction_timestamp()+${e.retencionDias}*interval '1 day') returning id,ambito,version,retencion_dias,creado_en,caduca_en`;
            return r;
        });
    }
    async listar(usuarioId: string, cursor?: string) {
        const c = cursor ? validarCursor(cursor) : null;
        return this.lectura(async (sql) => {
            await identidadConsulta(sql, usuarioId);
            const pred = c ? sql `and (creado_en,id)>(${c.fecha}::timestamptz,${c.id}::uuid)` : sql ``;
            const filas = await sql `select id,ambito,version,retencion_dias,creado_en,caduca_en from consultas_conversaciones where propietario_id=${usuarioId} and caduca_en>clock_timestamp() ${pred} order by creado_en,id limit 21`;
            const lista = filas.slice(0, L.pagina), ultimo = lista.at(-1);
            return { conversaciones: lista, siguiente: filas.length > L.pagina && ultimo ? codificarCursor(new Date(ultimo.creado_en).toISOString(), ultimo.id) : null };
        });
    }
    async listarTurnos(usuarioId: string, id: string, desde = 0) {
        return this.lectura(async (sql) => {
            const u = await identidadConsulta(sql, usuarioId), c = await this.propia(sql, id, u.id);
            exigirConsulta(u, requisitosConsulta('no_disponible', c.ambito));
            const turnos = await sql `select id,numero,intent,motor,observado_en,creado_en from consultas_turnos where conversacion_id=${id} and propietario_id=${u.id} and numero>${desde} order by numero,id limit 21`;
            return { conversacion: c, turnos: turnos.slice(0, 20), siguiente: turnos.length > 20 ? turnos[19].numero : null };
        });
    }
    async turnoMetadata(sql: SqlConsulta, id: string, turnoId: string, usuarioId: string): Promise<Turno> {
        const [t] = await sql `select id,conversacion_id,propietario_id,numero,clave_peticion,entrada_sha256,acl_fuentes,captura_sha256,observado_en from consultas_turnos where id=${turnoId} and conversacion_id=${id} and propietario_id=${usuarioId}`;
        if (!t)
            throw new ErrorConsulta('NO_ENCONTRADO', 'Turno no encontrado.', 404);
        return { ...t, acl_fuentes: integridad(aclConsultaSchema, t.acl_fuentes) } as Turno;
    }
    async comprobarAcl(sql: SqlConsulta, u: IdentidadConsulta, c: Conversacion, t: Turno, exigirIgual = false) {
        const acl = integridad(aclConsultaSchema, t.acl_fuentes);
        if (canonico(acl.ambito) !== canonico(c.ambito))
            throw new ErrorConsulta('INTEGRIDAD', 'Consulta no disponible.', 503);
        exigirConsulta(u, [...requisitosConsulta(acl.intent, acl.ambito), ...acl.secciones]);
        // La ausencia de fuentes sólo es válida para abstención o enlace al flujo03.
        if (!['no_disponible', 'informe', 'documentos'].includes(acl.intent) && !acl.fuentes.length)
            throw new ErrorConsulta('INTEGRIDAD', 'Fuentes de consulta no disponibles.', 503);
        if (acl.intent !== 'no_disponible')
            await resolverAmbito(sql, u, c.ambito);
        for (const f of acl.fuentes)
            await autorizarMetadatosConsulta(sql, u, f);
        let historica = false;
        for (const f of acl.fuentes) {
            const igual = await comprobarFuente(sql, u, f);
            if (!igual) {
                if (exigirIgual)
                    throw new ErrorConsulta('FUENTE_CAMBIADA', 'Las fuentes cambiaron. Conserva la pregunta y consulta otra vez.', 409);
                historica = true;
            }
        }
        return historica;
    }
    async cargarContenido(sql: SqlConsulta, u: IdentidadConsulta, c: Conversacion, t: Turno) {
        const historica = await this.comprobarAcl(sql, u, c, t);
        await this.barreras.antesContenido?.();
        const [contenido] = await sql `select pregunta,respuesta from consultas_contenidos where turno_id=${t.id}`;
        const respuesta = integridad(respuestaConsultaSchema, contenido?.respuesta);
        if (!contenido || hashConsulta({ respuesta, acl: t.acl_fuentes }) !== t.captura_sha256 || canonico(respuesta.citas.map(ci => ci.fuente)) !== canonico(t.acl_fuentes.fuentes))
            throw new ErrorConsulta('INTEGRIDAD', 'La consulta no supera la comprobación de integridad.', 503);
        return { id: t.id, numero: t.numero, pregunta: contenido.pregunta, respuesta, historica, capturaSha256: t.captura_sha256 };
    }
    async obtenerTurno(usuarioId: string, id: string, turnoId: string) {
        try {
            const contenido = await this.lectura(async (sql) => { const u = await identidadConsulta(sql, usuarioId), c = await this.propia(sql, id, u.id), t = await this.turnoMetadata(sql, id, turnoId, u.id); return this.cargarContenido(sql, u, c, t); });
            // Nueva instantánea antes de publicar; nunca un stream de contenido parcial.
            const ultima=await this.lectura(async (sql) => { const u = await identidadConsulta(sql, usuarioId), c = await this.propia(sql, id, u.id), t = await this.turnoMetadata(sql, id, turnoId, u.id); return this.comprobarAcl(sql, u, c, t); });
            return { ...contenido, historica:contenido.historica||ultima,bloqueado: false };
        }
        catch (e) {
            if (e instanceof ErrorConsulta && [403, 409].includes(e.status))
                return { id: turnoId, bloqueado: true, mensaje: 'Este turno ya no está disponible con las fuentes y permisos actuales.' };
            throw e;
        }
    }
    async existente(sql: SqlConsulta, u: IdentidadConsulta, c: Conversacion, clave: string, entradaHash: string) {
        const [t] = await sql `select id,conversacion_id,entrada_sha256 from consultas_turnos where propietario_id=${u.id} and clave_peticion=${clave}`;
        if (!t)
            return null;
        if (t.conversacion_id !== c.id || t.entrada_sha256 !== entradaHash)
            throw new ErrorConsulta('CLAVE_CAMBIADA', 'La clave de petición ya identifica otra pregunta.', 409);
        return this.cargarContenido(sql, u, c, await this.turnoMetadata(sql, c.id, t.id, u.id));
    }
    async preguntar(usuarioId: string, id: string, entrada: unknown) {
        const e = validar(preguntarConsultaSchema, entrada);
        const inicial = await this.lectura(async (sql) => {
            const u = await identidadConsulta(sql, usuarioId), c = await this.propia(sql, id, u.id);
            const entradaHash = hashConsulta({ pregunta: e.pregunta, fuente: e.fuente ?? null, ambito: c.ambito });
            const existe = await this.existente(sql, u, c, e.clavePeticion, entradaHash);
            if (existe)
                return { existe, c, entradaHash };
            if (c.version !== e.version)
                throw new ErrorConsulta('CONFLICTO', 'Otra pestaña añadió una pregunta. Conservamos tu edición: recarga el historial.', 409);
            const captura = await this.capturar(sql, u, c.ambito, e);
            return { c, entradaHash, captura };
        });
        if (inicial.existe) {
            const ultima=await this.lectura(async (sql) => { const u = await identidadConsulta(sql, usuarioId), c = await this.propia(sql, id, u.id); const t = await this.turnoMetadata(sql, id, inicial.existe.id, u.id); return this.comprobarAcl(sql, u, c, t); });
            return { ...inicial.existe, historica:inicial.existe.historica||ultima, version: inicial.c.version, reintentado: true };
        }
        await this.barreras.despuesCaptura?.();
        const captura = inicial.captura!;
        return this.escritura(async (sql) => {
            await identidadConsulta(sql, usuarioId);
            await this.bloquear(sql, usuarioId);
            const u = await identidadConsulta(sql, usuarioId);
            await this.purgar(sql, u.id);
            const c = await this.propia(sql, id, u.id, true);
            const existe = await this.existente(sql, u, c, e.clavePeticion, inicial.entradaHash);
            if (existe)
                return { ...existe, version: c.version, reintentado: true };
            if (c.version !== e.version)
                throw new ErrorConsulta('CONFLICTO', 'Otra pestaña añadió una pregunta. Conservamos tu edición: recarga el historial.', 409);
            // READ COMMITTED nuevo, posterior a la captura MVCC: identidad/ámbito/todas fuentes otra vez.
            const falsoTurno: Turno = { id: randomUUID(), conversacion_id: id, propietario_id: u.id, numero: 0, clave_peticion: e.clavePeticion, entrada_sha256: inicial.entradaHash, acl_fuentes: captura.acl, captura_sha256: captura.hash, observado_en: new Date(captura.respuesta.observadoEn) };
            await this.comprobarAcl(sql, u, c, falsoTurno, true);
            const [q] = await sql `select count(*)::int as n from consultas_turnos where conversacion_id=${id} and propietario_id=${u.id}`;
            if (q.n >= L.turnos)
                throw new ErrorConsulta('CUOTA', 'Esta conversación ya tiene cien turnos. Crea otra conversación.', 429);
            const [tamano] = await sql `select octet_length(${e.pregunta}::text)+octet_length(${sql.json(objetoJson(captura.respuesta))}::jsonb::text) as bytes`;
            if (Number(tamano.bytes) > L.bytesTurno || captura.respuesta.hechos.length > L.hechos)
                throw new ErrorConsulta('LIMITE', 'La respuesta supera el límite. Reduce la selección.', 413);
            const [cuota] = await sql `select coalesce(sum(octet_length(c.pregunta)+octet_length(c.respuesta::text)+octet_length(t.acl_fuentes::text)),0)::bigint as bytes from consultas_contenidos c join consultas_turnos t on t.id=c.turno_id where t.propietario_id=${u.id}`;
            if (Number(cuota.bytes) + Number(tamano.bytes) + Buffer.byteLength(canonico(captura.acl)) > L.bytesPersona)
                throw new ErrorConsulta('CUOTA', 'Has alcanzado la cuota de historial. Borra conversaciones propias o reduce la selección.', 429);
            const [t] = await sql `insert into consultas_turnos(conversacion_id,propietario_id,numero,clave_peticion,entrada_sha256,intent,motor,acl_fuentes,observado_en,captura_sha256) values(${id},${u.id},${q.n + 1},${e.clavePeticion},${inicial.entradaHash},${captura.respuesta.intent},'local-1',${sql.json(objetoJson(captura.acl))},${captura.respuesta.observadoEn},${captura.hash}) returning id,numero`;
            await sql `insert into consultas_contenidos(turno_id,pregunta,respuesta) values(${t.id},${e.pregunta},${sql.json(objetoJson(captura.respuesta))})`;
            const [cabecera] = await sql `update consultas_conversaciones set version=version+1 where id=${id} and propietario_id=${u.id} and version=${e.version} returning version`;
            if (!cabecera)
                throw new ErrorConsulta('CONFLICTO', 'La conversación ha cambiado.', 409);
            return { id: t.id, numero: t.numero, pregunta: e.pregunta, respuesta: captura.respuesta, historica: false, capturaSha256: captura.hash, version: cabecera.version, reintentado: false };
        });
    }
    async capturar(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, e: EntradaPregunta): Promise<CapturaConsulta> {
        const intent = clasificarConsulta(e.pregunta), secciones = requisitosConsulta(intent.intent, a);
        exigirConsulta(u, secciones);
        const [{ observado }] = await sql `select transaction_timestamp() as observado`;
        const observadoEn = new Date(observado).toISOString();
        let partes: ProyeccionConsulta[] = [], texto = intent.motivo ?? 'Datos técnicos registrados en el ámbito elegido.';
        if (intent.intent !== 'no_disponible') {
            const ids = await resolverAmbito(sql, u, a);
            if (['medidas', 'equipos', 'conexiones', 'cables', 'necesidad'].includes(intent.intent)) {
                if (a.tipo === 'catalogo')
                    throw new ErrorConsulta('AMBITO', 'Elige una sala o selección de salas para esta pregunta.', 400);
                for (const id of ids)
                    partes.push(await proyectarSala(sql, u, a, id, intent));
            }
            else if (intent.intent === 'catalogo') {
                if (e.fuente && e.fuente.tipo !== 'catalogo')
                    throw new ErrorConsulta('ENTRADA_INVALIDA', 'Elige una ficha de catálogo.', 400);
                partes = await proyectarCatalogo(sql, u, a, e.fuente?.id);
            }
            else if (intent.intent === 'documentos') {
                partes = e.fuente ? [await leerDocumentoSeleccionado(sql, u, a, e.fuente, true)] : await listarDocumentosConsulta(sql, u, a);
                texto = partes.length ? 'Documentos autorizados de esta selección. El texto consultable se reproduce como dato literal.' : 'No hay documentos técnicos consultables disponibles para esta selección y tus permisos.';
            }
            else if (intent.intent === 'informe') {
                if (a.tipo === 'catalogo')
                    throw new ErrorConsulta('AMBITO', 'Los informes requieren una sala o selección explícita de una obra.', 400);
                const requeridas = seccionesInforme('estado_actual', a);
                exigirConsulta(u, requeridas);
                secciones.push(...requeridas.filter(s => !secciones.includes(s)));
                const qs = new URLSearchParams({ clave: 'estado_actual', tipo: a.tipo, id: a.id, ...(a.tipo === 'obra' ? { salaIds: a.salaIds.join(',') } : {}) });
                texto = `${REGISTRO_INFORMES.estado_actual.nombre} · ámbito seleccionado · período actual · Europe/Madrid · PDF, XLSX o CSV · audiencia propia. Abre el flujo de informes para revisar la vista previa y confirmar su creación.`;
                const respuesta = validar(respuestaConsultaSchema, { versionModelo: 1, motor: 'local-1', intent: intent.intent, ambito: a, observadoEn, texto, hechos: [], avisos: [], citas: [], enlaces: [{ etiqueta: 'Preparar informe de estado actual', href: `/cuenta/informes?${qs}` }] });
                const acl: AclConsulta = { versionModelo: 1, intent: intent.intent, ambito: a, secciones, fuentes: [] };
                return { respuesta, acl, hash: hashConsulta({ respuesta, acl }) };
            }
        }
        const hechos = partes.flatMap(p => p.hechos);
        if (hechos.length > L.hechos)
            throw new ErrorConsulta('LIMITE', 'La respuesta supera mil hechos. Reduce el ámbito.', 413);
        const fuentes = partes.map(p => p.fuente);
        const respuesta = validar(respuestaConsultaSchema, { versionModelo: 1, motor: 'local-1', intent: intent.intent, ambito: a, observadoEn, texto, hechos, avisos: partes.flatMap(p => p.avisos), citas: partes.map(p => ({ fuente: p.fuente, href: p.href, observadoEn: p.observadoEn ?? observadoEn, ...(p.borrador !== undefined ? { borrador: p.borrador } : {}) })), enlaces: partes.map(p => ({ etiqueta: p.etiqueta ?? 'Abrir fuente autorizada', href: p.href })) });
        const acl: AclConsulta = { versionModelo: 1, intent: intent.intent, ambito: a, secciones: [...new Set(secciones)], fuentes };
        return { respuesta, acl, hash: hashConsulta({ respuesta, acl }) };
    }
    async retener(usuarioId: string, id: string, version: number, dias: 7 | 30 | 90) {
        return this.escritura(async (sql) => { await identidadConsulta(sql, usuarioId); await this.bloquear(sql, usuarioId); const u = await identidadConsulta(sql, usuarioId); await this.purgar(sql, u.id); const c = await this.propia(sql, id, u.id, true); if (c.version !== version)
            throw new ErrorConsulta('CONFLICTO', 'La conversación cambió. Recarga el historial.', 409); const [f] = await sql `update consultas_conversaciones set retencion_dias=${dias},caduca_en=creado_en+${dias}*interval '1 day',version=version+1 where id=${id} and propietario_id=${u.id} and version=${version} returning version,caduca_en,retencion_dias`; await this.purgar(sql, u.id); return f; });
    }
    async borrar(usuarioId: string, id: string, version: number) {
        return this.escritura(async (sql) => { await identidadConsulta(sql, usuarioId); await this.bloquear(sql, usuarioId); const u = await identidadConsulta(sql, usuarioId); const c = await this.propia(sql, id, u.id, true); if (c.version !== version)
            throw new ErrorConsulta('CONFLICTO', 'La conversación cambió. Recarga el historial.', 409); await sql `delete from consultas_conversaciones where id=${id} and propietario_id=${u.id} and version=${version}`; return { borrada: true }; });
    }
}
const cursorSchema = z.object({ fecha: z.iso.datetime(), id: z.uuid() }).strict();
function codificarCursor(fecha: string, id: string) { return Buffer.from(JSON.stringify({ fecha, id })).toString('base64url'); }
export function validarCursor(cursor: string) { try {
    if (cursor.length > 300 || !/^[\w-]+$/.test(cursor))
        throw new Error();
    const c = validar(cursorSchema, JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (codificarCursor(c.fecha, c.id) !== cursor)
        throw new Error();
    return c;
}
catch {
    throw new ErrorConsulta('CURSOR', 'Cursor inválido.', 400);
} }
