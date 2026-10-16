import { mkdir, cp, writeFile, symlink, readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const raiz = resolve('.'), sello = Date.now(), destino = `/private/tmp/rea09-qa-${sello}`;
const tanda = resolve(process.env.REA09_SALIDA ?? `output/rea-integracion/rea09/consultas-runtime/tanda-${sello}`);
const evidencia = join(tanda, 'freeze'), fuentes = join(evidencia, 'fuentes-congeladas');
await mkdir(destino, { recursive: true });
await mkdir(fuentes, { recursive: true });
const rutas = ['src', 'public', 'scripts', 'e2e-gate', 'db', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs', 'design-system', 'AGENTS.md', 'docs/27-rea09-especificacion.md'];
const archivos: Array<{ ruta: string; sha256: string; bytes: number; propia: boolean }> = [];
const propia = (p: string) => /^(src\/(lib\/consultas\/|components\/consultas\/|app\/api\/consultas\/|app\/cuenta\/consultas\/|lib\/consultas-(intenciones|modelo)\.test\.ts)|scripts\/(rea09|verificar-rea09)|e2e-gate\/rea09)/.test(p);
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
await mkdir(join(fuentes, dirname(preload)), { recursive: true });
await writeFile(join(fuentes, preload), b);
archivos.push({ ruta: preload, sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length, propia: false });
await symlink(join(raiz, 'node_modules'), join(destino, 'node_modules'), 'dir');
archivos.sort((a, b) => a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0);
const hash = createHash('sha256').update(JSON.stringify(archivos)).digest('hex');
await writeFile(join(evidencia, 'manifest.json'), JSON.stringify({ raiz, destino, sello, hash, archivos, env: 'Sin .env*, node_modules enlazado, Next distDir propio y NODE_OPTIONS sin-env.cjs obligatorio.', limite: 'Fuentes propias y dependencias copiadas sin alterar checkout. No incluye credenciales ni acepta la unidad.' }, null, 2));
await writeFile(join(tanda, 'qa-activa.json'), JSON.stringify({ destino, evidencia, hash }, null, 2));
console.log(JSON.stringify({ destino, evidencia, hash }));
