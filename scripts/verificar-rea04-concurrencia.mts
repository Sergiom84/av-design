import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { conectarRevisiones, URL_REA_PRUEBA, idPlan } from './rea04-fixture.mjs';
import { RepositorioPlanificacion } from '../src/lib/planificacion/repositorio';
import { ErrorPlan, type SeleccionPlan } from '../src/lib/planificacion/modelo';
import { resolverPermisos } from '../src/lib/usuarios';
const salida = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04', 'concurrencia');
assert.equal(process.env.REA_DATABASE_URL, URL_REA_PRUEBA);
const c = await conectarRevisiones(process.env.REA_DATABASE_URL!);
const base = Number(String(Date.now()).slice(-9)) + 400000000, f = (n: number) => idPlan(base + n), u = idPlan(1), tecnico = f(1);
const repo = new RepositorioPlanificacion(c, { secreto: 'rea04-local-prueba-integracion-secreto-2026' });
const mod = Module as unknown as {
    _load: (s: string, ...r: unknown[]) => unknown;
}, original = mod._load;
const autor = { id: u, usuario: 'rea04-1', nombre: 'QA', rol: 'admin', permisos: resolverPermisos('admin'), ficticio: false, debeCambiarClave: false };
let ciclo: typeof import('../src/app/acciones-ciclo'), proyectos: typeof import('../src/app/acciones-proyectos'), acciones: typeof import('../src/app/acciones'), e3: typeof import('../src/lib/revisiones-diseno-repositorio');
try {
    mod._load = (s, ...r) => s === 'server-only' ? {} : s === 'next/cache' ? { revalidatePath: () => {
        } } : s === 'next/navigation' ? { redirect: () => {
            const e = new Error('Redirección QA');
            Object.assign(e, { digest: 'NEXT_REDIRECT' });
            throw e;
        } } : s === '@/lib/db' || s === './db' ? { sql: c, hayConfiguracion: () => true } : s === '@/lib/sesion-servidor' ? { exigirEdicion: async () => autor, exigirSeccion: async () => autor, sesionActual: async () => autor } : s === '@/app/salas/[id]/datos-ficha' ? { fichaConAlmacen: () => {
            throw new Error('No se permite leer material en este gate de cierre.');
        } } : original.call(Module, s, ...r);
    const requerir = createRequire(import.meta.url);
    ciclo = requerir('../src/app/acciones-ciclo.ts');
    proyectos = requerir('../src/app/acciones-proyectos.ts');
    acciones = requerir('../src/app/acciones.ts');
    e3 = requerir('../src/lib/revisiones-diseno-repositorio.ts');
}
finally {
    mod._load = original;
}
const resultados: Record<string, unknown>[] = [];
const formulario = (valor: Record<string, unknown>) => {
    const d = new FormData();
    for (const [k, v] of Object.entries(valor))
        if (v != null)
            d.set(k, String(v));
    return d;
};
const capturar = <T,>(p: Promise<T>) => p.then(valor => ({ ok: true, valor }), e => ({ ok: false, error: String(e), status: (e as {
        status?: number;
    }).status, codigo: (e as {
        code?: string;
    }).code }));
