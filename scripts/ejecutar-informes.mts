/** Proceso local confiable. Nunca lee .env ni utiliza sesiones ficticias. */
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import { conectarRevisiones } from './rea03-fixture.mjs';
let codigo = 0;
let sql: Awaited<ReturnType<typeof conectarRevisiones>> | undefined;
let repo: import('../src/lib/informes/repositorio').RepositorioInformes | undefined;
let procesoId: string | undefined;
let latido: ReturnType<typeof setInterval> | undefined;
let detener = false;
const espera = new AbortController();
let salidaForzada: ReturnType<typeof setTimeout> | undefined;
try {
    const argumentos = process.argv.slice(2);
    const una = argumentos.includes('--una-vez'), continuo = argumentos.includes('--continuo');
    const intervaloArgumento = argumentos.find(a => a.startsWith('--intervalo-segundos='));
    const intervalo = intervaloArgumento ? Number(intervaloArgumento.split('=')[1]) : 15;
    if (una === continuo || argumentos.some(a => a !== '--una-vez' && a !== '--continuo' && !a.startsWith('--intervalo-segundos=')) || !Number.isInteger(intervalo) || intervalo < 1 || intervalo > 3600)
        throw new Error('CONFIGURACION');
    const url = process.env.INFORMES_DATABASE_URL;
    if (!url)
        throw new Error('CONFIGURACION');
    try {
        sql = await conectarRevisiones(url);
    }
    catch {
        throw new Error('DESTINO');
    }
    process.env.DATABASE_URL = url;
    globalThis.__sql = sql;
    // Interceptar únicamente server-only; no cookies, SQL, permisos ni Next.
    const require = createRequire(import.meta.url);
    const Module = require('node:module') as {
        _load: (id: string, ...args: unknown[]) => unknown;
    };
    const anterior = Module._load;
    Module._load = function (id, ...args) {
        if (id === 'server-only')
            return {};
        return anterior.call(this, id, ...args);
    };
    let moduloRepo: typeof import('../src/lib/informes/repositorio');
    let moduloRunner: typeof import('../src/lib/informes/runner');
    try {
        moduloRepo = await import('../src/lib/informes/repositorio');
        moduloRunner = await import('../src/lib/informes/runner');
    }
    finally {
        Module._load = anterior;
    }
    repo = new moduloRepo.RepositorioInformes(sql);
    procesoId = await repo.iniciarRunner(una ? 'manual' : 'continuo');
    latido = setInterval(() => {
        void repo!.latidoRunner(procesoId!).catch(() => {
            codigo = 1;
            detener = true;
        });
    }, 15000);
    const parar = () => {
        detener = true;
        espera.abort();
        salidaForzada ??= setTimeout(() => {
            process.exit(1);
        }, 30000);
    };
    process.once('SIGTERM', parar);
    process.once('SIGINT', parar);
    do {
        const resumen = await moduloRunner.pasadaInformes(repo, { detener: () => detener, latido: () => repo!.latidoRunner(procesoId!) });
        console.log(JSON.stringify({ procesoId, modo: una ? 'manual' : 'continuo', ...resumen }));
        if (resumen.fallosInfraestructura)
            codigo = 1;
        if (una || detener)
            break;
        await esperar(intervalo * 1000, undefined, { signal: espera.signal }).catch(error => {
            if (!detener)
                throw error;
        });
    } while (!detener);
}
catch (error) {
    const tipo = error instanceof Error ? error.message : '';
    if (['CONFIGURACION', 'DESTINO'].includes(tipo)) {
        codigo = 2;
        console.error('Configuración o destino de informes rechazado. Exige la base sintética REA-03 y un modo válido.');
    }
    else {
        codigo = 1;
        console.error('El runner no pudo completar su pasada por un fallo de infraestructura.');
    }
}
finally {
    if (latido)
        clearInterval(latido);
    if (salidaForzada)
        clearTimeout(salidaForzada);
    if (repo && procesoId)
        try {
            await repo.detenerRunner(procesoId);
        }
        catch {
            codigo = 1;
        }
    if (sql)
        await sql.end({ timeout: 5 });
    process.exitCode = codigo;
}
