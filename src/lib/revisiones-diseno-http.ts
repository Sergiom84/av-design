import 'server-only';
import { hayConfiguracion, sql } from './db';
import { sesionActual } from './sesion-servidor';
import { puede } from './usuarios';
import { ErrorRevisionDiseno } from './revisiones-diseno-repositorio';
import { z } from 'zod';

export const esquemaBaseDiseno = z.object({ version:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), hash:z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const esquemaCrearRevision = z.object({ nombre:z.string().trim().min(1).max(160),base:esquemaBaseDiseno }).strict();
export const esquemaRestaurarRevision = z.object({ revisionId:z.uuid(),base:esquemaBaseDiseno }).strict();
export const esquemaDuplicarDiseno = z.object({ nombre:z.string().trim().min(1).max(160),codigo:z.string().trim().max(160).nullable().optional(),base:esquemaBaseDiseno }).strict();
export async function usuarioRevisionDiseno(request:Request,editar=false) {
  const yo=await sesionActual();
  if(!yo)throw new ErrorRevisionDiseno('Sin sesión.',401);
  if(yo.debeCambiarClave)throw new ErrorRevisionDiseno('Cambia la contraseña provisional.',403);
  if(!hayConfiguracion())throw new ErrorRevisionDiseno('Base de datos sin configurar.',503);
  if(!puede(yo.permisos,'salas',editar?'editar':'ver'))throw new ErrorRevisionDiseno('Sin permiso para esta sala.',403);
  if(editar) {
    if(yo.ficticio)throw new ErrorRevisionDiseno('El historial requiere un usuario real para registrar autoría.',403);
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new ErrorRevisionDiseno('La petición debe proceder de esta aplicación.',403);
  }
  return yo;
}
export async function entradaRevisionDiseno(request:Request) {
  const max=16384;const reader=request.body?.getReader();if(!reader)throw new ErrorRevisionDiseno('Falta la solicitud.');
  const partes:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new ErrorRevisionDiseno('Solicitud demasiado grande.',413);}partes.push(value);}
  try{return JSON.parse(Buffer.concat(partes).toString('utf8'));}catch{throw new ErrorRevisionDiseno('Solicitud inválida.');}
}
export function respuestaRevisionDiseno(valor:unknown,status=200){return Response.json(valor,{status,headers:{'Cache-Control':'private, no-store'}});}
export function errorRevisionDiseno(error:unknown) {
  if(error instanceof ErrorRevisionDiseno)return respuestaRevisionDiseno({error:error.message},error.status);
  if(error instanceof z.ZodError)return respuestaRevisionDiseno({error:'Comprueba los campos y la revisión base.'},400);
  const codigo=(error as {code?:string})?.code;
  if(codigo==='40001'||codigo==='40P01')return respuestaRevisionDiseno({error:'El diseño cambió durante la operación. Recarga y compara antes de continuar.'},409);
  return respuestaRevisionDiseno({error:'No se pudo completar la operación. No se guardó ningún cambio parcial.'},400);
}
export {sql};
