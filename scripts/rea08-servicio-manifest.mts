import { readdir,readFile,writeFile,stat } from 'node:fs/promises';
import { resolve,relative,join } from 'node:path';
import { createHash } from 'node:crypto';
const raiz=process.cwd(),salida=resolve(process.env.REA08_SALIDA??'output/rea-integracion/rea08/servicio-runtime'),sha=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
async function archivos(ruta:string):Promise<string[]>{const s=await stat(ruta);return s.isDirectory()?(await Promise.all((await readdir(ruta)).map(f=>archivos(join(ruta,f))))).flat():[ruta];}
const fuentes=(await Promise.all(['src/lib/servicio-instalaciones','src/components/servicio-instalaciones','src/app/api/servicio-instalaciones','src/app/salas/[id]/servicio','src/app/proyectos/[id]/servicio'].map(p=>archivos(resolve(p))))).flat();
for(const dir of ['scripts','src/lib','e2e-gate'])for(const f of await readdir(dir))if(dir==='scripts'&&/^((verificar-)?rea08-servicio)/.test(f)||dir==='src/lib'&&/^servicio-instalaciones-.*\.test\.ts$/.test(f)||dir==='e2e-gate'&&/^rea08/.test(f))fuentes.push(resolve(dir,f));
const filas=async(paths:string[])=>Promise.all([...new Set(paths)].sort().map(async p=>({ruta:relative(raiz,p),sha256:sha(await readFile(p)),bytes:(await stat(p)).size})));
const lista=(await readFile(join(salida,'dependencias-ts.txt'),'utf8')).split('\n').filter(p=>p.startsWith(raiz+'/')&&!fuentes.includes(p));
lista.push(...['package.json','package-lock.json','next.config.ts','tsconfig.json','db/migraciones/2026-10-rea08-servicio.sql','scripts/rea08-fixture.mts','docs/26-rea08-especificacion.md'].map(p=>resolve(p)));
const artefactos=(await archivos(salida)).filter(p=>!p.endsWith('/manifest-final.json'));
const v={creadoEn:new Date().toISOString(),fuentes:await filas(fuentes),dependencias:await filas(lista),evidencia:await filas(artefactos),node:process.version,baseExclusiva:'127.0.0.1:5561/av_design_rea08_prueba',limite:'Código08 local y QA sintética; requiere revisión independiente y gates globales del coordinador. Sin commit/push/despliegue/producción.'};
await writeFile(join(salida,'manifest-final.json'),JSON.stringify({...v,fuentesHash:sha(Buffer.from(JSON.stringify(v.fuentes)))},null,2));console.log(`${v.fuentes.length}fuentes,${v.dependencias.length}deps,${v.evidencia.length}artefactos.`);
