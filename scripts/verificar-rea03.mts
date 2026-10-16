/** Gate real de REA03. Exclusivamente nueva BD5555; evidencia sin secretos. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ExcelJS from 'exceljs';
import { conectarRevisiones, URL_REA_PRUEBA, FIXTURE_REVISIONES as f, crearIdentidadesInformes, idInforme, fotografiarRevisiones } from './rea03-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
import type { ConfiguracionInforme } from '../src/lib/informes/modelo';
const url = process.env.INFORMES_DATABASE_URL;
if (url !== URL_REA_PRUEBA)
    throw new Error('URL explícita REA03 obligatoria.');
process.env.DATABASE_URL = url;
const sql = await conectarRevisiones(url);
globalThis.__sql = sql;
const require = createRequire(import.meta.url);
const Module = require('node:module') as {
    _load: (id: string, ...a: unknown[]) => unknown;
};
const anterior = Module._load;
Module._load = function (id, ...a) {
    return id === 'server-only' ? {} : anterior.call(this, id, ...a);
};
let modulo: typeof import('../src/lib/informes/repositorio'), servicio: typeof import('../src/lib/informes/servicio'), lectores: typeof import('../src/lib/informes/lectores');
try {
    modulo = await import('../src/lib/informes/repositorio');
    servicio = await import('../src/lib/informes/servicio');
    lectores = await import('../src/lib/informes/lectores');
}
finally {
    Module._load = anterior;
}
const repo = new modulo.RepositorioInformes(sql);
const salida = resolve('output/rea-integracion/rea03');
await mkdir(resolve(salida, 'archivos'), { recursive: true });
const pruebas: {
    nombre: string;
    datos: unknown;
}[] = [];
const ok = (nombre: string, datos: unknown = {}) => {
    pruebas.push({ nombre, datos });
    console.log(`OK ${nombre}`);
};
const config = (clave: ConfiguracionInforme['clave'], ambito: ConfiguracionInforme['ambito'] = { tipo: 'sala', id: f.sala }): ConfiguracionInforme => ({ versionModelo: 1, versionRegistro: 1, clave, ambito, periodo: clave.endsWith('_actual') ? { modo: 'actual' } : { modo: 'rango', desde: '2026-01-01', hasta: '2026-12-31' }, formatos: ['pdf', 'xlsx', 'csv'], audiencia: { usuarios: [], grupos: [] } });
async function nueva(c: ConfiguracionInforme, propietario = idInforme(1)) {
    const d = await repo.guardarDefinicion(propietario, 'PRUEBA REA03 ' + c.clave + ' ' + randomUUID().slice(0, 8), c);
    const p = await repo.vistaPrevia(propietario, c);
    const e = await repo.encolar(propietario, d.id, d.version, p, randomUUID());
    return { d, e, p };
}
async function procesoCli(args: string[]) {
    return new Promise<{
        codigo: number | null;
        stdout: string;
        stderr: string;
    }>((res, rej) => {
        const p = spawn(process.execPath, ['--import', 'tsx', 'scripts/ejecutar-informes.mts', ...args], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', INFORMES_DATABASE_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        p.stdout.on('data', d => stdout += d);
        p.stderr.on('data', d => stderr += d);
        p.on('error', rej);
        p.on('close', codigo => res({ codigo, stdout, stderr }));
    });
}
let antes: Awaited<ReturnType<typeof fotografiarRevisiones>> | undefined;
try {
    await crearIdentidadesInformes(sql);
    // Cada repetición conserva la historia y libera sólo definiciones de este fixture, sin borrar archivos.
    await sql `update informes_definiciones set archivada_en=coalesce(archivada_en,now()) where propietario_id in (${idInforme(1)},${idInforme(2)},${idInforme(3)})`;
    await sql `update informes_programaciones set activa=false where definicion_id in(select id from informes_definiciones where propietario_id in (${idInforme(1)},${idInforme(2)},${idInforme(3)}))`;
    await sql `update informes_ejecuciones set estado='cancelada' where estado='pendiente' and propietario_id in (${idInforme(1)},${idInforme(2)},${idInforme(3)})`;
    // Preparación repetible de estos cinco usuarios sintéticos; no hay runner externo en5555.
    // Una caída del gate no deja una tentativa ni un reintento que contamine el siguiente ensayo.
    await sql `update informes_intentos set estado='interrumpida',terminado_en=now(),error_codigo='LEASE_VENCIDO',error_mensaje='Tentativa huérfana del gate sintético anterior.' where estado='en_curso' and ejecucion_id in(select id from informes_ejecuciones where propietario_id in(${idInforme(1)},${idInforme(2)},${idInforme(3)}))`;
    await sql `update informes_ejecuciones set estado='fallida',lease_token=null,lease_hasta=null,error_codigo='LEASE_VENCIDO',error_mensaje='Tentativa huérfana del gate sintético anterior.',reintentar_desde=null where estado='en_curso' and propietario_id in(${idInforme(1)},${idInforme(2)},${idInforme(3)})`;
    await sql `update informes_ejecuciones set reintentar_desde=null where estado='fallida' and propietario_id in(${idInforme(1)},${idInforme(2)},${idInforme(3)})`;
    antes = await fotografiarRevisiones(sql);
    await writeFile(resolve(salida, 'hechos-antes.json'), JSON.stringify(antes, null, 2));
    const exportados = [];
    for (const clave of ['material_actual', 'material_movimientos', 'carga_actual', 'carga_hechos', 'estado_actual', 'estado_hitos'] as const) {
        const { e } = await nueva(config(clave, clave === 'material_actual' ? { tipo: 'obra', id: f.proyecto } : { tipo: 'sala', id: f.sala }));
        const reclamada = await repo.reclamar();
        assert.equal(reclamada?.id, e.id);
        const r = await servicio.procesarEjecucion(repo, reclamada!);
        assert.equal(r.estado, 'correcta', JSON.stringify(r));
        const resultado = await repo.resultado(e.id, idInforme(1));
        assert.ok(resultado.snapshot);
        assert.equal(resultado.manifiesto!.archivos.length, 3);
        for (const a of resultado.manifiesto!.archivos) {
            const descargado = await repo.descargar(e.id, a.id, idInforme(1));
            assert.equal(createHash('sha256').update(descargado.contenido).digest('hex'), a.sha256);
            const ruta = resolve(salida, 'archivos', `${clave}.${a.formato}`);
            await writeFile(ruta, descargado.contenido);
            if (a.formato === 'xlsx') {
                const libro = new ExcelJS.Workbook();
                await libro.xlsx.load(Buffer.from(descargado.contenido) as unknown as ExcelJS.Buffer);
                assert.ok(libro.getWorksheet('Informe'));
            }
            if (a.formato === 'pdf')
                assert.equal(Buffer.from(descargado.contenido).subarray(0, 5).toString(), '%PDF-');
            if (a.formato === 'csv')
                assert.deepEqual([...descargado.contenido.slice(0, 3)], [239, 187, 191]);
        }
        await writeFile(resolve(salida, 'archivos', `${clave}.json`), JSON.stringify(resultado.manifiesto, null, 2));
        exportados.push({ clave, id: e.id, filas: resultado.snapshot!.filas.length, revision: resultado.manifiesto!.revision, sha256: resultado.snapshot_sha256 });
        ok('lector/exportación/descarga durable ' + clave, exportados.at(-1));
    }
    const c = config('estado_actual');
    const { d, p, e } = await nueva(c);
    const key = e.clave_peticion!;
    const repetida = await repo.encolar(idInforme(1), d.id, d.version, p, key);
    assert.equal(repetida.id, e.id);
    const editada = await repo.guardarDefinicion(idInforme(1), d.nombre + ' editada', c, d.id, d.version);
    await assert.rejects(() => repo.guardarDefinicion(idInforme(1), d.nombre, c, d.id, d.version), { status: 409 });
    await assert.rejects(() => repo.encolar(idInforme(1), d.id, editada.version, p, key), { status: 409 });
    const reclamadas = await Promise.all([repo.reclamar(), repo.reclamar()]);
    assert.equal(reclamadas.filter(Boolean).length, 1);
    await servicio.procesarEjecucion(repo, reclamadas.find(Boolean)!);
    ok('idempotencia manual, CAS y dos reclamaciones');
    // Lectura ligera sin fuentes ajenas: conexión instrumentada con debug sólo SQL sin parámetros.
    const consultas: string[] = [];
    const postgres = (await import('postgres')).default;
    const espia = postgres(url, { ssl: false, max: 5, debug: (_id, query) => {
            consultas.push(query);
        } });
    const conexionAnterior = globalThis.__sql;
    globalThis.__sql = espia;
    try {
        const { d, e } = await nueva(config('estado_actual'), idInforme(2));
        const er = await repo.reclamar();
        assert.equal(er?.id, e.id);
        consultas.length = 0;
        await lectores.capturarInforme({ id: e.id, definicion: er!.definicion_snapshot, definicionSha256: er!.definicion_sha256, periodo: er!.periodo_resuelto, ocurrencia: new Date(er!.ocurrencia_utc).toISOString() });
        assert.equal(consultas.filter(q => /\b(articulos|parametros|movimientos|reservas|pedidos|carga_lineas|cargas|proyectos)\b/i.test(q)).length, 0);
        ok('estado sala: cero consultas a fuentes no permitidas', { consultas });
        await servicio.procesarEjecucion(repo, er!);
        await assert.rejects(() => repo.vistaPrevia(idInforme(2), config('material_actual')), { status: 403 });
        await repo.guardarDefinicion(idInforme(2), d.nombre, d.configuracion, d.id, d.version, true);
    }
    finally {
        globalThis.__sql = conexionAnterior;
        await espia.end();
    }
    const grupo = await repo.guardarGrupo(idInforme(1), 'PRUEBA grupo ' + randomUUID().slice(0, 6), c, [idInforme(2)]);
    const cg = { ...c, audiencia: { usuarios: [], grupos: [{ id: grupo!.id, version: grupo!.version }] } };
    const { e: eg } = await nueva(cg);
    let trabajo = await repo.reclamar();
    assert.equal(trabajo?.id, eg.id);
    await servicio.procesarEjecucion(repo, trabajo!);
    assert.ok(await repo.resultado(eg.id, idInforme(2)));
    await repo.guardarGrupo(idInforme(1), grupo!.nombre, c, [], grupo!.id, grupo!.version);
    await assert.rejects(() => repo.resultado(eg.id, idInforme(2)), { status: 404 });
    await assert.rejects(() => repo.vistaPrevia(idInforme(1), cg), { status: 409 });
    ok('audiencia congelada, grupo cambiado y revocación vigente');
    // Permiso retirado durante render: el propietario real pierde catalogo. No se publica ningún formato.
    const { e: rev } = await nueva(config('carga_actual'), idInforme(3));
    trabajo = await repo.reclamar();
    assert.equal(trabajo?.id, rev.id);
    const bloqueada = await servicio.procesarEjecucion(repo, trabajo!, { antesDePublicar: async () => {
            await sql `insert into usuario_permisos(usuario_id,seccion,acceso) values(${idInforme(3)},'catalogo','oculto') on conflict(usuario_id,seccion) do update set acceso='oculto'`;
        } });
    assert.equal(bloqueada.estado, 'bloqueada');
    assert.equal((await sql `select id from informes_archivos where ejecucion_id=${rev.id}`).length, 0);
    await sql `delete from usuario_permisos where usuario_id=${idInforme(3)} and seccion='catalogo'`;
    ok('revocación durante render impide publicación completa');
    // Snapshot de intento fallido se mantiene. Fallo de un formato no publica parciales.
    const { e: fallo } = await nueva(config('estado_actual'));
    trabajo = await repo.reclamar();
    const fallida = await servicio.procesarEjecucion(repo, trabajo!, { exportar: async () => {
            throw new Error('Fallo de exportador inyectado');
        } });
    assert.equal(fallida.estado, 'fallida');
    const [conservada] = await sql `select snapshot_sha256,snapshot,estado,intento_actual from informes_ejecuciones where id=${fallo.id}`;
    assert.ok(conservada.snapshot_sha256);
    assert.equal((await sql `select id from informes_archivos where ejecucion_id=${fallo.id}`).length, 0);
    await repo.reintentar(fallo.id, idInforme(1), conservada.estado, conservada.intento_actual);
    trabajo = await repo.reclamar();
    await servicio.procesarEjecucion(repo, trabajo!, { capturar: async () => {
            throw new Error('No debe releer');
        } });
    const [recuperada] = await sql `select snapshot_sha256,estado from informes_ejecuciones where id=${fallo.id}`;
    assert.equal(recuperada.snapshot_sha256, conservada.snapshot_sha256);
    assert.equal(recuperada.estado, 'correcta');
    ok('fallo sin parciales, reintento usa el snapshot original');
    // Fencing: lease de A vencido, B reclama y A no puede publicar ni alterar B.
    const { e: lease } = await nueva(config('estado_actual'));
    const a = await repo.reclamar();
    await sql `update informes_ejecuciones set lease_hasta=now()-interval '1 second' where id=${lease.id}`;
    await repo.reclamar();
    await sql `update informes_ejecuciones set reintentar_desde=now()-interval '1 second' where id=${lease.id}`;
    const b = await repo.reclamar();
    assert.equal(b?.id, lease.id);
    assert.notEqual(a!.lease_token, b!.lease_token);
    await assert.rejects(() => repo.renovar(a!), { codigo: 'LEASE_VENCIDO' });
    await servicio.procesarEjecucion(repo, b!);
    ok('lease vencido, tentativa interrumpida y fencing');
    // CLI real de shell limpio: programación vencida encola y conserva los tres archivos.
    const def = await repo.guardarDefinicion(idInforme(1), 'PRUEBA CLI ' + randomUUID().slice(0, 6), config('estado_actual'));
    const calendario = { frecuencia: 'diaria' as const, inicio: '2026-01-01', fin: null, hora: '09:00' };
    const prog = await repo.guardarProgramacion(idInforme(1), def.id, def.version, calendario);
    await sql `update informes_programaciones set proxima_utc=now()-interval '1 minute' where id=${prog.id}`;
    const cli = await procesoCli(['--una-vez']);
    await writeFile(resolve(salida, 'cli-manual.log'), cli.stdout + cli.stderr);
    assert.equal(cli.codigo, 0, cli.stderr);
    assert.match(cli.stdout, /correcta/);
    const [programada] = await sql `select id,estado from informes_ejecuciones where programacion_id=${prog.id} order by creado_en desc limit 1`;
    assert.equal(programada.estado, 'correcta');
    await repo.modificarProgramacion(idInforme(1), prog.id, prog.version, false);
    ok('CLI de proceso nuevo sin .env materializa y procesa programación', cli);
    const cookie = await firmarSesion('rea03-local-prueba-integracion-secreto-2026', Date.now() + 3600000, idInforme(1));
    const headers = { cookie: `${COOKIE_SESION}=${cookie}`, origin: 'http://localhost:3113' };
    const lista = await fetch('http://localhost:3113/api/informes/ejecuciones', { headers });
    assert.equal(lista.status, 200);
    const resultado = await repo.resultado(exportados[0].id, idInforme(1));
    for (const a of resultado.manifiesto!.archivos) {
        const resp = await fetch(`http://localhost:3113/api/informes/ejecuciones/${resultado.id}/archivos/${a.id}`, { headers });
        assert.equal(resp.status, 200);
        assert.equal(resp.headers.get('x-av-sha256'), a.sha256);
        assert.equal(createHash('sha256').update(new Uint8Array(await resp.arrayBuffer())).digest('hex'), a.sha256);
    }
    ok('GET HTTP autenticado y descarga real con hash');
    const ajeno = await firmarSesion('rea03-local-prueba-integracion-secreto-2026', Date.now() + 3600000, idInforme(2));
    const denegada = await fetch(`http://localhost:3113/api/informes/ejecuciones/${resultado.id}`, { headers: { cookie: `${COOKIE_SESION}=${ajeno}` } });
    assert.equal(denegada.status, 404);
    for (const [n, esperado] of [[4, 403], [5, 401]] as const) {
        const ck = await firmarSesion('rea03-local-prueba-integracion-secreto-2026', Date.now() + 3600000, idInforme(n));
        assert.equal((await fetch('http://localhost:3113/api/informes', { headers: { cookie: `${COOKIE_SESION}=${ck}` } })).status, esperado);
    }
    ok('HTTP no receptor/provisional/inactivo sin contenido');
    // Dos procesos reales compiten por una única ocurrencia natural.
    const programaConcurrente = await repo.guardarProgramacion(idInforme(1), def.id, def.version, calendario);
    const previstaConcurrente = new Date(Date.now() - 60000).toISOString();
    await sql `update informes_programaciones set proxima_utc=${previstaConcurrente} where id=${programaConcurrente.id}`;
    const concurrentes = await Promise.all([procesoCli(['--una-vez']), procesoCli(['--una-vez'])]);
    assert.ok(concurrentes.every(c => c.codigo === 0));
    const [unica] = await sql `select count(*)::int as n from informes_ejecuciones where programacion_id=${programaConcurrente.id} and ocurrencia_utc=${previstaConcurrente}`;
    assert.equal(unica.n, 1);
    await repo.modificarProgramacion(idInforme(1), programaConcurrente.id, programaConcurrente.version, false);
    await writeFile(resolve(salida, 'cli-concurrentes.json'), JSON.stringify(concurrentes, null, 2));
    ok('dos CLI reales: una ocurrencia y un conjunto de archivos');
    // Proceso continuo real: latido activo y parada por señal sin esperar al intervalo.
    const continuo = spawn(process.execPath, ['--import', 'tsx', 'scripts/ejecutar-informes.mts', '--continuo', '--intervalo-segundos=15'], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', INFORMES_DATABASE_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] });
    let salidaContinuo = '';
    let erroresContinuo = '';
    await new Promise<void>((res, rej) => {
        const limite = setTimeout(() => {
            continuo.kill('SIGTERM');
            rej(new Error('No llegó primera pasada continua'));
        }, 30000);
        continuo.stdout.on('data', d => {
            salidaContinuo += d;
            if (salidaContinuo.includes('"modo":"continuo"')) {
                clearTimeout(limite);
                res();
            }
        });
        continuo.stderr.on('data', d => erroresContinuo += d);
        continuo.on('error', rej);
    });
    assert.equal((await repo.estadoRunner(idInforme(1))).estado, 'Runner activo');
    const terminado = new Promise<number | null>(res => continuo.once('close', res));
    continuo.kill('SIGTERM');
    assert.equal(await terminado, 0);
    assert.equal((await repo.estadoRunner(idInforme(1))).estado, 'Runner detenido');
    await writeFile(resolve(salida, 'cli-continuo.log'), salidaContinuo + erroresContinuo);
    ok('CLI continuo real: latido activo, señal y parada registrada');
    // Atraso mayor de diez: la cola de cinco frena el cursor sin consumirlo.
    const atrasoDef = await repo.guardarDefinicion(idInforme(1), 'PRUEBA atraso ' + randomUUID().slice(0, 6), config('estado_actual'));
    const atrasoProg = await repo.guardarProgramacion(idInforme(1), atrasoDef.id, atrasoDef.version, calendario);
    await sql `update informes_programaciones set proxima_utc=${new Date(Date.now() - 16 * 86400000).toISOString()} where id=${atrasoProg.id}`;
    assert.equal(await repo.planificar(), 5);
    const [cursorLleno] = await sql `select proxima_utc from informes_programaciones where id=${atrasoProg.id}`;
    assert.equal(await repo.planificar(), 0);
    assert.equal(new Date((await sql `select proxima_utc from informes_programaciones where id=${atrasoProg.id}`)[0].proxima_utc).toISOString(), new Date(cursorLleno.proxima_utc).toISOString());
    for (let lote = 0; lote < 2; lote++) {
        await sql `update informes_ejecuciones set estado='cancelada' where programacion_id=${atrasoProg.id} and estado='pendiente'`;
        assert.equal(await repo.planificar(), 5);
    }
    const [atrasadas] = await sql `select count(*)::int as n from informes_ejecuciones where programacion_id=${atrasoProg.id}`;
    assert.equal(atrasadas.n, 15);
    assert.ok((await repo.estadoRunner(idInforme(1))).programaciones.find(p => p.id === atrasoProg.id)!.atraso > 0);
    const pausada = await repo.modificarProgramacion(idInforme(1), atrasoProg.id, 0, false);
    assert.equal((await sql `select id from informes_ejecuciones where programacion_id=${atrasoProg.id} and estado='pendiente'`).length, 0);
    const reanudada = await repo.modificarProgramacion(idInforme(1), atrasoProg.id, pausada.version, true);
    assert.ok(+new Date(reanudada.proxima_utc) > Date.now());
    assert.match(JSON.stringify(reanudada.ultima_omision), /Reanudación/);
    await repo.modificarProgramacion(idInforme(1), atrasoProg.id, reanudada.version, false);
    ok('quince ocurrencias por lotes, cola llena no consume cursor, pausa y reanudación sin pasado');
    // Cuota con presupuesto reducido únicamente en este proceso de prueba. Se mide JSONB exacto;
    // el bloqueo/las transacciones/publicación siguen siendo los reales de producción.
    const limitesModulo = await import('../src/lib/informes/modelo');
    const exportadores = await import('../src/lib/informes/exportadores');
    const presupuestoOriginal = limitesModulo.LIMITES.propietario;
    const soloCsv = { ...config('estado_actual'), formatos: ['csv' as const] };
    const q1 = await nueva(soloCsv, idInforme(3)), q2 = await nueva(soloCsv, idInforme(3));
    const trabajosCuota = [(await repo.reclamar())!, (await repo.reclamar())!];
    assert.deepEqual(new Set(trabajosCuota.map(e => e.id)), new Set([q1.e.id, q2.e.id]));
    const conjuntos: Awaited<ReturnType<typeof exportadores.exportarInforme>>[] = [];
    for (const trabajo of trabajosCuota) {
        const snap = await lectores.capturarInforme({ id: trabajo.id, definicion: trabajo.definicion_snapshot, definicionSha256: trabajo.definicion_sha256, periodo: trabajo.periodo_resuelto, ocurrencia: new Date(trabajo.ocurrencia_utc).toISOString() });
        const sellado = exportadores.sellarSnapshot(snap);
        await repo.persistirCaptura(trabajo, sellado.snapshot, sellado.sha256);
        conjuntos.push(await exportadores.exportarInforme(sellado.snapshot, sellado.sha256));
    }
    const [conservado] = await sql `select (coalesce((select sum(octet_length(snapshot::text)) from informes_ejecuciones where propietario_id=${idInforme(3)} and snapshot is not null),0)+coalesce((select sum(a.bytes) from informes_archivos a join informes_ejecuciones e on e.id=a.ejecucion_id where e.propietario_id=${idInforme(3)}),0))::bigint as bytes`;
    const bytesConjuntos = conjuntos.map(c => c.archivos.reduce((n, a) => n + a.bytes, 0));
    const limitePrueba = Number(conservado.bytes) + bytesConjuntos[0] + bytesConjuntos[1] - 1;
    Object.assign(limitesModulo.LIMITES, { propietario: limitePrueba });
    let publicaciones: PromiseSettledResult<void>[] = [];
    try {
        publicaciones = await Promise.allSettled(trabajosCuota.map((e, i) => repo.publicar(e, conjuntos[i].archivos, conjuntos[i].manifiesto)));
        assert.equal(publicaciones.filter(r => r.status === 'fulfilled').length, 1);
        const fallo = publicaciones.find(r => r.status === 'rejected') as PromiseRejectedResult;
        assert.equal(fallo.reason.codigo, 'CUOTA_EXCEDIDA');
    }
    finally {
        Object.assign(limitesModulo.LIMITES, { propietario: presupuestoOriginal });
    }
    for (let i = 0; i < publicaciones.length; i++)
        if (publicaciones[i].status === 'rejected')
            await repo.fallar(trabajosCuota[i], new limitesModulo.ErrorInforme('CUOTA_EXCEDIDA', 'Cuota de prueba alcanzada.', 429));
    const [sumaCuota] = await sql `select (coalesce((select sum(octet_length(snapshot::text)) from informes_ejecuciones where propietario_id=${idInforme(3)} and snapshot is not null),0)+coalesce((select sum(a.bytes) from informes_archivos a join informes_ejecuciones e on e.id=a.ejecucion_id where e.propietario_id=${idInforme(3)}),0))::bigint as bytes`;
    assert.ok(Number(sumaCuota.bytes) <= limitePrueba);
    ok('cuota exacta JSONB y publicaciones concurrentes sin parciales', { presupuestoReducido: limitePrueba, bytesReales: Number(sumaCuota.bytes), bytesConjuntos });
    // El borde de captura se cobra por su JSONB persistido, incluyendo espacios.
    const borde = await nueva(soloCsv, idInforme(3));
    const trabajoBorde = (await repo.reclamar())!;
    assert.equal(trabajoBorde.id, borde.e.id);
    const capturaBorde = exportadores.sellarSnapshot(await lectores.capturarInforme({ id: trabajoBorde.id, definicion: trabajoBorde.definicion_snapshot, definicionSha256: trabajoBorde.definicion_sha256, periodo: trabajoBorde.periodo_resuelto, ocurrencia: new Date(trabajoBorde.ocurrencia_utc).toISOString() }));
    const [medidaBorde] = await sql `select octet_length(${sql.json(capturaBorde.snapshot as never)}::jsonb::text)::int as bytes`;
    Object.assign(limitesModulo.LIMITES, { propietario: Number(sumaCuota.bytes) + medidaBorde.bytes - 1 });
    try {
        await assert.rejects(() => repo.persistirCaptura(trabajoBorde, capturaBorde.snapshot, capturaBorde.sha256), { codigo: 'CUOTA_EXCEDIDA' });
        assert.equal((await sql `select snapshot from informes_ejecuciones where id=${borde.e.id}`)[0].snapshot, null);
    }
    finally {
        Object.assign(limitesModulo.LIMITES, { propietario: presupuestoOriginal });
    }
    await repo.fallar(trabajoBorde, new limitesModulo.ErrorInforme('CUOTA_EXCEDIDA', 'Borde de cuota de prueba.', 429));
    ok('borde de captura: un byte por debajo del JSONB real rechaza sin conservar parcial', { bytesJsonb: medidaBorde.bytes });
    // Retención: registro histórico sintético completo, ya vencido, con bytes reales.
    const historico = await repo.resultado(exportados.find(e => e.clave === 'estado_actual')!.id, idInforme(1));
    const idCaducado = randomUUID();
    const capturaAntigua = structuredClone(historico.snapshot!);
    capturaAntigua.ejecucionId = idCaducado;
    capturaAntigua.observadoEn = new Date(Date.now() - 32 * 86400000).toISOString();
    capturaAntigua.previstaEn = capturaAntigua.observadoEn;
    const selladoAntiguo = exportadores.sellarSnapshot(capturaAntigua);
    const artefactosAntiguos = await exportadores.exportarInforme(selladoAntiguo.snapshot, selladoAntiguo.sha256);
    await sql `insert into informes_ejecuciones(id,definicion_id,propietario_id,clave_peticion,ocurrencia_utc,definicion_snapshot,definicion_sha256,periodo_resuelto,snapshot,snapshot_sha256,observado_en,estado,manifiesto,terminado_en,caduca_en) values(${idCaducado},${historico.definicion_id},${idInforme(1)},${randomUUID()},${capturaAntigua.previstaEn},${sql.json(historico.definicion_snapshot as never)},${historico.definicion_sha256},${sql.json(historico.periodo_resuelto)},${sql.json(selladoAntiguo.snapshot as never)},${selladoAntiguo.sha256},${capturaAntigua.observadoEn},'correcta',${sql.json(artefactosAntiguos.manifiesto as never)},${capturaAntigua.observadoEn},now()-interval '2 days')`;
    await sql `insert into informes_receptores(ejecucion_id,usuario_id,origenes) values(${idCaducado},${idInforme(1)},${sql.json([{ tipo: 'propietario' }])})`;
    for (const a of artefactosAntiguos.archivos)
        await sql `insert into informes_archivos(id,ejecucion_id,formato,nombre,mime,contenido,sha256) values(${a.id},${idCaducado},${a.formato},${a.nombre},${a.mime},${Buffer.from(a.contenido)},${a.sha256})`;
    await assert.rejects(() => repo.descargar(idCaducado, 'manifiesto', idInforme(1)), { status: 410 });
    await repo.transaccion(async (r) => {
        await r.sql `select pg_advisory_xact_lock(728303)`;
        assert.ok(await r.purgar() >= 1);
    });
    const [expurgado] = await sql `select estado,snapshot,snapshot_sha256,snapshot_expurgado_en,manifiesto from informes_ejecuciones where id=${idCaducado}`;
    assert.equal(expurgado.estado, 'caducada');
    assert.equal(expurgado.snapshot, null);
    assert.equal(expurgado.snapshot_sha256, selladoAntiguo.sha256);
    assert.ok(expurgado.snapshot_expurgado_en);
    assert.ok(expurgado.manifiesto);
    assert.equal((await sql `select id from informes_archivos where ejecucion_id=${idCaducado}`).length, 0);
    ok('retención elimina contenido y conserva identidad, manifiesto y referencia histórica');
    // Tres fallos transitorios usan30/120segundos y agotan el mismo trabajo.
    const transitoria = await nueva(config('estado_actual'));
    for (let intento = 1; intento <= 3; intento++) {
        const job = (await repo.reclamar())!;
        assert.equal(job.id, transitoria.e.id);
        assert.equal(job.intento_actual, intento);
        await servicio.procesarEjecucion(repo, job, { capturar: async () => {
                throw new Error('Interrupción sintética de fuente');
            } });
        const [estado] = await sql `select estado,intento_actual,reintentar_desde,extract(epoch from reintentar_desde-now()) as demora,snapshot from informes_ejecuciones where id=${job.id}`;
        assert.equal(estado.estado, 'fallida');
        assert.equal(estado.snapshot, null);
        if (intento < 3) {
            assert.ok(Number(estado.demora) >= (intento === 1 ? 28 : 118));
            assert.ok(Number(estado.demora) <= (intento === 1 ? 31 : 121));
            await sql `update informes_ejecuciones set reintentar_desde=now()-interval '1 second' where id=${job.id}`;
        }
        else {
            assert.equal(estado.reintentar_desde, null);
            await assert.rejects(() => repo.reintentar(job.id, idInforme(1), 'fallida', 3), { status: 409 });
        }
    }
    assert.equal((await sql `select numero from informes_intentos where ejecucion_id=${transitoria.e.id}`).length, 3);
    ok('reintentos automáticos30/120segundos, máximo3 y captura ausente no acreditada');
    // Una ocurrencia antigua finaliza después; el último correcto sigue a la fecha prevista.
    const defOrden = await repo.guardarDefinicion(idInforme(1), 'PRUEBA orden ' + randomUUID().slice(0, 6), config('estado_actual'));
    const antigua = await repo.transaccion(r => r.insertarEjecucion(defOrden as unknown as import('../src/lib/informes/repositorio').DefinicionInforme, new Date(Date.now() - 3600000), randomUUID(), null));
    const reciente = await repo.transaccion(r => r.insertarEjecucion(defOrden as unknown as import('../src/lib/informes/repositorio').DefinicionInforme, new Date(), randomUUID(), null));
    const trabajoAntiguo = (await repo.reclamar())!;
    const trabajoReciente = (await repo.reclamar())!;
    assert.equal(trabajoAntiguo.id, antigua.id);
    assert.equal(trabajoReciente.id, reciente.id);
    let liberarRender: () => void = () => {
    };
    let confirmarBarrera: () => void = () => {
    };
    const barrera = new Promise<void>(r => liberarRender = r);
    const detenida = new Promise<void>(r => confirmarBarrera = r);
    const pendienteAntigua = servicio.procesarEjecucion(repo, trabajoAntiguo, { antesDePublicar: async () => {
            confirmarBarrera();
            await barrera;
        } });
    await detenida;
    await servicio.procesarEjecucion(repo, trabajoReciente);
    liberarRender();
    await pendienteAntigua;
    assert.equal((await repo.ultimosCorrectos(idInforme(1))).find(e => e.definicion_id === defOrden.id)!.id, reciente.id);
    const posterior = await repo.transaccion(r => r.insertarEjecucion(defOrden as unknown as import('../src/lib/informes/repositorio').DefinicionInforme, new Date(), randomUUID(), null));
    const jobPosterior = (await repo.reclamar())!;
    assert.equal(jobPosterior.id, posterior.id);
    await servicio.procesarEjecucion(repo, jobPosterior, { exportar: async () => {
            throw new Error('Formato sintético fallido');
        } });
    assert.equal((await repo.ultimosCorrectos(idInforme(1))).find(e => e.definicion_id === defOrden.id)!.id, reciente.id);
    ok('último correcto por ocurrencia, incluso finalización tardía y fallo posterior');
    // Defensa de descarga ante corrupción de transporte: la consulta real se altera sólo en el harness.
    const archivoIntegridad = historico.manifiesto!.archivos[0];
    const conexionCorrupta = new Proxy(sql, { apply(target, thisArg, args) {
            const retorno = Reflect.apply(target, thisArg, args);
            if (String(args[0]).includes('select contenido,bytes,sha256'))
                return Promise.resolve(retorno).then((filas: Record<string, unknown>[]) => filas.map(f => ({ ...f, contenido: Buffer.from('bytes alterados por harness') })));
            return retorno;
        } });
    const repoCorrupto = new modulo.RepositorioInformes(conexionCorrupta);
    await assert.rejects(() => repoCorrupto.descargar(historico.id, archivoIntegridad.id, idInforme(1)), { status: 503, codigo: 'ARCHIVO_INTEGRO_NO_DISPONIBLE' });
    assert.ok((await repo.descargar(historico.id, archivoIntegridad.id, idInforme(1))).contenido.length > 0);
    await assert.rejects(() => sql `insert into informes_archivos(id,ejecucion_id,formato,nombre,mime,contenido,sha256)values(${randomUUID()},${borde.e.id},'csv',${'informe-' + borde.e.id + '.csv'},'text/csv; charset=utf-8',${Buffer.from('contenido')},${'0'.repeat(64)})`, { code: '23514' });
    ok('corrupción devuelve503 sin bytes; el CHECK criptográfico rechaza almacenamiento inválido');
    // Un límite tardío de formato falla el conjunto, aunque otro archivo ya se haya generado.
    const limiteCsv = await nueva({ ...config('estado_actual'), formatos: ['pdf', 'csv', 'xlsx'] });
    const jobCsv = (await repo.reclamar())!;
    assert.equal(jobCsv.id, limiteCsv.e.id);
    const falloCsv = await servicio.procesarEjecucion(repo, jobCsv, { capturar: async (entrada) => {
            const s = await lectores.capturarInforme(entrada);
            s.avisos = ['AVISO PRUEBA '.repeat(30000)];
            const base = s.filas[0];
            s.filas = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(base), clave: randomUUID(), valores: { ...base.valores, nombre: 'PRUEBA límite CSV ' + i } }));
            return s;
        } });
    assert.equal(falloCsv.codigo, 'LIMITE_EXCEDIDO');
    assert.equal((await sql `select id from informes_archivos where ejecucion_id=${jobCsv.id}`).length, 0);
    const limiteXlsx = await nueva({ ...config('estado_actual'), formatos: ['csv', 'pdf', 'xlsx'] });
    const jobXlsx = (await repo.reclamar())!;
    assert.equal(jobXlsx.id, limiteXlsx.e.id);
    const falloXlsx = await servicio.procesarEjecucion(repo, jobXlsx, { capturar: async (entrada) => {
            const s = await lectores.capturarInforme(entrada);
            s.filas[0].valores.nombre = 'PRUEBA texto completo ' + 'W'.repeat(32768);
            return s;
        } });
    assert.equal(falloXlsx.codigo, 'LIMITE_EXCEDIDO');
    assert.equal((await sql `select id from informes_archivos where ejecucion_id=${jobXlsx.id}`).length, 0);
    ok('límite tardío CSV25MiB/XLSX32767caracteres: cero archivos parciales publicados');
    // Igualdad de todas las columnas BOM con E1, incluidos vacío/cero/orientativo/E2/E3.
    const materialConservado = await repo.resultado(exportados.find(e => e.clave === 'material_actual')!.id, idInforme(1));
    const tablasE1 = await import('../src/lib/documentos/tablas');
    const { Readable } = await import('node:stream');
    async function leerCsvCompleto(bytes: Uint8Array) {
        const libro = new ExcelJS.Workbook();
        const hoja = await libro.csv.read(Readable.from([Buffer.from(bytes)]), { parserOptions: { delimiter: ';' }, map: valor => valor });
        return (hoja.getRows(1, hoja.rowCount) ?? []).map(f => Array.isArray(f.values) ? f.values.slice(1).map(v => v == null ? '' : String(v)) : []);
    }
    const baseCsv = await leerCsvCompleto(tablasE1.generarBomCsv(materialConservado.snapshot!.material!, materialConservado.snapshot!.material!.salas));
    const archivoCsv = materialConservado.manifiesto!.archivos.find(a => a.formato === 'csv')!;
    const informeCsv = await leerCsvCompleto((await repo.descargar(materialConservado.id, archivoCsv.id, idInforme(1))).contenido);
    const indicesBase = tablasE1.COLUMNAS_BOM.map(([k]) => baseCsv[0].indexOf(k));
    const indicesInforme = tablasE1.COLUMNAS_BOM.map(([k]) => informeCsv[0].indexOf(k));
    assert.ok([...indicesBase, ...indicesInforme].every(i => i >= 0));
    assert.equal(baseCsv.length, informeCsv.length);
    const basePorArticulo = new Map(baseCsv.slice(1).map(f => [f[indicesBase[0]], indicesBase.map(i => f[i])]));
    for (const f of informeCsv.slice(1))
        assert.deepEqual(indicesInforme.map(i => f[i]), basePorArticulo.get(f[indicesInforme[0]]));
    const libroBase = new ExcelJS.Workbook();
    await libroBase.xlsx.load(Buffer.from(await tablasE1.generarXlsx(materialConservado.snapshot!.material!, materialConservado.snapshot!.material!.salas, 'bom')) as unknown as ExcelJS.Buffer);
    const libroInforme = new ExcelJS.Workbook();
    const archivoXlsx = materialConservado.manifiesto!.archivos.find(a => a.formato === 'xlsx')!;
    await libroInforme.xlsx.load(Buffer.from((await repo.descargar(materialConservado.id, archivoXlsx.id, idInforme(1))).contenido) as unknown as ExcelJS.Buffer);
    let celdasContrastadas = 0;
    for (const hoja of libroBase.worksheets) {
        const informe = libroInforme.getWorksheet(hoja.name)!;
        assert.ok(informe);
        for (let fila = 1; fila <= hoja.rowCount; fila++)
            for (let columna = 1; columna <= hoja.columnCount; columna++) {
                assert.deepEqual(informe.getCell(fila, columna).value, hoja.getCell(fila, columna).value);
                celdasContrastadas++;
            }
    }
    ok('paridad BOM completa E1:18columnas CSV y todas las celdas XLSX', { filas: baseCsv.length - 1, columnas: 18, celdasContrastadas });
    // Corpus de estrés separado: título máximo, ámbito500, saltos y fórmulas, cero y ausencia.
    const stress = structuredClone((await repo.resultado(exportados.find(e => e.clave === 'carga_actual')!.id, idInforme(1))).snapshot!);
    stress.definicion.nombre = 'W'.repeat(120);
    stress.ambito.salas = Array.from({ length: 500 }, (_, i) => ({ id: randomUUID(), nombre: `PRUEBA ESTRÉS ${i}: ` + 'Nombre largo con tildes áéíóú y ñ. '.repeat(7), codigo: `ESTRES-${i}` }));
    if (stress.filas.length) {
        stress.filas[0].valores.carga = 'PRUEBA FILA CONTINUADA: ' + ('Texto completo con tildes ñ y salto de línea.\n'.repeat(500)) + 'FIN ÍNTEGRO';
        stress.filas[0].valores.articulo = '=HYPERLINK("https://no-cargar.invalid")';
        stress.filas[0].valores.cantidad = 0;
        stress.filas[0].valores.instalado = null;
    }
    const stressSellado = exportadores.sellarSnapshot(stress);
    const stressArchivos = await exportadores.exportarInforme(stressSellado.snapshot, stressSellado.sha256);
    for (const a of stressArchivos.archivos)
        await writeFile(resolve(salida, 'archivos', `stress.${a.formato}`), a.contenido);
    await writeFile(resolve(salida, 'archivos', 'stress.json'), JSON.stringify(stressArchivos.manifiesto, null, 2));
    ok('corpus de estrés real de los tres formatos', { salas: 500, titulo: 120, archivos: stressArchivos.manifiesto.archivos });
    await writeFile(resolve(salida, 'gate.json'), JSON.stringify({ pruebas, exportados }, null, 2));
}
finally {
    if (antes) {
        const despues = await fotografiarRevisiones(sql);
        await writeFile(resolve(salida, 'hechos-despues.json'), JSON.stringify(despues, null, 2));
        const operativas = (f: typeof despues) => f.tablas.filter(t => !t.tabla.startsWith('informes_') && !['usuarios', 'usuario_permisos'].includes(t.tabla));
        assert.deepEqual(operativas(despues), operativas(antes));
        console.log('OK hashes de tablas operativas intactos');
    }
    await sql.end();
}
