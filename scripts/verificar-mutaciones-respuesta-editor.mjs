/** Reproduce la respuesta no serializable en una copia y una base propias. */
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

assert.ok(process.argv.slice(2).every(x => x === '--plan'));
console.log('Copia propia y base QA local UUID; respuesta anterior debe fallar en aceptación.');
if (process.argv.includes('--plan')) process.exit(0);
const raiz = fileURLToPath(new URL('../', import.meta.url));
const sombra = mkdtempSync(join(tmpdir(), 'av-respuesta-editor-'));
let enlace = false;
try {
  for (const carpeta of ['src', 'scripts', 'db']) cpSync(join(raiz, carpeta), join(sombra, carpeta), { recursive: true });
  cpSync(join(raiz, 'tsconfig.json'), join(sombra, 'tsconfig.json'));
  symlinkSync(join(raiz, 'node_modules'), join(sombra, 'node_modules'), 'junction');
  enlace = true;
  const ruta = join(sombra, 'src/app/acciones-diagrama.ts');
  const original = readFileSync(ruta, 'utf8');
  const respuesta = 'equipos_ids: { ...equipos_ids }, etiquetas: { ...etiquetas }';
  assert.ok(original.includes(respuesta));
  writeFileSync(ruta, original.replace(respuesta, 'equipos_ids, etiquetas'));
  const resultado = spawnSync(process.execPath, ['scripts/verificar-base-plan40.mjs', '--solo=editor-conexiones'], { cwd: sombra, encoding: 'utf8' });
  process.stdout.write(resultado.stdout ?? '');
  process.stderr.write(resultado.stderr ?? '');
  if (resultado.error) throw resultado.error;
  const salida = join(sombra, 'output');
  assert.ok(existsSync(salida));
  const carpetas = readdirSync(salida).filter(x => /^qa_plan40_base_[a-f0-9]{32}$/.test(x));
  assert.equal(carpetas.length, 1);
  process.stdout.write(readFileSync(join(salida, carpetas[0], 'editor-conexiones.log'), 'utf8'));
  process.exitCode = resultado.status ?? 1;
} finally {
  if (enlace) unlinkSync(join(sombra, 'node_modules'));
  const destino = resolve(sombra);
  assert.ok(destino.startsWith(resolve(tmpdir()) + sep) && destino.includes('av-respuesta-editor-'));
  rmSync(destino, { recursive: true, force: true });
}
