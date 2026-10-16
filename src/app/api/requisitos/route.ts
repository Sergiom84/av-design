import { z } from 'zod';
import { altaReferenciaSchema, LIMITES_REQUISITOS, metadatosSchema, uuid, validar, ErrorRequisito } from '@/lib/requisitos/modelo';
import { ejecutar, leerBytes, leerJson } from '@/lib/requisitos/http';
import { exigir, identidad } from '@/lib/requisitos/fuentes';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){return ejecutar(req,false,async(r,_p,id)=>{const q=validar(z.object({proyectoId:uuid}).strict(),Object.fromEntries(new URL(req.url).searchParams));return r.listar(id,q.proyectoId);});}
export async function POST(req:Request){return ejecutar(req,true,async(r,_p,id)=>{
  const u=await identidad(r.db,id);exigir(u,['proyectos','salas']);exigir(u,['proyectos'],'editar');
  if(req.headers.get('content-type')?.split(';')[0]==='application/json')return r.registrarReferencia(id,await leerJson(req,altaReferenciaSchema));
  exigir(u,['compras']);if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new ErrorRequisito('ENTRADA','Selecciona un archivo PDF o TXT.');
  const bytes=await leerBytes(req,LIMITES_REQUISITOS.multipart);const f=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')!}}).formData();
  const permitidos=new Set(['archivo','proyectoId','procedencia','fechaFuente','url']);for(const k of f.keys())if(!permitidos.has(k)||f.getAll(k).length!==1)throw new ErrorRequisito('ENTRADA','Campos de archivo inválidos o repetidos.');
  const archivo=f.get('archivo');if(!(archivo instanceof File))throw new ErrorRequisito('ARCHIVO','Falta el archivo.');
  if(archivo.size<1||archivo.size>LIMITES_REQUISITOS.archivo)throw new ErrorRequisito('ARCHIVO','Selecciona PDF o TXT de entre 1 byte y 5 MiB.',413);
  const m=validar(metadatosSchema,{nombre:archivo.name,mime:archivo.type,procedencia:String(f.get('procedencia')??''),fechaFuente:f.get('fechaFuente')||null,url:f.get('url')||null,tamano:archivo.size});
  return r.registrarArchivo(id,validar(uuid,f.get('proyectoId')),m,new Uint8Array(await archivo.arrayBuffer()));
});}
