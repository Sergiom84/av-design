import { test, expect, type BrowserContext } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, URL_REA_PRUEBA, crearIdentidadesInformes, idInforme, FIXTURE_REVISIONES as f, fotografiarRevisiones, type SqlRevisionesPrueba } from '../scripts/rea03-fixture.mjs';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
const salida = resolve('output/rea-integracion/rea03/navegador'), origen = 'http://localhost:3113';
let sql: SqlRevisionesPrueba;
let antes: Awaited<ReturnType<typeof fotografiarRevisiones>>;
let ejecucionId = '';
async function entrar(context: BrowserContext, n = 1) {
    await context.clearCookies();
    await context.addCookies([{ name: COOKIE_SESION, value: await firmarSesion('rea03-local-prueba-integracion-secreto-2026', Date.now() + 3600000, idInforme(n)), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
async function cli() {
    return new Promise<void>((res, rej) => {
        const p = spawn(process.execPath, ['--import', 'tsx', 'scripts/ejecutar-informes.mts', '--una-vez'], { env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', INFORMES_DATABASE_URL: URL_REA_PRUEBA }, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
        let texto = '';
        p.stdout.on('data', d => texto += d);
        p.stderr.on('data', d => texto += d);
        p.on('close', async (code) => {
            await writeFile(resolve(salida, `cli-${Date.now()}.log`), texto);
            if (code === 0)
                res();
            else
                rej(new Error('Runner falló: ' + texto));
        });
        p.on('error', rej);
    });
}
test.describe.serial('REA03 · escritorio completo y móvil al cierre', () => {
    test.beforeAll(async () => {
        if (process.env.INFORMES_DATABASE_URL !== URL_REA_PRUEBA)
            throw new Error('Destino REA03 explícito obligatorio');
        sql = await conectarRevisiones(URL_REA_PRUEBA);
        await crearIdentidadesInformes(sql);
        await mkdir(salida, { recursive: true });
        antes = await fotografiarRevisiones(sql);
    });
    test.afterAll(async () => {
        if (sql) {
            const despues = await fotografiarRevisiones(sql);
            const operativas = (f: typeof despues) => f.tablas.filter(t => !t.tabla.startsWith('informes_') && !['usuarios', 'usuario_permisos'].includes(t.tabla));
            expect(operativas(despues)).toEqual(operativas(antes));
            await writeFile(resolve(salida, 'hechos-despues.json'), JSON.stringify(despues, null, 2));
            await sql.end();
        }
    });
    test('escritorio: definición, revisión, generación durable, tres descargas y programación', async ({ page, context }) => {
        await entrar(context);
        const errores: string[] = [];
        page.on('pageerror', e => errores.push(e.message));
        await page.goto('/cuenta/informes');
        await expect(page.getByRole('heading', { name: 'Informes', exact: true })).toBeVisible();
        await page.getByLabel('Nombre', { exact: true }).fill('PRUEBA REA03 navegador completo');
        await page.getByLabel('Informe', { exact: true }).selectOption('estado_actual');
        await page.getByLabel('Ámbito', { exact: true }).selectOption(f.sala);
        await page.getByRole('button', { name: 'Revisar selección y audiencia' }).click();
        await expect(page.getByRole('region', { name: 'Selección revisada' })).toContainText('PRUEBA');
        await page.getByRole('button', { name: 'Guardar definición revisada' }).click();
        await expect(page.getByRole('status')).toContainText('Definición guardada');
        await page.getByRole('button', { name: 'Solicitar informe', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Informe encolado');
        await cli();
        await expect(page.getByRole('region', { name: 'Resultado del informe' })).toContainText('correcta');
        const [e] = await sql `select id,manifiesto from informes_ejecuciones where propietario_id=${idInforme(1)} and definicion_snapshot->>'nombre'='PRUEBA REA03 navegador completo' order by creado_en desc limit 1`;
        ejecucionId = e.id;
        for (const formato of ['PDF', 'XLSX', 'CSV']) {
            const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: new RegExp('Descargar ' + formato + ' \\(') }).click()]);
            const p = resolve(salida, descarga.suggestedFilename());
            await descarga.saveAs(p);
            const respuesta = await context.request.get(`/api/informes/ejecuciones/${e.id}/archivos/${e.manifiesto.archivos.find((a: {
                formato: string;
            }) => a.formato === formato.toLowerCase()).id}`);
            expect(respuesta.status()).toBe(200);
            expect(createHash('sha256').update(await respuesta.body()).digest('hex')).toBe(respuesta.headers()['x-av-sha256']);
        }
        await page.getByRole('link', { name: 'Descargar manifiesto' }).click();
        await page.getByLabel('Hora local', { exact: true }).fill('23:55');
        await page.getByRole('button', { name: 'Guardar programación', exact: true }).click();
        await expect(page.getByText('diaria · 23:55 Madrid · v0 · Activa')).toBeVisible();
        await page.getByRole('button', { name: 'Pausar', exact: true }).click();
        await expect(page.getByText(/diaria · 23:55 Madrid · v1 · Pausada/)).toBeVisible();
        await page.getByRole('button', { name: 'Reanudar desde la próxima fecha futura' }).click();
        await expect(page.getByText('diaria · 23:55 Madrid · v2 · Activa')).toBeVisible();
        await expect(page.getByText(/Reanudación: se omite/)).toBeVisible();
        await page.screenshot({ path: resolve(salida, 'escritorio-completo.png'), fullPage: true });
        expect(errores).toEqual([]);
    });
    test('escritorio: grupos y audiencia, conflicto conserva formulario, error recuperable y segundo usuario', async ({ page, context }) => {
        await entrar(context);
        await page.goto('/cuenta/informes');
        await page.getByRole('button', { name: 'PRUEBA REA03 navegador completo', exact: false }).first().click();
        await page.getByLabel('Nombre del grupo', { exact: true }).fill('PRUEBA REA03 grupo navegador');
        const grupos = page.getByRole('heading', { name: 'Grupos internos' }).locator('..');
        await grupos.getByLabel('Buscar destinatarios').fill('rea03-2');
        await expect(grupos.getByText('PRUEBA REA03 usuario 2 (rea03-2)', { exact: true })).toBeVisible();
        await grupos.getByRole('checkbox').first().check();
        await page.getByRole('button', { name: 'Crear grupo con el ámbito seleccionado' }).click();
        await expect(page.getByRole('status')).toContainText('Grupo guardado');
        await expect(grupos.getByText(/PRUEBA REA03 grupo navegador · 1 miembros/).first()).toBeVisible();
        const otra = await context.newPage();
        await otra.goto('/cuenta/informes');
        await otra.getByRole('button', { name: 'PRUEBA REA03 navegador completo', exact: false }).first().click();
        await page.getByLabel('Nombre', { exact: true }).fill('PRUEBA REA03 navegador versión nueva');
        await page.getByRole('button', { name: 'Revisar selección y audiencia' }).click();
        await page.getByRole('button', { name: 'Guardar definición revisada' }).click();
        await expect(page.getByRole('status')).toContainText('Definición guardada');
        await otra.getByLabel('Nombre', { exact: true }).fill('Edición local conservada');
        await otra.getByRole('button', { name: 'Revisar selección y audiencia' }).click();
        await otra.getByRole('button', { name: 'Guardar definición revisada' }).click();
        await expect(otra.locator('p[role="alert"]')).toContainText('Otra pestaña');
        await expect(otra.getByLabel('Nombre', { exact: true })).toHaveValue('Edición local conservada');
        await otra.route('**/api/informes/vista-previa', r => r.abort('failed'));
        await otra.getByRole('button', { name: 'Revisar selección y audiencia' }).click();
        await expect(otra.locator('p[role="alert"]')).toBeVisible();
        await expect(otra.getByLabel('Nombre', { exact: true })).toHaveValue('Edición local conservada');
        await otra.screenshot({ path: resolve(salida, 'escritorio-conflicto.png'), fullPage: true });
        await otra.unroute('**/api/informes/vista-previa');
        await otra.getByRole('button', { name: 'Comparar versión guardada', exact: true }).click();
        await expect(otra.getByRole('region', { name: 'Comparación de versiones' })).toBeVisible();
        await expect(otra.getByLabel('Nombre', { exact: true })).toHaveValue('Edición local conservada');
        await otra.getByRole('button', { name: 'Revisar mi edición con la versión actual', exact: true }).click();
        await otra.getByRole('button', { name: 'Revisar selección y audiencia', exact: true }).click();
        await otra.getByRole('button', { name: 'Guardar definición revisada', exact: true }).click();
        await expect(otra.getByRole('status')).toContainText('Definición guardada');
        await otra.close();
        await entrar(context, 2);
        expect((await context.request.get(`/api/informes/ejecuciones/${ejecucionId}`)).status()).toBe(404);
        await page.goto('/cuenta/informes');
        expect(await page.content()).not.toContain('PRUEBA REA03 navegador');
        await expect(page.getByRole('heading', { name: 'Grupos internos' })).toHaveCount(0);
        await page.screenshot({ path: resolve(salida, 'escritorio-receptor-ajeno.png'), fullPage: true });
    });
    test('escritorio: HTTP estricto, origen, cuerpo, UUID, provisional y ausencia de sesión', async ({ context }) => {
        await entrar(context);
        expect((await context.request.post('/api/informes', { data: { propietario: idInforme(2) }, headers: { origin: origen } })).status()).toBe(400);
        expect((await context.request.post('/api/informes', { data: {}, headers: { origin: 'https://ajeno.invalid' } })).status()).toBe(403);
        expect((await context.request.post('/api/informes', { data: ' '.repeat(16385), headers: { origin: origen, 'content-type': 'application/json' } })).status()).toBe(413);
        expect((await context.request.get('/api/informes/no-es-uuid')).status()).toBe(400);
        await entrar(context, 4);
        expect((await context.request.get('/api/informes')).status()).toBe(403);
        await context.clearCookies();
        expect((await context.request.get('/api/informes', { maxRedirects: 0 })).status()).toBe(401);
    });
    test('móvil final: selección, teclado, error preservado y descarga completa', async ({ page, context }) => {
        await entrar(context);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/cuenta/informes');
        await page.getByRole('button', { name: 'Nueva definición', exact: true }).click();
        await page.getByLabel('Nombre', { exact: true }).fill('PRUEBA REA03 móvil');
        await page.getByLabel('Informe', { exact: true }).selectOption('carga_hechos');
        await page.getByLabel('Ámbito', { exact: true }).selectOption(f.sala);
        await page.getByLabel('Desde', { exact: true }).fill('2026-10-14');
        await page.getByLabel('Hasta', { exact: true }).fill('2026-10-15');
        await page.getByRole('button', { name: 'Revisar selección y audiencia' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('region', { name: 'Selección revisada' })).toBeVisible();
        await page.getByRole('button', { name: 'Guardar definición revisada' }).click();
        await expect(page.getByRole('status')).toContainText('Definición guardada');
        await page.getByRole('button', { name: 'Solicitar informe', exact: true }).click();
        await cli();
        await expect(page.getByRole('region', { name: 'Resultado del informe' })).toContainText('correcta');
        const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Descargar CSV \(/ }).click()]);
        await d.saveAs(resolve(salida, 'movil-' + d.suggestedFilename()));
        const desbordes = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(e => e.getBoundingClientRect().right > innerWidth + 2 && e.getBoundingClientRect().width > 0).slice(-20).map(e => ({ tag: e.tagName, clase: e.className, texto: e.textContent?.slice(0, 80), derecha: e.getBoundingClientRect().right })));
        await writeFile(resolve(salida, 'movil-geometria.json'), JSON.stringify(desbordes, null, 2));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
        await page.screenshot({ path: resolve(salida, 'movil-cierre.png'), fullPage: true });
    });
});
