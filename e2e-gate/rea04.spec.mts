import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, URL_REA_PRUEBA, idPlan, fotografiarRevisiones, type SqlRevisionesPrueba } from '../scripts/rea04-fixture.mjs';
import { firmarSesion, COOKIE_SESION } from '../src/lib/sesion';
const salida = resolve(process.env.REA04_EVIDENCIA ?? 'output/rea-integracion/rea04');
const base = Number(String(Date.now()).slice(-9));
const ident = (n: number) => idPlan(base + n);
const tecnico = ident(20), nombreTecnico = 'Técnico UI REA04 ' + base;
const obra = ident(1), localizacion = ident(2), salas = [ident(3), ident(4)];
let sql: SqlRevisionesPrueba;
const trabajo = 'Trabajo UI REA04 ' + base, manual = 'Manual UI REA04 ' + base, grupo = 'Grupo UI REA04 ' + base;
async function entrar(context: BrowserContext, n = 1) {
    await context.clearCookies();
    await context.addCookies([{ name: COOKIE_SESION, value: await firmarSesion('rea04-local-prueba-integracion-secreto-2026', Date.now() + 3600000, idPlan(n)), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
test.describe.serial('REA04 · escritorio completo antes de móvil', () => {
    test.beforeAll(async () => {
        if (process.env.REA_DATABASE_URL !== URL_REA_PRUEBA)
            throw new Error('URL REA04 explícita obligatoria.');
        sql = await conectarRevisiones(process.env.REA_DATABASE_URL);
        await mkdir(salida, { recursive: true });
        await sql `insert into tecnicos(id,nombre,activo,fuente)values(${tecnico},${nombreTecnico},true,'app')`;
        await sql `insert into proyectos(id,nombre,codigo)values(${obra},${'Obra UI REA04 ' + base},${'REA04-UI-' + base})`;
        await sql `insert into localizaciones(id,proyecto_id,nombre)values(${localizacion},${obra},'Edificio UI')`;
        for (let i = 0; i < 2; i++)
            await sql `insert into salas(id,localizacion_id,nombre,codigo,largo_m,ancho_m,alto_m)values(${salas[i]},${localizacion},${'Sala UI ' + (i + 1)},${'UI-' + base + '-' + i},6,4,3)`;
        await writeFile(resolve(salida, 'e2e-identidades.json'), JSON.stringify({ obra, localizacion, salas, tecnico, nombreTecnico, trabajo, manual, grupo }, null, 2));
    });
    test.afterAll(async () => {
        await sql?.end();
    });
    test('escritorio: catálogo/regla, crearplan, preview selectivo, manual, grupo/técnico, horario, historial y agenda', async ({ page, context }) => {
        await entrar(context);
        const errores: string[] = [];
        page.on('pageerror', e => errores.push(e.message));
        await page.goto('/proyectos/planificacion/catalogo');
        await page.getByLabel('Título del trabajo', { exact: true }).fill(trabajo);
        await page.getByLabel('Descripción del trabajo', { exact: true }).fill('Trabajo literal de prueba');
        await page.getByLabel('Estimación del trabajo', { exact: true }).fill('45');
        await page.getByRole('button', { name: 'Guardar trabajo', exact: true }).click();
        await page.getByLabel('Buscar trabajo', { exact: true }).fill(trabajo);
        await page.getByRole('button', { name: 'Buscar trabajos', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Editar ' + trabajo, exact: true })).toBeVisible();
        await page.getByLabel('Trabajo de la regla', { exact: true }).selectOption({ label: trabajo });
        await page.getByRole('button', { name: 'Guardar regla', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Guardar regla', exact: true })).toBeEnabled();
        for (let n = 0; n < 10 && !await page.getByText(trabajo + ' · sala · Activa', { exact: true }).count(); n++) {
            await page.getByRole('button', { name: 'Reglas siguientes', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Guardar regla', exact: true })).toBeEnabled();
        }
        await expect(page.getByText(trabajo + ' · sala · Activa', { exact: true })).toBeVisible();
        await page.goto(`/proyectos/${obra}/plan`);
        await expect(page.getByText('La obra ya existe. Crear su plan no la inicia ni añade salas.')).toBeVisible();
        await page.getByRole('button', { name: 'Crear plan de esta obra', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Tareas del plan', exact: true })).toBeVisible();
        const prep = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Proponer desde salas y reglas', exact: true }) });
        await prep.getByLabel('Todas las salas actuales de la obra').check();
        for (let n = 0; n < 10 && !await prep.getByLabel(trabajo + ' · sala', { exact: true }).count(); n++) {
            await prep.getByRole('button', { name: 'Cargar más reglas', exact: true }).click();
            await expect(prep.getByRole('status').filter({ hasText: 'Más reglas disponibles.' })).toBeVisible();
        }
        await prep.getByLabel(trabajo + ' · sala', { exact: true }).check();
        await prep.getByRole('button', { name: 'Preparar propuesta', exact: true }).click();
        await expect(prep.getByRole('heading', { name: 'Diff para revisar', exact: true })).toBeVisible();
        await expect(prep.getByLabel('Elegir candidata 1', { exact: true })).not.toBeChecked();
        await prep.getByLabel('Elegir candidata 1', { exact: true }).check();
        await prep.getByRole('button', { name: 'Confirmar 1 acciones elegidas', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Abrir tarea ' + trabajo, exact: true })).toHaveCount(1);
        await page.getByLabel('Nueva tarea: título', { exact: true }).fill(manual);
        await page.getByLabel('Nueva tarea: estado', { exact: true }).selectOption('pendiente');
        await page.getByLabel('Nueva tarea: vencimiento', { exact: true }).fill('2026-10-15');
        await page.getByRole('button', { name: 'Crear tarea manual', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true })).toBeVisible();
        await page.getByLabel('Nombre del grupo', { exact: true }).fill(grupo);
        await page.getByLabel('Buscar miembro', { exact: true }).fill(nombreTecnico);
        await page.getByRole('button', { name: 'Buscar miembros', exact: true }).click();
        await page.getByRole('button', { name: 'Incluir ' + nombreTecnico, exact: true }).click();
        await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Editar grupo ' + grupo, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const ficha = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await ficha.getByLabel('Programar intervalo común (Europe/Madrid)', { exact: true }).check();
        await ficha.getByLabel('Fecha de inicio', { exact: true }).fill('2026-10-15');
        await ficha.getByLabel('Hora de inicio en Madrid', { exact: true }).fill('09:00');
        await ficha.getByLabel('Fecha de fin', { exact: true }).fill('2026-10-15');
        await ficha.getByLabel('Hora de fin en Madrid', { exact: true }).fill('11:00');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await ficha.getByLabel(new RegExp('Grupo ' + grupo + ' · versión')).check();
        await ficha.getByRole('button', { name: 'Guardar asignación revisada', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Asignación guardada.' })).toBeVisible();
        await page.screenshot({ path: resolve(salida, 'escritorio-plan-asignado.png'), fullPage: true });
        await ficha.getByLabel('Editar tarea: estado', { exact: true }).selectOption('hecha');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await ficha.getByRole('button', { name: 'Consultar historial', exact: true }).click();
        await expect(ficha.getByText('crear manual ·', { exact: false })).toBeVisible();
        await ficha.getByLabel('Motivo de restauración', { exact: true }).fill('Restaurar campos sin reservas antiguas');
        await ficha.getByRole('button', { name: 'Restaurar campos de este evento', exact: true }).last().click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Versión restaurada como borrador' })).toBeVisible();
        await page.reload();
        await page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const nuevaFicha = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await expect(nuevaFicha.getByLabel('Editar tarea: estado', { exact: true })).toHaveValue('borrador');
        await expect(nuevaFicha.getByLabel('Programar intervalo común (Europe/Madrid)', { exact: true })).not.toBeChecked();
        await page.goto('/proyectos/agenda');
        await expect(page.getByRole('heading', { name: 'Agenda de montaje', exact: true })).toBeVisible();
        await page.getByRole('link', { name: /Sin fecha \(/ }).click();
        await expect(page.getByRole('link', { name: manual + ' · Obra UI REA04 ' + base, exact: true })).toBeVisible();
        await page.screenshot({ path: resolve(salida, 'escritorio-agenda.png'), fullPage: true });
        expect(errores).toEqual([]);
    });
    test('escritorio: rechazo de permisos/origen y borrados referenciados conservados con feedback', async ({ context, page }) => {
        await entrar(context, 2);
        expect((await context.request.post(`/api/plan/proyectos/${obra}/tareas`, { data: {}, headers: { origin: 'http://localhost:3114' } })).status()).toBe(400);
        await sql `insert into usuario_permisos(usuario_id,seccion,acceso)values(${idPlan(2)},'catalogo','oculto')on conflict(usuario_id,seccion)do update set acceso='oculto'`;
        expect((await context.request.get('/api/catalogo?q=REA04')).status()).toBe(403);
        await sql `delete from usuario_permisos where usuario_id=${idPlan(2)} and seccion='catalogo'`;
        await entrar(context, 4);
        expect((await context.request.get('/api/catalogo?q=REA04')).status()).toBe(403);
        await entrar(context);
        expect((await context.request.post(`/api/plan/proyectos/${obra}`, { data: { clavePeticion: crypto.randomUUID() }, headers: { origin: 'https://ajeno.invalid' } })).status()).toBe(403);
        const antes = await fotografiarRevisiones(sql);
        await writeFile(resolve(salida, 'e2e-borrados-antes.json'), JSON.stringify(antes, null, 2));
        await page.goto(`/proyectos/${obra}`);
        await page.getByRole('link', { name: 'Borrar proyecto', exact: true }).click();
        await page.getByRole('button', { name: 'Borrar definitivamente', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: /historial|vinculad|referenci/ })).toBeVisible();
        expect((await sql `select id from proyectos where id=${obra}`).length).toBe(1);
        const [referida] = await sql `select t.sala_id from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${obra} and t.sala_id is not null limit 1`;
        await page.goto(`/salas/${referida.sala_id}`);
        await page.getByRole('link', { name: 'Borrar sala', exact: true }).click();
        await page.getByRole('button', { name: 'Borrar definitivamente', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: /historial|vinculad|referenci/ })).toBeVisible();
        const despues = await fotografiarRevisiones(sql);
        expect(despues.tablas).toEqual(antes.tablas);
        await writeFile(resolve(salida, 'e2e-borrados-despues.json'), JSON.stringify(despues, null, 2));
    });
    test('escritorio: conflicto real, CAS, red, lectura y RSC tardíos, ACL retirada y fechas vacías', async ({ page, context }) => {
        await entrar(context);
        const otraObra = ident(90);
        await sql `insert into proyectos(id,nombre,codigo)values(${otraObra},${'Conflicto UI ' + base},${'REA04-CF-' + base})`;
        const headers = { origin: 'http://localhost:3114' };
        expect((await context.request.post(`/api/plan/proyectos/${otraObra}`, { headers, data: { clavePeticion: crypto.randomUUID() } })).status()).toBe(201);
        const actual = await (await context.request.get(`/api/plan/proyectos/${otraObra}`)).json();
        const r = await context.request.post(`/api/plan/proyectos/${otraObra}/tareas`, { headers, data: { titulo: 'Solapamiento UI ' + base, descripcion: '', notas: '', duracionEstimadaMin: null, estado: 'pendiente', venceFecha: null, intervalo: { inicio: { fecha: '2026-11-16', hora: '09:00' }, fin: { fecha: '2026-11-16', hora: '11:00' } }, salaId: null, trabajoId: null, versionPlan: actual.plan.version, clavePeticion: crypto.randomUUID() } });
        expect(r.status()).toBe(201);
        const creada = await r.json();
        const t = await (await context.request.get(`/api/plan/tareas/${creada.id}`)).json();
        expect((await context.request.put(`/api/plan/tareas/${t.id}/asignaciones`, { headers, data: { versionPlan: t.versionPlan, versionTarea: t.version, clavePeticion: crypto.randomUUID(), tecnicos: [tecnico], grupos: [] } })).status()).toBe(200);
        await page.goto(`/proyectos/${obra}/plan`);
        await page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const ficha = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await ficha.getByLabel('Editar tarea: estado', { exact: true }).selectOption('pendiente');
        await ficha.getByLabel('Programar intervalo común (Europe/Madrid)', { exact: true }).check();
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        expect(await ficha.getByLabel('Fecha de inicio', { exact: true }).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
        await ficha.getByLabel('Fecha de inicio', { exact: true }).fill('2026-11-16');
        await ficha.getByLabel('Hora de inicio en Madrid', { exact: true }).fill('09:00');
        await ficha.getByLabel('Fecha de fin', { exact: true }).fill('2026-11-16');
        await ficha.getByLabel('Hora de fin en Madrid', { exact: true }).fill('11:00');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await ficha.getByLabel('Buscar técnico', { exact: true }).fill(nombreTecnico);
        await ficha.getByRole('button', { name: 'Buscar técnicos', exact: true }).click();
        await ficha.getByRole('button', { name: 'Añadir ' + nombreTecnico, exact: true }).click();
        await ficha.getByRole('button', { name: 'Guardar asignación revisada', exact: true }).click();
        await expect(ficha.getByRole('heading', { name: 'Conflictos actuales', exact: true })).toBeVisible();
        await expect(ficha.getByText('Solapamiento UI ' + base, { exact: false })).toBeVisible();
        await ficha.getByLabel('Nota de aceptación', { exact: true }).fill('Coordinado presencialmente para este solapamiento');
        await ficha.getByRole('button', { name: 'Confirmar con estos conflictos', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Asignación guardada.' })).toBeVisible();
        await page.screenshot({ path: resolve(salida, 'escritorio-conflicto-aceptado.png'), fullPage: true });
        const segunda = await context.newPage();
        await segunda.goto(`/proyectos/${obra}/plan`);
        await segunda.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const otraFicha = segunda.locator('section').filter({ has: segunda.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await ficha.getByLabel('Editar tarea: notas', { exact: true }).fill('Versión guardada por pestaña primera');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await otraFicha.getByLabel('Editar tarea: notas', { exact: true }).fill('Borrador de segunda pestaña');
        await otraFicha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(otraFicha.getByRole('alert')).toContainText('cambió');
        await expect(otraFicha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Borrador de segunda pestaña');
        await otraFicha.getByRole('button', { name: 'Recargar tarea y comparar', exact: true }).click();
        await expect(otraFicha.getByText(/Guardado:.*Versión guardada por pestaña primera/)).toBeVisible();
        await expect(otraFicha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Borrador de segunda pestaña');
        await otraFicha.getByRole('button', { name: 'Adoptar campos guardados', exact: true }).click();
        await expect(otraFicha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Versión guardada por pestaña primera');
        await segunda.close();
        const tareaId = (await sql `select t.id from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${obra} and t.titulo=${manual}`)[0].id;
        await page.route(`**/api/plan/tareas/${tareaId}`, async (route) => {
            if (route.request().method() === 'PATCH')
                await route.abort('failed');
            else
                await route.continue();
        });
        await ficha.getByLabel('Editar tarea: notas', { exact: true }).fill('Borrador conservado tras red');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('alert')).toContainText('Error de red');
        await expect(ficha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Borrador conservado tras red');
        await page.unroute(`**/api/plan/tareas/${tareaId}`);
        let liberarLectura!: () => void;
        const retenida = new Promise<void>(r => liberarLectura = r);
        let leida!: () => void;
        const yaLeida = new Promise<void>(r => leida = r);
        await page.route(`**/api/plan/proyectos/${obra}`, async (route) => {
            if (route.request().method() === 'GET') {
                const respuesta = await route.fetch();
                leida();
                await retenida;
                await route.fulfill({ response: respuesta });
            }
            else
                await route.continue();
        });
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await yaLeida;
        await expect(ficha.getByLabel('Editar tarea: notas', { exact: true })).toBeDisabled();
        liberarLectura();
        await expect(ficha.getByLabel('Editar tarea: notas', { exact: true })).toBeEnabled();
        await page.unroute(`**/api/plan/proyectos/${obra}`);
        let liberarRsc!: () => void;
        const retenidaRsc = new Promise<void>(r => liberarRsc = r);
        let recibida!: () => void;
        const rscLeida = new Promise<void>(r => recibida = r);
        await page.route(`**/proyectos/${obra}/plan?**`, async (route) => {
            if (route.request().headers().rsc === '1') {
                const respuesta = await route.fetch();
                recibida();
                await retenidaRsc;
                await route.fulfill({ response: respuesta });
            }
            else
                await route.continue();
        });
        await page.getByRole('button', { name: 'Actualizar lista del plan', exact: true }).click();
        await rscLeida;
        await expect(page.getByRole('status').filter({ hasText: 'Lista actualizada.' })).toBeVisible();
        await ficha.getByLabel('Editar tarea: notas', { exact: true }).fill('Edición posterior sobrevive RSC');
        liberarRsc();
        await page.waitForLoadState('networkidle');
        await expect(ficha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Edición posterior sobrevive RSC');
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await page.unroute(`**/proyectos/${obra}/plan?**`);
        await entrar(context, 3);
        await page.reload();
        await page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const permisoFicha = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await permisoFicha.getByLabel('Editar tarea: notas', { exact: true }).fill('Borrador conservado tras permiso retirado');
        await sql `insert into usuario_permisos(usuario_id,seccion,acceso)values(${idPlan(3)},'proyectos','ver')on conflict(usuario_id,seccion)do update set acceso='ver'`;
        try {
            await permisoFicha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
            await expect(permisoFicha.getByRole('alert')).toContainText('permiso');
            await expect(permisoFicha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Borrador conservado tras permiso retirado');
            await page.getByRole('button', { name: 'Actualizar lista del plan', exact: true }).click();
            await expect(permisoFicha.getByRole('button', { name: 'Guardar tarea', exact: true })).toBeDisabled();
            await expect(permisoFicha.getByLabel('Editar tarea: notas', { exact: true })).toHaveValue('Borrador conservado tras permiso retirado');
        }
        finally {
            await sql `delete from usuario_permisos where usuario_id=${idPlan(3)} and seccion='proyectos'`;
        }
        expect((await sql `select inicio_utc from plan_tareas where id=${tareaId}`)[0].inicio_utc.getUTCFullYear()).toBe(2026);
    });
    test('escritorio: página 51 accesible, filtro completo y ficha conserva edición al cambiar lista', async ({ page, context }) => {
        await entrar(context);
        const headers = { origin: 'http://localhost:3114' };
        let version = (await (await context.request.get(`/api/plan/proyectos/${obra}`)).json()).plan.version;
        for (let i = 1; i <= 51; i++) {
            const r = await context.request.post(`/api/plan/proyectos/${obra}/tareas`, { headers, data: { titulo: `Página UI ${base} número ${i}`, descripcion: '', notas: '', duracionEstimadaMin: null, estado: 'borrador', venceFecha: null, intervalo: null, salaId: null, trabajoId: null, versionPlan: version, clavePeticion: crypto.randomUUID() } });
            expect(r.status()).toBe(201);
            version = (await r.json()).versionPlan;
        }
        await page.goto(`/proyectos/${obra}/plan`);
        await expect(page.getByRole('button', { name: `Abrir tarea Página UI ${base} número 51`, exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Tareas siguientes', exact: true }).click();
        await page.getByRole('button', { name: `Abrir tarea Página UI ${base} número 51`, exact: true }).click();
        const notas = page.getByLabel('Editar tarea: notas', { exact: true });
        await notas.fill('Edición de tarea fuera de primera página');
        await page.getByLabel('Filtrar estado', { exact: true }).selectOption('hecha');
        await expect(page.getByText('No hay tareas en este alcance.', { exact: true })).toBeVisible();
        await expect(notas).toHaveValue('Edición de tarea fuera de primera página');
        await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await page.getByLabel('Filtrar estado', { exact: true }).selectOption('borrador');
        await page.getByRole('button', { name: 'Tareas siguientes', exact: true }).click();
        await expect(page.getByRole('button', { name: `Abrir tarea Página UI ${base} número 51`, exact: true })).toBeVisible();
    });
    test('escritorio: restauración y reapertura limpian recursos; técnico URL fuera de20 y búsqueda de trabajos paginada', async ({ page, context }) => {
        await entrar(context);
        const headers = { origin: 'http://localhost:3114' };
        const prefijo = 'Busca20 UI ' + base;
        for (let n = 0; n < 25; n++)
            expect((await context.request.post('/api/plan/catalogo', { headers, data: { titulo: prefijo + '-' + String(n).padStart(2, '0'), descripcion: '', duracionEstimadaMin: null, activo: true } })).status()).toBe(201);
        const primera = await (await context.request.get('/api/plan/catalogo?q=' + encodeURIComponent(prefijo))).json();
        const segunda = await (await context.request.get('/api/plan/catalogo?q=' + encodeURIComponent(prefijo) + '&pagina=2')).json();
        expect(primera.trabajos).toHaveLength(20); expect(segunda.trabajos).toHaveLength(5);
        await page.goto(`/proyectos/${obra}/plan`);
        await page.getByLabel('Buscar trabajo para copiar', { exact: true }).fill(prefijo);
        await page.getByRole('button', { name: 'Buscar trabajo para tarea', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Trabajos consultados.' })).toBeVisible();
        expect(await page.getByLabel('Copiar trabajo (opcional)', { exact: true }).locator('option').count()).toBe(21);
        await page.getByRole('button', { name: 'Trabajos siguientes para tarea', exact: true }).click();
        await expect(page.getByLabel('Copiar trabajo (opcional)', { exact: true }).locator('option').filter({ hasText: prefijo + '-24' })).toHaveCount(1);
        await page.getByLabel('Copiar trabajo (opcional)', { exact: true }).selectOption({ label: prefijo + '-24' });
        await expect(page.getByLabel('Nueva tarea: título', { exact: true })).toHaveValue(prefijo + '-24');
        await page.getByRole('button', { name: 'Trabajos anteriores para tarea', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Trabajos anteriores para tarea', exact: true })).toBeDisabled();
        await expect(page.getByLabel('Copiar trabajo (opcional)', { exact: true })).toHaveValue(segunda.trabajos[4].id);
        await page.getByRole('button', { name: 'Abrir tarea ' + manual, exact: true }).click();
        const ficha = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarea: ' + manual, exact: true }) });
        await expect(ficha.getByRole('button', { name: 'Quitar ' + nombreTecnico, exact: true })).toBeVisible();
        await ficha.getByLabel(new RegExp('Grupo ' + grupo + ' · versión')).check();
        await ficha.getByRole('button', { name: 'Consultar historial', exact: true }).click();
        await ficha.getByLabel('Motivo de restauración', { exact: true }).fill('Corrección: restauración explícita sin recursos previos');
        await ficha.getByRole('button', { name: 'Restaurar campos de este evento', exact: true }).last().click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Versión restaurada como borrador' })).toBeVisible();
        await expect(ficha.getByRole('button', { name: 'Quitar ' + nombreTecnico, exact: true })).toHaveCount(0);
        await expect(ficha.getByLabel(new RegExp('Grupo ' + grupo + ' · versión'))).not.toBeChecked();
        await ficha.getByRole('button', { name: 'Guardar asignación revisada', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Asignación guardada.' })).toBeVisible();
        const tareaId = (await sql `select t.id from plan_tareas t join planes p on p.id=t.plan_id where p.proyecto_id=${obra} and t.titulo=${manual}`)[0].id;
        expect((await (await context.request.get(`/api/plan/tareas/${tareaId}`)).json()).tecnicos).toHaveLength(0);
        await ficha.getByLabel(new RegExp('Grupo ' + grupo + ' · versión')).check();
        await ficha.getByRole('button', { name: 'Guardar asignación revisada', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Asignación guardada.' })).toBeVisible();
        await ficha.getByLabel('Editar tarea: estado', { exact: true }).selectOption('hecha');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await ficha.getByLabel('Editar tarea: estado', { exact: true }).selectOption('pendiente');
        await ficha.getByLabel('Motivo del cambio de tarea', { exact: true }).fill('Reapertura explícita sin recursos previos');
        await ficha.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
        await expect(ficha.getByRole('status').filter({ hasText: 'Tarea guardada.' })).toBeVisible();
        await expect(ficha.getByLabel('Editar tarea: estado', { exact: true })).toHaveValue('borrador');
        await expect(ficha.getByRole('button', { name: 'Quitar ' + nombreTecnico, exact: true })).toHaveCount(0);
        await expect(ficha.getByLabel(new RegExp('Grupo ' + grupo + ' · versión'))).not.toBeChecked();
        await page.screenshot({ path: resolve(salida, 'escritorio-restauracion-recursos-limpios.png') });
        const primeros = await (await context.request.get('/api/plan/tecnicos')).json();
        expect(primeros.tecnicos).toHaveLength(20); expect(primeros.tecnicos.some((t: { id: string }) => t.id === tecnico)).toBe(false);
        await page.goto(`/proyectos/agenda?vista=sin_fecha&tecnicoId=${tecnico}`);
        await expect(page.locator('select[name="tecnicoId"]')).toHaveValue(tecnico);
        await page.getByLabel('Buscar técnico por nombre', { exact: true }).fill('AAAAA');
        await page.getByRole('button', { name: 'Buscar en técnicos', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Técnicos consultados.' })).toBeVisible();
        await expect(page.locator('select[name="tecnicoId"]')).toHaveValue(tecnico);
        await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        await expect(page).toHaveURL(new RegExp('tecnicoId=' + tecnico));
        await expect(page.locator('select[name="tecnicoId"]')).toHaveValue(tecnico);
        await page.getByRole('link', { name: /Semana \(/ }).click();
        await expect(page).toHaveURL(new RegExp('tecnicoId=' + tecnico));
        await expect(page.getByRole('heading', { name: 'Tareas · Semana', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: /Semana \(/ })).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('select[name="tecnicoId"]')).toHaveValue(tecnico);
        await page.screenshot({ path: resolve(salida, 'escritorio-tecnico-url-conservado.png') });
    });
    test('móvil final: lista/agenda y formulario con teclado sin desbordamiento', async ({ page, context }) => {
        await entrar(context);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/proyectos/${obra}/plan`);
        await page.getByLabel('Nueva tarea: título', { exact: true }).fill('Móvil UI REA04 ' + base);
        await page.getByRole('button', { name: 'Crear tarea manual', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('status').filter({ hasText: 'Tarea manual creada.' })).toBeVisible();
        for (let n = 0; n < 10 && !await page.getByRole('button', { name: 'Abrir tarea Móvil UI REA04 ' + base, exact: true }).count(); n++) {
            await page.getByRole('button', { name: 'Tareas siguientes', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Actualizar lista del plan', exact: true })).toBeEnabled();
        }
        await expect(page.getByRole('button', { name: 'Abrir tarea Móvil UI REA04 ' + base, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
        await page.screenshot({ path: resolve(salida, 'movil-plan.png'), fullPage: true });
        await page.goto('/proyectos/agenda?vista=sin_fecha');
        await expect(page.getByRole('heading', { name: 'Agenda de montaje', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
        await page.screenshot({ path: resolve(salida, 'movil-agenda.png'), fullPage: true });
    });
});
