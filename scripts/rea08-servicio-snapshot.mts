import { readdir,readFile,writeFile,mkdir,copyFile,symlink,stat } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
const salida=process.env.REA08_SALIDA??'output/rea-integracion/rea08/servicio-runtime';
const origen=process.cwd(),destino=`/private/tmp/av-design-rea08-servicio-${Date.now()}`;
if(origen!=='/Users/sergio/Desktop/Aplicaciones/AV_design')throw new Error('Origen08 distinto del checkout autorizado.');
const manifest:Array<{ruta:string;sha256:string}>=[];
async function copiar(rel:string){const src=join(origen,rel),s=await stat(src);if(s.isDirectory()){for(const f of await readdir(src))if(f!=='.DS_Store')await copiar(join(rel,f));return;}if(rel.split('/').some(p=>p.startsWith('.env')))throw new Error('Nunca copiar entorno.');const out=join(destino,rel);await mkdir(resolve(out,'..'),{recursive:true});await copyFile(src,out);manifest.push({ruta:rel,sha256:createHash('sha256').update(await readFile(src)).digest('hex')});}
for(const rel of ['src','public','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs'])await copiar(rel);
await symlink(join(origen,'node_modules'),join(destino,'node_modules'),'dir');
await mkdir(salida,{recursive:true});
await writeFile(join(salida,'snapshot.json'),JSON.stringify({origen,destino,manifest:manifest.sort((a,b)=>a.ruta.localeCompare(b.ruta)),creadoEn:new Date().toISOString()},null,2));
await writeFile(join(salida,'sin-env.cjs'),await readFile('output/rea-integracion/rea05/tiempos-runtime/sin-env.cjs'));
console.log(destino,manifest.length,'archivos verificados; sin.env; node_modules symlink.');
