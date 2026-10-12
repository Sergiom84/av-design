/** Ejecuta la misma aceptación de ficha en copia, opcionalmente sin sus arreglos. */
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const opciones = process.argv.slice(2);
assert.ok(opciones.every(x => ['--plan', '--sin-arreglo'].includes(x)));
console.log('Copia temporal propia; sin BD. --sin-arreglo debe terminar con fallos de aceptación.');
if (opciones.includes('--plan')) process.exit(0);
const raiz = fileURLToPath(new URL('../', import.meta.url));
const sombra = mkdtempSync(join(tmpdir(), 'av-ficha-mutacion-'));
let enlace = false;
try {
  cpSync(join(raiz, 'src'), join(sombra, 'src'), { recursive: true });
  cpSync(join(raiz, 'tsconfig.json'), join(sombra, 'tsconfig.json'));
  symlinkSync(join(raiz, 'node_modules'), join(sombra, 'node_modules'), 'junction');
  enlace = true;
  if (opciones.includes('--sin-arreglo')) {
    const fichero = join(sombra, 'src/lib/ficha-tecnica.ts');
    let codigo = readFileSync(fichero, 'utf8');
    const fecha = ' || Number(valor.slice(0, 4)) < 1';
    const ausencia = 'return `${dato.concepto}: sin documentar`;';
    const suministro = /case 'suministro': return[\s\S]*?(?=    case 'puerto':)/;
    assert.ok(codigo.includes(fecha) && codigo.includes(ausencia));
    assert.match(codigo, suministro);
    codigo = codigo.replace(fecha, '').replace(ausencia, "return 'Dato desconocido';")
      .replace(suministro, `case 'suministro': return [\x60\x24{dato.valor.cantidad} × \x24{dato.valor.referencia}\x60,
      dato.valor.incluido === null ? 'inclusión desconocida' : dato.valor.incluido ? 'incluido' : 'adicional',
      dato.valor.longitud_m === null ? 'longitud desconocida' : \x60\x24{dato.valor.longitud_m} m\x60].join(' · ');
`);
    writeFileSync(fichero, codigo);
    const componente = join(sombra, 'src/components/catalogo/ficha-tecnica.tsx');
    const vista = readFileSync(componente, 'utf8');
    assert.ok(vista.includes('{dato.concepto}</h3>'));
    writeFileSync(componente, vista.replace('ESTADO_DATO_TECNICO, presentarDatoTecnico',
      'ESTADO_DATO_TECNICO, TIPO_DATO_TECNICO, presentarDatoTecnico')
      .replace('{dato.concepto}</h3>', '{TIPO_DATO_TECNICO[dato.tipo]}</h3>'));
  }
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--test',
    'src/lib/ficha-tecnica.test.ts', 'src/components/catalogo/ficha-tecnica.test.tsx'],
  { cwd: sombra, encoding: 'utf8' });
  process.stdout.write(resultado.stdout ?? '');
  process.stderr.write(resultado.stderr ?? '');
  if (resultado.error) throw resultado.error;
  process.exitCode = resultado.status ?? 1;
} finally {
  if (enlace) unlinkSync(join(sombra, 'node_modules'));
  const destino = resolve(sombra);
  assert.ok(destino.startsWith(resolve(tmpdir()) + sep) && destino.includes('av-ficha-mutacion-'));
  rmSync(destino, { recursive: true, force: true });
  console.log('Copia propia retirada; árbol compartido intacto.');
}
