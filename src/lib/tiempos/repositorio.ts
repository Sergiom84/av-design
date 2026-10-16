import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { autorTiempos, exigirGestorTiempos, exigirPropioTiempos, gestionaTiempos, identidadTiempos, titularDelTecnico, veSalasTiempo, type AutorTiempos, type ConexionTiempos } from './autorizacion';
import { altaTiempoSchema, anularTiempoSchema, canonicoTiempo, corregirTiempoSchema, entradaTiempo, ErrorTiempo, LIMITES_TIEMPOS, restaurarTiempoSchema, uuidTiempo, type AltaTiempo, type AnulacionTiempo, type CorreccionTiempo, type FiltroTiempos, type ParteTiempo, type RestauracionTiempo, type VersionTiempo } from './modelo';
import { rangoTrabajoMadrid, validarIntervaloReal } from './fechas';
import { localDesdeInstante } from '../planificacion/fechas';

const id = (v: string) => entradaTiempo(uuidTiempo, v);
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
const json = (c: ConexionTiempos, v: unknown) => c.json(v as postgres.JSONValue);
type Fila = Record<string, unknown>;
function version(f: Fila): VersionTiempo {
  return { id: String(f.version_id ?? f.id), numero: Number(f.numero), antecedenteId: f.antecedente_id ? String(f.antecedente_id) : null, accion: f.accion as VersionTiempo['accion'], inicioUtc: iso(f.inicio_utc), finUtc: iso(f.fin_utc), minutos: Number(f.minutos), entradaLocal: f.entrada_local as VersionTiempo['entradaLocal'], notas: String(f.notas), motivo: f.motivo == null ? null : String(f.motivo), autorNombre: String(f.autor_nombre), creadoEn: iso(f.version_creada ?? f.creado_en) };
}
interface Contexto { tarea_id: string; plan_id: string; proyecto_id: string; sala_id: string | null; estado: string; archivado: boolean; sala_proyecto_id: string | null }
function contexto(f: Fila): Contexto { return { tarea_id: String(f.tarea_id), plan_id: String(f.plan_id), proyecto_id: String(f.proyecto_id), sala_id: f.sala_id ? String(f.sala_id) : null, estado: String(f.estado), archivado: !!f.archivado, sala_proyecto_id: f.sala_proyecto_id ? String(f.sala_proyecto_id) : null }; }
const noEncontrado = () => new ErrorTiempo('NO_ENCONTRADO', 'El parte o la tarea no está disponible en este ámbito.', 404);