async function invocar<T>(p: Promise<T>) {
    try {
        return await p;
    }
    catch (e) {
        if (String((e as {
            digest?: string;
        }).digest).startsWith('NEXT_REDIRECT'))
            return;
        throw e;
    }
}
async function obra(n: number) {
    const p = f(n), l = f(n + 1), s = f(n + 2);
    await c `insert into proyectos(id,nombre,codigo)values(${p},${'Carrera REA04 ' + base + '-' + n},${'REA04-CARRERA-' + base + '-' + n})`;
    await c `insert into localizaciones(id,proyecto_id,nombre)values(${l},${p},'Destino carrera')`;
    await c `insert into salas(id,localizacion_id,nombre,codigo,largo_m,ancho_m,alto_m)values(${s},${l},${'Sala carrera ' + n},${'S-' + base + '-' + n},6,4,3)`;
    await c `insert into hitos_proyecto(proyecto_id,tipo,tecnico_id,notas)values(${p},'inicio',${tecnico},'Inicio QA explícito')`;
    await repo.crearPlan(u, p, randomUUID());
    return { p, l, s };
}
async function esperaBloqueador(pid: number) {
    const limite = Date.now() + 15000;
    while (Date.now() < limite) {
        const filas = await c `select pid from pg_stat_activity where ${pid}::int=any(pg_blocking_pids(pid))`;
        if (filas.length)
            return Number(filas[0].pid);
        await new Promise(r => setTimeout(r, 25));
    }
    throw new Error('No se observó la barrera de dos conexiones.');
}
async function barrera(tabla: string, evento: string, predicado: string, n: number) {
    const nombre = 'rea04_gate_' + base + '_' + n, key = 904000000 + base + n;
    await c.unsafe(`create function ${nombre}() returns trigger language plpgsql as $$ begin if ${predicado} then perform pg_advisory_xact_lock(${key}::bigint); end if;return new;end $$`);
    await c.unsafe(`create trigger ${nombre} before ${evento} on ${tabla} for each row execute function ${nombre}()`);
    const lock = await c.reserve(), [{ pid }] = await lock `select pg_backend_pid()pid`;
    await lock `select pg_advisory_lock(${key}::bigint)`;
    let abierta = true;
    return { pid: Number(pid), soltar: async () => {
            if (abierta) {
                abierta = false;
                await lock `select pg_advisory_unlock(${key}::bigint)`;
            }
        }, limpiar: async () => {
            if (abierta)
                await lock `select pg_advisory_unlock(${key}::bigint)`;
            lock.release();
            await c.unsafe(`drop trigger if exists ${nombre} on ${tabla}`);
            await c.unsafe(`drop function if exists ${nombre}()`);
        } };
}
async function preparar(x: Awaited<ReturnType<typeof obra>>, reglaId: string) {
    const seleccion: SeleccionPlan = { versionPlan: (await repo.leerPlan(u, x.p)).plan!.version, salas: { modo: 'todas' }, reglas: [reglaId], fuentes: [{ salaId: x.s, tipo: 'actual' }] };
    const p = await repo.preparar(u, x.p, seleccion);
    return { seleccion, token: p.token, clavePeticion: randomUUID(), acciones: [{ clave: p.diff[0].clave, accion: 'crear', versionTarea: null, campos: [] }] };
}
async function cerrar(p: string) {
    return ciclo.registrarHitoProyecto(formulario({ proyecto_id: p, tipo: 'cierre', tecnico_id: tecnico, notas: 'Cierre real QA con salas pendientes', fecha: '2026-10-15' }));
}
async function assertSinTareas(p: string) {
    const [{ n }] = await c `select count(*)::int n from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${p}`;
    assert.equal(n, 0);
}
try {
    await mkdir(salida, { recursive: true });
    await c `insert into tecnicos(id,nombre,activo,fuente)values(${tecnico},${'Técnico cierre REA04 ' + base},true,'app')`;
    await c `insert into tecnico_roles(tecnico_id,rol)values(${tecnico},'inicio')`;
    const trabajo = await repo.guardarTrabajo(u, { titulo: 'Montaje concurrente', descripcion: 'Sólo sala', duracionEstimadaMin: null, activo: true }), regla = await repo.guardarRegla(u, { trabajoId: trabajo.id, selector: { tipo: 'sala' }, activo: true });
    // 1. El cierre real posee sala/proyecto antes de una confirmación real.
    {
        const x = await obra(10), b = await preparar(x, String(regla.id)), gate = await barrera('hitos_proyecto', 'insert', `new.proyecto_id='${x.p}'::uuid and new.tipo='cierre'`, 1);
        let cierre: Promise<unknown> | undefined, plan: Promise<unknown> | undefined;
        try {
            cierre = cerrar(x.p);
            const pid = await esperaBloqueador(gate.pid);
            plan = capturar(repo.confirmar(u, x.p, b));
            await esperaBloqueador(pid);
            await gate.soltar();
            await cierre;
            const r = await plan as {
                ok: boolean;
                status?: number;
            };
            assert.equal(r.ok, false);
            assert.equal(r.status, 409);
            await assertSinTareas(x.p);
            resultados.push({ caso: 'cierre real antes de confirmar', ok: true, resultado: r });
        }
        finally {
            await gate.soltar();
            await Promise.allSettled([cierre, plan].filter(Boolean));
            await gate.limpiar();
        }
    }
    // 2. Confirmación posee sala/proyecto antes del cierre; después no escribe.
    {
        const x = await obra(30), b = await preparar(x, String(regla.id)), planId = (await repo.leerPlan(u, x.p)).plan!.id, gate = await barrera('plan_operaciones', 'insert', `new.plan_id='${planId}'::uuid and new.tipo='confirmar_fuente'`, 2);
        let cierre: Promise<unknown> | undefined, plan: Promise<unknown> | undefined;
        try {
            plan = repo.confirmar(u, x.p, b);
            const pid = await esperaBloqueador(gate.pid);
            cierre = cerrar(x.p);
            await esperaBloqueador(pid);
            await gate.soltar();
            await plan;
            await cierre;
            const t = (await repo.leerPlan(u, x.p)).tareas[0];
            assert(t);
            await assert.rejects(() => repo.editarTarea(u, t.id, { titulo: t.titulo, descripcion: t.descripcion, notas: 'No escribir', duracionEstimadaMin: null, estado: t.estado, venceFecha: null, intervalo: null, versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: randomUUID() }), (e: unknown) => e instanceof ErrorPlan && e.status === 409);
            resultados.push({ caso: 'confirmación antes del cierre real; edición posterior rechazada', ok: true });
        }
        finally {
            await gate.soltar();
            await Promise.allSettled([cierre, plan].filter(Boolean));
            await gate.limpiar();
        }
    }
    // 3. Alta real mantiene proyecto mientras la selección todas espera.
    {
        const x = await obra(50), b = await preparar(x, String(regla.id)), nombre = 'Alta real REA04 ' + base, gate = await barrera('salas', 'insert', `new.localizacion_id='${x.l}'::uuid and new.nombre='${nombre}'`, 3);
        let alta: Promise<unknown> | undefined, plan: Promise<unknown> | undefined;
        try {
            alta = invocar(acciones.crearSala(null, formulario({ nombre, codigo: 'ALTA-' + base, localizacion_id: x.l, unidad_dimensiones: 'm', entrada_largo: 6, entrada_ancho: 4, entrada_alto: 3, ruta_por_defecto: 'directo' })));
            const pid = await esperaBloqueador(gate.pid);
            plan = capturar(repo.confirmar(u, x.p, b));
            await esperaBloqueador(pid);
            await gate.soltar();
            await alta;
            const r = await plan as {
                ok: boolean;
                status?: number;
            };
            assert.equal(r.ok, false);
            assert.equal(r.status, 409);
            await assertSinTareas(x.p);
            assert.equal((await c `select id from salas where localizacion_id=${x.l}`).length, 2);
            resultados.push({ caso: 'alta real cambia conjunto todas: rollback/reintento y409', ok: true, resultado: r });
        }
        finally {
            await gate.soltar();
            await Promise.allSettled([alta, plan].filter(Boolean));
            await gate.limpiar();
        }
    }
    // 4. Adopción real entra antes de que el plan obtenga el proyecto.
    {
        const x = await obra(70), otra = await obra(80), b = await preparar(x, String(regla.id)), gate = await barrera('salas', 'update', `new.id='${otra.s}'::uuid and new.localizacion_id='${x.l}'::uuid`, 4);
        let adopcion: Promise<unknown> | undefined, plan: Promise<unknown> | undefined;
        try {
            adopcion = proyectos.asignarSalaALocalizacion(formulario({ sala_id: otra.s, localizacion_id: x.l }));
            const pid = await esperaBloqueador(gate.pid);
            plan = capturar(repo.confirmar(u, x.p, b));
            await esperaBloqueador(pid);
            await gate.soltar();
            await adopcion;
            const r = await plan as {
                ok: boolean;
                status?: number;
            };
            assert.equal(r.ok, false);
            assert.equal(r.status, 409);
            await assertSinTareas(x.p);
            resultados.push({ caso: 'adopción real cambia conjunto todas sin lock inverso', ok: true, resultado: r });
        }
        finally {
            await gate.soltar();
            await Promise.allSettled([adopcion, plan].filter(Boolean));
            await gate.limpiar();
        }
    }
    // 5. Copia E3 SERIALIZABLE termina antes; el plan no omite su sala fantasma.
    {
        const x = await obra(100), b = await preparar(x, String(regla.id)), baseE3 = (await e3.leerDiseno(c, x.s)).base, nombre = 'Copia E3 REA04 ' + base, gate = await barrera('salas', 'insert', `new.localizacion_id='${x.l}'::uuid and new.nombre='${nombre}'`, 5);
        let copia: Promise<unknown> | undefined, plan: Promise<unknown> | undefined;
        try {
            copia = e3.duplicarSalaDiseno(c, x.s, nombre, 'COPIA-' + base, u, baseE3);
            const pid = await esperaBloqueador(gate.pid);
            plan = capturar(repo.confirmar(u, x.p, b));
            await esperaBloqueador(pid);
            await gate.soltar();
            await copia;
            const r = await plan as {
                ok: boolean;
                status?: number;
            };
            assert.equal(r.ok, false);
            assert.equal(r.status, 409);
            await assertSinTareas(x.p);
            assert.equal((await c `select id from salas where localizacion_id=${x.l}`).length, 2);
            resultados.push({ caso: 'copia E3 real cambia conjunto todas; protocolo conservado', ok: true, resultado: r });
        }
        finally {
            await gate.soltar();
            await Promise.allSettled([copia, plan].filter(Boolean));
            await gate.limpiar();
        }
    }
    console.log('GWT16: cinco intercalados reales con barreras de dos conexiones aprobados.');
}
finally {
    await writeFile(resolve(salida, 'gwt16.json'), JSON.stringify({ base, resultados }, null, 2));
    await c.end();
}
