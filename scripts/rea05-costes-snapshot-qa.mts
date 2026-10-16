/** Copia de QA idéntica, nunca destino de implementación. No copia .env ni datos. */
import { cp,mkdir,readFile,readdir,stat,symlink,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { resolve,relative,join } from 'node:path';
const origen=process.cwd(),marca=Date.now(),destino=resolve('/private/tmp','av-design-rea05-costes-qa-'+marca+'-'+randomUUID().slice(0,8));
const entradas=['src','public','package.json','package-lock.json','next.config.ts','postcss.config.mjs','tsconfig.json','next-env.d.ts'];
await mkdir(destino,{recursive:true});
const archivos:Array<{ruta:string;sha256:string}>=[];
async function listar(ruta:string):Promise<string[]>{const s=await stat(ruta);return s.isDirectory()?(await Promise.all((await readdir(ruta)).sort().map(n=>listar(join(ruta,n))))).flat():[ruta];}
for(const entrada of entradas){const fuente=resolve(origen,entrada);await cp(fuente,resolve(destino,entrada),{recursive:true});for(const archivo of await listar(fuente)){const ruta=relative(origen,archivo),a=await readFile(archivo),b=await readFile(resolve(destino,ruta)),hash=createHash('sha256').update(a).digest('hex');if(!a.equals(b))throw new Error('La fuente cambió durante la copia: '+ruta);archivos.push({ruta,sha256:hash});}}
for(const a of archivos){const actual=createHash('sha256').update(await readFile(resolve(origen,a.ruta))).digest('hex');if(actual!==a.sha256)throw new Error('La fuente cambió al verificar: '+a.ruta);}
await symlink(resolve(origen,'node_modules'),resolve(destino,'node_modules'),'dir');
const manifiesto={origen,destino,marca,archivos,exclusiones:['.env*','data','docs inventario','output','.git'],dependencias:'node_modules existente de origen, sin instalar paquetes'};
const salida=process.env.REA05_COSTES_SALIDA??'output/rea-integracion/rea05/costes-runtime';await mkdir(resolve(origen,salida),{recursive:true});
const nombre=resolve(origen,salida,'snapshot-qa-'+marca+'.json');await writeFile(nombre,JSON.stringify(manifiesto,null,2));await writeFile(resolve(origen,salida,'snapshot-qa-actual.json'),JSON.stringify({destino,manifiesto:nombre},null,2));console.log(JSON.stringify({destino,manifiesto:nombre,archivos:archivos.length}));
