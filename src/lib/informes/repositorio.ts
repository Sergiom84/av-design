import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { identidadActual, autorizarAmbitoInforme, expandirAudiencia, exigirDistribucion, distribuye, origenVigente, type ConexionInformes, type OrigenReceptor } from './autorizacion';
import { ErrorInforme, GENERADOR, LIMITES, identificador, entrada, configuracionSchema, serializarCanonico, type ArchivoInforme, type ConfiguracionInforme, type DefinicionCongelada, type ManifiestoInforme, type PeriodoResuelto, type SnapshotInforme, type CalendarioInforme } from './modelo';
import { resolverPeriodo } from './periodos';
import { proximasOcurrencias, validarCalendario } from './calendario';
import { resolverAmbito } from './lectores';
import { sha256, MIME_INFORME, metadatosArchivo } from './exportadores';
export interface DefinicionInforme {
    id: string;
    propietario_id: string;
    nombre: string;
    version: number;
    configuracion: ConfiguracionInforme;
    archivada_en: Date | null;
}
export interface EjecucionInforme {
    id: string;
    definicion_id: string;
    propietario_id: string;
    programacion_id: string | null;
    clave_peticion: string | null;
    ocurrencia_utc: Date;
    definicion_snapshot: DefinicionCongelada;
    definicion_sha256: string;
    periodo_resuelto: PeriodoResuelto;
    snapshot: SnapshotInforme | null;
    snapshot_sha256: string | null;
    observado_en: Date | null;
    estado: string;
    intento_actual: number;
    lease_token: string | null;
    lease_hasta: Date | null;
    manifiesto: ManifiestoInforme | null;
    caduca_en: Date | null;
    revocada_en: Date | null;
    error_codigo: string | null;
    error_mensaje: string | null;
    caducada?: boolean;
}
const META = 'id,definicion_id,propietario_id,programacion_id,clave_peticion,ocurrencia_utc,definicion_snapshot,definicion_sha256,periodo_resuelto,snapshot_sha256,observado_en,estado,intento_actual,lease_token,lease_hasta,manifiesto,caduca_en,revocada_en,error_codigo,error_mensaje';
export class RepositorioInformes {
    constructor(public sql: ConexionInformes) {
    }
    async transaccion<T>(trabajo: (r: RepositorioInformes) => Promise<T>): Promise<T> {
        return this.sql.begin(async (tx) => trabajo(new RepositorioInformes(tx as unknown as ReturnType<typeof postgres>))) as Promise<T>;
    }
    async bloquearPropietario(id: string) {
        await this.sql `select pg_advisory_xact_lock(728301,hashtext(${id}))`;
    }
    async identidad(id: string) {
        return identidadActual(this.sql, id);
    }
    async propia(id: string, propietarioId: string, bloquear = false): Promise<DefinicionInforme> {
        const filas = bloquear ? await this.sql `select * from informes_definiciones where id=${id} and propietario_id=${propietarioId} for update` : await this.sql `select * from informes_definiciones where id=${id} and propietario_id=${propietarioId}`;
        if (!filas[0])
            throw new ErrorInforme('NO_ENCONTRADO', 'Informe no encontrado.', 404);
        const d = filas[0] as DefinicionInforme;
        d.configuracion = entrada(configuracionSchema, d.configuracion);
        const u = await this.identidad(propietarioId);
        autorizarAmbitoInforme(u, d.configuracion);
        return d;
    }
    async definiciones(propietarioId: string) {
        const u = await this.identidad(propietarioId);
        const filas = await this.sql `select * from informes_definiciones where propietario_id=${propietarioId} order by creado_en desc,id desc`;
        return filas.filter(d => {
            try {
                autorizarAmbitoInforme(u, entrada(configuracionSchema, d.configuracion));
                return true;
            }
            catch (error) {
                if (!(error instanceof ErrorInforme))
                    throw error;
                return false;
            }
        });
    }
    async vistaPrevia(propietarioId: string, c: ConfiguracionInforme, creadaEn = new Date().toISOString(), calendario?: CalendarioInforme, ocurrencia = new Date()) {
        const instante = new Date(creadaEn);
        if (!Number.isFinite(+instante) || Date.now() - +instante > 600000 || +instante > Date.now() + 5000)
            throw new ErrorInforme('VISTA_PREVIA_CADUCADA', 'La revisión ha caducado. Revisa de nuevo.', 409);
        const u = await this.identidad(propietarioId);
        autorizarAmbitoInforme(u, c);
        const audiencia = await expandirAudiencia(this.sql, u, c);
        const ambito = await resolverAmbito(this.sql, c.ambito, c.ambito.tipo !== 'sala' || c.clave === 'material_actual');
        const periodo = resolverPeriodo(c.periodo, ocurrencia);
        const seleccion = { propietarioId, configuracion: c, ambito, periodo, audiencia, creadaEn };
        return { hash: sha256(serializarCanonico(seleccion)), creadaEn, ambito, periodo, audiencia, ...calendario ? { calendario: validarCalendario(calendario, new Date()) } : {} };
    }
    async guardarDefinicion(propietarioId: string, nombre: string, c: ConfiguracionInforme, id?: string, version?: number, archivar = false) {
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(propietarioId);
            const u = await r.identidad(propietarioId);
            resolverPeriodo(c.periodo, new Date());
            await expandirAudiencia(r.sql, u, c);
            if (!id) {
                const [{ n }] = await r.sql `select count(*)::int as n from informes_definiciones where propietario_id=${propietarioId} and archivada_en is null`;
                if (n >= LIMITES.definiciones)
                    throw new ErrorInforme('CUOTA_EXCEDIDA', 'Máximo veinte definiciones activas.', 429);
                const [nueva] = await r.sql `insert into informes_definiciones(propietario_id,nombre,configuracion) values (${propietarioId},${nombre},${r.sql.json(c)}) returning *`;
                return nueva;
            }
            const antigua = await r.propia(id, propietarioId, true);
            if (antigua.archivada_en && !archivar) {
                const [{ n }] = await r.sql `select count(*)::int as n from informes_definiciones where propietario_id=${propietarioId} and archivada_en is null`;
                if (n >= 20)
                    throw new ErrorInforme('CUOTA_EXCEDIDA', 'Máximo veinte definiciones activas.', 429);
            }
            if (antigua.version !== version)
                throw new ErrorInforme('VERSION_CAMBIADA', 'Otra pestaña modificó la definición. Tu edición se conserva.', 409);
            const [nueva] = await r.sql `update informes_definiciones set nombre=${nombre},configuracion=${r.sql.json(c)},version=version+1,archivada_en=${archivar ? new Date() : null},actualizado_en=now() where id=${id} and version=${version!} returning *`;
            const retirados = antigua.configuracion.audiencia.usuarios.filter(x => !c.audiencia.usuarios.includes(x));
            if (retirados.length)
                await r.sql `update informes_receptores set origenes=(select coalesce(jsonb_agg(case when o->>'tipo'='directo' and o->>'revocadoEn' is null then o||jsonb_build_object('revocadoEn',now()) else o end),'[]'::jsonb) from jsonb_array_elements(origenes) o) where usuario_id in ${r.sql(retirados)} and ejecucion_id in (select id from informes_ejecuciones where definicion_id=${id})`;
            if (archivar) {
                await r.sql `update informes_programaciones set activa=false,version=version+1,actualizado_en=now() where definicion_id=${id}`;
                await r.sql `update informes_ejecuciones set estado='cancelada',error_codigo='DEFINICION_ARCHIVADA',error_mensaje='La definición fue archivada.' where definicion_id=${id} and estado='pendiente'`;
            }
            return nueva;
        });
    }
    async insertarEjecucion(d: DefinicionInforme, ocurrencia: Date, clavePeticion: string | null, programacion: {
        id: string;
        version: number;
    } | null, manual = true) {
        const u = await this.identidad(d.propietario_id);
        const receptores = await expandirAudiencia(this.sql, u, d.configuracion, manual);
        let configuracion = d.configuracion;
        if (!manual) {
            configuracion = structuredClone(d.configuracion);
            for (const g of configuracion.audiencia.grupos) {
                const [actual] = await this.sql `select version from informes_grupos where id=${g.id}`;
                if (actual)
                    g.version = actual.version;
            }
        }
        const definicion: DefinicionCongelada = { id: d.id, nombre: d.nombre, version: d.version, propietarioId: d.propietario_id, configuracion, programacion, versionGenerador: GENERADOR };
        const hash = sha256(serializarCanonico(definicion));
        if (clavePeticion) {
            const [previa] = await this.sql `select ${this.sql.unsafe(META)} from informes_ejecuciones where propietario_id=${d.propietario_id} and clave_peticion=${clavePeticion}`;
            if (previa) {
                if (previa.definicion_sha256 !== hash)
                    throw new ErrorInforme('CLAVE_INCOMPATIBLE', 'La clave de solicitud ya pertenece a otra configuración.', 409);
                return previa;
            }
        }
        const [{ n }] = await this.sql `select count(*)::int as n from informes_ejecuciones where propietario_id=${d.propietario_id} and estado in ('pendiente','en_curso')`;
        if (n >= LIMITES.cola)
            throw new ErrorInforme('COLA_LLENA', 'Ya hay cinco informes pendientes o en curso.', 429);
        const periodo = resolverPeriodo(d.configuracion.periodo, ocurrencia);
        const [e] = await this.sql `insert into informes_ejecuciones(definicion_id,propietario_id,programacion_id,clave_peticion,ocurrencia_utc,definicion_snapshot,definicion_sha256,periodo_resuelto) values (${d.id},${d.propietario_id},${programacion?.id ?? null},${clavePeticion},${ocurrencia.toISOString()},${this.sql.json(definicion as never)},${hash},${this.sql.json(periodo)}) on conflict do nothing returning *`;
        if (!e) {
            const [existente] = await this.sql `select ${this.sql.unsafe(META)} from informes_ejecuciones where programacion_id=${programacion!.id} and ocurrencia_utc=${ocurrencia.toISOString()}`;
            return existente;
        }
        for (const rec of receptores)
            await this.sql `insert into informes_receptores(ejecucion_id,usuario_id,origenes) values (${e.id},${rec.usuarioId},${this.sql.json(rec.origenes as never)})`;
        return e;
    }
    async encolar(propietarioId: string, id: string, version: number, vista: {
        hash: string;
        creadaEn: string;
    }, clavePeticion: string) {
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(propietarioId);
            const d = await r.propia(id, propietarioId, true);
            const [existente] = await r.sql `select ${r.sql.unsafe(META)} from informes_ejecuciones where propietario_id=${propietarioId} and clave_peticion=${clavePeticion}`;
            if (existente) {
                const congelada = existente.definicion_snapshot as DefinicionCongelada;
                if (congelada.id !== id || congelada.version !== version)
                    throw new ErrorInforme('CLAVE_INCOMPATIBLE', 'La clave ya se usó con otra versión.', 409);
                return existente;
            }
            if (d.archivada_en)
                throw new ErrorInforme('ESTADO_CAMBIADO', 'La definición está archivada.', 409);
            if (d.version !== version)
                throw new ErrorInforme('VERSION_CAMBIADA', 'La definición cambió. Revisa antes de ejecutar.', 409);
            const [reloj] = await r.sql `select clock_timestamp() as ahora`;
            const ocurrencia = new Date(reloj.ahora);
            const actual = await r.vistaPrevia(propietarioId, d.configuracion, vista.creadaEn, undefined, ocurrencia);
            if (actual.hash !== vista.hash)
                throw new ErrorInforme('VISTA_PREVIA_CAMBIADA', 'La selección, el período o la audiencia cambió. Revisa de nuevo.', 409);
            return r.insertarEjecucion(d, ocurrencia, clavePeticion, null);
        });
    }
    async programaciones(id: string, propietarioId: string) {
        await this.propia(id, propietarioId);
        return this.sql `select p.*,(select jsonb_build_object('id',e.id,'estado',e.estado,'revision',e.manifiesto->>'revision','ocurrencia',e.ocurrencia_utc) from informes_ejecuciones e where e.programacion_id=p.id and e.manifiesto is not null and e.estado in ('correcta','caducada') order by e.ocurrencia_utc desc,e.id desc limit 1) as ultimo_correcto from informes_programaciones p where definicion_id=${id} order by creado_en,id`;
    }
    async guardarProgramacion(propietarioId: string, definicionId: string, versionDefinicion: number, calendario: CalendarioInforme) {
        const preview = validarCalendario(calendario, new Date());
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(propietarioId);
            const d = await r.propia(definicionId, propietarioId, true);
            if (d.version !== versionDefinicion || d.archivada_en)
                throw new ErrorInforme('VERSION_CAMBIADA', 'La definición cambió.', 409);
            await expandirAudiencia(r.sql, await r.identidad(propietarioId), d.configuracion);
            const [{ n }] = await r.sql `select count(*)::int as n from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where d.propietario_id=${propietarioId} and p.activa`;
            if (n >= LIMITES.programaciones)
                throw new ErrorInforme('CUOTA_EXCEDIDA', 'Máximo veinte programaciones activas.', 429);
            const [p] = await r.sql `insert into informes_programaciones(definicion_id,calendario,proxima_utc,ultima_omision) values (${definicionId},${r.sql.json(calendario)},${preview.ocurrencias[0].utc},${r.sql.json(preview.omisiones)}) returning *`;
            return p;
        });
    }
    async modificarProgramacion(propietarioId: string, id: string, version: number, activa: boolean, calendario?: CalendarioInforme) {
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(propietarioId);
            const [p] = await r.sql `select p.* from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where p.id=${id} and d.propietario_id=${propietarioId} for update of p`;
            if (!p)
                throw new ErrorInforme('NO_ENCONTRADO', 'Programación no encontrada.', 404);
            await r.propia(p.definicion_id, propietarioId);
            if (p.version !== version)
                throw new ErrorInforme('VERSION_CAMBIADA', 'La programación cambió en otra pestaña.', 409);
            if (!p.activa && activa) {
                const [{ n }] = await r.sql `select count(*)::int as n from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where d.propietario_id=${propietarioId} and p.activa`;
                if (n >= 20)
                    throw new ErrorInforme('CUOTA_EXCEDIDA', 'Máximo veinte programaciones activas.', 429);
            }
            const nuevo = calendario ?? p.calendario as CalendarioInforme;
            const preview = activa ? validarCalendario(nuevo, new Date()) : null;
            let omision: unknown = preview?.omisiones ?? [];
            if (!p.activa && activa)
                omision = { desde: p.proxima_utc ? new Date(p.proxima_utc).toISOString() : null, hasta: new Date().toISOString(), motivo: 'Reanudación: se omite el intervalo de pausa.', horasInexistentes: preview?.omisiones };
            const [guardada] = await r.sql `update informes_programaciones set version=version+1,activa=${activa},calendario=${r.sql.json(nuevo)},proxima_utc=${activa ? preview!.ocurrencias[0].utc : p.proxima_utc},ultima_omision=${r.sql.json(omision as never)},actualizado_en=now() where id=${id} returning *`;
            if (!activa)
                await r.sql `update informes_ejecuciones set estado='cancelada',error_codigo='PROGRAMACION_PAUSADA',error_mensaje='Programación pausada antes de trabajar.' where programacion_id=${id} and estado='pendiente'`;
            return guardada;
        });
    }
    async grupos(propietarioId: string) {
        exigirDistribucion(await this.identidad(propietarioId));
        return this.sql `select g.*,(select coalesce(jsonb_agg(m.usuario_id order by m.usuario_id),'[]'::jsonb) from informes_grupo_miembros m where m.grupo_id=g.id) as miembros from informes_grupos g where propietario_id=${propietarioId} order by nombre,id`;
    }
    async guardarGrupo(propietarioId: string, nombre: string, c: ConfiguracionInforme, miembros: string[], id?: string, version?: number, activo = true) {
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(propietarioId);
            const u = await r.identidad(propietarioId);
            exigirDistribucion(u);
            autorizarAmbitoInforme(u, c);
            await resolverAmbito(r.sql, c.ambito, true);
            if (activo)
                for (const miembro of miembros)
                    autorizarAmbitoInforme(await r.identidad(miembro), c);
            let grupoId = id;
            if (!id) {
                const [{ n }] = await r.sql `select count(*)::int as n from informes_grupos where propietario_id=${propietarioId}`;
                if (n >= LIMITES.grupos)
                    throw new ErrorInforme('CUOTA_EXCEDIDA', 'Máximo veinte grupos.', 429);
                const [g] = await r.sql `insert into informes_grupos(propietario_id,nombre,ambito,activo) values (${propietarioId},${nombre},${r.sql.json(c.ambito)},${activo}) returning id`;
                grupoId = g.id;
            }
            else {
                const [anterior] = await r.sql `select ambito from informes_grupos where id=${id} and propietario_id=${propietarioId} and version=${version!} for update`;
                if (!anterior)
                    throw new ErrorInforme('VERSION_CAMBIADA', 'El grupo cambió o ya no está disponible.', 409);
                const cambioAmbito = serializarCanonico(anterior.ambito) !== serializarCanonico(c.ambito);
                const [g] = await r.sql `update informes_grupos set nombre=${nombre},ambito=${r.sql.json(c.ambito)},activo=${activo},version=version+1,actualizado_en=now() where id=${id} and propietario_id=${propietarioId} and version=${version!} returning id`;
                if (!g)
                    throw new ErrorInforme('VERSION_CAMBIADA', 'El grupo cambió o ya no está disponible.', 409);
                const anteriores = await r.sql `select usuario_id from informes_grupo_miembros where grupo_id=${id}`;
                // Un origen conserva su ámbito original: volver a él no reactiva la concesión.
                const retirados = activo && !cambioAmbito ? anteriores.map(m => m.usuario_id).filter(u => !miembros.includes(u)) : anteriores.map(m => m.usuario_id);
                if (cambioAmbito || retirados.length)
                    await r.sql `update informes_receptores set origenes=(select jsonb_agg(case when o->>'tipo'='grupo' and o->>'id'=${id} and o->>'revocadoEn' is null then o||jsonb_build_object('revocadoEn',now()) else o end) from jsonb_array_elements(origenes) o) where ${cambioAmbito ? r.sql `true` : r.sql `usuario_id in ${r.sql(retirados)}`} and ejecucion_id in(select id from informes_ejecuciones where propietario_id=${propietarioId})`;
                await r.sql `delete from informes_grupo_miembros where grupo_id=${id}`;
            }
            for (const miembro of miembros)
                await r.sql `insert into informes_grupo_miembros(grupo_id,usuario_id) values (${grupoId!},${miembro})`;
            return (await r.grupos(propietarioId)).find(g => g.id === grupoId);
        });
    }
    async destinatarios(propietarioId: string, c: ConfiguracionInforme, busqueda: string) {
        exigirDistribucion(await this.identidad(propietarioId));
        autorizarAmbitoInforme(await this.identidad(propietarioId), c);
        const filas = await this.sql `select id,usuario,nombre,activo from usuarios where (nombre ilike ${'%' + busqueda + '%'} or usuario ilike ${'%' + busqueda + '%'}) order by nombre,id limit 20`;
        const salida = [];
        for (const f of filas) {
            let apto = false;
            try {
                autorizarAmbitoInforme(await this.identidad(f.id), c);
                apto = true;
            }
            catch (error) {
                if (!(error instanceof ErrorInforme) || error.status === 503)
                    throw error;
            }
            salida.push({ ...f, apto });
        }
        return salida;
    }
    /** Sólo metadatos: la autorización precede a cualquier lectura del snapshot/bytea. */
    async accesoEjecucion(id: string, usuarioId: string): Promise<EjecucionInforme> {
        const [e] = await this.sql `select ${this.sql.unsafe(META)} from informes_ejecuciones where id=${id}`;
        if (!e)
            throw new ErrorInforme('NO_ENCONTRADO', 'Ejecución no encontrada.', 404);
        const [rec] = await this.sql `select origenes,revocado_en,excluido_codigo from informes_receptores where ejecucion_id=${id} and usuario_id=${usuarioId}`;
        if (!rec || rec.revocado_en || rec.excluido_codigo)
            throw new ErrorInforme('NO_ENCONTRADO', 'Ejecución no encontrada.', 404);
        if (!await origenVigente(this.sql, id, usuarioId, e.propietario_id, rec.origenes as OrigenReceptor[]))
            throw new ErrorInforme('NO_ENCONTRADO', 'Ejecución no encontrada.', 404);
        const c = (e.definicion_snapshot as DefinicionCongelada).configuracion;
        const propietario = await this.identidad(e.propietario_id);
        autorizarAmbitoInforme(propietario, c);
        if (distribuye(c, propietario.id))
            exigirDistribucion(propietario);
        autorizarAmbitoInforme(await this.identidad(usuarioId), c);
        if (e.revocada_en)
            throw new ErrorInforme('PERMISO_RETIRADO', 'El propietario revocó esta ejecución.', 403);
        return { ...e, caducada: e.estado === 'caducada' || !!e.caduca_en && +new Date(e.caduca_en) <= Date.now() } as EjecucionInforme;
    }
    async resultado(id: string, usuarioId: string) {
        const e = await this.accesoEjecucion(id, usuarioId);
        let snapshot: SnapshotInforme | null = null;
        if (e.estado === 'correcta' && e.caduca_en && +new Date(e.caduca_en) > Date.now()) {
            const [r] = await this.sql `select snapshot from informes_ejecuciones where id=${id}`;
            snapshot = r.snapshot;
        }
        const receptores = usuarioId === e.propietario_id ? await this.sql `select r.usuario_id,u.nombre,r.origenes,r.excluido_codigo,r.revocado_en from informes_receptores r left join usuarios u on u.id=r.usuario_id where r.ejecucion_id=${id} order by r.usuario_id` : undefined;
        return { ...e, snapshot, ...receptores ? { receptores } : {} };
    }
    async historial(usuarioId: string, cursor?: string) {
        await this.identidad(usuarioId);
        let cursorFecha: string | null = null, cursorId: string | null = null;
        if (cursor) {
            try {
                const [fecha, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
                if (typeof fecha !== 'string' || typeof id !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fecha) || !Number.isFinite(+new Date(fecha)) || new Date(fecha).toISOString() !== fecha)
                    throw new Error();
                identificador(id);
                cursorFecha = fecha;
                cursorId = id;
            }
            catch {
                throw new ErrorInforme('ENTRADA_INVALIDA', 'Cursor inválido.');
            }
        }
        const salida = [];
        let ultima: {
            fecha: string;
            id: string;
        } | null = null;
        for (let tanda = 0; tanda < 20 && salida.length < 20; tanda++) {
            const filas = await this.sql `select e.id,e.creado_en from informes_ejecuciones e join informes_receptores r on r.ejecucion_id=e.id and r.usuario_id=${usuarioId} and r.revocado_en is null and r.excluido_codigo is null where (${cursorFecha}::timestamptz is null or (e.creado_en,e.id)<(${cursorFecha}::timestamptz,${cursorId}::uuid)) order by e.creado_en desc,e.id desc limit 20`;
            if (!filas.length)
                break;
            for (const f of filas) {
                cursorFecha = new Date(f.creado_en).toISOString();
                cursorId = f.id;
                ultima = { fecha: cursorFecha, id: cursorId! };
                try {
                    const e = await this.accesoEjecucion(f.id, usuarioId);
                    salida.push(e);
                }
                catch (error) {
                    if (!(error instanceof ErrorInforme) || ![403, 404, 401].includes(error.status))
                        throw error;
                }
                if (salida.length === 20)
                    break;
            }
            if (filas.length < 20)
                break;
        }
        return { ejecuciones: salida, cursor: ultima ? Buffer.from(JSON.stringify([ultima.fecha, ultima.id])).toString('base64url') : null };
    }
    async ultimosCorrectos(propietarioId: string) {
        const d = await this.definiciones(propietarioId);
        const resultado = [];
        for (const def of d) {
            const [e] = await this.sql `select ${this.sql.unsafe(META)} from informes_ejecuciones where definicion_id=${def.id} and manifiesto is not null and estado in ('correcta','caducada') order by ocurrencia_utc desc,id desc limit 1`;
            if (e)
                try {
                    resultado.push(await this.accesoEjecucion(e.id, propietarioId));
                }
                catch (error) {
                    if (!(error instanceof ErrorInforme) || error.status === 503)
                        throw error;
                }
        }
        return resultado;
    }
    async revocar(id: string, usuarioId: string, estado: string, intento: number) {
        return this.transaccion(async (r) => {
            const e = await r.accesoEjecucion(id, usuarioId);
            if (e.propietario_id !== usuarioId)
                throw new ErrorInforme('NO_ENCONTRADO', 'Ejecución no encontrada.', 404);
            const [actual] = await r.sql `update informes_ejecuciones set revocada_en=coalesce(revocada_en,now()) where id=${id} and estado=${estado} and intento_actual=${intento} returning id`;
            if (!actual)
                throw new ErrorInforme('ESTADO_CAMBIADO', 'La ejecución cambió.', 409);
            return actual;
        });
    }
    async reintentar(id: string, usuarioId: string, estado: string, intento: number) {
        return this.transaccion(async (r) => {
            await r.bloquearPropietario(usuarioId);
            const e = await r.accesoEjecucion(id, usuarioId);
            if (e.propietario_id !== usuarioId)
                throw new ErrorInforme('NO_ENCONTRADO', 'Ejecución no encontrada.', 404);
            if (intento >= 3 || !['fallida', 'bloqueada'].includes(estado))
                throw new ErrorInforme('ESTADO_CAMBIADO', 'No queda presupuesto de intentos. Crea una nueva captura.', 409);
            const [{ n }] = await r.sql `select count(*)::int as n from informes_ejecuciones where propietario_id=${usuarioId} and estado in ('pendiente','en_curso')`;
            if (n >= 5)
                throw new ErrorInforme('COLA_LLENA', 'La cola está llena.', 429);
            const [nueva] = await r.sql `update informes_ejecuciones set estado='pendiente',reintentar_desde=null,error_codigo=null,error_mensaje=null where id=${id} and estado=${estado} and intento_actual=${intento} and lease_token is null and revocada_en is null and (caduca_en is null or caduca_en>now()) returning id`;
            if (!nueva)
                throw new ErrorInforme('ESTADO_CAMBIADO', 'La ejecución cambió.', 409);
            return nueva;
        });
    }
    async validarAudienciaEjecucion(e: EjecucionInforme) {
        const c = e.definicion_snapshot.configuracion;
        const propietario = await this.identidad(e.propietario_id);
        autorizarAmbitoInforme(propietario, c);
        if (distribuye(c, propietario.id))
            exigirDistribucion(propietario);
        for (const rec of await this.sql `select usuario_id,origenes from informes_receptores where ejecucion_id=${e.id} and usuario_id<>${e.propietario_id} and excluido_codigo is null and revocado_en is null`) {
            try {
                autorizarAmbitoInforme(await this.identidad(rec.usuario_id), c);
                if (!await origenVigente(this.sql, e.id, rec.usuario_id, e.propietario_id, rec.origenes as OrigenReceptor[]))
                    throw new ErrorInforme('PERMISO_RETIRADO', 'El grupo ya no concede acceso.', 403);
            }
            catch (error) {
                if (!(error instanceof ErrorInforme) || error.status === 503)
                    throw error;
                await this.sql `update informes_receptores set excluido_codigo='PERMISO_RETIRADO',revocado_en=now() where ejecucion_id=${e.id} and usuario_id=${rec.usuario_id}`;
            }
        }
    }
    async reclamar(): Promise<EjecucionInforme | null> {
        return this.transaccion(async (r) => {
            const vencidas = await r.sql `select id,intento_actual,lease_token from informes_ejecuciones where estado='en_curso' and lease_hasta<=now() order by creado_en for update skip locked limit 20`;
            for (const e of vencidas) {
                await r.sql `update informes_intentos set estado='interrumpida',terminado_en=now(),error_codigo='LEASE_VENCIDO',error_mensaje='El trabajador perdió su lease.' where ejecucion_id=${e.id} and token=${e.lease_token} and estado='en_curso'`;
                await r.sql `update informes_ejecuciones set estado='fallida',lease_token=null,lease_hasta=null,error_codigo='LEASE_VENCIDO',error_mensaje='El trabajador perdió su lease.',reintentar_desde=case when intento_actual<3 then now()+case when intento_actual=1 then interval '30 seconds' else interval '120 seconds' end else null end where id=${e.id}`;
            }
            const [e] = await r.sql `select * from informes_ejecuciones where (estado='pendiente' or (estado='fallida' and reintentar_desde is not null and reintentar_desde<=now())) and intento_actual<3 and revocada_en is null and (caduca_en is null or caduca_en>now()) order by creado_en,id for update skip locked limit 1`;
            if (!e)
                return null;
            const token = randomUUID();
            const [actual] = await r.sql `update informes_ejecuciones set estado='en_curso',intento_actual=intento_actual+1,lease_token=${token},lease_hasta=now()+interval '90 seconds',reintentar_desde=null,error_codigo=null,error_mensaje=null where id=${e.id} returning *`;
            await r.sql `insert into informes_intentos(ejecucion_id,numero,token,estado) values (${e.id},${actual.intento_actual},${token},'en_curso')`;
            return actual as EjecucionInforme;
        });
    }
    async renovar(e: EjecucionInforme) {
        const [r] = await this.sql `update informes_ejecuciones e set lease_hasta=now()+interval '90 seconds' where id=${e.id} and lease_token=${e.lease_token} and estado='en_curso' and lease_hasta>now() and exists(select 1 from informes_intentos i where i.ejecucion_id=e.id and i.token=${e.lease_token} and i.estado='en_curso' and i.iniciado_en>now()-interval '300 seconds') returning id`;
        if (!r)
            throw new ErrorInforme('LEASE_VENCIDO', 'La tentativa ha perdido su autorización de escritura.', 409);
        await this.sql `update informes_intentos set latido_en=now() where ejecucion_id=${e.id} and token=${e.lease_token} and estado='en_curso'`;
    }
    async lease(e: EjecucionInforme) {
        const [v] = await this.sql `select id from informes_ejecuciones where id=${e.id} and lease_token=${e.lease_token} and estado='en_curso' and lease_hasta>now() and revocada_en is null for update`;
        if (!v)
            throw new ErrorInforme('LEASE_VENCIDO', 'La tentativa ya no puede escribir.', 409);
        const [i] = await this.sql `select numero from informes_intentos where ejecucion_id=${e.id} and token=${e.lease_token} and estado='en_curso' and iniciado_en>now()-interval '300 seconds'`;
        if (!i)
            throw new ErrorInforme('LEASE_VENCIDO', 'La tentativa agotó su tiempo.', 409);
    }
    async purgar() {
        const caducadas = await this.sql `select e.id from informes_ejecuciones e where e.caduca_en<=now() and (e.snapshot is not null or exists(select 1 from informes_archivos a where a.ejecucion_id=e.id)) order by e.caduca_en,e.id for update skip locked limit 100`;
        const ids = caducadas.map(e => e.id);
        if (!ids.length)
            return 0;
        await this.sql `update informes_intentos set estado='interrumpida',terminado_en=now(),error_codigo='LEASE_VENCIDO' where estado='en_curso' and ejecucion_id in ${this.sql(ids)}`;
        await this.sql `delete from informes_archivos where ejecucion_id in ${this.sql(ids)}`;
        await this.sql `update informes_ejecuciones set estado='caducada',snapshot=null,snapshot_expurgado_en=coalesce(snapshot_expurgado_en,now()),lease_token=null,lease_hasta=null,reintentar_desde=null where id in ${this.sql(ids)} and snapshot is not null`;
        return ids.length;
    }
    async cuota(propietarioId: string, adicional: number) {
        await this.sql `select pg_advisory_xact_lock(728303)`;
        await this.purgar();
        const [q] = await this.sql `select coalesce(sum(octet_length(snapshot::text)),0)::bigint as snapshots,coalesce(sum(octet_length(snapshot::text)) filter(where propietario_id=${propietarioId}),0)::bigint as propios from informes_ejecuciones where snapshot is not null`;
        const [a] = await this.sql `select coalesce(sum(a.bytes),0)::bigint as archivos,coalesce(sum(a.bytes) filter(where e.propietario_id=${propietarioId}),0)::bigint as propios from informes_archivos a join informes_ejecuciones e on e.id=a.ejecucion_id`;
        if (Number(q.snapshots) + Number(a.archivos) + adicional > LIMITES.global || Number(q.propios) + Number(a.propios) + adicional > LIMITES.propietario)
            throw new ErrorInforme('CUOTA_EXCEDIDA', 'Se ha alcanzado la cuota de conservación de informes.', 429);
    }
    async persistirCaptura(e: EjecucionInforme, snapshot: SnapshotInforme, hash: string) {
        await this.transaccion(async (r) => {
            await r.lease(e);
            await r.validarAudienciaEjecucion(e);
            if (sha256(serializarCanonico(snapshot)) !== hash)
                throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'Integridad de captura inválida.', 503);
            const [tamano] = await r.sql `select octet_length(${r.sql.json(snapshot as never)}::jsonb::text)::int as bytes`;
            await r.cuota(e.propietario_id, tamano.bytes);
            const [actual] = await r.sql `update informes_ejecuciones set snapshot=${r.sql.json(snapshot as never)},snapshot_sha256=${hash},observado_en=${snapshot.observadoEn},caduca_en=now()+interval '30 days' where id=${e.id} and snapshot_sha256 is null and lease_token=${e.lease_token} returning id`;
            if (!actual)
                throw new ErrorInforme('ESTADO_CAMBIADO', 'La captura ya estaba conservada.', 409);
        });
    }
    async publicar(e: EjecucionInforme, archivos: ArchivoInforme[], manifiesto: ManifiestoInforme) {
        await this.transaccion(async (r) => {
            await r.lease(e);
            await r.validarAudienciaEjecucion(e);
            const [captura] = await r.sql `select snapshot,snapshot_sha256,caduca_en from informes_ejecuciones where id=${e.id}`;
            if (!captura.snapshot || sha256(serializarCanonico(captura.snapshot)) !== captura.snapshot_sha256 || manifiesto.snapshotSha256 !== captura.snapshot_sha256)
                throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'La captura conservada no supera la comprobación de integridad.', 503);
            const esperados = e.definicion_snapshot.configuracion.formatos;
            if (archivos.length !== esperados.length || new Set(archivos.map(a => a.formato)).size !== esperados.length || archivos.some(a => !esperados.includes(a.formato) || a.mime !== MIME_INFORME[a.formato] || a.nombre !== `informe-${e.id}.${a.formato}` || a.bytes !== a.contenido.length || a.bytes < 1 || a.bytes > LIMITES.archivo || sha256(a.contenido) !== a.sha256) || serializarCanonico(manifiesto.archivos) !== serializarCanonico(archivos.map(metadatosArchivo)))
                throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'El conjunto de archivos está incompleto o no es íntegro.', 503);
            const bytes = archivos.reduce((n, a) => n + a.bytes, 0);
            if (bytes > LIMITES.ejecucion)
                throw new ErrorInforme('LIMITE_EXCEDIDO', 'La ejecución supera cincuenta MiB.', 413);
            await r.cuota(e.propietario_id, bytes);
            await r.lease(e);
            for (const a of archivos)
                await r.sql `insert into informes_archivos(id,ejecucion_id,formato,nombre,mime,contenido,sha256) values (${a.id},${e.id},${a.formato},${a.nombre},${a.mime},${Buffer.from(a.contenido)},${a.sha256})`;
            await r.sql `update informes_ejecuciones set estado='correcta',manifiesto=${r.sql.json(manifiesto as never)},terminado_en=now(),lease_token=null,lease_hasta=null,error_codigo=null,error_mensaje=null where id=${e.id} and lease_token=${e.lease_token}`;
            await r.sql `update informes_intentos set estado='correcta',terminado_en=now() where ejecucion_id=${e.id} and token=${e.lease_token} and estado='en_curso'`;
        });
    }
    async fallar(e: EjecucionInforme, error: ErrorInforme) {
        await this.transaccion(async (r) => {
            const [v] = await r.sql `select id from informes_ejecuciones where id=${e.id} and estado='en_curso' and lease_token=${e.lease_token} and lease_hasta>now() for update`;
            if (!v)
                return;
            const bloqueada = ['PERMISO_RETIRADO', 'USUARIO_NO_DISPONIBLE', 'VERSION_NO_SOPORTADA', 'AMBITO_CAMBIADO'].includes(error.codigo);
            await r.sql `update informes_intentos set estado=${bloqueada ? 'bloqueada' : 'fallida'},terminado_en=now(),error_codigo=${error.codigo},error_mensaje=${error.message} where ejecucion_id=${e.id} and token=${e.lease_token} and estado='en_curso'`;
            await r.sql `update informes_ejecuciones set estado=${bloqueada ? 'bloqueada' : 'fallida'},lease_token=null,lease_hasta=null,error_codigo=${error.codigo},error_mensaje=${error.message},reintentar_desde=case when ${error.transitorio} and intento_actual<3 then now()+case when intento_actual=1 then interval '30 seconds' else interval '120 seconds' end else null end where id=${e.id} and lease_token=${e.lease_token}`;
        });
    }
    async planificar() {
        let creadas = 0;
        const programaciones = await this.sql `select p.id,d.propietario_id from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where p.activa and p.proxima_utc<=now() and d.archivada_en is null order by p.proxima_utc,p.id limit 50`;
        for (const p of programaciones) {
            if (creadas >= 50)
                break;
            creadas += await this.transaccion(async (r) => {
                await r.bloquearPropietario(p.propietario_id);
                const [prog] = await r.sql `select p.*,d.propietario_id,d.nombre,d.version as def_version,d.configuracion,d.archivada_en from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where p.id=${p.id} and p.activa and d.archivada_en is null for update of p`;
                if (!prog)
                    return 0;
                const [{ ahora }] = await r.sql `select clock_timestamp() as ahora`;
                let proxima = prog.proxima_utc ? new Date(prog.proxima_utc) : null;
                let n = 0;
                while (proxima && +proxima <= +new Date(ahora) && n < 10 && creadas + n < 50) {
                    const [{ cola }] = await r.sql `select count(*)::int as cola from informes_ejecuciones where propietario_id=${p.propietario_id} and estado in ('pendiente','en_curso')`;
                    if (cola >= 5)
                        break;
                    const d: DefinicionInforme = { id: prog.definicion_id, propietario_id: prog.propietario_id, nombre: prog.nombre, version: prog.def_version, configuracion: entrada(configuracionSchema, prog.configuracion), archivada_en: prog.archivada_en };
                    try {
                        await r.insertarEjecucion(d, proxima, null, { id: prog.id, version: prog.version }, false);
                    }
                    catch (error) {
                        if (error instanceof ErrorInforme && [401, 403].includes(error.status)) { // Conservar la ocurrencia bloqueada sin leer contenido.
                            const def: DefinicionCongelada = { id: d.id, nombre: d.nombre, version: d.version, propietarioId: d.propietario_id, configuracion: d.configuracion, programacion: { id: prog.id, version: prog.version }, versionGenerador: GENERADOR };
                            const [e] = await r.sql `insert into informes_ejecuciones(definicion_id,propietario_id,programacion_id,ocurrencia_utc,definicion_snapshot,definicion_sha256,periodo_resuelto,estado,error_codigo,error_mensaje) values (${d.id},${d.propietario_id},${prog.id},${proxima.toISOString()},${r.sql.json(def as never)},${sha256(serializarCanonico(def))},${r.sql.json(resolverPeriodo(d.configuracion.periodo, proxima))},'bloqueada',${error.codigo},${error.message}) on conflict do nothing returning id`;
                            if (e)
                                await r.sql `insert into informes_receptores(ejecucion_id,usuario_id,origenes) values (${e.id},${d.propietario_id},${r.sql.json([{ tipo: 'propietario' }])})`;
                        }
                        else
                            throw error;
                    }
                    n++;
                    const siguiente = proximasOcurrencias(prog.calendario as CalendarioInforme, proxima, 1);
                    proxima = siguiente.ocurrencias[0] ? new Date(siguiente.ocurrencias[0].utc) : null;
                    await r.sql `update informes_programaciones set proxima_utc=${proxima},ultima_omision=${r.sql.json(siguiente.omisiones)},actualizado_en=now() where id=${prog.id}`;
                }
                return n;
            });
        }
        return creadas;
    }
    async descargar(id: string, archivoId: string, usuarioId: string) {
        const e = await this.accesoEjecucion(id, usuarioId);
        if (e.estado === 'caducada' || e.caduca_en && +new Date(e.caduca_en) <= Date.now())
            throw new ErrorInforme('CADUCADO', 'El archivo ha caducado.', 410);
        if (e.estado !== 'correcta' || !e.manifiesto)
            throw new ErrorInforme('ESTADO_CAMBIADO', 'El resultado todavía no está disponible.', 409);
        if (archivoId === 'manifiesto') {
            return { contenido: Buffer.from(serializarCanonico(e.manifiesto)), mime: 'application/json; charset=utf-8', nombre: `informe-${id}.json`, sha256: sha256(serializarCanonico(e.manifiesto)), revision: e.manifiesto.revision };
        }
        const declarado = e.manifiesto.archivos.find(a => a.id === archivoId);
        if (!declarado)
            throw new ErrorInforme('NO_ENCONTRADO', 'Archivo no encontrado.', 404);
        const [a] = await this.sql `select contenido,bytes,sha256,formato,mime,nombre from informes_archivos where id=${archivoId} and ejecucion_id=${id}`;
        if (!a || a.formato !== declarado.formato || a.mime !== declarado.mime || a.nombre !== `informe-${id}.${declarado.formato}` || a.bytes !== declarado.bytes || a.sha256 !== declarado.sha256 || sha256(a.contenido) !== a.sha256) {
            await this.sql `update informes_ejecuciones set error_codigo='ARCHIVO_INTEGRO_NO_DISPONIBLE',error_mensaje='Se detectó un incidente de integridad del archivo.' where id=${id}`;
            throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'El archivo no supera la comprobación de integridad.', 503);
        }
        return { contenido: a.contenido as Uint8Array, mime: MIME_INFORME[a.formato as keyof typeof MIME_INFORME], nombre: `informe-${id}.${a.formato}`, sha256: a.sha256 as string, revision: e.manifiesto.revision };
    }
    async estadoRunner(usuarioId: string) {
        await this.identidad(usuarioId);
        const permitidas = (await this.definiciones(usuarioId)).map(d => d.id);
        const ids = permitidas.length ? permitidas : ['00000000-0000-0000-0000-000000000000'];
        // Un proceso continuo se busca por separado: diez pasadas manuales no lo ocultan.
        const [continuo] = await this.sql `select id,modo,version,iniciado_en,latido_en,detenido_en from informes_runner_latidos where modo='continuo' order by latido_en desc limit 1`;
        const [manual] = await this.sql `select id,modo,version,iniciado_en,latido_en,detenido_en from informes_runner_latidos where modo='manual' order by latido_en desc limit 1`;
        const activo = continuo && !continuo.detenido_en && Date.now() - +new Date(continuo.latido_en) <= 45000;
        const [cola] = await this.sql `select count(*) filter(where estado='pendiente')::int as pendientes,count(*) filter(where estado='en_curso')::int as en_curso from informes_ejecuciones where propietario_id=${usuarioId} and definicion_id in ${this.sql(ids)}`;
        const progs = await this.sql `select p.id,p.proxima_utc,p.activa,p.calendario,p.ultima_omision from informes_programaciones p join informes_definiciones d on d.id=p.definicion_id where d.propietario_id=${usuarioId} and d.id in ${this.sql(ids)} order by p.proxima_utc nulls last`;
        const [ultimoError] = await this.sql `select id,error_codigo,error_mensaje,ocurrencia_utc from informes_ejecuciones where propietario_id=${usuarioId} and definicion_id in ${this.sql(ids)} and error_codigo is not null order by ocurrencia_utc desc,id desc limit 1`;
        const ahora = new Date();
        const programaciones = progs.map(p => {
            let cursor = p.proxima_utc ? new Date(p.proxima_utc) : null;
            let atraso = 0;
            while (p.activa && cursor && +cursor <= +ahora && atraso < 10000) {
                atraso++;
                const siguiente = proximasOcurrencias(p.calendario as CalendarioInforme, cursor, 1).ocurrencias[0];
                cursor = siguiente ? new Date(siguiente.utc) : null;
            }
            return { id: p.id, proxima_utc: p.proxima_utc, activa: p.activa, ultima_omision: p.ultima_omision, atraso, atrasoAcotado: atraso === 10000 };
        });
        return { estado: activo ? 'Runner activo' : continuo ? 'Runner detenido' : 'Sin runner', continuo: continuo ?? null, ultimaPasadaManual: manual ?? null, cola, programaciones, ultimoError: ultimoError ?? null, entregaExterna: 'entrega_externa_no_configurada', schedulerDesplegado: false };
    }
    async iniciarRunner(modo: 'manual' | 'continuo') {
        const id = randomUUID();
        await this.sql `insert into informes_runner_latidos(id,modo,version) values (${id},${modo},${GENERADOR})`;
        return id;
    }
    async latidoRunner(id: string) {
        await this.sql `update informes_runner_latidos set latido_en=now() where id=${id} and detenido_en is null`;
    }
    async detenerRunner(id: string) {
        await this.sql `update informes_runner_latidos set detenido_en=now(),latido_en=now() where id=${id}`;
    }
}
