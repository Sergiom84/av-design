import { mkdir, cp, writeFile, symlink, readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const raiz = resolve('.'), sello = Date.now(), destino = `/private/tmp/rea10-qa-${sello}`;
const tanda = resolve(process.env.REA10_SALIDA ?? `output/rea-integracion/rea10/runtime-20261016/tanda-${sello}`);
const evidencia = join(tanda, 'freeze'), fuentes = join(evidencia, 'fuentes-congeladas');
await mkdir(destino, { recursive: true });
await mkdir(fuentes, { recursive: true });
const rutas = ['src', 'public', 'scripts', 'e2e-gate', 'db', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs', 'design-system', 'AGENTS.md', 'docs/28-rea10-especificacion.md', 'output/rea-integracion/reanudacion-20261015/regresiones-e2-puente10/scripts/importacion-fixture.mts'];
const archivos: Array<{ ruta: string; sha256: string; bytes: number; propia: boolean }> = [];
const propia = (p: string) => /^(src\/(lib\/requisitos\/|components\/requisitos\/|app\/api\/requisitos\/|app\/proyectos\/\[id\]\/requisitos\/)|scripts\/(rea10|verificar-rea10-runtime)|e2e-gate\/rea10)/.test(p) || ['src/lib/catalogo-tecnico-repositorio.ts','src/components/catalogo-tecnico/ficha-tecnica.tsx','src/components/puertos/tabla-puertos.tsx','src/app/articulo/[id]/page.tsx'].includes(p);
async function visitar(ruta: string): Promise<void> {
    if ((await stat(join(raiz, ruta))).isDirectory()) {
        for (const a of await readdir(join(raiz, ruta))) await visitar(join(ruta, a));
        return;
    }
    const b = await readFile(join(raiz, ruta));
    archivos.push({ ruta, sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length, propia: propia(ruta) });
}
for (const ruta of rutas) {
    await cp(join(raiz, ruta), join(destino, ruta), { recursive: true });
    await cp(join(raiz, ruta), join(fuentes, ruta), { recursive: true });
    await visitar(ruta);
}
const preload = 'output/rea-integracion/rea05/tiempos-runtime/sin-env.cjs';
const b = await readFile(join(raiz, preload));
await writeFile(join(evidencia, 'sin-env.cjs'), b);
archivos.push({ ruta: preload, sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length, propia: false });
await symlink(join(raiz, 'node_modules'), join(destino, 'node_modules'), 'dir');
archivos.sort((a, b) => a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0);
const hash = createHash('sha256').update(JSON.stringify(archivos)).digest('hex');
await writeFile(join(evidencia, 'manifest.json'), JSON.stringify({ raiz, destino, sello, hash, archivos, env: 'Sin .env*, node_modules enlazado, Next distDir propio y NODE_OPTIONS sin-env.cjs obligatorio.', limite: 'Fuentes propias y dependencias copiadas sin alterar checkout. No incluye credenciales ni acepta la unidad.' }, null, 2));
await writeFile(join(tanda, 'qa-activa.json'), JSON.stringify({ destino, evidencia, hash }, null, 2));
console.log(JSON.stringify({ destino, evidencia, hash }));