/** Sólo datos operativos. Esta clase no importa ni consulta el módulo de costes. */
export class RepositorioTiempos {
  constructor(public conexion: ConexionTiempos) {}
  async identidad(usuarioId: string) { return identidadTiempos(this.conexion, await autorTiempos(this.conexion, usuarioId)); }
  private async lectura<T>(usuarioId: string, f: (c: ConexionTiempos, u: AutorTiempos) => Promise<T>): Promise<T> {
    return this.conexion.begin('isolation level repeatable read read only', async tx => { const c = tx as unknown as ConexionTiempos; return f(c, await autorTiempos(c, usuarioId)); }) as Promise<T>;
  }
  private async tareaContexto(c: ConexionTiempos, tareaId: string): Promise<Contexto> {
    const [t] = await c`select t.id tarea_id,t.plan_id,p.proyecto_id,t.sala_id,t.estado,p.archivado_en is not null archivado,l.proyecto_id sala_proyecto_id from plan_tareas t join planes p on p.id=t.plan_id left join salas s on s.id=t.sala_id left join localizaciones l on l.id=s.localizacion_id where t.id=${id(tareaId)}`;
    if (!t) throw noEncontrado();
    return contexto(t);
  }
  private contextoVisible(u: AutorTiempos, salaId: string | null) {
    if (salaId && !veSalasTiempo(u)) throw noEncontrado();
  }
  private async cabecera(c: ConexionTiempos, u: AutorTiempos, registroId: string) {
    // La titularidad/contexto se filtran antes de leer versiones o sus textos.
    const [r] = await c`select r.id,r.tarea_id,r.proyecto_id,r.sala_id,r.tecnico_id,r.titular_usuario_id,r.numero_actual,r.actual_id,r.relacionado_id from tiempo_registros r where r.id=${id(registroId)} and (${gestionaTiempos(u)} or r.titular_usuario_id=${u.id}) and (r.sala_id is null or ${veSalasTiempo(u)})`;
    if (!r) throw noEncontrado();
    return r;
  }
  private async proyeccion(c: ConexionTiempos, u: AutorTiempos, registroId: string): Promise<ParteTiempo> {
    const r = await this.cabecera(c, u, registroId);
    const [f] = await c`select t.titulo,p.nombre proyecto,s.nombre sala,te.nombre tecnico,te.activo tecnico_activo,v.id version_id,v.numero,v.antecedente_id,v.accion,v.inicio_utc,v.fin_utc,v.minutos,v.entrada_local,v.notas,v.motivo,v.autor_nombre,v.creado_en version_creada from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id join plan_tareas t on t.id=r.tarea_id join proyectos p on p.id=r.proyecto_id left join salas s on s.id=r.sala_id join tecnicos te on te.id=r.tecnico_id where r.id=${r.id}`;
    if (!f) throw noEncontrado();
    const yo = await identidadTiempos(c, u);
    const ctx = await this.tareaContexto(c, String(r.tarea_id));
    const [a] = await c`select 1 from plan_asignaciones where tarea_id=${r.tarea_id} and tecnico_id=${r.tecnico_id} and activo`;
    const [cerrado] = await c`select 1 from hitos_proyecto where proyecto_id=${r.proyecto_id} and tipo='cierre'`;
    const propio = String(r.titular_usuario_id) === u.id && yo.puedeRegistrar && yo.tecnicoId === String(r.tecnico_id) && !!a && !ctx.archivado && !cerrado && ['pendiente','en_curso','hecha'].includes(ctx.estado) && (!ctx.sala_id || ctx.sala_proyecto_id === ctx.proyecto_id);
    let relacionadoId: string | null = null;
    if (r.relacionado_id) {
      const [visible] = await c`select id from tiempo_registros where id=${r.relacionado_id} and (${gestionaTiempos(u)} or titular_usuario_id=${u.id}) and (sala_id is null or ${veSalasTiempo(u)})`;
      if (visible) relacionadoId = String(visible.id);
    }
    return { id: String(r.id), tareaId: String(r.tarea_id), tarea: String(f.titulo), proyectoId: String(r.proyecto_id), proyecto: String(f.proyecto), salaId: r.sala_id ? String(r.sala_id) : null, sala: f.sala ? String(f.sala) : null, tecnicoId: String(r.tecnico_id), tecnico: String(f.tecnico), tecnicoActivo: !!f.tecnico_activo, relacionadoId, numeroActual: Number(r.numero_actual), actualId: String(r.actual_id), version: version(f), puedeEscribir: gestionaTiempos(u) || propio };
  }
  async registro(usuarioId: string, registroId: string) { return this.lectura(usuarioId, (c, u) => this.proyeccion(c, u, registroId)); }
  async relacionados(usuarioId: string, registroId: string, pagina = 1) {
    this.pagina(pagina);
    return this.lectura(usuarioId, async (c, u) => {
      const r = await this.cabecera(c, u, registroId);
      const filas = await c`select id from tiempo_registros where (relacionado_id=${r.id} or id=${r.relacionado_id}::uuid) and (${gestionaTiempos(u)} or titular_usuario_id=${u.id}) and (sala_id is null or ${veSalasTiempo(u)}) order by creado_en,id limit ${LIMITES_TIEMPOS.pagina + 1} offset ${(pagina - 1) * LIMITES_TIEMPOS.pagina}`;
      return { partes: await Promise.all(filas.slice(0, LIMITES_TIEMPOS.pagina).map(f => this.proyeccion(c, u, String(f.id)))), hayMas: filas.length > LIMITES_TIEMPOS.pagina, pagina };
    });
  }
  async historial(usuarioId: string, registroId: string, pagina = 1) {
    this.pagina(pagina);
    return this.lectura(usuarioId, async (c, u) => {
      const r = await this.cabecera(c, u, registroId);
      const filas = await c`select id,numero,antecedente_id,accion,inicio_utc,fin_utc,minutos,entrada_local,notas,motivo,autor_nombre,creado_en from tiempo_versiones where registro_id=${r.id} order by numero desc limit ${LIMITES_TIEMPOS.pagina + 1} offset ${(pagina - 1) * LIMITES_TIEMPOS.pagina}`;
      return { registro: await this.proyeccion(c, u, registroId), versiones: filas.slice(0, LIMITES_TIEMPOS.pagina).map(version), pagina, hayMas: filas.length > LIMITES_TIEMPOS.pagina };
    });
  }
  private pagina(p: number) { if (!Number.isInteger(p) || p < 1 || p > 100000) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Página inválida.'); }
  async listar(usuarioId: string, filtro: FiltroTiempos, proyectoId?: string) {
    this.pagina(filtro.pagina);
    const rango = rangoTrabajoMadrid(filtro.desde, filtro.hasta);
    if (proyectoId) id(proyectoId);
    return this.lectura(usuarioId, async (c, u) => {
      if (proyectoId) { exigirGestorTiempos(u); if (!(await c`select id from proyectos where id=${proyectoId}`).length) throw noEncontrado(); }
      const yo = await identidadTiempos(c, u);
      const partes = await c`select r.id from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id where (${proyectoId != null} or r.titular_usuario_id=${u.id}) and (${proyectoId == null} or r.proyecto_id=${proyectoId ?? null}::uuid) and (r.sala_id is null or ${veSalasTiempo(u)}) and v.inicio_utc < ${rango.finUtcExclusivo} and v.fin_utc > ${rango.inicioUtc} order by v.inicio_utc desc,r.id limit ${LIMITES_TIEMPOS.pagina + 1} offset ${(filtro.pagina - 1) * LIMITES_TIEMPOS.pagina}`;
      // Resumen completo del rango, sin truncar a la página. Se agregan días en SQL
      // con medianoches Madrid y el mismo filtro de titular/contexto.
      const dias = await c`select d.fecha::text fecha,sum(extract(epoch from (least(v.fin_utc,(d.fecha+1)::timestamp at time zone 'Europe/Madrid')-greatest(v.inicio_utc,d.fecha::timestamp at time zone 'Europe/Madrid')))/60)::int minutos from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id cross join lateral (select serie::date fecha from generate_series(${rango.desde}::date,${rango.hasta}::date,interval '1 day') serie) d where (${proyectoId != null} or r.titular_usuario_id=${u.id}) and (${proyectoId == null} or r.proyecto_id=${proyectoId ?? null}::uuid) and (r.sala_id is null or ${veSalasTiempo(u)}) and v.accion<>'anulacion' and v.inicio_utc < (d.fecha+1)::timestamp at time zone 'Europe/Madrid' and v.fin_utc > d.fecha::timestamp at time zone 'Europe/Madrid' group by d.fecha order by d.fecha`;
      return { identidad: yo, partes: await Promise.all(partes.slice(0, LIMITES_TIEMPOS.pagina).map(r => this.proyeccion(c, u, String(r.id)))), pagina: filtro.pagina, hayMas: partes.length > LIMITES_TIEMPOS.pagina, desde: rango.desde, hasta: rango.hasta, minutos: dias.reduce((a, d) => a + Number(d.minutos), 0), dias: dias.map(d => ({ fecha: String(d.fecha), minutos: Number(d.minutos) })) };
    });
  }
  async tareas(usuarioId: string, q = '', proyectoId?: string, gestion = false) {
    if (typeof q !== 'string' || q.length > 120) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Búsqueda demasiado larga.');
    if (proyectoId) id(proyectoId);
    return this.lectura(usuarioId, async (c, u) => {
      if (gestion) exigirGestorTiempos(u);
      const yo = await identidadTiempos(c, u);
      if (!gestion && !yo.puedeRegistrar) return { tareas: [], aviso: yo.aviso ?? 'PERMISO_DENEGADO' };
      const filas = await c`select t.id,t.titulo,p.proyecto_id,pr.nombre proyecto,s.nombre sala,t.estado,(p.archivado_en is not null or t.estado in ('borrador','anulada') or exists(select 1 from hitos_proyecto h where h.proyecto_id=p.proyecto_id and h.tipo='cierre') or (t.sala_id is not null and l.proyecto_id is distinct from p.proyecto_id)) historica from plan_tareas t join planes p on p.id=t.plan_id join proyectos pr on pr.id=p.proyecto_id left join salas s on s.id=t.sala_id left join localizaciones l on l.id=s.localizacion_id where (t.sala_id is null or ${veSalasTiempo(u)}) and (${!proyectoId} or p.proyecto_id=${proyectoId ?? null}::uuid) and (t.titulo ilike ${'%' + q + '%'} or pr.nombre ilike ${'%' + q + '%'}) and (${gestion} or (p.archivado_en is null and t.estado in ('pendiente','en_curso','hecha') and (t.sala_id is null or l.proyecto_id=p.proyecto_id) and not exists(select 1 from hitos_proyecto h where h.proyecto_id=p.proyecto_id and h.tipo='cierre') and exists(select 1 from plan_asignaciones a where a.tarea_id=t.id and a.tecnico_id=${yo.tecnicoId}::uuid and a.activo))) order by pr.nombre,t.titulo,t.id limit ${LIMITES_TIEMPOS.sugerencias}`;
      return { tareas: filas.map(t => ({ id: String(t.id), titulo: String(t.titulo), proyectoId: String(t.proyecto_id), proyecto: String(t.proyecto), sala: t.sala ? String(t.sala) : null, estado: String(t.estado), historica: !!t.historica })) };
    });
  }
  async tecnicos(usuarioId: string, q = '') {
    if (typeof q !== 'string' || q.length > 120) throw new ErrorTiempo('ENTRADA_INVALIDA', 'Búsqueda demasiado larga.');
    return this.lectura(usuarioId, async (c, u) => { exigirGestorTiempos(u); return { tecnicos: (await c`select id,nombre from tecnicos where activo and nombre ilike ${'%' + q + '%'} order by nombre,id limit ${LIMITES_TIEMPOS.sugerencias}`).map(t => ({ id: String(t.id), nombre: String(t.nombre) })) }; });
  }
  private async validarPropio(c: ConexionTiempos, u: AutorTiempos, ctx: Contexto, tecnicoId: string) {
    await exigirPropioTiempos(c, u, tecnicoId);
    const [asignado] = await c`select 1 from plan_asignaciones where tarea_id=${ctx.tarea_id} and tecnico_id=${tecnicoId} and activo`;
    if (!asignado) throw new ErrorTiempo('ASIGNACION_REQUERIDA', 'La tarea debe tener una asignación activa a tu técnico.', 403);
    if (ctx.archivado || !['pendiente','en_curso','hecha'].includes(ctx.estado) || (ctx.sala_id && ctx.sala_proyecto_id !== ctx.proyecto_id) || (await c`select 1 from hitos_proyecto where proyecto_id=${ctx.proyecto_id} and tipo='cierre'`).length) throw new ErrorTiempo('CONTEXTO_CERRADO', 'El gestor debe registrar o corregir este trabajo histórico con un motivo.', 409);
  }
  private async bloquear(c: ConexionTiempos, usuarioId: string, previa: Contexto, tecnicoId: string) {
    // Orden también para las FK: sala → obra → plan/tarea → técnico → parte.
    if (previa.sala_id) await c`select id from salas where id=${previa.sala_id} for update`;
    await c`select id from proyectos where id=${previa.proyecto_id} for update`;
    await c`select id from planes where id=${previa.plan_id} for update`;
    await c`select id from plan_tareas where id=${previa.tarea_id} for update`;
    const [tecnico] = await c`select id,activo from tecnicos where id=${tecnicoId} for update`;
    if (!tecnico) throw noEncontrado();
    const actual = await this.tareaContexto(c, previa.tarea_id);
    if (actual.proyecto_id !== previa.proyecto_id || actual.plan_id !== previa.plan_id || actual.sala_id !== previa.sala_id) throw new ErrorTiempo('FUENTE_CAMBIADA', 'Cambió el ámbito de la tarea. Revisa de nuevo.', 409);
    const autor = await autorTiempos(c, usuarioId);
    this.contextoVisible(autor, actual.sala_id);
    return { ctx: actual, autor, tecnicoActivo: !!tecnico.activo };
  }
  private async anteriorOperacion(c: ConexionTiempos, u: AutorTiempos, clave: string, hash: string) {
    // Global por autor y clave, incluso si se dirigieron a técnicos distintos.
    await c`select pg_advisory_xact_lock(hashtextextended(${u.id + ':' + clave},5))`;
    const [op] = await c`select registro_id,version_id,hash_peticion from tiempo_operaciones where autor_id=${u.id} and clave_peticion=${clave}`;
    if (!op) return null;
    if (op.hash_peticion !== hash) throw new ErrorTiempo('IDEMPOTENCIA_CONFLICTO', 'La clave ya se usó con otra solicitud.', 409);
    await this.cabecera(c, u, String(op.registro_id));
    const [v] = await c`select numero,minutos,accion from tiempo_versiones where id=${op.version_id} and registro_id=${op.registro_id}`;
    return { id: String(op.registro_id), actualId: String(op.version_id), numeroActual: Number(v.numero), minutos: Number(v.minutos), accion: String(v.accion), repetida: true };
  }
  private async solapamiento(c: ConexionTiempos, tecnicoId: string, intervalo: { inicioUtc: string; finUtc: string }, excluir?: string) {
    const [conflicto] = await c`select v.inicio_utc,v.fin_utc from tiempo_registros r join tiempo_versiones v on v.id=r.actual_id where r.tecnico_id=${tecnicoId} and (${!excluir} or r.id<>${excluir ?? null}::uuid) and v.accion<>'anulacion' and v.inicio_utc<${intervalo.finUtc} and v.fin_utc>${intervalo.inicioUtc} limit 1`;
    // Ni IDs, ni títulos, ni sala/obra de otro contexto salen en este error.
    if (conflicto) throw new ErrorTiempo('SOLAPAMIENTO_REAL', 'El técnico ya tiene trabajo real en parte de ese intervalo. Corrige o divide el parte.', 409);
  }
  async crear(usuarioId: string, bruto: unknown, proyectoGestion?: string) {
    const b: AltaTiempo = entradaTiempo(altaTiempoSchema, bruto);
    if (proyectoGestion) id(proyectoGestion);
    const hash = createHash('sha256').update(canonicoTiempo({ tipo: 'registro', proyectoGestion, entrada: b })).digest('hex');
    return this.conexion.begin('isolation level read committed', async tx => {
      const c = tx as unknown as ConexionTiempos;
      const inicial = await autorTiempos(c, usuarioId);
      const gestion = !!proyectoGestion;
      if (gestion) exigirGestorTiempos(inicial);
      else if (b.tecnicoId) throw new ErrorTiempo('ENTRADA_INVALIDA', 'El técnico propio lo resuelve el servidor.');
      const tecnicoId = gestion ? b.tecnicoId : (await identidadTiempos(c, inicial)).tecnicoId;
      if (!tecnicoId) throw new ErrorTiempo('VINCULO_TECNICO_NO_RESUELTO', 'Selecciona un técnico válido o resuelve el vínculo en administración.', 403);
      const previa = await this.tareaContexto(c, b.tareaId);
      this.contextoVisible(inicial, previa.sala_id);
      if (gestion && previa.proyecto_id !== proyectoGestion) throw noEncontrado();
      const { ctx, autor, tecnicoActivo } = await this.bloquear(c, usuarioId, previa, tecnicoId);
      if (gestion) { exigirGestorTiempos(autor); if (!b.motivo) throw new ErrorTiempo('MOTIVO_REQUERIDO', 'La gestión requiere motivo.'); }
      else await this.validarPropio(c, autor, ctx, tecnicoId);
      const repetida = await this.anteriorOperacion(c, autor, b.clavePeticion, hash);
      if (repetida) return repetida;
      if (!tecnicoActivo) throw new ErrorTiempo('TECNICO_INACTIVO', 'No se admiten partes nuevos de un técnico inactivo.', 409);
      const [{ ahora }] = await c`select clock_timestamp() ahora`;
      const intervalo = validarIntervaloReal(b, new Date(ahora));
      intervalo.entradaLocal = { inicio: localDesdeInstante(intervalo.inicioUtc), fin: localDesdeInstante(intervalo.finUtc) };
      await this.solapamiento(c, tecnicoId, intervalo);
      if (b.relacionadoId) {
        const relacionado = await this.cabecera(c, autor, b.relacionadoId);
        const [v] = await c`select accion from tiempo_versiones where id=${relacionado.actual_id}`;
        if (v.accion !== 'anulacion' || (!gestion && String(relacionado.tecnico_id) !== tecnicoId)) throw new ErrorTiempo('RELACION_INVALIDA', 'Anula el parte erróneo antes de registrar el correcto. Sólo el gestor puede reclasificar otro técnico.', 409);
        if (!b.motivo) throw new ErrorTiempo('MOTIVO_REQUERIDO', 'Explica la relación con el parte anterior.');
      }
      const registroId = randomUUID(), versionId = randomUUID(), titular = await titularDelTecnico(c, tecnicoId);
      await c`insert into tiempo_registros(id,tarea_id,proyecto_id,sala_id,tecnico_id,titular_usuario_id,relacionado_id,actual_id) values(${registroId},${ctx.tarea_id},${ctx.proyecto_id},${ctx.sala_id},${tecnicoId},${titular},${b.relacionadoId ?? null},${versionId})`;
      await c`insert into tiempo_versiones(id,registro_id,numero,accion,inicio_utc,fin_utc,minutos,entrada_local,notas,motivo,autor_usuario_id,autor_nombre) values(${versionId},${registroId},1,'registro',${intervalo.inicioUtc},${intervalo.finUtc},${intervalo.minutos},${json(c, intervalo.entradaLocal)},${b.notas},${b.motivo ?? null},${autor.id},${autor.nombre})`;
      await c`insert into tiempo_operaciones(autor_id,clave_peticion,hash_peticion,registro_id,version_id,tipo) values(${autor.id},${b.clavePeticion},${hash},${registroId},${versionId},'registro')`;
      return { id: registroId, actualId: versionId, numeroActual: 1, minutos: intervalo.minutos, accion: 'registro', repetida: false };
    });
  }
  async corregir(usuarioId: string, registroId: string, bruto: unknown, gestion = false) { return this.cambiar(usuarioId, registroId, 'correccion', entradaTiempo(corregirTiempoSchema, bruto), gestion); }
  async anular(usuarioId: string, registroId: string, bruto: unknown, gestion = false) { return this.cambiar(usuarioId, registroId, 'anulacion', entradaTiempo(anularTiempoSchema, bruto), gestion); }
  async restaurar(usuarioId: string, registroId: string, bruto: unknown, gestion = false) { return this.cambiar(usuarioId, registroId, 'restauracion', entradaTiempo(restaurarTiempoSchema, bruto), gestion); }
  private async cambiar(usuarioId: string, registroId: string, tipo: 'correccion' | 'anulacion' | 'restauracion', b: CorreccionTiempo | AnulacionTiempo | RestauracionTiempo, gestion: boolean) {
    id(registroId);
    const hash = createHash('sha256').update(canonicoTiempo({ tipo, registroId, gestion, entrada: b })).digest('hex');
    return this.conexion.begin('isolation level read committed', async tx => {
      const c = tx as unknown as ConexionTiempos, inicial = await autorTiempos(c, usuarioId);
      if (gestion) exigirGestorTiempos(inicial);
      const previo = await this.cabecera(c, inicial, registroId), previa = await this.tareaContexto(c, String(previo.tarea_id));
      const { ctx, autor } = await this.bloquear(c, usuarioId, previa, String(previo.tecnico_id));
      const r = await this.cabecera(c, autor, registroId);
      await c`select id from tiempo_registros where id=${r.id} for update`;
      const actual = await this.cabecera(c, autor, registroId);
      if (String(actual.proyecto_id) !== ctx.proyecto_id || String(actual.tarea_id) !== ctx.tarea_id || (actual.sala_id ?? null) !== ctx.sala_id) throw new ErrorTiempo('FUENTE_CAMBIADA', 'El ámbito histórico no coincide con la tarea. Consulta al gestor.', 409);
      if (gestion) exigirGestorTiempos(autor);
      else { if (actual.titular_usuario_id !== autor.id) throw noEncontrado(); await this.validarPropio(c, autor, ctx, String(actual.tecnico_id)); }
      const repetida = await this.anteriorOperacion(c, autor, b.clavePeticion, hash);
      if (repetida) return repetida;
      if (Number(actual.numero_actual) !== b.numeroActual || actual.actual_id !== b.actualId) throw new ErrorTiempo('VERSION_CONFLICTO', 'El parte cambió. Recarga y compara antes de guardar.', 409);
      const [v] = await c`select id,numero,antecedente_id,accion,inicio_utc,fin_utc,minutos,entrada_local,notas,motivo,autor_nombre,creado_en from tiempo_versiones where registro_id=${registroId} and id=${tipo === 'restauracion' ? (b as RestauracionTiempo).versionId : actual.actual_id}`;
      if (!v || tipo === 'restauracion' && v.accion === 'anulacion') throw new ErrorTiempo('VERSION_INVALIDA', 'Elige una versión de intervalo del mismo parte.', 409);
      if (tipo === 'anulacion' && v.accion === 'anulacion') throw new ErrorTiempo('YA_ANULADO', 'El parte ya está anulado.', 409);
      const [{ ahora }] = await c`select clock_timestamp() ahora`;
      const contenido = tipo === 'correccion' ? b as CorreccionTiempo : { ...(v.entrada_local as VersionTiempo['entradaLocal']), notas: String(v.notas) };
      const intervalo = validarIntervaloReal(contenido, new Date(ahora));
      intervalo.entradaLocal = { inicio: localDesdeInstante(intervalo.inicioUtc), fin: localDesdeInstante(intervalo.finUtc) };
      if (tipo !== 'anulacion') await this.solapamiento(c, String(actual.tecnico_id), intervalo, registroId);
      const versionId = randomUUID(), numero = Number(actual.numero_actual) + 1, accion = tipo === 'anulacion' ? 'anulacion' : 'correccion';
      await c`insert into tiempo_versiones(id,registro_id,numero,antecedente_id,accion,inicio_utc,fin_utc,minutos,entrada_local,notas,motivo,autor_usuario_id,autor_nombre) values(${versionId},${registroId},${numero},${actual.actual_id},${accion},${intervalo.inicioUtc},${intervalo.finUtc},${intervalo.minutos},${json(c, intervalo.entradaLocal)},${contenido.notas},${b.motivo},${autor.id},${autor.nombre})`;
      const cambiadas = await c`update tiempo_registros set numero_actual=${numero},actual_id=${versionId} where id=${registroId} and numero_actual=${b.numeroActual} and actual_id=${b.actualId} returning id`;
      if (cambiadas.length !== 1) throw new ErrorTiempo('VERSION_CONFLICTO', 'El parte cambió. Recarga antes de guardar.', 409);
      await c`insert into tiempo_operaciones(autor_id,clave_peticion,hash_peticion,registro_id,version_id,tipo) values(${autor.id},${b.clavePeticion},${hash},${registroId},${versionId},${tipo})`;
      return { id: registroId, actualId: versionId, numeroActual: numero, minutos: intervalo.minutos, accion, repetida: false };
    });
  }
}
