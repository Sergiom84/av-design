import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { COOKIE_SESION, firmarSesion } from '../src/lib/sesion';
import { idRequisito, URL_REA_PRUEBA } from '../scripts/rea10-fixture.mjs';

assert.equal(process.env.REA10_DATABASE_URL, URL_REA_PRUEBA);
const base = 'http://localhost:3122';
const salida = resolve(process.env.REA10_SALIDA ?? `output/rea-integracion/rea10/runtime-20261016/puertos-visual-${Date.now()}`);
await mkdir(salida, { recursive: true });
const fixture = JSON.parse(await readFile('output/rea-integracion/rea10/runtime-20261016/postgres-05/fixture.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await contexto.addCookies([{ name: COOKIE_SESION, value: await firmarSesion('rea10-local-sintetico-secreto-requisitos-2026', Date.now() + 3600000, idRequisito(1)), url: base, httpOnly: true, sameSite: 'Lax' }]);
const page = await contexto.newPage();
const errores: string[] = [], externas: string[] = [], escrituras: string[] = [];
page.on('pageerror', error => errores.push(error.message));
page.on('request', request => {
    if (!request.url().startsWith(base) && !request.url().startsWith('data:')) externas.push(request.url());
    if (request.method() !== 'GET') escrituras.push(`${request.method()} ${request.url()}`);
});
const medidas: unknown[] = [];
try {
    await page.goto(`${base}/articulo/${fixture.articuloId}`);
    await expect(page.getByRole('textbox', { name: 'Nombre del puerto', exact: true })).toHaveValue('HDMI IN 1');
    const tabla = page.getByRole('table').filter({ has: page.getByRole('textbox', { name: 'Nombre del puerto', exact: true }) });
    for (const [nombre, ancho, alto] of [['escritorio', 1440, 1000], ['movil', 390, 844]] as const) {
        await page.setViewportSize({ width: ancho, height: alto });
        await tabla.scrollIntoViewIfNeeded();
        const datos = await tabla.evaluate(elemento => {
            const tabla = elemento as HTMLTableElement;
            const botones = Array.from(tabla.querySelectorAll('button')).map(boton => ({
                texto: boton.textContent?.trim(), ancho: boton.getBoundingClientRect().width,
                alto: boton.getBoundingClientRect().height, blanco: getComputedStyle(boton).whiteSpace,
            }));
            const contenedor = tabla.parentElement!;
            return { botones, overflowPagina: document.documentElement.scrollWidth - innerWidth,
                anchoTabla: tabla.getBoundingClientRect().width, anchoContenedor: contenedor.getBoundingClientRect().width };
        });
        assert.equal(datos.overflowPagina, 0);
        for (const boton of datos.botones) {
            assert.ok(boton.ancho >= 70, JSON.stringify(boton));
            assert.ok(boton.alto <= 52, JSON.stringify(boton));
            assert.equal(boton.blanco, 'nowrap');
        }
        medidas.push({ nombre, ...datos });
        if (nombre === 'movil') await tabla.evaluate(elemento => { elemento.parentElement!.scrollLeft = elemento.parentElement!.scrollWidth; });
        await page.screenshot({ path: resolve(salida, `${nombre}.png`), fullPage: true });
    }
    await page.goto(`${base}/proyectos/no-es-uuid/requisitos`);
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
    assert.deepEqual(errores, []); assert.deepEqual(externas, []); assert.deepEqual(escrituras, []);
    await writeFile(resolve(salida, 'resultado.json'), JSON.stringify({ medidas, errores, externas, escrituras, guardUuid: '404 sin acceso a SQL por identificador inválido', navegador: browser.version() }, null, 2));
    console.log(JSON.stringify({ medidas, errores, externas, escrituras }));
} finally { await browser.close(); }
