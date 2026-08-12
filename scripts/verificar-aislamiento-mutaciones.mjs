/**
 * Prueba focal del aislamiento de `mutaciones-lote1.mjs`.
 *
 * No ejecuta mutaciones. Comprueba dos salidas del runner:
 *  1. `--solo-preflight` termina sin tocar el fichero real y borra su sombra.
 *  2. SIGTERM mientras la sombra está viva también la borra y deja intacto el
 *     checkout compartido.
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const raiz = process.cwd();
const runner = join(raiz, 'scripts', 'mutaciones-lote1.mjs');
const objetivo = join(raiz, 'scripts', 'migrar-sillas.mts');
const hash = () => createHash('sha256').update(readFileSync(runner)).digest('hex');
const hashObjetivo = () => createHash('sha256').update(readFileSync(objetivo)).digest('hex');
const MUTACION_FOCAL = 'El backfill calcula con la geometría anterior al cerrojo';

let total = 0;
let pasadas = 0;
function afirmar(condicion, mensaje) {
  total += 1;
  if (condicion) pasadas += 1;
  console.log(`${condicion ? 'OK   ' : 'FALLO'} ${mensaje}`);
}

function sombraDe(salida) {
  const nombre = salida.match(/matriz aislada en (av-design-mutaciones-lote1-[^;\r\n]+)/)?.[1];
  return nombre ? join(tmpdir(), nombre) : null;
}

async function esperarAusente(ruta, limiteMs = 5_000) {
  if (!ruta) return false;
  const fin = Date.now() + limiteMs;
  while (existsSync(ruta) && Date.now() < fin) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !existsSync(ruta);
}

function lanzar({ pausa = 0, pausaTrasMutar = 0, interrumpir = false, focal = false } = {}) {
  return new Promise((resolve, reject) => {
    const argumentos = focal
      ? [runner, `--solo-mutacion=${MUTACION_FOCAL}`]
      : [runner, '--solo-preflight'];
    const hijo = spawn(process.execPath, argumentos, {
      cwd: raiz,
      env: {
        ...process.env,
        AV_DESIGN_PRUEBA_PAUSA_AISLAMIENTO_MS: String(pausa),
        AV_DESIGN_PRUEBA_PAUSA_TRAS_MUTAR_MS: String(pausaTrasMutar),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let salida = '';
    let sombra = null;
    let señalEnviada = false;
    const temporizador = setTimeout(() => {
      hijo.kill('SIGTERM');
      reject(new Error('el runner no terminó la prueba de aislamiento a tiempo'));
    }, 30_000);

    const recoger = (trozo) => {
      salida += String(trozo);
      sombra ??= sombraDe(salida);
      const puntoInterrupcion = focal
        ? salida.includes(`mutación preparada en sombra: ${MUTACION_FOCAL}`)
        : true;
      if (interrumpir && sombra && puntoInterrupcion && !señalEnviada) {
        señalEnviada = true;
        hijo.kill('SIGTERM');
      }
    };
    hijo.stdout.on('data', recoger);
    hijo.stderr.on('data', recoger);
    hijo.on('error', (error) => {
      clearTimeout(temporizador);
      reject(error);
    });
    hijo.on('close', (codigo, señal) => {
      clearTimeout(temporizador);
      resolve({ codigo, señal, salida, sombra, señalEnviada });
    });
  });
}

const antes = hash();
const objetivoAntes = hashObjetivo();

const normal = await lanzar();
afirmar(normal.codigo === 0, 'el preflight aislado termina correctamente');
afirmar(/preflight: \d+ patrones, todos únicos y sin mutar/.test(normal.salida), 'el preflight comprueba sus patrones');
afirmar(normal.sombra !== null && (await esperarAusente(normal.sombra)), 'el preflight elimina su sombra temporal');
afirmar(hash() === antes, 'el preflight no modifica el runner del checkout real');

const interrumpida = await lanzar({ pausaTrasMutar: 20_000, interrumpir: true, focal: true });
afirmar(interrumpida.señalEnviada, 'la prueba interrumpe una mutación ya aplicada dentro de la sombra');
afirmar(interrumpida.codigo !== 0 || interrumpida.señal !== null, 'la ejecución interrumpida no se presenta como éxito');
afirmar(
  interrumpida.sombra !== null && (await esperarAusente(interrumpida.sombra)),
  'SIGTERM elimina también la sombra temporal',
);
afirmar(hash() === antes, 'la interrupción no modifica el checkout real');
afirmar(hashObjetivo() === objetivoAntes, 'el fichero que se mutó en la sombra conserva sus bytes reales');

console.log(`\n${pasadas}/${total} comprobaciones`);
if (pasadas !== total) process.exitCode = 1;
