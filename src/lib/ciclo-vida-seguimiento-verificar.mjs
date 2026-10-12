/** node src/lib/ciclo-vida-seguimiento-verificar.mjs
 * Copia temporal independiente; ni Git ni reversión del árbol compartido.
 */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

if (process.argv.slice(2).some((arg) => arg !== '--plan')) {
  throw new Error('Única opción admitida: --plan');
}
console.log('Destino fijo: 127.0.0.1:5433/av_design (administración); fixtures av_seguimiento_test_<UUID>.');
console.log('Copia código a un temporal, prueba base y cinco mutaciones; elimina sus fixtures y su copia.');
console.log('No lee .env ni usa el destino de DATABASE_URL; output solo recibe logs.');
if (process.argv.includes('--plan')) process.exit(0);

const raiz = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(raiz);
const temporal = mkdtempSync(join(tmpdir(), 'av-seguimiento-'));
const salida = resolve('output', `seguimiento-${Date.now()}`);
mkdirSync(salida, { recursive: true });
const fichero = 'src/lib/ciclo-vida-seguimiento-db.ts';
const fuente = readFileSync(fichero, 'utf8');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const huella = hash(readFileSync(fichero));
const mutaciones = [
  ['sin-orden-entrega', "exigirOrdenFinal(fecha(instalacion?.fecha), fecha(prueba?.fecha), dia, true);", ''],
  ['sin-completitud', "exigirSeguimiento(pruebaCompleta(puntos), 'Quedan puntos pendientes o incidencias; no se puede completar la prueba final.');", ''],
  ['sin-lock-sala', 'where id = ${orden.salaId} for update`', 'where id = ${orden.salaId}`'],
  ['sin-nota-excepcional', "exigirSeguimiento(!revision.exigeNota || nota, 'Entrega excepcional: la revisión tiene bloqueos y exige una nota.');", ''],
  ['recepcion-falsa-completa', "lineas.every(completa) ? 'total'", "alguna ? 'total'", 'src/lib/ciclo-vida-compras.ts'],
];
try {
  cpSync(resolve('src'), join(temporal, 'src'), { recursive: true });
  cpSync(resolve('db'), join(temporal, 'db'), { recursive: true });
  cpSync(resolve('tsconfig.json'), join(temporal, 'tsconfig.json'));
  symlinkSync(resolve('node_modules'), join(temporal, 'node_modules'), 'junction');
  const ejecutar = async (nombre) => {
    const fixture = `av_seguimiento_test_${randomUUID().replaceAll('-', '')}`;
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'src/lib/ciclo-vida-seguimiento-db.verificar.mts'],
      { cwd: temporal, encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_ENV: 'test', SEGUIMIENTO_FIXTURE: fixture } });
    const crudo = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? String(r.error) : '');
    writeFileSync(join(salida, `${nombre}.log`), crudo);
    // Supervisor: si el proceso termina antes de ejecutar after(), elimina solo SU fixture.
    const supervisor = postgres('postgres://av_design:av_design_local@127.0.0.1:5433/av_design', { max: 1, onnotice: () => {} });
    try { await supervisor.unsafe(`drop database if exists "${fixture}" with (force)`); }
    finally { await supervisor.end(); }
    const fallos = Number(crudo.match(/# fail (\d+)/)?.[1] ?? crudo.match(/ℹ fail (\d+)/)?.[1] ?? NaN);
    const pruebas = Number(crudo.match(/# tests (\d+)/)?.[1] ?? crudo.match(/ℹ tests (\d+)/)?.[1] ?? NaN);
    console.log(`${nombre}: exit=${r.status}, tests=${pruebas}, fail=${fallos}`);
    assert.ok(crudo.includes('FIXTURE ELIMINADO'), `Fixture sin cierre: ${join(salida, `${nombre}.log`)}`);
    return { estado: r.status, fallos, pruebas };
  };
  const base = await ejecutar('base');
  assert.equal(base.estado, 0, `Revisar ${salida}/base.log`);
  assert.ok(base.pruebas >= 12);
  for (const [nombre, patron, reemplazo, objetivo = fichero] of mutaciones) {
    const original = readFileSync(resolve(objetivo), 'utf8');
    assert.equal(original.split(patron).length - 1, 1, `Patrón causal único: ${nombre}`);
    writeFileSync(join(temporal, fichero), fuente);
    writeFileSync(join(temporal, objetivo), original.replace(patron, reemplazo));
    const r = await ejecutar(nombre);
    assert.notEqual(r.estado, 0, `Mutación sobreviviente: ${nombre}`);
    assert.ok(r.fallos > 0 && r.pruebas === base.pruebas, `Debe fallar una prueba, no la carga: ${nombre}`);
  }
} finally {
  assert.equal(hash(readFileSync(resolve(raiz, fichero))), huella, 'El fichero compartido cambió durante las pruebas');
  const destino = resolve(temporal);
  assert.ok(destino.startsWith(resolve(tmpdir()) + sep) && destino.includes('av-seguimiento-'));
  // Quitar primero la unión: jamás recorrer node_modules del repositorio al limpiar.
  unlinkSync(join(temporal, 'node_modules'));
  rmSync(destino, { recursive: true, force: true });
  console.log(`Evidencia cruda: ${salida}`);
  console.log(`SHA256 árbol compartido sin revertir: ${huella}`);
}
