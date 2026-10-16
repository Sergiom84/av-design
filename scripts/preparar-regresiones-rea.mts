/** Adapta destino/evidencia de gates existentes sin modificar sus fuentes históricas. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const raiz = resolve('.');
const salida = resolve('output/rea-integracion/verificacion');
const scripts = resolve(salida, 'scripts');
await mkdir(scripts, { recursive: true });
const manifiesto: Array<{ fuente: string; sha256: string; destino: string }> = [];
const fixture = resolve('scripts/rea-fixture.mts');
const adaptar = (texto: string) => texto
  .replaceAll("'./revisiones-fixture.mjs'", JSON.stringify(fixture))
  .replaceAll("'../scripts/revisiones-fixture.mjs'", JSON.stringify(fixture))
  .replaceAll("'../scripts/documentos-fixture.mjs'", JSON.stringify(resolve(salida, 'fixture-documentos.mts')))
  .replaceAll("'../src/", `'${raiz}/src/`)
  .replaceAll('output/e3-revisiones', 'output/rea-integracion')
  .replaceAll('output/e1-documentos', 'output/rea-integracion/e1-navegador')
  .replaceAll('e3-local-prueba-revisiones-secreto-2026', 'rea-local-prueba-integracion-secreto-2026')
  .replaceAll('e1-local-prueba-documentos-secreto-2026', 'rea-local-prueba-integracion-secreto-2026')
  .replaceAll('http://localhost:3105', 'http://localhost:3110')
  .replaceAll('http://localhost:3101', 'http://localhost:3110')
  .replaceAll('av_design_e3_prueba', 'av_design_rea_prueba')
  .replaceAll('av_design_e3:', 'av_design_rea:')
  .replaceAll("url.replace('5547','5432')", "url.replace('5550','5432')");

await writeFile(resolve(salida, 'fixture-documentos.mts'),
  `export {conectarRevisiones as conectarPrueba,fotografiarRevisiones as fotografiarBase,FIXTURE_REVISIONES as FIXTURE_DOCUMENTOS} from ${JSON.stringify(fixture)};\n` +
  `export type {SqlRevisionesPrueba as SqlPrueba} from ${JSON.stringify(fixture)};\n` +
  `export type {FotoBase} from ${JSON.stringify(resolve('scripts/documentos-fixture.mts'))};\n`);
const rollback = resolve(salida, 'rollback-e3-prueba.sql');
await writeFile(rollback, (await readFile('db/migraciones/rollback/2026-10-e3.sql', 'utf8'))
  .replaceAll('av_design_e3_prueba', 'av_design_rea_prueba').replaceAll("'av_design_e3'", "'av_design_rea'"));

for (const nombre of ['verificar-revisiones.mts', 'verificar-revisiones-regresiones.mts', 'verificar-revisiones-correccion.mts', 'verificar-documentos-e3.mts']) {
  const fuente = `scripts/${nombre}`;
  const original = await readFile(fuente, 'utf8');
  const contenido = adaptar(original).replaceAll("'db/migraciones/rollback/2026-10-e3.sql'", JSON.stringify(rollback));
  const destino = resolve(scripts, nombre);
  await writeFile(destino, contenido);
  manifiesto.push({ fuente, sha256: createHash('sha256').update(original).digest('hex'), destino });
}
for (const bloque of ['documentos', 'revisiones']) {
  let fuente = adaptar(await readFile(`e2e-gate/${bloque}.spec.mts`, 'utf8'));
  if (bloque === 'documentos') fuente = fuente
    .replace("expect(await page.getByRole('group', { name: 'Salas de la obra' }).getByRole('checkbox').count()).toBe(3);", "const grupoObra = page.getByRole('group', { name: 'Salas de la obra' });\n    expect(await grupoObra.getByRole('checkbox').count()).toBeGreaterThanOrEqual(3);\n    for (const casilla of await grupoObra.getByRole('checkbox').all()) await casilla.uncheck();\n    await grupoObra.getByRole('checkbox', {name:/PRUEBA-DOC-01/}).check();\n    await grupoObra.getByRole('checkbox', {name:/PRUEBA-DOC-02/}).check();")
    .replace('expect(mic.getCell(6).value).toBe(2);', 'expect(mic.getCell(6).value).toBe(4);');
  await writeFile(resolve(salida, `${bloque}.spec.mts`), fuente);
  const carpetaNavegador = resolve(bloque === 'documentos' ? 'output/rea-integracion/e1-navegador' : 'output/rea-integracion/navegador');
  const configuracion = `import {defineConfig,devices} from '@playwright/test';\n` +
    `export default defineConfig({testDir:${JSON.stringify(salida)},testMatch:${JSON.stringify(`${bloque}.spec.mts`)},fullyParallel:false,workers:1,retries:0,timeout:${bloque === 'documentos' ? 90000 : 120000},expect:{timeout:25000},forbidOnly:true,` +
    `reporter:[['list'],['json',{outputFile:${JSON.stringify(resolve(carpetaNavegador, 'resultados.json'))}}],['html',{outputFolder:${JSON.stringify(resolve(carpetaNavegador, 'reporte'))},open:'never'}]],outputDir:${JSON.stringify(resolve(carpetaNavegador, 'trazas'))},` +
    `use:{...devices['Desktop Chrome'],channel:'chrome',baseURL:'http://localhost:3110',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:15000}});\n`;
  await writeFile(resolve(salida, `${bloque}.config.ts`), configuracion);
}

// Mantiene íntegros los gates E2; sólo adapta identidad del contenedor nuevo y salidas.
const e2Original = await readFile('scripts/reusar-regresiones-e2-e3.mts', 'utf8');
const e2 = e2Original
  .replaceAll('output/e3-revisiones', 'output/rea-integracion')
  .replaceAll('av_design_e3_regresiones', 'av_design_rea_regresiones')
  .replaceAll('5548', '5551');
await writeFile(resolve(scripts, 'reusar-regresiones-e2.mts'), e2);
manifiesto.push({ fuente: 'scripts/reusar-regresiones-e2-e3.mts', sha256: createHash('sha256').update(e2Original).digest('hex'), destino: resolve(scripts, 'reusar-regresiones-e2.mts') });
// Los ficheros fuente son las fixtures sintéticas históricas, nunca inventario real.
const fuentesE2 = resolve('output/e2-importacion/gates/fuentes');
const destinoFuentesE2 = resolve('output/rea-integracion/regresiones-e2/fuentes');
await mkdir(destinoFuentesE2, { recursive: true });
for (const nombre of await readdir(fuentesE2)) {
  if (!/\.(csv|xlsx)$/.test(nombre)) continue;
  const fuente = resolve(fuentesE2, nombre);
  const bytes = await readFile(fuente);
  const destino = resolve(destinoFuentesE2, nombre);
  const existente = await readFile(destino).catch(() => null);
  if (existente && !existente.equals(bytes)) throw new Error(`Fuente sintética ya existente difiere: ${nombre}. No se sobrescribe.`);
  if (!existente) await writeFile(destino, bytes);
  manifiesto.push({ fuente, sha256: createHash('sha256').update(bytes).digest('hex'), destino });
}
await writeFile(resolve(salida, 'adaptacion.json'), JSON.stringify({
  fecha: '2026-10-15', raiz, destino: '127.0.0.1:5550/av_design_rea_prueba',
  regresiones: '127.0.0.1:5551/av_design_rea_regresiones',
  motivos: ['Dos contenedores Postgres sintéticos nuevos', 'Evidencia REA exclusiva', 'Mismos criterios E3', 'E1 selecciona dos salas y cuenta la BOM adicional de E2', 'Rollback estructural mantiene guarda de la nueva base y rol'],
  fuentes: manifiesto,
}, null, 2));
console.log(`Gates adaptados en ${salida}; fuentes históricas intactas.`);
