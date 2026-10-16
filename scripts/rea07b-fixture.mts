/** Destino exclusivo de QA requisitos REA-07B: Postgres local nuevo, nunca .env.local. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { crearFixtureRevisiones, FIXTURE_REVISIONES } from './revisiones-fixture.mjs';
import { fotografiarBase } from './documentos-fixture.mjs';
export { FIXTURE_REVISIONES };
export type SqlRevisionesPrueba = ReturnType<typeof postgres>;
export const SALIDA_REVISIONES = resolve('output/rea-integracion/rea07b/postgres');
export const URL_REA_PRUEBA = 'postgres://av_design_rea07b:av_design_rea07b_local@127.0.0.1:5564/av_design_rea07b_prueba';
export function comprobarUrlRevisiones(texto: string): URL {
    const url = new URL(texto);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
        url.port !== '5564' || url.pathname !== '/av_design_rea07b_prueba' ||
        decodeURIComponent(url.username) !== 'av_design_rea07b' || url.search || url.hash) {
        throw new Error('REA sólo admite av_design_rea07b_prueba / av_design_rea07b / 127.0.0.1:5564 sin parámetros.');
    }
    return url;
}
export async function conectarRevisiones(texto: string): Promise<SqlRevisionesPrueba> {
    const url = comprobarUrlRevisiones(texto);
    const sql = postgres(url.toString(), { max: 5, ssl: false, onnotice: () => {
        } });
    try {
        const [real] = await sql `select current_database() as base, current_user as usuario, inet_server_port() as puerto`;
        if (real.base !== 'av_design_rea07b_prueba' || real.usuario !== 'av_design_rea07b' || Number(real.puerto) !== 5432) {
            throw new Error('Identidad real REA rechazada antes de escribir.');
        }
        await mkdir(SALIDA_REVISIONES, { recursive: true });
        await writeFile(resolve(SALIDA_REVISIONES, 'identidad.json'), JSON.stringify({ ...real, host: url.hostname }, null, 2));
        console.log(`Destino REA comprobado: ${url.hostname}:5564/${real.base}, usuario ${real.usuario}, servidor:5432.`);
        return sql;
    }
    catch (error) {
        await sql.end();
        throw error;
    }
}
export async function fotografiarRevisiones(sql: SqlRevisionesPrueba) {
    return { ...await fotografiarBase(sql), base: 'av_design_rea07b_prueba' };
}
async function main() {
    const url = process.env.REA07B_DATABASE_URL;
    if (!url)
        throw new Error('REA07B_DATABASE_URL explícita obligatoria. No se lee .env.local.');
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
/** Identidades sintéticas exclusivas para la comparación local REA07B. */
export const idResultado = (n: number) => `da000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function crearIdentidadesResultados(sql: SqlRevisionesPrueba) {
    const { cifrarClave } = await import('../src/lib/contrasena');
    const clave = await cifrarClave('Rea05PruebaLocal2026!');
    for (const [n, rol, provisional, activo] of [[1, 'admin', false, true], [2, 'lectura', false, true], [3, 'tecnico_avanzado', false, true], [4, 'lectura', true, true], [5, 'lectura', false, false]] as const) {
        await sql `insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo) values (${idResultado(n)},${'rea07b-' + n},${'PRUEBA REA07B resultados usuario ' + n},${rol},${clave},${provisional},${activo}) on conflict(id) do nothing`;
    }
}
