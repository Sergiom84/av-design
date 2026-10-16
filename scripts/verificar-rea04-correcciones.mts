import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, URL_REA_PRUEBA, idPlan, type SqlRevisionesPrueba } from './rea04-fixture.mjs';
import { RepositorioPlanificacion } from '../src/lib/planificacion/repositorio';
import { resumirAgenda } from '../src/lib/planificacion/agenda';
import { ErrorPlan, type FiltroAgenda, type CamposTarea, type TareaPlan } from '../src/lib/planificacion/modelo';
const salida = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04/correccion-reanudacion');
assert.equal(process.env.REA_DATABASE_URL, URL_REA_PRUEBA);
const c = await conectarRevisiones(URL_REA_PRUEBA), admin = idPlan(1), run = randomUUID();
const repo = new RepositorioPlanificacion(c, { secreto: 'rea04-local-prueba-integracion-secreto-2026' });
const p = randomUUID(), l = randomUUID(), sala = randomUUID(), p2 = randomUUID(), l2 = randomUUID(), usuario = randomUUID(), tecnico = randomUUID(), otroTecnico = randomUUID();
const campos: CamposTarea = { titulo: 'Corrección REA04 ' + run, descripcion: '', notas: '', duracionEstimadaMin: null, estado: 'pendiente', venceFecha: null, intervalo: null };
const resultados: Record<string, unknown>[] = [], consultas: string[] = [];
const es = (status: number) => (e: unknown) => e instanceof ErrorPlan && e.status === status;
const espiar = (sql: SqlRevisionesPrueba): SqlRevisionesPrueba => new Proxy(sql, {
    apply(target, thisArg, args) { consultas.push((args[0] as TemplateStringsArray).join('?')); return Reflect.apply(target, thisArg, args); },
    get(target, k) {
        if (k === 'begin') return (...args: unknown[]) => {
            const fn = args.pop() as (tx: SqlRevisionesPrueba) => Promise<unknown>;
            return (target.begin as (...a: unknown[]) => unknown)(...args, (tx: SqlRevisionesPrueba) => fn(espiar(tx)));
        };
        if (k === 'unsafe') return (q: string, ...args: unknown[]) => { consultas.push(q); return (target.unsafe as (...a: unknown[]) => unknown)(q, ...args); };
        return Reflect.get(target, k);
    },
});
async function manual(proyecto: string, extra: Partial<CamposTarea> = {}, salaId: string | null = null) {
    const versionPlan = (await repo.leerPlan(admin, proyecto)).plan!.version;
    const nueva = await repo.crearTarea(admin, proyecto, { ...campos, ...extra, salaId, trabajoId: null, versionPlan, clavePeticion: randomUUID() });
    return repo.tarea(admin, String(nueva.id));
}
function editable(t: TareaPlan, extra: Partial<CamposTarea> = {}) {
    return { titulo: t.titulo, descripcion: t.descripcion, notas: t.notas, estado: t.estado, duracionEstimadaMin: t.duracionEstimadaMin, venceFecha: t.venceFecha, intervalo: null, ...extra, versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID() };
}
const normalizarOcupacion = (ocupacion: { tecnicoId: string; minutos: number }[]) => ocupacion.map(p => ({ tecnicoId: p.tecnicoId, minutos: p.minutos })).sort((a, b) => a.tecnicoId.localeCompare(b.tecnicoId));
try {
    await mkdir(salida, { recursive: true });
    await c `insert into proyectos(id,nombre,codigo)values(${p},${'Corrección04 origen ' + run},${'COR04-' + run}),(${p2},${'Corrección04 agenda ' + run},${'COR04-B-' + run})`;
    await c `insert into localizaciones(id,proyecto_id,nombre)values(${l},${p},'Origen corrección'),(${l2},${p2},'Destino corrección')`;
    await c `insert into salas(id,nombre,codigo,localizacion_id)values(${sala},'Sala corrección',${'COR04-' + run},${l})`;
    await c `insert into usuarios(id,usuario,nombre,rol,clave_hash,activo,debe_cambiar_clave)values(${usuario},${'cor04-' + run},'Corrección sin catálogo','lectura','no-login-sintetico',true,false)`;
    await c `insert into usuario_permisos(usuario_id,seccion,acceso)values(${usuario},'proyectos','editar'),(${usuario},'salas','ver'),(${usuario},'catalogo','oculto')`;
    await c `insert into tecnicos(id,nombre,activo,fuente)values(${tecnico},${'ZZZZ Corrección04 ' + run},true,'app'),(${otroTecnico},${'ZZZZ Corrección04 segundo ' + run},true,'app')`;
    await repo.crearPlan(admin, p, randomUUID());
    await repo.crearPlan(admin, p2, randomUUID());
    let t = await manual(p, {}, sala);
    await c `update salas set localizacion_id=${l2} where id=${sala}`;
    await repo.editarTarea(admin, t.id, { ...editable(t, { estado: 'anulada' }), motivo: 'Resolver la sala trasladada' });
    let plan = (await repo.leerPlan(admin, p)).plan!;
    await repo.editarPlan(admin, p, { versionPlan: plan.version, notas: '', archivado: true, motivo: 'Archivo sintético', clavePeticion: randomUUID() });
    plan = (await repo.leerPlan(admin, p)).plan!;
    const reactivacion = { versionPlan: plan.version, notas: '', archivado: false, motivo: 'Reactivar tras resolución expresa', clavePeticion: randomUUID() };
    const reactivada = await repo.editarPlan(admin, p, reactivacion);
    assert.deepEqual(await repo.editarPlan(admin, p, reactivacion), reactivada);
    assert.equal((await repo.tarea(admin, t.id)).estado, 'anulada');
    assert.equal((await repo.leerPlan(admin, p)).plan!.archivado, false);
    resultados.push({ caso: 'R04-01', ok: true, tareaHistorica: t.id, reactivada });
    const trabajo = await repo.guardarTrabajo(admin, { titulo: 'Regla privada corrección ' + run, descripcion: '', duracionEstimadaMin: null, activo: true });
    const regla = await repo.guardarRegla(admin, { trabajoId: trabajo.id, selector: { tipo: 'equipo', categoria: 'PRIVADO_CORRECCION04' }, activo: true });
    const restringida = new RepositorioPlanificacion(espiar(c));
    await assert.rejects(() => restringida.guardarRegla(usuario, { trabajoId: trabajo.id, selector: { tipo: 'sala' }, activo: true }, String(regla.id), 0), es(403));
    assert(!consultas.some(q => /select\s+version\s*,\s*selector\s+from/i.test(q)));
    assert(!consultas.some(q => /from\s+articulos\b/i.test(q)));
    const anterior = [...consultas]; consultas.length = 0;
    const publica = await repo.guardarRegla(admin, { trabajoId: trabajo.id, selector: { tipo: 'sala' }, activo: true });
    await restringida.guardarRegla(usuario, { trabajoId: trabajo.id, selector: { tipo: 'tipologia', tipologia: 'Literal' }, activo: true }, String(publica.id), 0);
    await assert.rejects(() => restringida.guardarRegla(usuario, { trabajoId: trabajo.id, selector: { tipo: 'equipo' }, activo: true }, String(publica.id), 1), es(403));
    await assert.rejects(() => repo.guardarRegla(admin, { trabajoId: trabajo.id, selector: { tipo: 'sala' }, activo: true }, String(publica.id), 0), es(409));
    resultados.push({ caso: 'R04-02', ok: true, consultasDenegacion: anterior, catalogoNuevoYAnterior: true, CAS: true });
    const prefijo = 'Busca20Correccion-' + run;
    for (let n = 0; n < 25; n++) await repo.guardarTrabajo(admin, { titulo: prefijo + '-' + String(n).padStart(2, '0'), descripcion: '', duracionEstimadaMin: null, activo: true });
    const primera = await repo.catalogo(admin, prefijo), segunda = await repo.catalogo(admin, prefijo, 2), administracion = await repo.catalogo(admin, prefijo, 1, true);
    assert.equal(primera.length, 20); assert.equal(segunda.length, 5); assert.equal(administracion.length, 25);
    assert.equal(new Set([...primera, ...segunda].map(t => t.id)).size, 25);
    resultados.push({ caso: 'R04-06', ok: true, busqueda: primera.length, segunda: segunda.length, administracion: administracion.length, prefijo });
    for (let n = 0; n < 25; n++) await c `insert into tecnicos(nombre,activo,fuente)values(${'AAAAA Corrección04 ' + run + '-' + n},true,'app')`;
    assert.equal((await repo.tecnicos(admin)).length, 20);
    assert(!(await repo.tecnicos(admin)).some(t => t.id === tecnico));
    assert.equal((await repo.tecnicoAgenda(admin, tecnico)).id, tecnico);
    resultados.push({ caso: 'R04-05', ok: true, tecnico, nombre: (await repo.tecnicoAgenda(admin, tecnico)).nombre });
    const sinFecha = await manual(p2, { titulo: 'Sin fecha corrección ' + run, estado: 'borrador' });
    for (const [indice, inicio, fin] of [[1, '09:00', '11:00'], [2, '10:00', '12:00']] as const) {
        t = await manual(p2, { titulo: 'Ocupación corrección ' + indice + ' ' + run, intervalo: { inicio: { fecha: '2026-10-15', hora: inicio }, fin: { fecha: '2026-10-15', hora: fin } } });
        if (indice === 1) await repo.asignar(admin, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [tecnico], grupos: [] });
        else await repo.asignar(admin, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [otroTecnico], grupos: [] });
    }
    const basePure = (await repo.tareas(admin, p2)).tareas, ahora = new Date('2026-10-15T12:00:00Z');
    const paridad: unknown[] = [];
    for (const vista of ['hoy', 'semana', 'vencidas', 'sin_fecha'] as const) for (const extra of [{}, { tecnicoId: tecnico }, { desde: '2026-10-16', hasta: '2026-10-16' }, { historial: true }]) {
        const filtro: FiltroAgenda = { vista, proyectoId: p2, ...extra }, puro = resumirAgenda(basePure, filtro, ahora), sql = await repo.agenda(admin, filtro, ahora);
        assert.deepEqual(sql.contadores, puro.contadores);
        assert.deepEqual(sql.tareas.map(t => t.id), puro.tareas.map(t => t.id));
        assert.deepEqual(normalizarOcupacion(sql.ocupacion), normalizarOcupacion(puro.ocupacion));
        assert.deepEqual(sql.estimacion, puro.estimacion); assert.equal(sql.ahora, puro.ahora); assert.deepEqual(sql.rango, puro.rango);
        paridad.push({ filtro, contadores: sql.contadores, ocupacion: sql.ocupacion, ids: sql.tareas.map(t => t.id), ahora: sql.ahora });
    }
    const [{ n: antes }] = await c `select count(*)::int n from plan_tareas`;
    let cardinalidad: unknown;
    try {
        await c.begin(async tx => {
            for (let n = 0; n < 3; n++) {
                const proyecto = randomUUID(), plan = randomUUID();
                await tx `insert into proyectos(id,nombre,codigo)values(${proyecto},${'Rollback corrección04 ' + proyecto},${'ROLLBACK04-' + proyecto})`;
                await tx `insert into planes(id,proyecto_id,creado_por)values(${plan},${proyecto},${admin})`;
                await tx `insert into plan_tareas(plan_id,titulo,creado_por)select ${plan},'Tarea rollback '||n,${admin} from generate_series(1,4000)n`;
            }
            const resultado = await repo.agendaEnLectura(tx as unknown as SqlRevisionesPrueba, admin, { vista: 'sin_fecha', proyectoId: p2 }, ahora);
            assert.deepEqual(resultado.tareas.map(t => t.id), [sinFecha.id]);
            assert.equal(resultado.contadores.sin_fecha, 1); assert.equal(resultado.contadores.hoy, 2);
            const globalHoy = await repo.agendaEnLectura(tx as unknown as SqlRevisionesPrueba, admin, { vista: 'hoy' }, ahora);
            assert(globalHoy.contadores.sin_fecha >= 12000);
            cardinalidad = { total: Number(antes) + 12000, filtradas: resultado.tareas.length, globalContadores: globalHoy.contadores, sinTruncar: true };
            throw new Error('ROLLBACK_CORRECCION04');
        });
    } catch (e) { if (!(e instanceof Error) || e.message !== 'ROLLBACK_CORRECCION04') throw e; }
    const [{ n: despues }] = await c `select count(*)::int n from plan_tareas`;
    assert.equal(despues, antes);
    resultados.push({ caso: 'R04-04', ok: true, paridad, cardinalidad, rollback: { antes, despues } });
    await writeFile(resolve(salida, 'ids-correcciones.json'), JSON.stringify({ proyecto: p2, tarea: sinFecha.id, tecnico, tecnicoNombre: 'ZZZZ Corrección04 ' + run, prefijo }, null, 2));
    console.log('R04-01/02/04/05/06 SQL y 16 combinaciones de paridad aprobadas; R04-03 se verifica en DOM/Chrome.');
} finally {
    await writeFile(resolve(salida, 'correcciones-sql.json'), JSON.stringify(resultados, null, 2));
    await c.end();
}
