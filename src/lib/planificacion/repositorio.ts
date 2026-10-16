import type postgres from 'postgres';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { autorPlan, exigirPlan, veSalas, veCatalogo, type ConexionPlan, type AutorPlan } from './autorizacion';
import { ErrorPlan, LIMITES_PLAN, entradaPlan, uuidPlan, trabajoSchema, reglaSchema, selectorSchema, manualSchema, editarTareaSchema, asignacionSchema, seleccionSchema, confirmarSchema, filtroAgendaSchema, canonico, type Trabajo, type Regla, type TareaPlan, type SeleccionPlan, type EntradaManual, type EdicionTarea, type BaseGenerada, type TareaAgenda, type FiltroAgenda } from './modelo';
import { hashPlan, generarCandidatas, tipoPrivado } from './reglas';
import { leerFuentes, salasDeObra } from './fuentes';
import { compararPlan } from './diff';
import { fechaPlan, intervaloPlan } from './fechas';
import { resumirAgenda, periodosAgenda } from './agenda';
const json = (c: ConexionPlan, valor: unknown) => c.json(valor as postgres.JSONValue);
const fecha = (valor: unknown): string | null => valor == null ? null : valor instanceof Date ? valor.toISOString() : String(valor);
const id = (valor: string) => entradaPlan(uuidPlan, valor);
const diferencia = (a: unknown, b: unknown) => canonico(a) !== canonico(b);
class ConjuntoCambio extends Error {
}
interface EventoNuevo {
    tareaId: string | null;
    tipo: string;
    antes: unknown;
    despues: unknown;
    catalogo?: unknown;
    antecedenteId?: string;
    motivo?: string;
}
interface ResultadoOperacion {
    resultado: Record<string, unknown>;
    eventos: EventoNuevo[];
    cambio: boolean;
    fuenteId?: string;
}
interface PlanBloqueado {
    id: string;
    proyectoId: string;
    version: number;
    archivado: boolean;
}
interface ContextoEscritura {
    c: ConexionPlan;
    autor: AutorPlan;
    plan: PlanBloqueado | null;
    proyecto: {
        id: string;
        nombre: string;
    };
    salaIds: string[];
}
export class RepositorioPlanificacion {
    constructor(public conexion: ConexionPlan, private opciones: {
        secreto?: string;
        ahora?: () => Date;
    } = {}) {
    }
    private ahora() {
        return this.opciones.ahora?.() ?? new Date();
    }
    private secreto() {
        const s = this.opciones.secreto ?? process.env['SESION_SECRETO'];
        if (!s)
            throw new ErrorPlan('SERVICIO_NO_DISPONIBLE', 'No se puede confirmar una preparación sin configuración de sesión.', 503);
        return s;
    }
    async identidad(usuarioId: string) {
        return autorPlan(this.conexion, usuarioId);
    }
    private async obra(c: ConexionPlan, proyectoId: string, bloquear = false) {
        id(proyectoId);
        const filas = bloquear ? await c `select id,nombre from proyectos where id=${proyectoId} for update` : await c `select id,nombre from proyectos where id=${proyectoId}`;
        if (!filas[0])
            throw new ErrorPlan('NO_ENCONTRADO', 'La obra no existe.', 404);
        return { id: String(filas[0].id), nombre: String(filas[0].nombre) };
    }
    private async cerrado(c: ConexionPlan, proyectoId: string) {
        return (await c `select 1 from hitos_proyecto where proyecto_id=${proyectoId} and tipo='cierre'`).length > 0;
    }
    private async escritura<T>(usuarioId: string, proyectoId: string, salas: string[], accion: (ctx: ContextoEscritura) => Promise<T>, todas = false, historica = false): Promise<T> {
        for (let intento = 0; intento < 3; intento++) {
            try {
                return await this.conexion.begin(async (tx) => {
                    const c = tx as unknown as ConexionPlan;
                    const autor = await autorPlan(c, usuarioId);
                    exigirPlan(autor, true, salas.length > 0 || todas);
                    const previas = todas ? (await salasDeObra(c, proyectoId)).map(s => s.id) : [...new Set(salas)].sort();
                    if (previas.length > LIMITES_PLAN.salas)
                        throw new ErrorPlan('LIMITE_EXCEDIDO', 'Selecciona como máximo 500 salas.', 413);
                    if (previas.length)
                        await c `select id from salas where id=any(${previas}::uuid[]) order by id for update`;
                    const proyecto = await this.obra(c, proyectoId, true);
                    if (todas && canonico(previas) !== canonico((await salasDeObra(c, proyectoId)).map(s => s.id)))
                        throw new ConjuntoCambio();
                    if (previas.length) {
                        const propias = await c `select s.id from salas s join localizaciones l on l.id=s.localizacion_id where s.id=any(${previas}::uuid[]) and l.proyecto_id=${proyectoId} order by s.id`;
                        if (!historica && propias.length !== previas.length)
                            throw new ErrorPlan('SALA_AJENA', 'Una sala dejó de pertenecer a esta obra. Revisa el plan.', 409);
                    }
                    if (await this.cerrado(c, proyectoId))
                        throw new ErrorPlan('OBRA_CERRADA', 'La obra está cerrada. Su planificación es de consulta.', 409);
                    const [p] = await c `select id,version,archivado_en from planes where proyecto_id=${proyectoId} for update`;
                    const plan = p ? { id: String(p.id), proyectoId, version: Number(p.version), archivado: !!p.archivado_en } : null;
                    return accion({ c, autor, plan, proyecto, salaIds: previas });
                }) as T;
            }
            catch (error) {
                if (error instanceof ConjuntoCambio && intento < 2)
                    continue;
                if (error instanceof ConjuntoCambio)
                    throw new ErrorPlan('CONJUNTO_CAMBIADO', 'Las salas cambiaron durante la operación. Revisa de nuevo.', 409);
                throw error;
            }
        }
        throw new ErrorPlan('CONJUNTO_CAMBIADO', 'No se pudo estabilizar el conjunto de salas.', 409);
    }
    private exigirVersion(plan: PlanBloqueado | null, version: number, permitirArchivado = false): asserts plan is PlanBloqueado {
        if (!plan)
            throw new ErrorPlan('NO_ENCONTRADO', 'Crea explícitamente el plan antes de añadir tareas.', 404);
        if (plan.version !== version)
            throw new ErrorPlan('VERSION_CAMBIADA', 'El plan cambió. Recarga y compara sin perder tu edición.', 409);
        if (plan.archivado && !permitirArchivado)
            throw new ErrorPlan('PLAN_ARCHIVADO', 'Reactiva el plan antes de editar tareas.', 409);
    }
    private async operacion(ctx: ContextoEscritura, clave: string, payload: unknown, tipo: string, version: number, accion: () => Promise<ResultadoOperacion>, motivo?: string, permitirArchivado = false): Promise<Record<string, unknown>> {
        const { c, plan, autor } = ctx;
        if (!plan)
            throw new ErrorPlan('NO_ENCONTRADO', 'El plan no existe.', 404);
        id(clave);
        const hash = hashPlan(payload);
        const [existente] = await c `select hash_peticion,resumen from plan_operaciones where plan_id=${plan.id} and clave_peticion=${clave}`;
        if (existente) {
            if (existente.hash_peticion !== hash)
                throw new ErrorPlan('IDEMPOTENCIA_CAMBIADA', 'La misma clave de petición ya se usó con otro contenido.', 409);
            return existente.resumen as Record<string, unknown>;
        }
        this.exigirVersion(plan, version, permitirArchivado);
        const r = await accion();
        const siguiente = plan.version + (r.cambio ? 1 : 0), operacionId = randomUUID();
        const resultado = { ...r.resultado, versionPlan: siguiente, operacionId };
        await c `insert into plan_operaciones(id,plan_id,clave_peticion,hash_peticion,tipo,version_antes,version_despues,fuente_id,autor_id,motivo,resumen) values(${operacionId},${plan.id},${clave},${hash},${tipo},${plan.version},${siguiente},${r.fuenteId ?? null},${autor.id},${motivo ?? null},${json(c, resultado)})`;
        if (r.cambio)
            await c `update planes set version=${siguiente},actualizado_en=now() where id=${plan.id}`;
        let orden = 0;
        for (const e of r.eventos)
            await c `insert into plan_eventos(plan_id,tarea_id,operacion_id,version_plan,orden,tipo,autor_id,antecedente_id,motivo,antes,despues,catalogo) values(${plan.id},${e.tareaId},${operacionId},${siguiente},${orden++},${e.tipo},${autor.id},${e.antecedenteId ?? null},${e.motivo ?? motivo ?? null},${json(c, e.antes)},${json(c, e.despues)},${json(c, e.catalogo ?? {})})`;
        return resultado;
    }
    async crearPlan(usuarioId: string, proyectoId: string, clavePeticion: string) {
        return this.escritura(usuarioId, proyectoId, [], async (ctx) => {
            if (ctx.plan) {
                const [op] = await ctx.c `select resumen from plan_operaciones where plan_id=${ctx.plan.id} and clave_peticion=${id(clavePeticion)} and tipo='crear_plan'`;
                if (op)
                    return op.resumen;
                throw new ErrorPlan('PLAN_EXISTENTE', 'La obra ya tiene un plan.', 409);
            }
            const planId = randomUUID();
            await ctx.c `insert into planes(id,proyecto_id,creado_por) values(${planId},${proyectoId},${ctx.autor.id})`;
            ctx.plan = { id: planId, proyectoId, version: 0, archivado: false };
            return this.operacion(ctx, clavePeticion, { proyectoId }, 'crear_plan', 0, async () => ({ resultado: { id: planId }, eventos: [{ tareaId: null, tipo: 'crear_plan', antes: null, despues: { id: planId, proyectoId } }], cambio: true }));
        });
    }
    async leerPlan(usuarioId: string, proyectoId: string) {
        return this.conexion.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPlan, u = await autorPlan(c, usuarioId), proyecto = await this.obra(c, proyectoId);
            const [p] = await c `select id,version,notas,archivado_en,creado_en from planes where proyecto_id=${proyectoId}`;
            const salas = veSalas(u) ? await salasDeObra(c, proyectoId) : [];
            const todasTareas = p ? await this.tareasEn(c, u, p.id) : [];
            const revisiones = veSalas(u) && salas.length ? await c<{
                id: string;
                sala_id: string;
                numero: number;
                nombre: string;
                hash: string;
                diseno_version: number;
            }[]> `select id,sala_id,numero,nombre,hash,diseno_version from revisiones_diseno where sala_id=any(${salas.map(s => s.id)}::uuid[]) order by sala_id,numero desc` : [];
            return { proyecto, cerrado: await this.cerrado(c, proyectoId), plan: p ? { id: p.id, version: Number(p.version), notas: p.notas, archivado: !!p.archivado_en } : null, tareas: todasTareas.slice(0, 50), totalTareas: todasTareas.length, salas, revisiones, puedeEditar: u.permisos.proyectos === 'editar', puedeSalas: veSalas(u), puedeCatalogo: veCatalogo(u), alcance: veSalas(u) ? 'Obra y salas' : 'Sólo tareas generales de obra; salas no autorizadas' };
        });
    }
    private async tareasEn(c: ConexionPlan, u: AutorPlan, planId?: string, tareaId?: string): Promise<TareaPlan[]> {
        const publico = `t.id,t.plan_id,t.sala_id,t.trabajo_id,t.regla_id,t.clave_origen,t.fuente_id,t.origen_publico,t.base_generada,t.titulo,t.descripcion,t.notas,t.duracion_estimada_min,t.estado,t.vence_fecha,t.inicio_utc,t.fin_utc,t.version,p.version version_plan,p.archivado_en,p.proyecto_id,o.nombre proyecto_nombre`;
        const privado = veCatalogo(u) ? ',t.origen_catalogo' : '';
        const jerarquia = veSalas(u) ? `,s.nombre sala_nombre,(t.sala_id is not null and (l.proyecto_id is distinct from p.proyecto_id or (t.clave_origen is not null and s.diseno_version::text is distinct from t.origen_publico->>'actualVersion'))) desactualizada` : `,null::text sala_nombre,false desactualizada`;
        const joins = veSalas(u) ? 'left join salas s on s.id=t.sala_id left join localizaciones l on l.id=s.localizacion_id' : '';
        const filas = await c.unsafe(`select ${publico}${privado}${jerarquia} from plan_tareas t join planes p on p.id=t.plan_id join proyectos o on o.id=p.proyecto_id ${joins} where ($1::uuid is null or t.plan_id=$1) and ($2::uuid is null or t.id=$2) ${veSalas(u) ? '' : 'and t.sala_id is null'} order by t.creado_en,t.id limit 10001`, [planId ?? null, tareaId ?? null]);
        if (filas.length > 10000 || planId && filas.length > LIMITES_PLAN.tareas)
            throw new ErrorPlan('LIMITE_EXCEDIDO', 'Reduce el ámbito de consulta de tareas.', 413);
        const asignados = filas.length ? await c `select a.tarea_id,t.id,t.nombre,t.activo from plan_asignaciones a join tecnicos t on t.id=a.tecnico_id where a.activo and a.tarea_id=any(${filas.map(f => f.id)}::uuid[]) order by t.id` : [];
        return filas.map(f => ({ id: String(f.id), planId: String(f.plan_id), proyectoId: String(f.proyecto_id), proyectoNombre: String(f.proyecto_nombre), salaId: f.sala_id ? String(f.sala_id) : null, salaNombre: f.sala_nombre ?? null, trabajoId: f.trabajo_id ?? null, reglaId: f.regla_id ?? null, claveOrigen: f.clave_origen ?? null, fuenteId: f.fuente_id ?? null, origenPublico: f.origen_publico ?? {}, ...(veCatalogo(u) ? { origenCatalogo: f.origen_catalogo ?? {} } : {}), baseGenerada: f.base_generada ?? null, titulo: String(f.titulo), descripcion: String(f.descripcion), notas: String(f.notas), duracionEstimadaMin: f.duracion_estimada_min == null ? null : Number(f.duracion_estimada_min), estado: f.estado, venceFecha: f.vence_fecha ? fecha(f.vence_fecha)!.slice(0, 10) : null, inicio: fecha(f.inicio_utc), fin: fecha(f.fin_utc), version: Number(f.version), versionPlan: Number(f.version_plan), tecnicos: asignados.filter(a => a.tarea_id === f.id).map(a => ({ id: a.id, nombre: a.nombre, activo: a.activo })), archivado: !!f.archivado_en, desactualizada: !!f.desactualizada }));
    }
    async tarea(usuarioId: string, tareaId: string) {
        const u = await autorPlan(this.conexion, usuarioId);
        id(tareaId);
        const tareas = await this.tareasEn(this.conexion, u, undefined, tareaId);
        if (!tareas[0])
            throw new ErrorPlan('NO_ENCONTRADO', 'Tarea no disponible.', 404);
        return tareas[0];
    }
    async agenda(usuarioId: string, filtros: FiltroAgenda, ahora = this.ahora()) {
        return this.conexion.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPlan;
            return this.agendaEnLectura(c, usuarioId, filtros, ahora);
        });
    }
    async listadoObras(usuarioId: string) {
        const u = await this.identidad(usuarioId);
        exigirPlan(u);
        return this.conexion<{
            id: string;
            nombre: string;
            codigo: string | null;
        }[]> `select id,nombre,codigo from proyectos order by nombre,id limit 501`;
    }
    async catalogo(usuarioId: string, q = '', pagina = 1, administracion = false) {
        await this.identidad(usuarioId);
        if (q.length > 200)
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Búsqueda demasiado larga.');
        if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000)
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Página inválida.');
        const tamano = administracion ? LIMITES_PLAN.pagina : LIMITES_PLAN.busqueda;
        const filas = await this.conexion `select id,titulo,descripcion,duracion_estimada_min,activo,version from catalogo_tareas where titulo ilike ${'%' + q.replace(/[\\%_]/g, '\\$&') + '%'} order by titulo,id limit ${tamano} offset ${(pagina - 1) * tamano}`;
        return filas.map(f => ({ id: f.id, titulo: f.titulo, descripcion: f.descripcion, duracionEstimadaMin: f.duracion_estimada_min == null ? null : Number(f.duracion_estimada_min), activo: f.activo, version: Number(f.version) }));
    }
    async trabajo(usuarioId: string, trabajoId: string): Promise<Trabajo> {
        await this.identidad(usuarioId);
        id(trabajoId);
        const [f] = await this.conexion `select id,titulo,descripcion,duracion_estimada_min,activo,version from catalogo_tareas where id=${trabajoId}`;
        if (!f)
            throw new ErrorPlan('NO_ENCONTRADO', 'Trabajo no encontrado.', 404);
        return { id: f.id, titulo: f.titulo, descripcion: f.descripcion, duracionEstimadaMin: f.duracion_estimada_min == null ? null : Number(f.duracion_estimada_min), activo: f.activo, version: Number(f.version) };
    }
    async guardarTrabajo(usuarioId: string, valor: unknown, trabajoId?: string, version?: number) {
        const trabajo = entradaPlan(trabajoSchema, valor);
        if (trabajoId)
            id(trabajoId);
        return this.conexion.begin(async (tx) => {
            const c = tx as unknown as ConexionPlan, u = await autorPlan(c, usuarioId);
            exigirPlan(u, true);
            if (trabajoId) {
                const [t] = await c `select version from catalogo_tareas where id=${trabajoId} for update`;
                if (!t)
                    throw new ErrorPlan('NO_ENCONTRADO', 'Trabajo no encontrado.', 404);
                if (Number(t.version) !== version)
                    throw new ErrorPlan('VERSION_CAMBIADA', 'El trabajo cambió.', 409);
                await c `update catalogo_tareas set titulo=${trabajo.titulo},descripcion=${trabajo.descripcion},duracion_estimada_min=${trabajo.duracionEstimadaMin},activo=${trabajo.activo},version=version+1,actualizado_en=now() where id=${trabajoId}`;
                return { id: trabajoId, version: version! + 1 };
            }
            const [t] = await c `insert into catalogo_tareas(titulo,descripcion,duracion_estimada_min,activo,creado_por) values(${trabajo.titulo},${trabajo.descripcion},${trabajo.duracionEstimadaMin},${trabajo.activo},${u.id}) returning id,version`;
            return { id: t.id, version: Number(t.version) };
        });
    }
    private async reglasEn(c: ConexionPlan, u: AutorPlan, ids?: string[], bloquear = false): Promise<Regla[]> {
        if (bloquear && ids?.length) {
            const trabajos = await c `select trabajo_id from reglas_plan where id=any(${ids}::uuid[]) order by trabajo_id`;
            await c `select id from catalogo_tareas where id=any(${trabajos.map(t => t.trabajo_id)}::uuid[]) order by id for update`;
            await c `select id from reglas_plan where id=any(${[...ids].sort()}::uuid[]) order by id for update`;
        }
        const filas = await c.unsafe(`select r.id,r.version,r.trabajo_id,r.selector,r.activo,t.titulo,t.descripcion,t.duracion_estimada_min,t.activo trabajo_activo,t.version trabajo_version from reglas_plan r join catalogo_tareas t on t.id=r.trabajo_id where ($1::uuid[] is null or r.id=any($1)) ${veSalas(u) ? '' : "and false"} ${veCatalogo(u) ? '' : "and r.selector->>'tipo' in ('sala','tipologia')"} order by r.id`, [ids ?? null]);
        if (ids && filas.length !== ids.length)
            throw new ErrorPlan('REGLA_NO_DISPONIBLE', 'Alguna regla no está disponible o requiere otros permisos.', 403);
        return filas.map(f => ({ id: f.id, version: Number(f.version), trabajoId: f.trabajo_id, selector: entradaPlan(selectorSchema, f.selector), activo: f.activo, trabajo: { id: f.trabajo_id, version: Number(f.trabajo_version), titulo: f.titulo, descripcion: f.descripcion, duracionEstimadaMin: f.duracion_estimada_min == null ? null : Number(f.duracion_estimada_min), activo: f.trabajo_activo } }));
    }
    async reglas(usuarioId: string, pagina = 1) {
        const u = await this.identidad(usuarioId);
        if (!Number.isInteger(pagina) || pagina < 1)
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Página inválida.');
        return (await this.reglasEn(this.conexion, u)).slice((pagina - 1) * 50, pagina * 50);
    }
    async regla(usuarioId: string, reglaId: string): Promise<Regla> {
        const u = await this.identidad(usuarioId);
        id(reglaId);
        return (await this.reglasEn(this.conexion, u, [reglaId]))[0];
    }
    async guardarRegla(usuarioId: string, valor: unknown, reglaId?: string, version?: number) {
        const r = entradaPlan(reglaSchema, valor);
        if (reglaId)
            id(reglaId);
        return this.conexion.begin(async (tx) => {
            const c = tx as unknown as ConexionPlan, u = await autorPlan(c, usuarioId);
            exigirPlan(u, true, true, tipoPrivado(r.selector));
            const [trabajo] = await c `select id from catalogo_tareas where id=${r.trabajoId} and activo for update`;
            if (!trabajo)
                throw new ErrorPlan('TRABAJO_INACTIVO', 'Elige un trabajo activo.', 409);
            const articuloId = 'articuloId' in r.selector ? r.selector.articuloId : 'articuloCableId' in r.selector ? r.selector.articuloCableId : undefined;
            if (articuloId) {
                const [a] = await c `select id,tipo,activo from articulos where id=${articuloId} for share`;
                if (!a || !a.activo || r.selector.tipo === 'equipo' && a.tipo !== 'equipo' || r.selector.tipo === 'conexion' && a.tipo !== 'cable')
                    throw new ErrorPlan('ARTICULO_INVALIDO', 'Elige una referencia activa y del tipo correspondiente.', 409);
            }
            if (reglaId) {
                const [a] = await c `select version,selector->>'tipo' tipo_origen from reglas_plan where id=${reglaId} for update`;
                if (!a)
                    throw new ErrorPlan('NO_ENCONTRADO', 'Regla no encontrada.', 404);
                if (!['sala', 'tipologia'].includes(a.tipo_origen))
                    exigirPlan(u, true, true, true);
                if (!['sala', 'tipologia', 'equipo', 'conexion', 'material_bom'].includes(a.tipo_origen))
                    throw new ErrorPlan('FUENTE_NO_SOPORTADA', 'El tipo de regla no está soportado.', 422);
                if (Number(a.version) !== version)
                    throw new ErrorPlan('VERSION_CAMBIADA', 'La regla cambió.', 409);
                await c `update reglas_plan set trabajo_id=${r.trabajoId},selector=${json(c, r.selector)},activo=${r.activo},version=version+1,actualizado_en=now() where id=${reglaId}`;
                return { id: reglaId, version: version! + 1 };
            }
            const [a] = await c `insert into reglas_plan(trabajo_id,selector,activo,creado_por) values(${r.trabajoId},${json(c, r.selector)},${r.activo},${u.id}) returning id,version`;
            return { id: a.id, version: Number(a.version) };
        });
    }
    private firmarToken(hash: string, seleccion: SeleccionPlan, usuarioId: string, proyectoId: string) {
        const cuerpo = Buffer.from(JSON.stringify({ hash, seleccion: hashPlan(seleccion), usuarioId, proyectoId, creadaEn: this.ahora().toISOString() })).toString('base64url');
        return cuerpo + '.' + createHmac('sha256', this.secreto()).update(cuerpo).digest('base64url');
    }
    private tokenValido(token: string, hash: string, seleccion: SeleccionPlan, usuarioId: string, proyectoId: string) {
        try {
            const [cuerpo, firma, ...extra] = token.split('.');
            if (extra.length || !cuerpo || !firma)
                throw new Error();
            const esperado = createHmac('sha256', this.secreto()).update(cuerpo).digest();
            const recibida = Buffer.from(firma, 'base64url');
            if (esperado.length !== recibida.length || !timingSafeEqual(esperado, recibida))
                throw new Error();
            const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
            const edad = +this.ahora() - Date.parse(p.creadaEn);
            if (p.hash !== hash || p.seleccion !== hashPlan(seleccion) || p.usuarioId !== usuarioId || p.proyectoId !== proyectoId || edad < 0 || edad > 600000)
                throw new Error();
        }
        catch {
            throw new ErrorPlan('PREVIEW_CAMBIADO', 'La preparación caducó o cambió. Vuelve a revisar las fuentes.', 409);
        }
    }
    private async prepararEn(c: ConexionPlan, u: AutorPlan, proyectoId: string, seleccion: SeleccionPlan, bloquear = false) {
        exigirPlan(u, false, true);
        await this.obra(c, proyectoId);
        const [plan] = await c `select id,version,archivado_en from planes where proyecto_id=${proyectoId}`;
        if ((plan ? Number(plan.version) : null) !== seleccion.versionPlan)
            throw new ErrorPlan('VERSION_CAMBIADA', 'El plan cambió desde la selección.', 409);
        if (plan?.archivado_en)
            throw new ErrorPlan('PLAN_ARCHIVADO', 'Reactiva el plan antes de preparar.', 409);
        const reglas = await this.reglasEn(c, u, seleccion.reglas, bloquear);
        if (reglas.some(r => !r.activo || !r.trabajo.activo))
            throw new ErrorPlan('REGLA_INACTIVA', 'Una regla o trabajo se desactivó. Revisa la selección.', 409);
        const fuentes = await leerFuentes(c, u, proyectoId, seleccion, reglas);
        const tareas = plan ? await this.tareasEn(c, u, plan.id) : [];
        const relevantes = tareas.filter(t => t.reglaId && seleccion.reglas.includes(t.reglaId) && fuentes.some(s => s.id === t.salaId));
        const candidatas = generarCandidatas(fuentes, reglas);
        const proyeccion = { versionModelo: 1, generador: 'rea04-1', proyectoId, seleccion, reglas, fuentes };
        if (Buffer.byteLength(canonico(proyeccion)) > LIMITES_PLAN.fuente)
            throw new ErrorPlan('LIMITE_EXCEDIDO', 'La proyección supera 10 MiB.', 413);
        const hash = hashPlan(proyeccion);
        return { hash, fuentes, reglas, candidatas, diff: compararPlan(candidatas, relevantes), proyeccion, anteriores: fuentes.filter(s => s.tipo === 'revision' && s.disenoVersion < s.actualVersion).map(s => s.id) };
    }
    async preparar(usuarioId: string, proyectoId: string, valor: unknown) {
        const seleccion = entradaPlan(seleccionSchema, valor);
        return this.conexion.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPlan, u = await autorPlan(c, usuarioId);
            const p = await this.prepararEn(c, u, proyectoId, seleccion);
            return { solicitudId: randomUUID(), hash: p.hash, token: this.firmarToken(p.hash, seleccion, usuarioId, proyectoId), leidaEn: this.ahora().toISOString(), seleccion, fuentes: p.fuentes.map(({ equipos, conexiones, material, ...s }) => ({ ...s, cantidades: { equipos: equipos.length, conexiones: conexiones.length, material: material.length } })), anteriores: p.anteriores, diff: p.diff };
        });
    }
    async confirmar(usuarioId: string, proyectoId: string, valor: unknown) {
        const b = entradaPlan(confirmarSchema, valor);
        return this.escritura(usuarioId, proyectoId, b.seleccion.salas.modo === 'seleccion' ? b.seleccion.salas.ids : [], async (ctx) => {
            exigirPlan(ctx.autor, true, true);
            await this.reglasEn(ctx.c, ctx.autor, b.seleccion.reglas);
            return this.operacion(ctx, b.clavePeticion, b, 'confirmar_fuente', b.seleccion.versionPlan ?? -1, async () => {
                const previa = await this.prepararEn(ctx.c, ctx.autor, proyectoId, b.seleccion);
                const tareaIds = previa.diff.filter(d => d.tarea && b.acciones.some(a => a.clave === d.clave)).map(d => d.tarea!.id).sort();
                if (tareaIds.length)
                    await ctx.c `select id from plan_tareas where id=any(${tareaIds}::uuid[]) order by id for update`;
                await this.reglasEn(ctx.c, ctx.autor, b.seleccion.reglas, true);
                const p = await this.prepararEn(ctx.c, ctx.autor, proyectoId, b.seleccion);
                this.tokenValido(b.token, p.hash, b.seleccion, usuarioId, proyectoId);
                if (p.anteriores.length && !b.aceptoFuenteAnterior)
                    throw new ErrorPlan('FUENTE_ANTERIOR', 'La revisión elegida es anterior. Confirma su aceptación explícita.', 409);
                const { c, plan, autor } = ctx;
                const planId = plan!.id;
                const [{ n }] = await c `select count(*)::int n from plan_tareas where plan_id=${planId}`;
                if (Number(n) + b.acciones.filter(a => a.accion === 'crear').length > LIMITES_PLAN.tareas)
                    throw new ErrorPlan('LIMITE_EXCEDIDO', 'El plan supera 5.000 tareas.', 413);
                const publico = { ...p.proyeccion, reglas: p.reglas.filter(r => !tipoPrivado(r.selector)), fuentes: p.fuentes.map(s => ({ id: s.id, nombre: s.nombre, tipologia: s.tipologia, localizacionId: s.localizacionId, proyectoId: s.proyectoId, disenoVersion: s.disenoVersion, actualVersion: s.actualVersion, tipo: s.tipo, revisionId: s.revisionId ?? null, hashE3: s.hashE3 ?? null })) };
                const [fuente] = await c `insert into plan_fuentes(plan_id,sha256,publico,catalogo,revisiones_e3,autor_id) values(${planId},${p.hash},${json(c, publico)},${json(c, { reglas: p.reglas, fuentes: p.fuentes })},${json(c, p.fuentes.filter(s => s.tipo === 'revision').map(s => ({ salaId: s.id, id: s.revisionId, hash: s.hashE3 })))},${autor.id}) on conflict(plan_id,sha256) do nothing returning id`;
                const fuenteId = fuente?.id ?? (await c `select id from plan_fuentes where plan_id=${planId} and sha256=${p.hash}`)[0].id;
                const eventos: EventoNuevo[] = [], tareas: string[] = [];
                for (const a of b.acciones) {
                    const d = p.diff.find(d => d.clave === a.clave);
                    if (!d)
                        throw new ErrorPlan('ACCION_INVALIDA', 'Una acción no pertenece al diff revisado.');
                    if (a.accion === 'crear') {
                        if (d.estado !== 'nueva' || a.versionTarea !== null || !d.candidata)
                            throw new ErrorPlan('VERSION_CAMBIADA', 'La candidata ya no es nueva.', 409);
                        const k = d.candidata, tareaId = randomUUID(), base: BaseGenerada = { titulo: k.titulo, descripcion: k.descripcion, duracionEstimadaMin: k.duracionEstimadaMin };
                        await c `insert into plan_tareas(id,plan_id,sala_id,trabajo_id,regla_id,clave_origen,fuente_id,origen_publico,origen_catalogo,base_generada,titulo,descripcion,duracion_estimada_min,creado_por) values(${tareaId},${planId},${k.salaId},${k.trabajoId},${k.reglaId},${k.clave},${fuenteId},${json(c, k.origenPublico)},${json(c, k.origenCatalogo)},${json(c, base)},${k.titulo},${k.descripcion},${k.duracionEstimadaMin},${autor.id})`;
                        tareas.push(tareaId);
                        eventos.push({ tareaId, tipo: 'generar', antes: null, despues: { ...base, estado: 'borrador', origenPublico: k.origenPublico }, catalogo: k.origenCatalogo });
                    }
                    else {
                        const t = d.tarea;
                        if (!t || t.version !== a.versionTarea)
                            throw new ErrorPlan('VERSION_CAMBIADA', 'La tarea cambió desde la preparación.', 409);
                        await c `select id from plan_tareas where id=${t.id} and plan_id=${planId} for update`;
                        if (a.accion === 'anular') {
                            if (!a.motivo)
                                throw new ErrorPlan('MOTIVO_REQUERIDO', 'Anular exige un motivo.');
                            if (t.estado === 'hecha')
                                throw new ErrorPlan('TAREA_HECHA', 'Una tarea hecha se conserva: cambia su estado explícitamente fuera de la regeneración.', 409);
                            if (t.estado !== 'anulada') {
                                await c `update plan_tareas set estado='anulada',version=version+1,actualizado_en=now() where id=${t.id}`;
                                await c `update plan_asignaciones set activo=false,actualizado_en=now() where tarea_id=${t.id}`;
                                eventos.push({ tareaId: t.id, tipo: 'anular_origen', antes: this.fotoTarea(t), despues: { ...this.fotoTarea(t), estado: 'anulada' }, motivo: a.motivo });
                            }
                        }
                        else {
                            if (!d.candidata || t.estado === 'anulada')
                                throw new ErrorPlan('ACCION_INVALIDA', 'La tarea anulada no se reactiva al regenerar.', 409);
                            const k = d.candidata, base: BaseGenerada = { titulo: k.titulo, descripcion: k.descripcion, duracionEstimadaMin: k.duracionEstimadaMin };
                            const nuevo = { titulo: a.campos.includes('titulo') ? k.titulo : t.titulo, descripcion: a.campos.includes('descripcion') ? k.descripcion : t.descripcion, duracionEstimadaMin: a.campos.includes('duracionEstimadaMin') ? k.duracionEstimadaMin : t.duracionEstimadaMin };
                            if (diferencia(nuevo, { titulo: t.titulo, descripcion: t.descripcion, duracionEstimadaMin: t.duracionEstimadaMin }) || diferencia(t.origenPublico, k.origenPublico) || diferencia(t.origenCatalogo, k.origenCatalogo)) {
                                await c `update plan_tareas set titulo=${nuevo.titulo},descripcion=${nuevo.descripcion},duracion_estimada_min=${nuevo.duracionEstimadaMin},base_generada=${json(c, base)},origen_publico=${json(c, k.origenPublico)},origen_catalogo=${json(c, k.origenCatalogo)},fuente_id=${fuenteId},version=version+1,actualizado_en=now() where id=${t.id}`;
                                eventos.push({ tareaId: t.id, tipo: 'actualizar_origen', antes: this.fotoTarea(t), despues: { ...this.fotoTarea(t), ...nuevo }, catalogo: k.origenCatalogo });
                            }
                        }
                        tareas.push(t.id);
                    }
                }
                return { resultado: { tareas, hash: p.hash }, eventos, cambio: eventos.length > 0, fuenteId: String(fuenteId) };
            });
        }, b.seleccion.salas.modo === 'todas');
    }
    private fotoTarea(t: TareaPlan) {
        return { titulo: t.titulo, descripcion: t.descripcion, notas: t.notas, duracionEstimadaMin: t.duracionEstimadaMin, estado: t.estado, venceFecha: t.venceFecha, inicio: t.inicio, fin: t.fin, tecnicos: t.tecnicos.map(p => p.id) };
    }
    private async ubicacionTarea(usuarioId: string, tareaId: string) {
        const u = await this.identidad(usuarioId);
        id(tareaId);
        const [t] = await this.conexion `select t.id,t.sala_id,p.proyecto_id from plan_tareas t join planes p on p.id=t.plan_id where t.id=${tareaId} and (${veSalas(u)} or t.sala_id is null)`;
        if (!t)
            throw new ErrorPlan('NO_ENCONTRADO', 'Tarea no disponible.', 404);
        return { proyectoId: String(t.proyecto_id), salaId: t.sala_id ? String(t.sala_id) : null };
    }
    private async tareaBloqueada(ctx: ContextoEscritura, tareaId: string, version: number) {
        const [fila] = await ctx.c `select id from plan_tareas where id=${tareaId} and plan_id=${ctx.plan!.id} for update`;
        if (!fila)
            throw new ErrorPlan('NO_ENCONTRADO', 'La tarea no pertenece al plan.', 404);
        const tarea = (await this.tareasEn(ctx.c, ctx.autor, ctx.plan!.id, tareaId))[0];
        if (!tarea || tarea.version !== version)
            throw new ErrorPlan('VERSION_CAMBIADA', 'La tarea cambió. Recarga y compara.', 409);
        return tarea;
    }
    private validarCampos(campos: EntradaManual | EdicionTarea) {
        if (campos.venceFecha)
            fechaPlan(campos.venceFecha);
        return intervaloPlan(campos.intervalo);
    }
    async crearTarea(usuarioId: string, proyectoId: string, valor: unknown) {
        const b = entradaPlan(manualSchema, valor), intervalo = this.validarCampos(b);
        return this.escritura(usuarioId, proyectoId, b.salaId ? [b.salaId] : [], async (ctx) => this.operacion(ctx, b.clavePeticion, b, 'crear_tarea', b.versionPlan, async () => {
            if (b.trabajoId) {
                const [trabajo] = await ctx.c `select id from catalogo_tareas where id=${b.trabajoId} and activo for share`;
                if (!trabajo)
                    throw new ErrorPlan('TRABAJO_INACTIVO', 'El trabajo no está activo.', 409);
            }
            const [{ n }] = await ctx.c `select count(*)::int n from plan_tareas where plan_id=${ctx.plan!.id}`;
            if (Number(n) >= LIMITES_PLAN.tareas)
                throw new ErrorPlan('LIMITE_EXCEDIDO', 'El plan admite 5.000 tareas.', 413);
            const tareaId = randomUUID();
            await ctx.c `insert into plan_tareas(id,plan_id,sala_id,trabajo_id,titulo,descripcion,notas,duracion_estimada_min,estado,vence_fecha,inicio_utc,fin_utc,creado_por) values(${tareaId},${ctx.plan!.id},${b.salaId},${b.trabajoId},${b.titulo},${b.descripcion},${b.notas},${b.duracionEstimadaMin},${b.estado},${b.venceFecha},${intervalo.inicio},${intervalo.fin},${ctx.autor.id})`;
            return { resultado: { id: tareaId, versionTarea: 0 }, eventos: [{ tareaId, tipo: 'crear_manual', antes: null, despues: { ...b, ...intervalo } }], cambio: true };
        }));
    }
    private async comprobarConflictos(ctx: ContextoEscritura, tarea: TareaPlan, tecnicos: string[], estado: string, inicio: string | null, fin: string | null, aceptacion?: {
        hash: string;
        nota: string;
    }, operacion: unknown = null) {
        exigirPlan(ctx.autor, true, true);
        const ids = [...new Set([...tarea.tecnicos.map(t => t.id), ...tecnicos])].sort();
        const activos = ids.length ? await ctx.c `select id,nombre,activo from tecnicos where id=any(${ids}::uuid[]) order by id for update` : [];
        if (tecnicos.some(id => !activos.some(t => t.id === id && t.activo)))
            throw new ErrorPlan('TECNICO_INACTIVO', 'Una asignación nueva exige técnicos activos. Revisa la lista.', 409);
        if (!inicio || !fin || !['pendiente', 'en_curso'].includes(estado) || !tecnicos.length)
            return;
        // Después de serializar por técnico: READ COMMITTED ve el ganador de otra obra.
        const conflictos = await ctx.c `select a.tecnico_id,t.id tarea_id,t.titulo,p.proyecto_id,o.nombre proyecto_nombre,t.sala_id,s.nombre sala_nombre,t.inicio_utc,t.fin_utc from plan_asignaciones a join plan_tareas t on t.id=a.tarea_id join planes p on p.id=t.plan_id join proyectos o on o.id=p.proyecto_id left join salas s on s.id=t.sala_id where a.activo and a.tecnico_id=any(${tecnicos}::uuid[]) and t.id<>${tarea.id} and t.estado in ('pendiente','en_curso') and p.archivado_en is null and t.inicio_utc<${fin}::timestamptz and t.fin_utc>${inicio}::timestamptz order by a.tecnico_id,t.id`;
        if (!conflictos.length)
            return;
        const lista = conflictos.map(t => ({ tecnicoId: t.tecnico_id, tareaId: t.tarea_id, titulo: t.titulo, proyectoId: t.proyecto_id, obra: t.proyecto_nombre, salaId: t.sala_id, sala: t.sala_nombre, inicio: fecha(t.inicio_utc), fin: fecha(t.fin_utc) }));
        const hash = hashPlan({ operacion, conflictos: lista });
        if (!aceptacion || aceptacion.hash !== hash || !aceptacion.nota.trim())
            throw new ErrorPlan('CONFLICTOS_TECNICOS', 'Hay solapamientos. Revisa la lista y confirma sólo este conjunto con una nota.', 409, { hash, conflictos: lista });
    }
    async editarTarea(usuarioId: string, tareaId: string, valor: unknown) {
        const b = entradaPlan(editarTareaSchema, valor), intervalo = this.validarCampos(b), ubicacion = await this.ubicacionTarea(usuarioId, tareaId);
        return this.escritura(usuarioId, ubicacion.proyectoId, ubicacion.salaId ? [ubicacion.salaId] : [], async (ctx) => this.operacion(ctx, b.clavePeticion, b, 'editar_tarea', b.versionPlan, async () => {
            const t = await this.tareaBloqueada(ctx, tareaId, b.versionTarea);
            if ((b.estado === 'anulada' && t.estado !== 'anulada' || t.estado === 'hecha' && b.estado !== 'hecha' || t.estado === 'anulada' && b.estado !== 'anulada' || t.desactualizada) && !b.motivo)
                throw new ErrorPlan('MOTIVO_REQUERIDO', 'Este cambio de estado u origen requiere un motivo.');
            const reactivada = ['hecha', 'anulada'].includes(t.estado) && b.estado !== t.estado;
            const siguiente = { titulo: b.titulo, descripcion: b.descripcion, notas: b.notas, duracionEstimadaMin: b.duracionEstimadaMin, estado: reactivada ? 'borrador' : b.estado, venceFecha: b.venceFecha, inicio: reactivada ? null : intervalo.inicio, fin: reactivada ? null : intervalo.fin, tecnicos: reactivada || b.estado === 'anulada' ? [] : t.tecnicos.map(p => p.id) };
            const antes = this.fotoTarea(t);
            if (!diferencia(antes, siguiente))
                return { resultado: { id: t.id, versionTarea: t.version }, eventos: [], cambio: false };
            const afectaReserva = diferencia({ activo: ['pendiente', 'en_curso'].includes(t.estado), inicio: t.inicio, fin: t.fin }, { activo: ['pendiente', 'en_curso'].includes(siguiente.estado), inicio: siguiente.inicio, fin: siguiente.fin });
            if (afectaReserva && siguiente.tecnicos.length && ['pendiente', 'en_curso'].includes(siguiente.estado))
                await this.comprobarConflictos(ctx, t, siguiente.tecnicos, siguiente.estado, siguiente.inicio, siguiente.fin, b.aceptacionConflictos, { tareaId, b: sinAceptacion(b) });
            await ctx.c `update plan_tareas set titulo=${siguiente.titulo},descripcion=${siguiente.descripcion},notas=${siguiente.notas},duracion_estimada_min=${siguiente.duracionEstimadaMin},estado=${siguiente.estado},vence_fecha=${siguiente.venceFecha},inicio_utc=${siguiente.inicio},fin_utc=${siguiente.fin},version=version+1,actualizado_en=now() where id=${t.id}`;
            if (reactivada || b.estado === 'anulada')
                await ctx.c `update plan_asignaciones set activo=false,actualizado_en=now() where tarea_id=${t.id}`;
            return { resultado: { id: t.id, versionTarea: t.version + 1 }, eventos: [{ tareaId: t.id, tipo: 'editar_tarea', antes, despues: siguiente }], cambio: true };
        }, b.motivo), false, true);
    }
    async asignar(usuarioId: string, tareaId: string, valor: unknown) {
        const b = entradaPlan(asignacionSchema, valor), ubicacion = await this.ubicacionTarea(usuarioId, tareaId);
        return this.escritura(usuarioId, ubicacion.proyectoId, ubicacion.salaId ? [ubicacion.salaId] : [], async (ctx) => {
            exigirPlan(ctx.autor, true, true);
            return this.operacion(ctx, b.clavePeticion, b, 'asignar', b.versionPlan, async () => {
                const t = await this.tareaBloqueada(ctx, tareaId, b.versionTarea);
                if (['hecha', 'anulada'].includes(t.estado))
                    throw new ErrorPlan('TAREA_CERRADA', 'Reabre la tarea antes de asignarla.', 409);
                const tecnicos = new Set(b.tecnicos), origenes = new Map<string, unknown[]>();
                for (const g of [...b.grupos].sort((a, b) => a.id.localeCompare(b.id))) {
                    const [grupo] = await ctx.c `select id,nombre,version from plan_grupos where id=${g.id} and plan_id=${ctx.plan!.id} and activo for share`;
                    if (!grupo || Number(grupo.version) !== g.version)
                        throw new ErrorPlan('GRUPO_CAMBIADO', 'El grupo no pertenece al plan o cambió. Revisa su composición.', 409);
                    const miembros = await ctx.c `select tecnico_id from plan_grupo_miembros where grupo_id=${g.id} order by tecnico_id`;
                    for (const m of miembros) {
                        tecnicos.add(m.tecnico_id);
                        origenes.set(m.tecnico_id, [...(origenes.get(m.tecnico_id) ?? []), { id: g.id, nombre: grupo.nombre, version: g.version, miembros: miembros.map(m => m.tecnico_id) }]);
                    }
                }
                const lista = [...tecnicos].sort();
                if (lista.length > LIMITES_PLAN.asignados)
                    throw new ErrorPlan('LIMITE_EXCEDIDO', 'Máximo 50 técnicos por tarea.', 413);
                await this.comprobarConflictos(ctx, t, lista, t.estado, t.inicio, t.fin, b.aceptacionConflictos, { tareaId, b: sinAceptacion(b) });
                const anteriores = await ctx.c `select tecnico_id,origen_grupos from plan_asignaciones where tarea_id=${t.id} and activo order by tecnico_id`;
                const nuevos = lista.map(tecnicoId => ({ tecnicoId, grupos: origenes.get(tecnicoId) ?? [] }));
                if (!diferencia(anteriores.map(a => ({ tecnicoId: a.tecnico_id, grupos: a.origen_grupos })), nuevos))
                    return { resultado: { id: t.id, versionTarea: t.version }, eventos: [], cambio: false };
                await ctx.c `update plan_asignaciones set activo=false,actualizado_en=now() where tarea_id=${t.id}`;
                for (const tecnicoId of lista)
                    await ctx.c `insert into plan_asignaciones(tarea_id,tecnico_id,activo,origen_grupos,asignado_por) values(${t.id},${tecnicoId},true,${json(ctx.c, origenes.get(tecnicoId) ?? [])},${ctx.autor.id}) on conflict(tarea_id,tecnico_id) do update set activo=true,origen_grupos=excluded.origen_grupos,asignado_por=excluded.asignado_por,actualizado_en=now()`;
                await ctx.c `update plan_tareas set version=version+1,actualizado_en=now() where id=${t.id}`;
                return { resultado: { id: t.id, versionTarea: t.version + 1, tecnicos: lista }, eventos: [{ tareaId: t.id, tipo: 'asignar', antes: anteriores.map(a => ({ tecnicoId: a.tecnico_id, grupos: a.origen_grupos })), despues: nuevos }], cambio: true };
            }, b.motivo);
        });
    }
    async tecnicos(usuarioId: string, q = '', tareaId?: string) {
        await this.identidad(usuarioId);
        if (q.length > 200)
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Búsqueda demasiado larga.');
        const actuales = tareaId ? (await this.tarea(usuarioId, tareaId)).tecnicos.map(t => t.id) : [];
        return this.conexion<{
            id: string;
            nombre: string;
            activo: boolean;
        }[]> `select id,nombre,activo from tecnicos where (activo or id=any(${actuales}::uuid[])) and nombre ilike ${'%' + q.replace(/[\\%_]/g, '\\$&') + '%'} order by nombre,id limit 20`;
    }
    async tecnicoAgenda(usuarioId: string, tecnicoId: string) {
        const u = await this.identidad(usuarioId);
        exigirPlan(u, false, true);
        id(tecnicoId);
        const [tecnico] = await this.conexion<{ id: string; nombre: string; activo: boolean }[]> `select id,nombre,activo from tecnicos where id=${tecnicoId}`;
        if (!tecnico)
            throw new ErrorPlan('NO_ENCONTRADO', 'El técnico seleccionado no existe.', 404);
        return tecnico;
    }
    async grupos(usuarioId: string, proyectoId: string) {
        await this.identidad(usuarioId);
        id(proyectoId);
        const filas = await this.conexion `select g.id,g.nombre,g.version,g.activo from plan_grupos g join planes p on p.id=g.plan_id where p.proyecto_id=${proyectoId} order by g.nombre,g.id`;
        const miembros = filas.length ? await this.conexion `select m.grupo_id,t.id,t.nombre,t.activo from plan_grupo_miembros m join tecnicos t on t.id=m.tecnico_id where m.grupo_id=any(${filas.map(g => g.id)}::uuid[]) order by t.id` : [];
        return filas.map(g => ({ id: g.id, nombre: g.nombre, version: Number(g.version), activo: g.activo, miembros: miembros.filter(m => m.grupo_id === g.id).map(m => ({ id: m.id, nombre: m.nombre, activo: m.activo })) }));
    }
    async guardarGrupo(usuarioId: string, proyectoId: string, b: {
        nombre: string;
        miembros: string[];
        activo: boolean;
        versionPlan: number;
        clavePeticion: string;
        version?: number;
    }, grupoId?: string) {
        return this.escritura(usuarioId, proyectoId, [], async (ctx) => this.operacion(ctx, b.clavePeticion, b, 'grupo', b.versionPlan, async () => {
            const { c } = ctx;
            const grupo = grupoId ? id(grupoId) : randomUUID();
            if (grupoId) {
                const [g] = await c `select id,version from plan_grupos where id=${grupoId} and plan_id=${ctx.plan!.id} for update`;
                if (!g || Number(g.version) !== b.version)
                    throw new ErrorPlan('GRUPO_CAMBIADO', 'El grupo cambió o no pertenece a este plan.', 409);
            }
            else {
                const [{ n }] = await c `select count(*)::int n from plan_grupos where plan_id=${ctx.plan!.id}`;
                if (Number(n) >= LIMITES_PLAN.grupos)
                    throw new ErrorPlan('LIMITE_EXCEDIDO', 'Máximo 50 grupos por plan.', 413);
            }
            const miembros = [...b.miembros].sort();
            const tecnicos = miembros.length ? await c `select id,activo from tecnicos where id=any(${miembros}::uuid[]) order by id for update` : [];
            if (tecnicos.length !== miembros.length || tecnicos.some(t => !t.activo))
                throw new ErrorPlan('TECNICO_INACTIVO', 'Los miembros deben ser técnicos activos.', 409);
            const antes = grupoId ? (await c `select nombre,activo from plan_grupos where id=${grupoId}`)[0] : null;
            const anteriores = grupoId ? await c `select tecnico_id from plan_grupo_miembros where grupo_id=${grupoId} order by tecnico_id` : [];
            if (grupoId && !diferencia({ nombre: antes?.nombre, activo: antes?.activo, miembros: anteriores.map(t => t.tecnico_id) }, { nombre: b.nombre, activo: b.activo, miembros }))
                return { resultado: { id: grupo, versionGrupo: b.version }, eventos: [], cambio: false };
            if (grupoId)
                await c `update plan_grupos set nombre=${b.nombre},activo=${b.activo},version=version+1,actualizado_en=now() where id=${grupoId}`;
            else
                await c `insert into plan_grupos(id,plan_id,nombre,activo) values(${grupo},${ctx.plan!.id},${b.nombre},${b.activo})`;
            await c `delete from plan_grupo_miembros where grupo_id=${grupo}`;
            for (const tecnicoId of miembros)
                await c `insert into plan_grupo_miembros(grupo_id,tecnico_id) values(${grupo},${tecnicoId})`;
            return { resultado: { id: grupo, versionGrupo: grupoId ? b.version! + 1 : 0 }, eventos: [{ tareaId: null, tipo: 'grupo', antes: { ...antes, miembros: anteriores.map(t => t.tecnico_id) }, despues: { id: grupo, nombre: b.nombre, activo: b.activo, miembros } }], cambio: true };
        }));
    }
    async proyectoDeGrupo(usuarioId: string, grupoId: string) {
        await this.identidad(usuarioId);
        id(grupoId);
        const [g] = await this.conexion `select p.proyecto_id from plan_grupos g join planes p on p.id=g.plan_id where g.id=${grupoId}`;
        if (!g)
            throw new ErrorPlan('NO_ENCONTRADO', 'Grupo no encontrado.', 404);
        return String(g.proyecto_id);
    }
    async historial(usuarioId: string, tareaId: string, pagina = 1) {
        const t = await this.tarea(usuarioId, tareaId), u = await this.identidad(usuarioId);
        exigirPlan(u, false, !!t.salaId);
        const privado = veCatalogo(u) ? ',e.catalogo' : '';
        return this.conexion.unsafe(`select e.id,e.tipo,e.autor_id,u.nombre autor,e.creado_en,e.version_plan,e.motivo,e.antecedente_id,e.antes,e.despues${privado} from plan_eventos e join usuarios u on u.id=e.autor_id where e.tarea_id=$1 and e.plan_id=$2 order by e.creado_en desc,e.id desc limit 50 offset $3`, [tareaId, t.planId, (pagina - 1) * 50]);
    }
    async restaurar(usuarioId: string, tareaId: string, b: {
        versionPlan: number;
        versionTarea: number;
        clavePeticion: string;
        motivo: string;
        eventoId: string;
    }) {
        const ubicacion = await this.ubicacionTarea(usuarioId, tareaId);
        return this.escritura(usuarioId, ubicacion.proyectoId, ubicacion.salaId ? [ubicacion.salaId] : [], async (ctx) => this.operacion(ctx, b.clavePeticion, b, 'restaurar_tarea', b.versionPlan, async () => {
            const t = await this.tareaBloqueada(ctx, tareaId, b.versionTarea);
            const [e] = await ctx.c `select id,despues from plan_eventos where id=${id(b.eventoId)} and tarea_id=${t.id} and plan_id=${ctx.plan!.id}`;
            if (!e || !e.despues || typeof e.despues.titulo !== 'string')
                throw new ErrorPlan('EVENTO_NO_RESTAURABLE', 'Elige un evento que conserve campos de tarea.', 409);
            const campos = entradaPlan(editarTareaSchema, { titulo: e.despues.titulo, descripcion: e.despues.descripcion ?? '', notas: e.despues.notas ?? '', duracionEstimadaMin: e.despues.duracionEstimadaMin ?? null, estado: 'borrador', venceFecha: null, intervalo: null, versionPlan: b.versionPlan, versionTarea: b.versionTarea, clavePeticion: b.clavePeticion, motivo: b.motivo });
            await ctx.c `update plan_tareas set titulo=${campos.titulo},descripcion=${campos.descripcion},notas=${campos.notas},duracion_estimada_min=${campos.duracionEstimadaMin},estado='borrador',vence_fecha=null,inicio_utc=null,fin_utc=null,version=version+1,actualizado_en=now() where id=${t.id}`;
            await ctx.c `update plan_asignaciones set activo=false,actualizado_en=now() where tarea_id=${t.id}`;
            return { resultado: { id: t.id, versionTarea: t.version + 1 }, eventos: [{ tareaId: t.id, tipo: 'restaurar_tarea', antes: this.fotoTarea(t), despues: { titulo: campos.titulo, descripcion: campos.descripcion, notas: campos.notas, duracionEstimadaMin: campos.duracionEstimadaMin, estado: 'borrador', venceFecha: null, inicio: null, fin: null, tecnicos: [] }, antecedenteId: e.id, motivo: b.motivo }], cambio: true };
        }, b.motivo), false, true);
    }
    async editarPlan(usuarioId: string, proyectoId: string, b: {
        versionPlan: number;
        clavePeticion: string;
        notas: string;
        archivado: boolean;
        motivo?: string;
    }) {
        return this.escritura(usuarioId, proyectoId, [], async (ctx) => this.operacion(ctx, b.clavePeticion, b, b.archivado ? 'archivar_plan' : 'reactivar_plan', b.versionPlan, async () => {
            const [p] = await ctx.c `select notas,archivado_en from planes where id=${ctx.plan!.id}`;
            if (!!p.archivado_en !== b.archivado && !b.motivo)
                throw new ErrorPlan('MOTIVO_REQUERIDO', 'Archivar o reactivar el plan exige motivo.');
            if (p.notas === b.notas && !!p.archivado_en === b.archivado)
                return { resultado: { id: ctx.plan!.id }, eventos: [], cambio: false };
            const eventos: EventoNuevo[] = [];
            if (p.archivado_en && !b.archivado) {
                exigirPlan(ctx.autor, true, true);
                // Reactivar no resucita reservas antiguas: vuelven a borrador y sin intervalo/asignación.
                const tareas = await this.tareasEn(ctx.c, ctx.autor, ctx.plan!.id);
                if (tareas.some(t => !['hecha', 'anulada'].includes(t.estado) && t.salaId && !ctx.salaIds.includes(t.salaId)))
                    throw new ErrorPlan('SALA_AJENA', 'Resuelve las tareas de salas trasladadas antes de reactivar.', 409);
                for (const t of tareas)
                    if (['pendiente', 'en_curso'].includes(t.estado)) {
                        await ctx.c `update plan_tareas set estado='borrador',inicio_utc=null,fin_utc=null,version=version+1 where id=${t.id}`;
                        await ctx.c `update plan_asignaciones set activo=false where tarea_id=${t.id}`;
                        eventos.push({ tareaId: t.id, tipo: 'reactivar_plan', antes: this.fotoTarea(t), despues: { ...this.fotoTarea(t), estado: 'borrador', inicio: null, fin: null, tecnicos: [] } });
                    }
            }
            await ctx.c `update planes set notas=${b.notas},archivado_en=${b.archivado ? this.ahora().toISOString() : null} where id=${ctx.plan!.id}`;
            return { resultado: { id: ctx.plan!.id }, eventos: [...eventos, { tareaId: null, tipo: 'editar_plan', antes: { notas: p.notas, archivado: !!p.archivado_en }, despues: { notas: b.notas, archivado: b.archivado } }], cambio: true };
        }, b.motivo, true), !b.archivado);
    }
    async tareas(usuarioId: string, proyectoId: string, pagina = 1, estado?: string) {
        if (!Number.isInteger(pagina) || pagina < 1)
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Página inválida.');
        if (estado && !['borrador', 'pendiente', 'en_curso', 'hecha', 'anulada'].includes(estado))
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Estado inválido.');
        return this.conexion.begin('isolation level repeatable read read only', async (tx) => {
            const c = tx as unknown as ConexionPlan, u = await autorPlan(c, usuarioId);
            await this.obra(c, proyectoId);
            const [p] = await c `select id,version from planes where proyecto_id=${proyectoId}`;
            const todas = p ? await this.tareasEn(c, u, p.id) : [], lista = estado ? todas.filter(t => t.estado === estado) : todas;
            return { tareas: lista.slice((pagina - 1) * 50, pagina * 50), total: lista.length, versionPlan: p ? Number(p.version) : null, alcance: veSalas(u) ? 'Obra y salas' : 'Sólo tareas generales' };
        });
    }
    async agendaEnLectura(c: ConexionPlan, usuarioId: string, filtros: FiltroAgenda, ahora = this.ahora()) {
        const u = await autorPlan(c, usuarioId);
        exigirPlan(u, false, true);
        const filtro = entradaPlan(filtroAgendaSchema, filtros);
        if (!(ahora instanceof Date) || !Number.isFinite(+ahora))
            throw new ErrorPlan('ENTRADA_INVALIDA', 'Instante de agenda inválido.');
        const { hoy, lunes, dia, semana, rango } = periodosAgenda(filtro, ahora);
        const parametros = [filtro.proyectoId ?? null, filtro.tecnicoId ?? null, hoy, lunes,
            dia.inicio, dia.fin, semana.inicio, semana.fin, ahora.toISOString(), rango.inicio, rango.fin];
        const tiposParametros = `configuracion as (select $1::uuid obra,$2::uuid tecnico,$3::date hoy,$4::date lunes,
            $5::timestamptz dia_inicio,$6::timestamptz dia_fin,$7::timestamptz semana_inicio,$8::timestamptz semana_fin,
            $9::timestamptz ahora,$10::timestamptz rango_inicio,$11::timestamptz rango_fin)`;
        const alcance = `p.archivado_en is null and ($1::uuid is null or p.proyecto_id=$1)
            and ($2::uuid is null or exists(select 1 from plan_asignaciones asignacion
                where asignacion.tarea_id=t.id and asignacion.activo and asignacion.tecnico_id=$2))`;
        const abiertas = `t.estado in ('borrador','pendiente','en_curso')`;
        const vistas = {
            hoy: `(t.inicio_utc<$6::timestamptz and t.fin_utc>$5::timestamptz or t.vence_fecha=$3::date)`,
            semana: `(t.inicio_utc<$8::timestamptz and t.fin_utc>$7::timestamptz or t.vence_fecha between $4::date and $4::date+6)`,
            vencidas: `(t.vence_fecha<$3::date or t.vence_fecha is null and t.fin_utc<$9::timestamptz)`,
            sin_fecha: `(t.vence_fecha is null and t.inicio_utc is null)`,
        };
        // Contadores completos del ámbito, sin cargar/truncar tareas de otras obras.
        const [contadores] = await c.unsafe(`with ${tiposParametros} select
            count(*) filter(where ${abiertas} and ${vistas.hoy})::int hoy,
            count(*) filter(where ${abiertas} and ${vistas.semana})::int semana,
            count(*) filter(where ${abiertas} and ${vistas.vencidas})::int vencidas,
            count(*) filter(where ${abiertas} and ${vistas.sin_fecha})::int sin_fecha
            from plan_tareas t join planes p on p.id=t.plan_id where ${alcance}`, parametros);
        // La vista limita la lista; desde/hasta recorta sólo ocupación, como el núcleo puro.
        const filas = await c.unsafe(`with ${tiposParametros} select t.id,t.plan_id,t.sala_id,s.nombre sala_nombre,
            p.proyecto_id,o.nombre proyecto_nombre,t.titulo,t.descripcion,t.notas,
            t.duracion_estimada_min,t.estado,t.vence_fecha,t.inicio_utc,t.fin_utc,t.version
            from plan_tareas t join planes p on p.id=t.plan_id join proyectos o on o.id=p.proyecto_id
            left join salas s on s.id=t.sala_id where ${alcance}
            ${filtro.historial ? '' : `and ${abiertas} and ${vistas[filtro.vista]}`}
            order by t.creado_en,t.id limit 10001`, parametros);
        if (filas.length > 10000)
            throw new ErrorPlan('LIMITE_EXCEDIDO', 'Reduce el ámbito de la vista de agenda.', 413);
        const asignados = filas.length ? await c `select a.tarea_id,t.id,t.nombre,t.activo from plan_asignaciones a join tecnicos t on t.id=a.tecnico_id where a.activo and a.tarea_id=any(${filas.map(f => f.id)}::uuid[]) order by t.id` : [];
        const tareas: TareaAgenda[] = filas.map(f => ({ id: String(f.id), planId: String(f.plan_id), salaId: f.sala_id ?? null, salaNombre: f.sala_nombre ?? null,
            proyectoId: String(f.proyecto_id), proyectoNombre: String(f.proyecto_nombre), titulo: String(f.titulo), descripcion: String(f.descripcion), notas: String(f.notas),
            duracionEstimadaMin: f.duracion_estimada_min == null ? null : Number(f.duracion_estimada_min), estado: f.estado, venceFecha: f.vence_fecha ? fecha(f.vence_fecha)!.slice(0, 10) : null,
            inicio: fecha(f.inicio_utc), fin: fecha(f.fin_utc), version: Number(f.version), archivado: false,
            tecnicos: asignados.filter(a => a.tarea_id === f.id).map(a => ({ id: a.id, nombre: a.nombre, activo: a.activo })) }));
        // Unión por persona en SQL: cada intervalo aporta sólo el tiempo aún no cubierto.
        const ocupacion = await c.unsafe(`with ${tiposParametros}, personas as (
            select distinct a.tecnico_id,tecnico.nombre,tecnico.activo
            from plan_tareas t join planes p on p.id=t.plan_id
            join plan_asignaciones a on a.tarea_id=t.id and a.activo
            join tecnicos tecnico on tecnico.id=a.tecnico_id
            where ${alcance} and t.estado in ('pendiente','en_curso')
                and t.inicio_utc is not null and t.fin_utc is not null
                and ($2::uuid is null or a.tecnico_id=$2)
        ), intervalos as (
            select a.tecnico_id,t.id tarea_id,tecnico.nombre,tecnico.activo,
                greatest(t.inicio_utc,$10::timestamptz) inicio,least(t.fin_utc,$11::timestamptz) fin
            from plan_tareas t join planes p on p.id=t.plan_id
            join plan_asignaciones a on a.tarea_id=t.id and a.activo
            join tecnicos tecnico on tecnico.id=a.tecnico_id
            where ${alcance} and t.estado in ('pendiente','en_curso')
                and ($2::uuid is null or a.tecnico_id=$2)
                and t.inicio_utc<$11::timestamptz and t.fin_utc>$10::timestamptz
        ), ordenados as (
            select tecnico_id,tarea_id,nombre,activo,inicio,fin,max(fin) over(partition by tecnico_id order by inicio,fin,tarea_id
                rows between unbounded preceding and 1 preceding) fin_anterior from intervalos
        ), unidos as (select tecnico_id,
            sum(greatest(0,extract(epoch from(fin-greatest(inicio,coalesce(fin_anterior,inicio))))/60))::float8 minutos
            from ordenados group by tecnico_id)
            select persona.tecnico_id,persona.nombre,persona.activo,coalesce(unidos.minutos,0)::float8 minutos
            from personas persona left join unidos on unidos.tecnico_id=persona.tecnico_id order by persona.tecnico_id`, parametros);
        return { solicitudId: randomUUID(), ...resumirAgenda(tareas, filtro, ahora),
            contadores: { hoy: Number(contadores.hoy), semana: Number(contadores.semana), vencidas: Number(contadores.vencidas), sin_fecha: Number(contadores.sin_fecha) },
            ocupacion: ocupacion.map(p => ({ tecnicoId: String(p.tecnico_id), nombre: String(p.nombre), activo: p.activo, minutos: Number(p.minutos) })) };
    }
}
function sinAceptacion<T extends {
    aceptacionConflictos?: unknown;
}>(b: T) {
    const resto = { ...b };
    delete resto.aceptacionConflictos;
    return resto;
}
