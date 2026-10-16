/** Navegador real exclusivo de la fixture sintética REA10. No abre conexiones SQL. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Locator } from '@playwright/test';
import { firmarSesion, COOKIE_SESION } from '../src/lib/sesion';
import { URL_REA_PRUEBA, idRequisito } from '../scripts/rea10-fixture.mjs';
import { etiquetaRevision } from '../src/components/requisitos/tipos';

assert.equal(process.env.REA10_DATABASE_URL, URL_REA_PRUEBA, 'El navegador sólo admite la base sintética5563 explícita.');
const base = 'http://localhost:3122';
const carpetaFixture = resolve(process.env.REA10_FIXTURE ?? 'output/rea-integracion/rea10/runtime-20261016/postgres-05');
const fixture = JSON.parse(await readFile(resolve(carpetaFixture, 'fixture.json'), 'utf8')) as { obraId: string; localizacionId: string; articuloId: string; varianteId: string; codigo: string };
const pdf = await readFile(resolve(carpetaFixture, 'fuente-textual.pdf'));
const salida = resolve(process.env.REA10_SALIDA ?? `output/rea-integracion/rea10/runtime-20261016/navegador-${Date.now()}`, 'navegador');
await mkdir(salida, { recursive: true });
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await contexto.addCookies([{ name: COOKIE_SESION, value: await firmarSesion('rea10-local-sintetico-secreto-requisitos-2026', Date.now() + 3600_000, idRequisito(1)), url: base, httpOnly: true, sameSite: 'Lax' }]);
const pagina = await contexto.newPage();
pagina.setDefaultTimeout(30_000);
const errores: string[] = [], externas: string[] = [], pasos: string[] = [], documentosCreados: string[] = [];
pagina.on('pageerror', e => errores.push(e.message));
pagina.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externas.push(r.url()); });
const paso = (s: string) => { pasos.push(s); console.log('OK', s); };
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ruta = `${base}/proyectos/${fixture.obraId}/requisitos`;
const esperarRespuesta = (sufijo: string, metodo = 'POST') => pagina.waitForResponse(r => r.url() === base + sufijo && r.request().method() === metodo);
async function revisarCampos(en: Locator, nombres: string[]) { for (const nombre of nombres) await en.getByRole('checkbox', { name: etiquetaRevision(nombre), exact: true }).check(); }
async function abrirFuente(id: string) {
  await pagina.locator('li').filter({ hasText: id }).getByRole('button').click();
  await expect(pagina.getByRole('button', { name: 'Descargar original', exact: true })).toBeVisible();
}
async function registrar(nombre: string, bytes: Buffer, mimeType: string) {
  const tarjeta = pagina.locator('section').filter({ has: pagina.getByRole('heading', { name: 'Registrar fuente', exact: true }) });
  await tarjeta.getByLabel('Archivo PDF o TXT').setInputFiles({ name: nombre, mimeType, buffer: bytes });
  await tarjeta.getByLabel('Procedencia declarada').fill('Fuente sintética del gate de navegador REA10');
  const respuesta = esperarRespuesta('/api/requisitos'); await tarjeta.getByRole('button', { name: 'Registrar fuente', exact: true }).click();
  const r = await respuesta, datos = await r.json(); assert.equal(r.status(), 200, JSON.stringify(datos)); documentosCreados.push(datos.id);
  await expect(pagina.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
  return datos as { id: string; sha256: string; version: number };
}
try {
  await pagina.goto(`${base}/proyectos/${fixture.obraId}`);
  await pagina.getByRole('link', { name: 'Documentación y requisitos', exact: true }).click();
  await expect(pagina).toHaveURL(ruta); await expect(pagina.getByRole('heading', { name: 'Documentos y requisitos', exact: true })).toBeVisible();
  const nombre = `fuente-textual-ui-${Date.now()}.pdf`;
  const documento = await registrar(nombre, pdf, 'application/pdf'); assert.equal(documento.sha256, sha(pdf));
  const descarga = pagina.waitForEvent('download'); await pagina.getByRole('button', { name: 'Descargar original', exact: true }).click();
  const archivo = await descarga; await archivo.saveAs(resolve(salida, 'original-descargado.pdf')); assert.equal(sha(await readFile(resolve(salida, 'original-descargado.pdf'))), sha(pdf));
  await pagina.screenshot({ path: resolve(salida, '01-escritorio-fuente.png'), fullPage: true }); paso('Escritorio: registroPDF y descarga original con SHA-256 idéntico');

  const extraer = esperarRespuesta(`/api/requisitos/${documento.id}/extracciones`); await pagina.getByRole('button', { name: 'Extraer texto local', exact: true }).click();
  const respuestaExtraccion = await extraer; assert.equal(respuestaExtraccion.status(), 200, await respuestaExtraccion.text());
  await expect(pagina.getByRole('button', { name: 'Crear plan con selección vacía', exact: true })).toBeEnabled();
  const detalle = await (await contexto.request.get(`${base}/api/requisitos/${documento.id}`)).json();
  const extraccion = detalle.extracciones.at(-1), alfa = extraccion.resultado.candidatos.find((c: { original: { sala?: string } }) => c.original.sala === 'Alfa');
  assert.ok(alfa); assert.equal(extraccion.parser, 'pdfjs-dist'); assert.equal(extraccion.resultado.candidatos.filter((c: { clase: string }) => c.clase === 'hipotesis').length, 1);
  const crear = esperarRespuesta('/api/requisitos/planes'); await pagina.getByRole('button', { name: 'Crear plan con selección vacía', exact: true }).click(); const creado = await crear, plan = await creado.json(); assert.equal(creado.status(), 200);
  await expect(pagina.getByText(/0 candidatos elegidos/)).toBeVisible(); await expect(pagina.getByRole('button', { name: 'Guardar revisión y preparar preview', exact: true })).toBeDisabled(); paso('Parser real: literales/hipótesis/anclas; plan inicialmente sin selección');

  const candidatoAlfa = pagina.locator('section').filter({ has: pagina.locator('blockquote').filter({ hasText: 'Sala: Alfa' }) }).last();
  await candidatoAlfa.getByRole('button', { name: 'Revisar como área', exact: true }).click();
  const nombreSala = `Alfa UI ${Date.now()}`;
  await candidatoAlfa.getByLabel('Nombre de sala', { exact: true }).fill(nombreSala); await candidatoAlfa.getByLabel(/^Localización/).selectOption(fixture.localizacionId);
  await candidatoAlfa.getByLabel('Motivo de la decisión', { exact: true }).fill('Alta de sala revisada en escritorio, sin medidas inventadas.');
  await revisarCampos(candidatoAlfa, ['accion', 'nombre', 'codigo', 'localizacion', 'medidas', 'aceptarHomonimo']);
  await candidatoAlfa.getByRole('button', { name: 'Incluir área revisada', exact: true }).click();
  const candidatoModelo = pagina.locator('section').filter({ has: pagina.locator('blockquote').filter({ hasText: 'Modelo: QB65R' }) }).last();
  await candidatoModelo.getByRole('button', { name: 'Revisar como material', exact: true }).click();
  await candidatoModelo.getByLabel(/^Sala de destino/).selectOption(`area:${alfa.id}`);
  await candidatoModelo.getByRole('combobox', { name: 'Referencia exacta del catálogo', exact: true }).fill(`${fixture.codigo} QB65R`);
  await pagina.getByRole('option').filter({ has: pagina.getByText(`${fixture.codigo} QB65R`, { exact: true }) }).click();
  await candidatoModelo.getByRole('button', { name: 'Comprobar referencia', exact: true }).click();
  await expect(candidatoModelo.getByLabel('Revisión actual del artículo', { exact: true })).not.toHaveValue('');
  await candidatoModelo.getByLabel('Cantidad adicional', { exact: true }).fill('3'); await candidatoModelo.getByLabel(/^Unidad/).selectOption('ud');
  await candidatoModelo.getByRole('checkbox', { name: 'He revisado el material que ya aporta el diseño. Esta necesidad es adicional.', exact: true }).check();
  await candidatoModelo.getByLabel('Motivo de la decisión', { exact: true }).fill('Tres QB65R adicionales, sin sustituir por la variante QB65R-B.');
  await revisarCampos(candidatoModelo, ['sala', 'articuloId', 'cantidad', 'unidad', 'disenoRevisado']);
  await candidatoModelo.getByRole('button', { name: 'Incluir material revisado', exact: true }).click(); await expect(pagina.getByText(/2 candidatos elegidos/)).toBeVisible();
  paso('Decisiones explícitas: sóloAlfa, localizaciónID, modeloQB65R exacto y BOMadicional3ud');

  for (const status of [409, 503]) {
    await pagina.route(`**/api/requisitos/planes/${plan.id}`, route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: `Fallo sintético ${status}: se conserva el borrador`, codigo: 'PRUEBA' }) }), { times: 1 });
    await pagina.getByRole('button', { name: 'Guardar revisión y preparar preview', exact: true }).click(); await expect(pagina.getByText(`Fallo sintético ${status}: se conserva el borrador`, { exact: true })).toBeVisible();
    await expect(pagina.getByText(/2 candidatos elegidos/)).toBeVisible();
  }
  await candidatoAlfa.getByRole('button', { name: 'Revisar como área', exact: true }).click(); await expect(candidatoAlfa.getByLabel('Nombre de sala', { exact: true })).toHaveValue(nombreSala); await candidatoAlfa.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  const vista = esperarRespuesta(`/api/requisitos/planes/${plan.id}/preview`); await pagina.getByRole('button', { name: 'Guardar revisión y preparar preview', exact: true }).click(); const respuestaVista = await vista, preview = await respuestaVista.json(); assert.equal(respuestaVista.status(), 200, JSON.stringify(preview));
  const filas = preview.diff.e2[0].preview.filas; assert.equal(filas[0].datos.cantidad, '3'); assert.ok(filas[0].candidatos.some((a: { id: string }) => a.id === fixture.articuloId)); assert.ok(!filas[0].candidatos.some((a: { id: string }) => a.id === fixture.varianteId));
  await expect(pagina.getByRole('button', { name: 'Confirmar aplicación de este plan', exact: true })).toBeDisabled();
  await pagina.getByRole('checkbox', { name: 'He revisado altas, vínculos, omisiones y material adicional', exact: true }).check();
  await pagina.screenshot({ path: resolve(salida, '02-escritorio-preview-revisado.png'), fullPage: true });
  const confirmar = esperarRespuesta(`/api/requisitos/planes/${plan.id}/confirmar`); await pagina.getByRole('button', { name: 'Confirmar aplicación de este plan', exact: true }).click(); const respuestaConfirmar = await confirmar, aplicacion = await respuestaConfirmar.json(); assert.equal(respuestaConfirmar.status(), 200, JSON.stringify(aplicacion));
  await expect(pagina.getByRole('heading', { name: 'Aplicaciones registradas', exact: true })).toBeVisible();
  await expect(pagina.getByText('0 de 20 fragmentos elegidos', { exact: true })).toBeVisible();
  await expect(pagina.getByRole('link', { name: 'Consultar fragmentos elegidos', exact: true })).toHaveCount(0);
  await pagina.locator(`input[data-candidato-consulta="${alfa.id}"]`).check();
  const enlaceConsulta = await pagina.getByRole('link', { name: 'Consultar fragmentos elegidos', exact: true }).getAttribute('href');
  const destinoConsulta = new URL(enlaceConsulta!, base); assert.equal(destinoConsulta.searchParams.get('candidatos'), alfa.id); assert.equal(destinoConsulta.searchParams.has('salaIds'), false);
  const consulta = await contexto.newPage(), enviosAutomaticos: string[] = [];
  consulta.on('pageerror', e => errores.push(e.message)); consulta.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/consultas')) enviosAutomaticos.push(r.url()); });
  await consulta.goto(destinoConsulta.href); await expect(consulta.getByRole('heading', { name: 'Elegir ámbito', exact: true })).toBeVisible();
  await expect(consulta.getByText('0 de 20 salas seleccionadas', { exact: true })).toBeVisible(); await expect(consulta.getByRole('button', { name: 'Empezar consulta', exact: true })).toBeDisabled();
  assert.equal(enviosAutomaticos.length, 0); await consulta.screenshot({ path: resolve(salida, '02b-escritorio-consulta09-seleccion-explicita.png'), fullPage: true });
  paso('Puente09:fragmento revisado elegido por persona, enlace exacto y ninguna sala/consulta/pregunta enviada automáticamente');
  await consulta.getByRole('checkbox', { name: new RegExp(nombreSala) }).check();
  const crearConsulta = consulta.waitForResponse(r => r.url() === base + '/api/consultas' && r.request().method() === 'POST');
  await consulta.getByRole('button', { name: 'Empezar consulta', exact: true }).click(); const respuestaCrearConsulta = await crearConsulta, conversacion = await respuestaCrearConsulta.json(); assert.equal(respuestaCrearConsulta.status(), 200, JSON.stringify(conversacion));
  await expect(consulta.getByLabel('Pregunta', { exact: true })).toBeEditable(); await consulta.getByLabel('Pregunta', { exact: true }).fill('');
  assert.equal(enviosAutomaticos.filter(u => u.endsWith('/turnos')).length, 0);
  const pregunta = '¿Qué dice este documento?'; await consulta.getByLabel('Pregunta', { exact: true }).fill(pregunta);
  const preguntar = consulta.waitForResponse(r => r.url() === `${base}/api/consultas/${conversacion.id}/turnos` && r.request().method() === 'POST');
  await consulta.getByRole('button', { name: 'Consultar', exact: true }).click(); const respuestaPregunta = await preguntar, turno = await respuestaPregunta.json(); assert.equal(respuestaPregunta.status(), 200, JSON.stringify(turno));
  assert.equal(turno.respuesta.intent, 'documentos'); assert.ok(turno.respuesta.hechos.some((h: { valor: unknown; anclaDocumento?: { pagina: number } }) => String(h.valor).trim() === 'Sala: Alfa' && h.anclaDocumento?.pagina === 1));
  assert.ok(!turno.respuesta.hechos.some((h: { valor: unknown }) => String(h.valor).includes('Sala: Beta')));
  await writeFile(resolve(salida, 'consulta09-lectura.json'), JSON.stringify({ conversacion, turno }, null, 2));
  await expect(consulta.getByRole('cell', { name: 'Sala: Alfa', exact: true })).toBeVisible();
  await consulta.screenshot({ path: resolve(salida, '02c-escritorio-consulta09-lectura-ancla.png'), fullPage: true });
  paso(`Consulta09real ${conversacion.id}:preguntaeditable,envíoexplícito, sóloAlfa conanclapágina1;turno ${turno.id}`);
  const nuevaFuente = contexto.waitForEvent('page'); await consulta.getByRole('link', { name: 'Abrir fuente', exact: true }).first().click({ modifiers: ['Meta'] });
  const fuenteCita = await nuevaFuente; await fuenteCita.waitForLoadState();
  await expect(fuenteCita).toHaveURL(`${ruta}?documento=${documento.id}`); await expect(fuenteCita.getByRole('heading', { name: nombre, exact: true })).toBeVisible();
  await expect(fuenteCita.locator('li').filter({ hasText: documento.id }).getByRole('button', { name: 'Fuente seleccionada', exact: true })).toBeVisible();
  await expect(fuenteCita.getByRole('heading', { name: 'Plan · Salas y material adicional', exact: true })).toHaveCount(0);
  await fuenteCita.screenshot({ path: resolve(salida, '02d-escritorio-cita09-fuente-exacta.png'), fullPage: true }); await fuenteCita.close();
  paso('Cita09abierta porclickreal:query documento autoriza y abre fuenteexacta sinseleccionarplan');
  await pagina.reload(); await abrirFuente(documento.id);
  const recargado = await (await contexto.request.get(`${base}/api/requisitos/${documento.id}`)).json(); assert.ok(recargado.aplicaciones.some((a: { id: string }) => a.id === aplicacion.id)); assert.equal(recargado.planes.find((p: { id: string }) => p.id === plan.id).estado, 'aplicado');
  for (const loteId of aplicacion.resultado.lotes) assert.equal((await contexto.request.get(`${base}/api/importacion/lotes/${loteId}`)).status(), 200);
  paso('409/503 conservanborrador; preview sinconfirmación implícita; aplicar y recargar conserva IDs/lotes');

  const aplicacionUI = pagina.locator('section').filter({ has: pagina.getByText(`Aplicación ${aplicacion.id} · plan ${plan.id}`, { exact: true }) }).last();
  await aplicacionUI.getByText('Revisar reversión de esta aplicación', { exact: true }).click();
  await aplicacionUI.getByLabel('Motivo de la reversión', { exact: true }).fill('Cierre del gate sintético de navegador, conservar evidencia.');
  const revertir = esperarRespuesta(`/api/requisitos/aplicaciones/${aplicacion.id}/revertir`); await aplicacionUI.getByRole('button', { name: 'Revertir aplicación', exact: true }).click(); const respuestaRevertir = await revertir, reversion = await respuestaRevertir.json(); assert.equal(respuestaRevertir.status(), 200, JSON.stringify(reversion)); await expect(pagina.getByText('Intento de reversión registrado', { exact: true })).toBeVisible();
  await pagina.screenshot({ path: resolve(salida, '03-escritorio-reversion.png'), fullPage: true });
  const retirarUI = pagina.locator('section').filter({ has: pagina.getByRole('heading', { name: 'Retirar o purgar fuente', exact: true }) });
  await retirarUI.getByLabel('Motivo', { exact: true }).fill('Retirada explícita al terminar la revisión sintética.'); await retirarUI.getByLabel('Confirmar SHA-256 completo', { exact: true }).fill(documento.sha256);
  const retirar = esperarRespuesta(`/api/requisitos/${documento.id}`, 'PATCH'); await retirarUI.getByRole('button', { name: 'Confirmar retirada o purga', exact: true }).click(); assert.equal((await retirar).status(), 200);
  await expect(pagina.getByRole('heading', { name: 'Fuente retirado', exact: true })).toBeVisible(); await expect(pagina.getByRole('heading', { name: nombre, exact: true })).toHaveCount(0);
  await retirarUI.getByLabel(/^Operación/).selectOption('purgar'); await retirarUI.getByLabel('Motivo', { exact: true }).fill('Purga explícita de bytes y borradores de la fixture.'); await retirarUI.getByLabel('Confirmar SHA-256 completo', { exact: true }).fill(documento.sha256);
  const purgar = esperarRespuesta(`/api/requisitos/${documento.id}`, 'PATCH'); await retirarUI.getByRole('button', { name: 'Confirmar retirada o purga', exact: true }).click(); assert.equal((await purgar).status(), 200);
  await expect(pagina.getByRole('heading', { name: 'Fuente purgado', exact: true })).toBeVisible(); await expect(pagina.locator('blockquote')).toHaveCount(0); assert.equal((await contexto.request.get(`${base}/api/requisitos/${documento.id}/archivo`)).status(), 409);
  paso('Reversión coninforme; retirada/purgaCAS eliminanlectura y conservan IDsdeaplicación');
  await consulta.getByRole('button', { name: 'Recargar historial', exact: true }).click();
  const historial = consulta.waitForResponse(r => r.url() === `${base}/api/consultas/${conversacion.id}/turnos/${turno.id}` && r.request().method() === 'GET');
  await consulta.getByRole('button', { name: 'Turno 1 · documentos', exact: true }).click(); const respuestaHistorial = await historial, bloqueado = await respuestaHistorial.json();
  assert.equal(respuestaHistorial.status(), 200); assert.equal(bloqueado.bloqueado, true); assert.equal('respuesta' in bloqueado, false); assert.equal('pregunta' in bloqueado, false);
  await writeFile(resolve(salida, 'consulta09-historial-bloqueado.json'), JSON.stringify(bloqueado, null, 2));
  await expect(consulta.getByText('Este turno ya no está disponible con las fuentes y permisos actuales.', { exact: true })).toBeVisible();
  await expect(consulta.getByRole('cell', { name: 'Sala: Alfa', exact: true })).toHaveCount(0); await expect(consulta.getByLabel('Pregunta', { exact: true })).toHaveValue('');
  await consulta.screenshot({ path: resolve(salida, '03b-escritorio-consulta09-historial-bloqueado.png'), fullPage: true }); await consulta.close();
  paso('Historial09realtrasretirada/purga:placeholderbloqueadosinrespuesta/fragmentos/preguntaanterior');

  await pagina.setViewportSize({ width: 390, height: 844 }); await pagina.goto(ruta);
  await registrar(`fuente-movil-${Date.now()}.txt`, Buffer.from('Sala: Gamma móvil\n'), 'text/plain');
  await pagina.getByLabel('Transcripción manual', { exact: true }).focus(); await pagina.keyboard.type('Sala: Revisión móvil sin OCR'); await pagina.keyboard.press('Tab');
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const controles = await pagina.locator('button:visible,input:visible:not([type=checkbox]):not([type=hidden]),select:visible,textarea:visible').evaluateAll(els => els.map(e => ({ etiqueta: e.getAttribute('aria-label') ?? e.textContent?.slice(0, 60), alto: e.getBoundingClientRect().height })).filter(e => e.alto < 43.5)); assert.deepEqual(controles, []);
  await pagina.screenshot({ path: resolve(salida, '04-movil-cierre-teclado.png'), fullPage: true }); paso('Móvilal final:registroTXT/teclado/tabulación,controles44pxysin desbordamiento');
  assert.deepEqual(errores, []); assert.deepEqual(externas, []);
  await writeFile(resolve(salida, 'resultado.json'), JSON.stringify({ pasos, errores, externas, documentosCreados, aplicacionId: aplicacion.id, reversionId: reversion.id, conversacionId: conversacion.id, turnoId: turno.id, navegador: navegador.version(), limites: 'No sustituye gates SQL/ACL/adversarios ni prueba de OCR. El historial09 se comprueba tras reversión de su sala y retirada/purga de fuente; el gate SQL aísla la causa de fuente. Documento TXT móvil e historial09 conservados como fixtures propias.' }, null, 2));
} catch (error) {
  await pagina.screenshot({ path: resolve(salida, 'fallo.png'), fullPage: true });
  for (const [i, tab] of contexto.pages().entries()) if (tab !== pagina && !tab.isClosed()) { await tab.screenshot({ path: resolve(salida, `fallo-tab-${i}.png`), fullPage: true }); await writeFile(resolve(salida, `fallo-tab-${i}.html`), await tab.content()); }
  await writeFile(resolve(salida, 'fallo.json'), JSON.stringify({ error: error instanceof Error ? error.message : String(error), pasos, errores, externas, documentosCreados, html: await pagina.content() }, null, 2)); throw error;
} finally { await navegador.close(); }
