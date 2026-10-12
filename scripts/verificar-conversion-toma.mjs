import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Cada variante usa una copia propia. No modifica fuentes ni abre una BD.
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'output', `qa_conversion_toma_${randomUUID()}`);
mkdirSync(salida, { recursive: true });
const componente = 'src/components/sala/convertir-asignacion-toma.tsx';
const prueba = 'src/components/sala/convertir-asignacion-toma.test.tsx';
const variantes = [
  { nombre: 'base', quitar: null, fallos: 0 },
  { nombre: 'sin-ack', quitar: '        setConfirmada({ id: resultado.id, version: resultado.version });', fallos: 2,
    aserciones: ['ACK de enlace impide otra alta', 'el ACK bloquea alta antes de actualizar props'] },
  { nombre: 'sin-enlace', quitar: '    {existentes.map(({ conexion, extremoEquipo, boca, puerto }) =>',
    reemplazo: '    {existentes.slice(0, 0).map(({ conexion, extremoEquipo, boca, puerto }) =>', fallos: 1,
    aserciones: ['las bocas ocupadas del mismo cable deben poder enlazarse explícitamente'] },
];
const resultados = [];
for (const variante of variantes) {
  const copia = join(salida, variante.nombre);
  mkdirSync(copia);
  cpSync(join(raiz, 'src'), join(copia, 'src'), { recursive: true });
  for (const fichero of ['tsconfig.json', 'package.json']) cpSync(join(raiz, fichero), join(copia, fichero));
  symlinkSync(join(raiz, 'node_modules'), join(copia, 'node_modules'), 'junction');
  try {
  if (variante.quitar) {
    const ruta = join(copia, componente);
    const original = readFileSync(ruta, 'utf8');
    assert.equal(original.split(variante.quitar).length - 1, 1, 'La mutación debe afectar un único punto conocido');
    writeFileSync(ruta, original.replace(variante.quitar, variante.reemplazo ?? ''));
  }
  const inicio = Date.now();
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=tap', prueba], {
    cwd: copia, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, DATABASE_URL: '', TSX_TSCONFIG_PATH: join(copia, 'tsconfig.json') },
  });
  const log = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;
  writeFileSync(join(salida, `${variante.nombre}.log`), log);
  assert.equal(resultado.error, undefined, `Fallo de ejecución/timeout en ${variante.nombre}; no acredita causal`);
  assert.equal(resultado.signal, null);
  assert.equal(resultado.status, variante.fallos ? 1 : 0, log);
  assert.match(log, /# tests 5\b/);
  assert.match(log, new RegExp(`# fail ${variante.fallos}\\b`));
  assert.match(log, /# cancelled 0\b/);
  assert.match(log, /# skipped 0\b/);
  for (const asercion of variante.aserciones ?? []) assert.ok(log.includes(asercion), asercion);
  resultados.push({ variante: variante.nombre, fallos: variante.fallos, codigo: resultado.status, ms: Date.now() - inicio });
  } finally {
    unlinkSync(join(copia, 'node_modules'));
  }
}
writeFileSync(join(salida, 'resultados.json'), JSON.stringify(resultados, null, 2));
console.log(JSON.stringify({ salida, resultados }, null, 2));
