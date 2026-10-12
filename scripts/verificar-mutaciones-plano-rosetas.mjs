import { mkdtempSync, cpSync, symlinkSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = resolve(import.meta.dirname, '..');
const copia = mkdtempSync(join(tmpdir(), 'av-plano-rosetas-'));
cpSync(join(raiz, 'src/lib'), join(copia, 'src/lib'), { recursive: true });
symlinkSync(join(raiz, 'node_modules'), join(copia, 'node_modules'), 'junction');
const archivo = join(copia, 'src/lib/plano-editor.ts');
const original = readFileSync(archivo, 'utf8');
const destino = join(raiz, 'output/plan40-20260908-083450');
mkdirSync(destino, { recursive: true });
const variantes = [
  ['base', original, 0, '0'],
  ['altura-inventada', original.replace('z_m: t.z_m,', 'z_m: t.z_m ?? 0,'), 1, '2'],
  ['edicion-borra-ejes', original.replace(
    'if (Object.values(cambios).some((valor) => valor === null))',
    'if (combinado.x_m == null || combinado.y_m == null)'), 1, '1'],
];
for (const [nombre, contenido, esperado, fallosEsperados] of variantes) {
  if (nombre !== 'base' && contenido === original) throw new Error(`Mutación no aplicada: ${nombre}`);
  writeFileSync(archivo, contenido);
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--test',
    '--test-name-pattern=histórico parcial|tres ejes uno a uno', 'src/lib/plano-editor.test.ts'],
  { cwd: copia, encoding: 'utf8' });
  const salida = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;
  writeFileSync(join(destino, `l2b-causal-plano-${nombre}.log`), salida);
  const aprobadas = salida.match(/tests (\d+)/)?.[1];
  const fallos = salida.match(/fail (\d+)/)?.[1];
  console.log(`${nombre}: exit=${resultado.status}; pruebas=${aprobadas}; fallos=${fallos}`);
  if (resultado.status !== esperado || aprobadas !== '2' || fallos !== fallosEsperados ||
    (esperado === 1 && !salida.includes('AssertionError'))) {
    throw new Error(`Evidencia inesperada para ${nombre}: ${salida}`);
  }
}
console.log(`Copia aislada preservada para inspección: ${copia}`);
