/** Destino exclusivo REA-04: Postgres local nuevo, nunca .env.local. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { crearFixtureRevisiones, FIXTURE_REVISIONES } from './revisiones-fixture.mjs';
import { fotografiarBase } from './documentos-fixture.mjs';
export { FIXTURE_REVISIONES };
export type SqlRevisionesPrueba = ReturnType<typeof postgres>;
export const SALIDA_REVISIONES = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04', 'postgres');
export const URL_REA_PRUEBA = 'postgres://av_design_rea04:av_design_rea04_local@127.0.0.1:5556/av_design_rea04_prueba';
export function comprobarUrlRevisiones(texto: string): URL {
    const url = new URL(texto);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
        url.port !== '5556' || url.pathname !== '/av_design_rea04_prueba' ||
        decodeURIComponent(url.username) !== 'av_design_rea04' || url.search || url.hash) {
        throw new Error('REA sólo admite av_design_rea04_prueba / av_design_rea04 / 127.0.0.1:5556 sin parámetros.');
    }
    return url;
}
export async function conectarRevisiones(texto: string): Promise<SqlRevisionesPrueba> {
    const url = comprobarUrlRevisiones(texto);
    const sql = postgres(url.toString(), { max: 5, ssl: false, onnotice: () => {
        } });
    try {
        const [real] = await sql `select current_database() as base, current_user as usuario, inet_server_port() as puerto`;
        if (real.base !== 'av_design_rea04_prueba' || real.usuario !== 'av_design_rea04' || Number(real.puerto) !== 5432) {
            throw new Error('Identidad real REA rechazada antes de escribir.');
        }
        await mkdir(SALIDA_REVISIONES, { recursive: true });
        await writeFile(resolve(SALIDA_REVISIONES, 'identidad.json'), JSON.stringify({ ...real, host: url.hostname }, null, 2));
        console.log(`Destino REA comprobado: ${url.hostname}:5556/${real.base}, usuario ${real.usuario}, servidor:5432.`);
        return sql;
    }
    catch (error) {
        await sql.end();
        throw error;
    }
}
export async function fotografiarRevisiones(sql: SqlRevisionesPrueba) {
    return { ...await fotografiarBase(sql), base: 'av_design_rea04_prueba' };
}
async function main() {
    const url = process.env.REA_DATABASE_URL;
    if (!url)
        throw new Error('REA_DATABASE_URL explícita obligatoria. No se lee .env.local.');
    const sql = await conectarRevisiones(url);
    try {
        if (process.argv.includes('--schema')) {
            if (!process.argv.includes('--aplicar'))
                throw new Error('--schema exige --aplicar.');
            const [{ n }] = await sql `select count(*)::int as n from pg_tables where schemaname='public'`;
            if (n !== 0)
                throw new Error('Schema sólo en base nueva vacía; no se resetea.');
            const conexion = await sql.reserve();
            try {
                await conexion.unsafe(await readFile(resolve('db/schema.sql'), 'utf8'));
            }
            finally {
                conexion.release();
            }
        }
        if (process.argv.includes('--aplicar'))
            await crearFixtureRevisiones(sql);
        const foto = process.argv.find(a => a.startsWith('--foto='))?.slice(7);
        if (foto) {
            if (!/^[a-z0-9-]+$/.test(foto))
                throw new Error('Nombre de foto inválido.');
            const datos = await fotografiarRevisiones(sql);
            await writeFile(resolve(SALIDA_REVISIONES, `bd-${foto}.json`), JSON.stringify(datos, null, 2));
            console.log(`Foto ${foto}: ${datos.sha256}, ${datos.tablas.length} tablas.`);
        }
    }
    finally {
        await sql.end();
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
/** Identidades sintéticas exclusivas para la aceptación de planificación. */
export const idPlan = (n: number) => `d4000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function crearIdentidadesPlanes(sql: SqlRevisionesPrueba) {
    const { cifrarClave } = await import('../src/lib/contrasena');
    const clave = await cifrarClave('Rea04PruebaLocal2026!');
    for (const [n, rol, provisional, activo] of [[1, 'admin', false, true], [2, 'lectura', false, true], [3, 'tecnico_avanzado', false, true], [4, 'lectura', true, true], [5, 'lectura', false, false]] as const) {
        await sql `insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo) values (${idPlan(n)},${'rea04-' + n},${'PRUEBA REA04 usuario ' + n},${rol},${clave},${provisional},${activo}) on conflict(id) do nothing`;
    }
}
