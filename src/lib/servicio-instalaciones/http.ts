import { z } from 'zod';
import { sesionActual } from '../sesion-servidor';
import { sql,hayConfiguracion } from '../db';
import { mismoOrigen } from '../catalogo-tecnico';
import { ErrorServicio,id,validar } from './modelo';
import { RepositorioServicio } from './repositorio';
export const respuestaServicio=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function errorServicio(e:unknown){
  if(e instanceof ErrorServicio)return e;
  if(['40001','40P01','23505'].includes((e as {code?:string})?.code??''))return new ErrorServicio('Otra operación cambió el registro o la fuente. Revisa de nuevo.',409);
  return new ErrorServicio('El servicio no está disponible. Conserva tu edición y reintenta.',503);
}
export async function cuerpoServicio(req:Request){
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')??''))throw new ErrorServicio('El cuerpo debe ser JSON.');
  if(Number(req.headers.get('content-length'))>65536)throw new ErrorServicio('Máximo 64 KiB por petición.',413);
  const lector=req.body?.getReader();if(!lector)throw new ErrorServicio('Falta el cuerpo.');let total=0;const partes:Uint8Array[]=[];
  try{while(true){const r=await lector.read();if(r.done)break;total+=r.value.byteLength;if(total>65536){await lector.cancel();throw new ErrorServicio('Máximo 64 KiB por petición.',413);}partes.push(r.value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(partes)));}catch(e){if(e instanceof ErrorServicio)throw e;throw new ErrorServicio('El JSON no es válido.');}finally{lector.releaseLock();}
}
const filtro=z.object({salaId:id.optional(),proyectoId:id.optional(),registroId:id.optional(),revisionId:id.optional(),paginaFuente:z.coerce.number().int().positive().max(100000).optional(),pagina:z.coerce.number().int().positive().max(100000).optional(),historial:z.enum(['1','0']).optional()}).strict();
export async function atenderServicio(req:Request){try{
  if(!hayConfiguracion())throw new ErrorServicio('La base de datos no está configurada.',503);
  const u=await sesionActual();if(!u)throw new ErrorServicio('Inicia sesión.',401);if(u.ficticio||u.debeCambiarClave)throw new ErrorServicio('Usa una identidad real con contraseña definitiva.',403);
  if(req.method!=='GET'&&!mismoOrigen(req))throw new ErrorServicio('La petición debe proceder de esta aplicación.',403);
  const repo=new RepositorioServicio(sql);await repo.identidad(u.id);
  if(req.method==='GET'&&new URL(req.url).searchParams.has('buscarSala')){const v=validar(z.object({buscarSala:z.string().max(120)}).strict(),Object.fromEntries(new URL(req.url).searchParams));return respuestaServicio(await repo.buscarSalas(u.id,v.buscarSala));}
  if(req.method==='GET'){const f=validar(filtro,Object.fromEntries(new URL(req.url).searchParams));return respuestaServicio(await repo.listar(u.id,{...f,historial:f.historial==='1'}));}
  if(req.method==='POST')return respuestaServicio(await repo.ejecutar(u.id,await cuerpoServicio(req)));
  throw new ErrorServicio('Operación no disponible.',405);
}catch(e){const error=errorServicio(e);return respuestaServicio({error:error.message,...(error.detalle?{detalle:error.detalle}:{})},error.status);}}
