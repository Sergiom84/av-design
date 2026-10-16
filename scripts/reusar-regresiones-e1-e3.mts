/** E1 escritorio/recarga parcial/propiedad/móvil, en destino E3 y evidencia nueva. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones } from './revisiones-fixture.mjs';
const url = process.env.REVISIONES_DATABASE_URL;
if (!url) throw new Error('REVISIONES_DATABASE_URL explícita obligatoria.');
const sql = await conectarRevisiones(url);
await sql.end();
const raiz = resolve('.');
const carpeta = resolve('output/e3-revisiones/e1-navegador');
await mkdir(carpeta, { recursive: true });
const puente = `export {conectarRevisiones as conectarPrueba,fotografiarRevisiones as fotografiarBase,FIXTURE_REVISIONES as FIXTURE_DOCUMENTOS} from ${JSON.stringify(resolve('scripts/revisiones-fixture.mts'))};
export type {SqlRevisionesPrueba as SqlPrueba} from ${JSON.stringify(resolve('scripts/revisiones-fixture.mts'))};
export type {FotoBase} from ${JSON.stringify(resolve('scripts/documentos-fixture.mts'))};\n`;
await writeFile(resolve(carpeta, 'fixture.mts'), puente);
const original = await readFile(resolve('e2e-gate/documentos.spec.mts'), 'utf8');
const fuente = original.replaceAll("'../scripts/documentos-fixture.mjs'", "'./fixture.mts'")
  .replaceAll("'../src/", `'${raiz}/src/`)
  .replaceAll('output/e1-documentos', 'output/e3-revisiones/e1-navegador')
  .replaceAll('e1-local-prueba-documentos-secreto-2026', 'e3-local-prueba-revisiones-secreto-2026')
  .replaceAll('http://localhost:3101', 'http://localhost:3105')
  .replace("expect(await page.getByRole('group', { name: 'Salas de la obra' }).getByRole('checkbox').count()).toBe(3);", "const grupoObra = page.getByRole('group', { name: 'Salas de la obra' });\n    expect(await grupoObra.getByRole('checkbox').count()).toBeGreaterThanOrEqual(3);\n    for (const casilla of await grupoObra.getByRole('checkbox').all()) await casilla.uncheck();\n    await grupoObra.getByRole('checkbox', {name:/PRUEBA-DOC-01/}).check();\n    await grupoObra.getByRole('checkbox', {name:/PRUEBA-DOC-02/}).check();")
  // La fixture E3 mantiene los 2 micros de E1 y añade 2 de BOM E2.
  .replace('expect(mic.getCell(6).value).toBe(2);', 'expect(mic.getCell(6).value).toBe(4);');
await writeFile(resolve(carpeta, 'documentos.spec.mts'), fuente);
const configuracion = (await readFile(resolve('e2e-gate/documentos.config.ts'), 'utf8'))
  .replaceAll('../output/e1-documentos', carpeta)
  .replaceAll('http://localhost:3101', 'http://localhost:3105');
await writeFile(resolve(carpeta, 'documentos.config.ts'), configuracion);
await writeFile(resolve(carpeta, 'adaptacion.json'), JSON.stringify({
  fuente: 'e2e-gate/documentos.spec.mts', destino: carpeta,
  cambios: ['Guard URL/base/usuario E3 nuevo', 'Puerto app3105/secreto sintético E3', 'Evidencia exclusiva E3', 'Cantidad mic4=2equipo+2BOM', 'Selección explícita de las dos salas E1 en obra ampliada con alternativas E3'],
  comando: `REVISIONES_DATABASE_URL=${url} DOCUMENTOS_DATABASE_URL=${url} node node_modules/@playwright/test/cli.js test --config=${resolve(carpeta, 'documentos.config.ts')}`,
}, null, 2));
console.log(`Gate E1 preparado: ${carpeta}. No modifica su fuente ni evidencia histórica.`);
