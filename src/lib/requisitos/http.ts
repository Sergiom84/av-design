import { z } from 'zod';
import { hayConfiguracion, sql } from '../db';
import { sesionActual } from '../sesion-servidor';
import { ErrorImportacion } from '../importacion/modelo';
import { ErrorJerarquia } from '../jerarquia-transaccional';
import { ErrorAltaPuerto } from '../catalogo-puertos-escritura';
import { ErrorExtraccion } from './parser';
import { ErrorRequisito, LIMITES_REQUISITOS, validar } from './modelo';
import { identidad } from './fuentes';
import { RepositorioRequisitos } from './repositorio';
import { PlanesRequisitos } from './planes';
export const CABECERAS={ 'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff' };
export function mismoOrigen(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')throw new ErrorRequisito('ORIGEN','La petición debe proceder de esta aplicación.',403);}
export async function leerBytes(req:Request,maximo:number){
  const largo=req.headers.get('content-length');if(largo&&(!/^\d+$/u.test(largo)||Number(largo)>maximo))throw new ErrorRequisito('LIMITE','La petición supera el tamaño permitido.',413);
  const lector=req.body?.getReader();if(!lector)throw new ErrorRequisito('ENTRADA','Falta el cuerpo de la petición.');
  const trozos:Uint8Array[]=[];let n=0;try{while(true){const r=await lector.read();if(r.done)break;n+=r.value.byteLength;if(n>maximo){await lector.cancel();throw new ErrorRequisito('LIMITE','La petición supera el tamaño permitido.',413);}trozos.push(r.value);}}finally{lector.releaseLock();}return Buffer.concat(trozos,n);
}
export async function leerJson<T>(req:Request,schema:z.ZodType<T>):Promise<T>{
  if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new ErrorRequisito('ENTRADA','Se requiere JSON.');
  const b=await leerBytes(req,LIMITES_REQUISITOS.cuerpo);try{return validar(schema,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b)));}catch(e){if(e instanceof ErrorRequisito)throw e;throw new ErrorRequisito('ENTRADA','El cuerpo JSON no es válido.');}
}
export function errorHttp(error:unknown){
  const e=error instanceof ErrorRequisito?error:error instanceof ErrorExtraccion?new ErrorRequisito(error.codigo,'No se pudo extraer el archivo localmente: '+error.codigo+'. Puedes conservarlo y transcribirlo manualmente.',error.estadoHttp):error instanceof ErrorImportacion?new ErrorRequisito('E2',error.message,error.estadoHttp):error instanceof ErrorJerarquia||error instanceof ErrorAltaPuerto?new ErrorRequisito('DESTINO',error.message,error.estadoHttp):new ErrorRequisito('NO_DISPONIBLE','La operación no está disponible. Conserva tu revisión y vuelve a intentarlo.',503);
  return Response.json({error:e.message,codigo:e.codigo},{status:e.status,headers:CABECERAS});
}
export async function ejecutar(req:Request,mutacion:boolean,fn:(r:RepositorioRequisitos,p:PlanesRequisitos,id:string)=>Promise<unknown>){
  try{if(mutacion)mismoOrigen(req);const yo=await sesionActual();if(!yo)throw new ErrorRequisito('IDENTIDAD','Sin sesión.',401);if(yo.ficticio||yo.debeCambiarClave)throw new ErrorRequisito('IDENTIDAD','Se necesita un usuario real con contraseña definitiva.',403);if(!hayConfiguracion())throw new ErrorRequisito('NO_DISPONIBLE','Base de datos sin configurar.',503);await identidad(sql,yo.id);const resultado=await fn(new RepositorioRequisitos(sql),new PlanesRequisitos(sql),yo.id);return resultado instanceof Response?resultado:Response.json(resultado,{headers:CABECERAS});}catch(e){return errorHttp(e);}
}
