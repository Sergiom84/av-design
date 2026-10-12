/** Entrada reproducible. El verificador crea y elimina su base qa_compras_*.
 * --plan describe el destino sin conectar ni escribir.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argumentos = process.argv.slice(2);
if (argumentos.some((arg) => !['--plan', '--mutaciones'].includes(arg))) {
  throw new Error('Opciones admitidas: --plan, --mutaciones');
}
console.log('Destino fijo: 127.0.0.1:5433/postgres; crea qa_compras_<UUID> desechable.');
console.log('Aplica schema.sql y migración de compras; verifica y elimina solo la base QA.');
console.log('No lee .env ni usa el destino de DATABASE_URL.');
if (argumentos.includes('--plan')) process.exit(0);

const entorno = { ...process.env, NODE_ENV: 'test' };
delete entorno.COMPRAS_FIXTURE;
delete entorno.COMPRAS_MUTACION;
const hijo = spawn(process.execPath, ['--import', 'tsx', 'scripts/verificar-compras-integrales.mts',
  ...(argumentos.includes('--mutaciones') ? ['--mutaciones'] : [])], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit', shell: false,
  env: entorno,
});
hijo.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
hijo.once('close', (codigo) => { process.exitCode = codigo ?? 1; });
