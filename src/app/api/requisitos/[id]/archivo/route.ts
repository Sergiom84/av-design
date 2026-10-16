import { CABECERAS,ejecutar } from '@/lib/requisitos/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request,c:{params:Promise<{id:string}>}){return ejecutar(req,false,async(r,_p,u)=>{const f=await r.archivo(u,(await c.params).id);return new Response(f.bytes,{headers:{...CABECERAS,'Content-Type':f.metadatos.mime,'Content-Length':String(f.metadatos.tamano),'Content-Disposition':`attachment; filename="${f.metadatos.nombre.replace(/["\\\r\n]/gu,'')}"`,'ETag':`"${f.sha256}"`}});});}
