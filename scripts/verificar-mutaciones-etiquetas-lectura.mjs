import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const raiz = fileURLToPath(new URL('../', import.meta.url));
assert.ok(process.argv.slice(2).every(x => ['--plan', '--sin-arreglo'].includes(x)));
if (process.argv.includes('--plan')) {
  console.log('Copia propia sin BD. Base espera salida 0; --sin-arreglo espera fallos de aceptación y salida 1.');
  process.exit(0);
}
const sombra = mkdtempSync(join(tmpdir(), 'av-etiquetas-mutacion-'));
let enlace = false;
try {
  cpSync(join(raiz, 'src'), join(sombra, 'src'), { recursive: true });
  cpSync(join(raiz, 'tsconfig.json'), join(sombra, 'tsconfig.json'));
  symlinkSync(join(raiz, 'node_modules'), join(sombra, 'node_modules'), 'junction');
  enlace = true;
  const fichero = join(sombra, 'src/lib/cable-schedule.ts');
  const codigo = readFileSync(fichero, 'utf8');
  const antes = "return new Map(conexiones.map((c) => [c.id, c.etiqueta_cable ?? 'Pendiente de guardar']));";
  assert.ok(codigo.includes(antes));
  if (process.argv.includes('--sin-arreglo')) {
    writeFileSync(fichero, codigo.replace(antes, 'return identificadoresHistoricosDeCable(conexiones);'));
  }
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'src/lib/cable-schedule.test.ts', 'src/components/diagrama/use-editor-conexiones.test.tsx'], { cwd: sombra, encoding: 'utf8' });
  process.stdout.write(resultado.stdout ?? '');
  process.stderr.write(resultado.stderr ?? '');
  if (resultado.error) throw resultado.error;
  process.exitCode = resultado.status ?? 1;
} finally {
  if (enlace) unlinkSync(join(sombra, 'node_modules'));
  const destino = resolve(sombra);
  assert.ok(destino.startsWith(resolve(tmpdir()) + sep) && destino.includes('av-etiquetas-mutacion-'));
  rmSync(destino, { recursive: true, force: true });
}
