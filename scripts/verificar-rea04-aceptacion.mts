import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { conectarRevisiones, URL_REA_PRUEBA, idPlan, fotografiarRevisiones, type SqlRevisionesPrueba } from './rea04-fixture.mjs';
import { RepositorioPlanificacion } from '../src/lib/planificacion/repositorio';
import { ErrorPlan, type SeleccionPlan, type CamposTarea, type TareaPlan } from '../src/lib/planificacion/modelo';
import { hashPlan } from '../src/lib/planificacion/reglas';
import { leerPanel } from '../src/lib/panel-repositorio';
import { resolverPermisos } from '../src/lib/usuarios';
import { instanteLocal, rangoMadrid, intervaloPlan } from '../src/lib/planificacion/fechas';
const tanda = Date.now().toString(36);
const raizEvidencia = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04');
const salida = resolve(raizEvidencia, 'aceptacion', tanda);
assert.equal(process.env.REA_DATABASE_URL, URL_REA_PRUEBA);
const c = await conectarRevisiones(process.env.REA_DATABASE_URL!);
const base = Number(String(Date.now()).slice(-9)) + 200000000;
const f = (n: number) => idPlan(base + n), u = idPlan(1), lectura = idPlan(2);
const repo = new RepositorioPlanificacion(c, { secreto: 'rea04-local-prueba-integracion-secreto-2026' });
const proyecto = f(1), localizacion = f(2), sala = f(3), sala2 = f(4), legado = f(5), obra2 = f(6), loc2 = f(7), salaAjena = f(8), tecnico = f(10);
const resultados: {
    caso: number;
    nombre: string;
    ok: boolean;
    detalle?: unknown;
}[] = [];
const consultas: string[] = [];
const es = (status: number) => (e: unknown) => e instanceof ErrorPlan && e.status === status;
const campos: CamposTarea = { titulo: 'Manual de aceptación', descripcion: 'Texto operativo literal', notas: '', duracionEstimadaMin: null, estado: 'borrador', venceFecha: null, intervalo: null };
function espiar(conexion: SqlRevisionesPrueba): SqlRevisionesPrueba {
    return new Proxy(conexion, { apply: (destino, thisArg, args) => {
            consultas.push((args[0] as TemplateStringsArray).join('?'));
            return Reflect.apply(destino, thisArg, args);
        }, get: (destino, k) => {
            if (k === 'begin')
                return (...args: unknown[]) => {
                    const fn = args.pop() as (c: SqlRevisionesPrueba) => Promise<unknown>;
                    return (destino.begin as (...a: unknown[]) => unknown)(...args, (tx: SqlRevisionesPrueba) => fn(espiar(tx)));
                };
            if (k === 'unsafe')
                return (texto: string, ...args: unknown[]) => {
                    consultas.push(texto);
                    return (destino.unsafe as (...a: unknown[]) => unknown)(texto, ...args);
                };
            return Reflect.get(destino, k);
        } });
}
async function comprobar(caso: number, nombre: string, hacer: () => Promise<unknown>) {
    try {
        const detalle = await hacer();
        resultados.push({ caso, nombre, ok: true, ...(detalle === undefined ? {} : { detalle }) });
        console.log(`GWT${caso} OK ${nombre}`);
    }
    catch (e) {
        resultados.push({ caso, nombre, ok: false, detalle: String(e) });
        throw e;
    }
}
async function version(obra = proyecto) {
    return (await repo.leerPlan(u, obra)).plan!.version;
}
async function manual(obra = proyecto, extra: Partial<CamposTarea> = {}, salaId: string | null = null) {
    const r = await repo.crearTarea(u, obra, { ...campos, ...extra, salaId, trabajoId: null, versionPlan: await version(obra), clavePeticion: randomUUID() });
    return repo.tarea(u, String(r.id));
}
function edit(t: TareaPlan, extra: Partial<CamposTarea> = {}) {
    return { ...campos, titulo: t.titulo, descripcion: t.descripcion, notas: t.notas, duracionEstimadaMin: t.duracionEstimadaMin, estado: t.estado, venceFecha: t.venceFecha, ...extra, versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID() };
}
let tarea: TareaPlan;
const reglas: string[] = [];
let seleccion: SeleccionPlan;
const revisionId = f(40);
try {
    await mkdir(salida, { recursive: true });
    await c `insert into proyectos(id,nombre,codigo) values(${proyecto},${'REA04 GWT ' + base},${'REA04-GWT-' + base}),(${obra2},${'REA04 GWT segunda ' + base},${'REA04-GWT2-' + base})`;
    await c `insert into localizaciones(id,proyecto_id,nombre) values(${localizacion},${proyecto},'EdificioA'),(${loc2},${obra2},'EdificioB')`;
    for (const [id, nombre, loc] of [[sala, 'SalaA', localizacion], [sala2, 'SalaB', localizacion], [legado, 'Legado', null], [salaAjena, 'Ajena', loc2]] as const)
        await c `insert into salas(id,nombre,codigo,tipologia,localizacion_id,largo_m,ancho_m,alto_m)values(${id},${nombre + ' ' + base},${id.slice(-12)},'TP',${loc},6,4,3)`;
    await c `insert into tecnicos(id,nombre,activo,fuente) values(${tecnico},${'Técnico GWT ' + base},true,'app')`;
    await c `insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,fuente)values(${f(20)},${'REA04-EQ-' + base},'equipo','PANTALLAS','REA04',${'Equipo sintético ' + base},'ud','app'),(${f(21)},${'REA04-CB-' + base},'cable','CABLE','REA04',${'Cable sintético ' + base},'m','app'),(${f(22)},${'REA04-MB-' + base},'consumible','BOM','REA04',${'Partida sintética ' + base},'ud','app')`;
    await c `insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,posicion_confirmada)values(${f(30)},${sala},${f(20)},'Equipo estimado',8,'pared',false),(${f(31)},${sala},${f(20)},'Equipo destino',1,'mesa',true)`;
    await c `insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta)values(${f(32)},${sala},${f(30)},${f(31)},${f(21)},'hdmi','directo')`;
    await c `insert into sala_material_bom(id,sala_id,articulo_id,cantidad,unidad,nota)values(${f(33)},${sala},${f(22)},3,'ud','Adicional persistida')`;
    await comprobar(1, 'Obra existente, GETsincrear, unicidad y rechazo legado/ajena', async () => {
        assert.equal((await repo.leerPlan(u, proyecto)).plan, null);
        assert.equal((await c `select id from planes where proyecto_id=${proyecto}`).length, 0);
        const clave = randomUUID(), p = await repo.crearPlan(u, proyecto, clave);
        assert.deepEqual(await repo.crearPlan(u, proyecto, clave), p);
        await assert.rejects(async () => repo.crearPlan(u, proyecto, randomUUID()), es(409));
        await repo.crearPlan(u, obra2, randomUUID());
        for (const salaId of [legado, salaAjena])
            await assert.rejects(async () => repo.crearTarea(u, proyecto, { ...campos, salaId, trabajoId: null, versionPlan: awaitVersionDummy(), clavePeticion: randomUUID() }), es(409));
        function awaitVersionDummy() {
            return Number(p.versionPlan);
        }
        assert.equal((await c `select localizacion_id from salas where id=${legado}`)[0].localizacion_id, null);
    });
    await comprobar(2, 'Catálogo/reglasCAS, cinco selectores y manual sin estimar', async () => {
        tarea = await manual(proyecto, {}, null);
        assert.equal(tarea.duracionEstimadaMin, null);
        const trabajo = await repo.guardarTrabajo(u, { titulo: 'Trabajo GWT literal', descripcion: 'No interpolar marca/modelo', duracionEstimadaMin: null, activo: true });
        for (const selector of [{ tipo: 'sala' }, { tipo: 'tipologia', tipologia: 'TP' }, { tipo: 'equipo', categoria: 'PANTALLAS' }, { tipo: 'conexion', senal: 'hdmi' }, { tipo: 'material_bom' }])
            reglas.push(String((await repo.guardarRegla(u, { trabajoId: trabajo.id, selector, activo: true })).id));
        await repo.guardarTrabajo(u, { titulo: 'Trabajo GWT actualizado', descripcion: 'Cambio revisable', duracionEstimadaMin: 30, activo: true }, String(trabajo.id), 0);
        await assert.rejects(async () => repo.guardarTrabajo(u, { titulo: 'No pisar', descripcion: '', duracionEstimadaMin: null, activo: true }, String(trabajo.id), 0), es(409));
    });
    await comprobar(3, 'Fuente real porIDs, cantidades, cableinmutable y geometríaestimada', async () => {
        seleccion = { versionPlan: await version(), salas: { modo: 'seleccion', ids: [sala] }, reglas, fuentes: [{ salaId: sala, tipo: 'actual' }] };
        const p = await repo.preparar(u, proyecto, seleccion);
        assert.equal(p.diff.length, 6);
        const eq = p.diff.filter(d => d.candidata?.origenPublico.tipoOrigen === 'equipo');
        assert.equal(eq.length, 2);
        assert(eq.some(d => d.candidata?.origenPublico.posicionEstimada));
        const conexion = p.diff.find(d => d.candidata?.origenPublico.tipoOrigen === 'conexion')!;
        assert.equal((conexion.candidata!.origenCatalogo.elemento as Record<string, unknown>).identificadorCable, 'HD-1000');
        const bom = p.diff.find(d => d.candidata?.origenPublico.tipoOrigen === 'material_bom')!;
        assert.equal((bom.candidata!.origenCatalogo.elemento as Record<string, unknown>).cantidad, 3);
    });
    await comprobar(4, 'E3anterior proyectado, aceptación explícita y sin blobprivado', async () => {
        const [actual] = await c `select diseno_version from salas where id=${sala}`;
        const snapshot = { formato: 1, salaId: sala, sala: { tipologia: 'TP' }, datos: { equipos: [{ id: f(30), articulo_id: f(20), cantidad: 8, posicion_confirmada: false }], conexiones: [], material: [] }, contexto: { articulos: [{ id: f(20), tipo: 'equipo', categoria: 'PANTALLAS', marca: 'REA04', modelo: 'Equipo sintético ' + base, activo: true, coste: 987654321 }], parametros: [{ secreto: 'NOLEER' }] } };
        await c `insert into revisiones_diseno(id,sala_id,numero,nombre,autor_id,autor_nombre,hash,diseno_version,snapshot)values(${revisionId},${sala},1,'Revisión anterior sintética',${u},'Autor QA',${hashPlan(snapshot)},${Number(actual.diseno_version) - 1},${c.json(snapshot)})`;
        const s: SeleccionPlan = { ...seleccion, versionPlan: await version(), reglas: [reglas[2]], fuentes: [{ salaId: sala, tipo: 'revision', revisionId }] };
        consultas.length = 0;
        const espiado = new RepositorioPlanificacion(espiar(c), { secreto: 'rea04-local-prueba-integracion-secreto-2026' });
        const p = await espiado.preparar(u, proyecto, s);
        assert.equal(p.anteriores.length, 1);
        assert(!JSON.stringify(p).includes('987654321'));
        assert(!consultas.some(q => /contexto.*parametros|snapshot\s*(?:as|,|from)|coste|pvp/.test(q)));
        const b = { seleccion: s, token: p.token, clavePeticion: randomUUID(), acciones: [{ clave: p.diff[0].clave, accion: 'crear', versionTarea: null, campos: [] }] };
        await assert.rejects(async () => repo.confirmar(u, proyecto, b), es(409));
        await repo.confirmar(u, proyecto, { ...b, aceptoFuenteAnterior: true });
    });
    await comprobar(5, 'Selección/idempotencia y otra clave no duplica un origen', async () => {
        seleccion = { ...seleccion, versionPlan: await version() };
        const p = await repo.preparar(u, proyecto, seleccion);
        const nuevas = p.diff.filter(d => d.estado === 'nueva').slice(0, 2);
        const b = { seleccion, token: p.token, clavePeticion: randomUUID(), acciones: nuevas.map(d => ({ clave: d.clave, accion: 'crear', versionTarea: null, campos: [] })) };
        const r = await repo.confirmar(u, proyecto, b);
        assert.deepEqual(await repo.confirmar(u, proyecto, b), r);
        await assert.rejects(async () => repo.confirmar(u, proyecto, { ...b, clavePeticion: randomUUID() }), es(409));
        const duplicadas = await c `select clave_origen,count(*)::int n from plan_tareas where plan_id=(select id from planes where proyecto_id=${proyecto}) and clave_origen is not null group by clave_origen having count(*)>1`;
        assert.equal(duplicadas.length, 0);
    });
    await comprobar(6, 'Edición manual porcampo, anuladas/hechas no reactivadas al regenerar', async () => {
        seleccion = { ...seleccion, versionPlan: await version() };
        let p = await repo.preparar(u, proyecto, seleccion);
        const existente = p.diff.find(d => d.tarea && d.candidata)!;
        let t = await repo.tarea(u, existente.tarea!.id);
        await repo.editarTarea(u, t.id, edit(t, { titulo: 'Título humano conservado' }));
        seleccion = { ...seleccion, versionPlan: await version() };
        p = await repo.preparar(u, proyecto, seleccion);
        const d = p.diff.find(d => d.tarea?.id === t.id)!;
        assert.equal(d.estado, 'edicion_manual');
        await repo.confirmar(u, proyecto, { seleccion, token: p.token, clavePeticion: randomUUID(), aceptoFuenteAnterior: false, acciones: [{ clave: d.clave, accion: 'actualizar', versionTarea: d.tarea!.version, campos: [] }] });
        t = await repo.tarea(u, t.id);
        assert.equal(t.titulo, 'Título humano conservado');
        await repo.editarTarea(u, t.id, { ...edit(t, { estado: 'anulada' }), motivo: 'Anular expresamente sin recrear' });
        seleccion = { ...seleccion, versionPlan: await version() };
        let anulada = await repo.preparar(u, proyecto, seleccion);
        const da = anulada.diff.find(d => d.tarea?.id === t.id)!;
        assert.equal(da.estado, 'anulada_existente');
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion, token: anulada.token, clavePeticion: randomUUID(), acciones: [{ clave: da.clave, accion: 'crear', versionTarea: null, campos: [] }] }), es(409));
        assert.equal((await repo.tarea(u, t.id)).estado, 'anulada');
        const otra = anulada.diff.find(d => d.tarea && d.tarea.id !== t.id && d.candidata)!;
        let hecha = await repo.tarea(u, otra.tarea!.id);
        await repo.editarTarea(u, hecha.id, edit(hecha, { estado: 'hecha' }));
        seleccion = { ...seleccion, versionPlan: await version() };
        anulada = await repo.preparar(u, proyecto, seleccion);
        const dh = anulada.diff.find(d => d.tarea?.id === hecha.id)!;
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion, token: anulada.token, clavePeticion: randomUUID(), acciones: [{ clave: dh.clave, accion: 'anular', versionTarea: dh.tarea!.version, campos: [], motivo: 'No se debe anular una hecha desde regeneración' }] }), es(409));
        hecha = await repo.tarea(u, hecha.id);
        assert.equal(hecha.estado, 'hecha');
    });
    await comprobar(7, 'ACLactual antes de fuentes: sin SQLprivado y sin salas ni contarlas', async () => {
        await c `insert into usuario_permisos(usuario_id,seccion,acceso)values(${lectura},'catalogo','oculto'),(${lectura},'compras','oculto'),(${lectura},'almacen','oculto'),(${lectura},'parametros','oculto') on conflict(usuario_id,seccion)do update set acceso='oculto'`;
        consultas.length = 0;
        const r = new RepositorioPlanificacion(espiar(c), { secreto: 'rea04-local-prueba-integracion-secreto-2026' });
        await r.leerPlan(lectura, proyecto);
        await r.agenda(lectura, { vista: 'semana' }, new Date('2026-10-15T12:00:00Z'));
        assert(!consultas.some(q => /\b(precios|existencias|movimientos|reservas|pedidos|cargas|parametros)\b|\bcoste\b|\bpvp\b|origen_catalogo/.test(q)));
        await assert.rejects(async () => r.preparar(lectura, proyecto, { ...seleccion, versionPlan: await version(), reglas: [reglas[2]] }), es(403));
        await c `insert into usuario_permisos(usuario_id,seccion,acceso)values(${lectura},'salas','oculto') on conflict(usuario_id,seccion)do update set acceso='oculto'`;
        consultas.length = 0;
        const p = await r.leerPlan(lectura, proyecto);
        assert(p.tareas.every(t => t.salaId === null));
        assert(!consultas.some(q => /\b(?:from|join) salas\b/.test(q)));
        await assert.rejects(async () => r.agenda(lectura, { vista: 'hoy' }), es(403));
        await writeFile(resolve(salida, 'consultas-sin-salas.json'), JSON.stringify(consultas, null, 2));
        await c `delete from usuario_permisos where usuario_id=${lectura} and seccion in ('catalogo','compras','almacen','parametros','salas')`;
    });
    await comprobar(8, 'Autorusuario distinto de técnico; baja preservahistoria y bloquea nuevasasignaciones', async () => {
        tarea = await manual(proyecto, { estado: 'pendiente' });
        await repo.asignar(u, tarea.id, { versionPlan: tarea.versionPlan, versionTarea: tarea.version, clavePeticion: randomUUID(), tecnicos: [tecnico], grupos: [] });
        const [asignada] = await c `select asignado_por from plan_asignaciones where tarea_id=${tarea.id}`;
        assert.equal(asignada.asignado_por, u);
        assert.notEqual(tecnico, u);
        await c `update tecnicos set activo=false where id=${tecnico}`;
        tarea = await repo.tarea(u, tarea.id);
        assert.equal(tarea.tecnicos[0].activo, false);
        await assert.rejects(async () => repo.asignar(u, tarea.id, { versionPlan: tarea.versionPlan, versionTarea: tarea.version, clavePeticion: randomUUID(), tecnicos: [tecnico], grupos: [] }), es(409));
        await c `update tecnicos set activo=true where id=${tecnico}`;
    });
    await comprobar(9, 'Dosgrupos deduplicados, expansión congelada, CAS y grupoajeno', async () => {
        let t = await manual(proyecto, { estado: 'pendiente' });
        const g1 = await repo.guardarGrupo(u, proyecto, { nombre: 'Grupo1', miembros: [tecnico], activo: true, versionPlan: await version(), clavePeticion: randomUUID() });
        const g2 = await repo.guardarGrupo(u, proyecto, { nombre: 'Grupo2', miembros: [tecnico], activo: true, versionPlan: await version(), clavePeticion: randomUUID() });
        t = await repo.tarea(u, t.id);
        await repo.asignar(u, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [], grupos: [{ id: g1.id, version: 0 }, { id: g2.id, version: 0 }] });
        assert.equal((await repo.tarea(u, t.id)).tecnicos.length, 1);
        await repo.guardarGrupo(u, proyecto, { nombre: 'Grupo1cambiado', miembros: [], activo: true, versionPlan: await version(), clavePeticion: randomUUID(), version: 0 }, String(g1.id));
        assert.equal((await repo.tarea(u, t.id)).tecnicos.length, 1);
        t = await repo.tarea(u, t.id);
        await assert.rejects(async () => repo.asignar(u, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [], grupos: [{ id: g1.id, version: 0 }] }), es(409));
        const ajeno = await repo.guardarGrupo(u, obra2, { nombre: 'Grupo de otra obra', miembros: [tecnico], activo: true, versionPlan: await version(obra2), clavePeticion: randomUUID() });
        t = await repo.tarea(u, t.id);
        await assert.rejects(async () => repo.asignar(u, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [], grupos: [{ id: ajeno.id, version: 0 }] }), es(409));
    });
    await comprobar(10, 'Dosasignaciones concurrentes de dosobras serializan técnicos; hash y nota concretos', async () => {
        const intervalo = { inicio: { fecha: '2026-10-15', hora: '09:00' }, fin: { fecha: '2026-10-15', hora: '11:00' } };
        const a = await manual(proyecto, { titulo: 'CarreraA', estado: 'pendiente', intervalo }), b = await manual(obra2, { titulo: 'CarreraB', estado: 'pendiente', intervalo });
        const claveA = randomUUID(), claveB = randomUUID();
        const cuerpoA = { versionPlan: a.versionPlan, versionTarea: a.version, clavePeticion: claveA, tecnicos: [tecnico], grupos: [] }, cuerpoB = { versionPlan: b.versionPlan, versionTarea: b.version, clavePeticion: claveB, tecnicos: [tecnico], grupos: [] };
        const lock = await c.reserve();
        await lock `begin`;
        await lock `select id from tecnicos where id=${tecnico} for update`;
        const carrera = Promise.allSettled([repo.asignar(u, a.id, cuerpoA), repo.asignar(u, b.id, cuerpoB)]);
        await new Promise(r => setTimeout(r, 100));
        await lock `commit`;
        lock.release();
        const res = await carrera;
        assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
        const fallo = res.find(r => r.status === 'rejected') as PromiseRejectedResult;
        assert(es(409)(fallo.reason));
        const indice = res.findIndex(r => r.status === 'rejected'), t = indice === 0 ? a : b, body = indice === 0 ? cuerpoA : cuerpoB;
        const detalle = (fallo.reason as ErrorPlan).detalle as {
            hash: string;
        };
        await assert.rejects(async () => repo.asignar(u, t.id, { ...body, aceptacionConflictos: { hash: '0'.repeat(64), nota: 'No vale' } }), es(409));
        const adicional = await manual(indice === 0 ? obra2 : proyecto, { titulo: 'Conflicto nuevo', estado: 'pendiente', intervalo: { inicio: { fecha: '2026-10-15', hora: '10:00' }, fin: { fecha: '2026-10-15', hora: '12:00' } } });
        const extra = { versionPlan: adicional.versionPlan, versionTarea: adicional.version, clavePeticion: randomUUID(), tecnicos: [tecnico], grupos: [] };
        let hashExtra = '';
        try {
            await repo.asignar(u, adicional.id, extra);
        }
        catch (e) {
            assert(e instanceof ErrorPlan);
            hashExtra = (e.detalle as {
                hash: string;
            }).hash;
        }
        assert(hashExtra);
        await repo.asignar(u, adicional.id, { ...extra, aceptacionConflictos: { hash: hashExtra, nota: 'Conflicto adicional revisado' } });
        await assert.rejects(async () => repo.asignar(u, t.id, { ...body, aceptacionConflictos: { hash: detalle.hash, nota: 'Esta aceptación ya no cubre el conjunto actual' } }), es(409));
        let hashActual = '';
        try {
            await repo.asignar(u, t.id, body);
        }
        catch (e) {
            assert(e instanceof ErrorPlan);
            hashActual = (e.detalle as {
                hash: string;
            }).hash;
        }
        assert.notEqual(hashActual, detalle.hash);
        await repo.asignar(u, t.id, { ...body, aceptacionConflictos: { hash: hashActual, nota: 'Solapamientos actuales revisados explícitamente' } });
        return { ganador: res.findIndex(r => r.status === 'fulfilled'), hash: detalle.hash };
    });
    await comprobar(11, 'DSTinexistente/ambiguo y días23/25horas sin1970', async () => {
        for (const valor of [{ fecha: '', hora: '' }, { fecha: '2026-02-30', hora: '09:00' }, { fecha: '2026-10-15', hora: '25:00' }])
            assert.throws(() => instanteLocal(valor), es(400));
        assert.throws(() => intervaloPlan({ inicio: { fecha: '2026-10-15', hora: '09:00' }, fin: { fecha: '2026-10-15', hora: '09:00' } }), es(400));
        assert.deepEqual(intervaloPlan(null), { inicio: null, fin: null });
        assert.throws(() => instanteLocal({ fecha: '2026-03-29', hora: '02:30' }), es(422));
        assert.throws(() => instanteLocal({ fecha: '2026-10-25', hora: '02:30' }), es(422));
        assert.equal(instanteLocal({ fecha: '2026-10-25', hora: '02:30', offset: '+01:00' }), '2026-10-25T01:30:00.000Z');
        for (const [dia, horas] of [['2026-03-29', 23], ['2026-10-25', 25]] as const) {
            const r = rangoMadrid(dia, dia);
            assert.equal((+new Date(r.fin) - +new Date(r.inicio)) / 3600000, horas);
        }
    });
    await comprobar(12, 'Cuatrovistas y contadores coinciden con detalle deduplicado', async () => {
        const ahora = new Date('2026-10-15T12:00:00Z');
        for (const vista of ['hoy', 'semana', 'vencidas', 'sin_fecha'] as const) {
            const r = await repo.agenda(u, { vista, proyectoId: proyecto }, ahora);
            assert.equal(r.tareas.length, r.contadores[vista]);
            assert.equal(new Set(r.tareas.map(t => t.id)).size, r.tareas.length);
        }
    });
    await comprobar(13, 'Ocupación es unión porpersona, estimaciónnull desconocida', async () => {
        const r = await repo.agenda(u, { vista: 'semana', tecnicoId: tecnico }, new Date('2026-10-15T12:00:00Z'));
        assert.equal(r.ocupacion[0].minutos, 180);
        assert(r.estimacion.sinEstimar >= 2);
        assert(r.tareas.length >= 2);
    });
    await comprobar(14, 'Hecha/restauración agregaevento, UUIDestable y noresucitaasignaciones', async () => {
        let t = await manual(proyecto, { titulo: 'RestaurarGWT', estado: 'pendiente', intervalo: { inicio: { fecha: '2026-10-16', hora: '09:00' }, fin: { fecha: '2026-10-16', hora: '10:00' } } });
        await repo.asignar(u, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), tecnicos: [tecnico], grupos: [] });
        t = await repo.tarea(u, t.id);
        await repo.editarTarea(u, t.id, edit(t, { estado: 'hecha', intervalo: null }));
        t = await repo.tarea(u, t.id);
        const antes = await repo.historial(u, t.id);
        const origen = antes.find(e => e.tipo === 'crear_manual')!;
        await repo.restaurar(u, t.id, { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID(), motivo: 'Recuperar sólo campos editables', eventoId: origen.id });
        t = await repo.tarea(u, t.id);
        assert.equal(t.estado, 'borrador');
        assert.equal(t.inicio, null);
        assert.equal(t.tecnicos.length, 0);
        assert.equal((await repo.historial(u, t.id)).length, antes.length + 1);
    });
    await comprobar(15, 'Sólo planifica: fotosoperativas idénticas alcompletar/anular/archivar/reactivar', async () => {
        const antes = await fotografiarRevisiones(c);
        let t = await manual(proyecto, { titulo: 'Sinhechosfísicos' });
        await repo.editarTarea(u, t.id, edit(t, { estado: 'hecha' }));
        t = await repo.tarea(u, t.id);
        await repo.editarTarea(u, t.id, { ...edit(t, { estado: 'pendiente' }), motivo: 'Reabrir como borrador' });
        t = await repo.tarea(u, t.id);
        await repo.editarTarea(u, t.id, { ...edit(t, { estado: 'anulada' }), motivo: 'Anulación de planificación' });
        await repo.editarPlan(u, proyecto, { versionPlan: await version(), clavePeticion: randomUUID(), notas: '', archivado: true, motivo: 'Archivar sintético' });
        await repo.editarPlan(u, proyecto, { versionPlan: await version(), clavePeticion: randomUUID(), notas: '', archivado: false, motivo: 'Reactivar sintético' });
        const despues = await fotografiarRevisiones(c), excluir = new Set(['planes', 'plan_fuentes', 'plan_tareas', 'plan_operaciones', 'plan_eventos', 'plan_grupos', 'plan_grupo_miembros', 'plan_asignaciones', 'catalogo_tareas', 'reglas_plan']);
        assert.deepEqual(despues.tablas.filter(t => !excluir.has(t.tabla)), antes.tablas.filter(t => !excluir.has(t.tabla)));
        await writeFile(resolve(salida, 'hechos-antes.json'), JSON.stringify(antes, null, 2));
        await writeFile(resolve(salida, 'hechos-despues.json'), JSON.stringify(despues, null, 2));
    });
    await comprobar(17, 'Rollback completo y idempotencia distingue payload; límites estrictos', async () => {
        const t = await manual(proyecto, { titulo: 'Idempotencia estricta' }), clave = randomUUID(), b = edit(t, { notas: 'Primero' });
        b.clavePeticion = clave;
        const r = await repo.editarTarea(u, t.id, b);
        assert.deepEqual(await repo.editarTarea(u, t.id, b), r);
        await assert.rejects(async () => repo.editarTarea(u, t.id, { ...b, notas: 'Otro' }), es(409));
        await assert.rejects(async () => repo.crearTarea(u, proyecto, { ...campos, titulo: 'No insertado', duracionEstimadaMin: 0, versionPlan: awaitVersion(), clavePeticion: randomUUID(), salaId: null, trabajoId: null }), es(400));
        function awaitVersion() {
            return Number(r.versionPlan);
        }
        const seleccion2: SeleccionPlan = { ...seleccion, versionPlan: await version(), salas: { modo: 'seleccion', ids: [sala2] }, fuentes: [{ salaId: sala2, tipo: 'actual' }] };
        const previa2 = await repo.preparar(u, proyecto, seleccion2);
        assert(previa2.diff.some(d => d.estado === 'nueva'));
        const seleccionBom: SeleccionPlan = { ...seleccion, versionPlan: await version(), reglas: [reglas[4]] };
        const previaBom = await repo.preparar(u, proyecto, seleccionBom);
        await c `update sala_material_bom set cantidad=cantidad+1,revision=revision+1 where id=${f(33)}`;
        const trasCambioBom = await fotografiarRevisiones(c);
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion: seleccionBom, token: previaBom.token, clavePeticion: randomUUID(), acciones: [{ clave: previaBom.diff[0].clave, accion: 'crear', versionTarea: null, campos: [] }] }), es(409));
        assert.deepEqual((await fotografiarRevisiones(c)).tablas, trasCambioBom.tablas);
        const seleccionRegla: SeleccionPlan = { ...seleccion, versionPlan: await version(), reglas: [reglas[1]] };
        const previaRegla = await repo.preparar(u, proyecto, seleccionRegla), regla = await repo.regla(u, reglas[1]);
        await repo.guardarRegla(u, { trabajoId: regla.trabajoId, selector: regla.selector, activo: false }, regla.id, regla.version);
        const trasCambioRegla = await fotografiarRevisiones(c);
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion: seleccionRegla, token: previaRegla.token, clavePeticion: randomUUID(), acciones: [{ clave: previaRegla.diff[0].clave, accion: 'crear', versionTarea: null, campos: [] }] }), es(409));
        assert.deepEqual((await fotografiarRevisiones(c)).tablas, trasCambioRegla.tablas);
        await repo.guardarRegla(u, { trabajoId: regla.trabajoId, selector: regla.selector, activo: true }, regla.id, regla.version + 1);
        const previaRollback = await repo.preparar(u, proyecto, seleccion2);
        const antesInsercion = await fotografiarRevisiones(c);
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion: seleccion2, token: previaRollback.token, clavePeticion: randomUUID(), acciones: [{ clave: previaRollback.diff.find(d => d.estado === 'nueva')!.clave, accion: 'crear', versionTarea: null, campos: [] }, { clave: '0'.repeat(64), accion: 'crear', versionTarea: null, campos: [] }] }), es(400));
        assert.deepEqual((await fotografiarRevisiones(c)).tablas, antesInsercion.tablas);
        const prev = await fotografiarRevisiones(c);
        await assert.rejects(async () => repo.confirmar(u, proyecto, { seleccion: { ...seleccion, versionPlan: await version() }, token: 'falso', clavePeticion: randomUUID(), acciones: [{ clave: '0'.repeat(64), accion: 'crear', versionTarea: null, campos: [] }] }), es(409));
        const post = await fotografiarRevisiones(c);
        assert.deepEqual(post.tablas, prev.tablas);
    });
    await comprobar(19, 'Panelmismoahora/filtro/valores y ceroSQLagenda cuando ocultas oACLparcial', async () => {
        const ahora = new Date('2026-10-15T12:00:00Z');
        const yo = { id: u, usuario: 'rea04-1', nombre: 'QA', rol: 'admin' as const, permisos: resolverPermisos('admin'), ficticio: false, debeCambiarClave: false };
        const [panel, a] = await Promise.all([leerPanel(c, yo, ahora), repo.agenda(u, { vista: 'semana' }, ahora)]);
        for (const [clave, vista] of [['agenda_hoy', 'hoy'], ['agenda_semana', 'semana'], ['agenda_vencidas', 'vencidas'], ['agenda_sin_fecha', 'sin_fecha']] as const) {
            assert.equal(panel.tarjetas.find(t => t.clave === clave)?.valor, a.contadores[vista]);
            assert(panel.tarjetas.find(t => t.clave === clave)?.href.includes('vista=' + vista));
        }
        assert.equal(panel.tarjetas.find(t => t.clave === 'ocupacion_semana')?.valor, a.ocupacion.reduce((n, t) => n + t.minutos, 0));
        await c `insert into preferencias_usuario(usuario_id,panel)values(${lectura},${c.json({ orden: [], ocultas: ['agenda_hoy', 'agenda_semana', 'agenda_vencidas', 'agenda_sin_fecha', 'ocupacion_semana'] })}) on conflict(usuario_id)do update set panel=excluded.panel`;
        const lect = { ...yo, id: lectura, rol: 'lectura' as const, permisos: resolverPermisos('lectura') };
        consultas.length = 0;
        await leerPanel(espiar(c), lect, ahora);
        assert(!consultas.some(q => /\bplan_tareas\b|\bplan_asignaciones\b/.test(q)));
        await c `delete from preferencias_usuario where usuario_id=${lectura}`;
        await c `insert into usuario_permisos(usuario_id,seccion,acceso)values(${lectura},'salas','oculto')on conflict(usuario_id,seccion)do update set acceso='oculto'`;
        consultas.length = 0;
        await leerPanel(espiar(c), lect, ahora);
        assert(!consultas.some(q => /\bplan_tareas\b|\bplan_asignaciones\b/.test(q)));
        await c `delete from usuario_permisos where usuario_id=${lectura} and seccion='salas'`;
        return { contadores: a.contadores, ocupacion: a.ocupacion, ahora: a.ahora };
    });
    console.log(`${resultados.length}GWT SQL aprobados. GWT16 en gate de dosconexiones; GWT18 enE2E escritorio/móvil.`);
}
finally {
    await writeFile(resolve(salida, 'gwt-sql.json'), JSON.stringify({ base, ids: { proyecto, localizacion, sala, sala2, legado, obra2, tecnico, revisionId }, resultados, externos: { 16: 'verificar-rea04-concurrencia.mts', 18: 'e2e-gate/rea04.spec.mts' } }, null, 2));
    await c `delete from usuario_permisos where usuario_id=${lectura} and seccion in ('catalogo','compras','almacen','parametros','salas')`;
    await writeFile(resolve(raizEvidencia, 'aceptacion', 'ultimo-corte.json'), JSON.stringify({ tanda, salida, aprobados: resultados.filter(r => r.ok).length }, null, 2));
    await c.end();
}
