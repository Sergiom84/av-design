import 'server-only';
import { z } from 'zod';
import { hayConfiguracion } from './db';
import { sesionActual } from './sesion-servidor';
import { mismoOrigen } from './catalogo-tecnico';
import { ErrorPreferencias } from './preferencias-usuario';
export async function usuarioHttpPreferencias(request:Request,mutacion=false){
  if(!hayConfiguracion())throw new ErrorPreferencias('Base de datos sin configurar.',503);
  const yo=await sesionActual();
  if(!yo)throw new ErrorPreferencias('Sin sesión.',401);
  if(yo.ficticio||yo.debeCambiarClave)throw new ErrorPreferencias('Inicia sesión con tu contraseña definitiva para usar preferencias personales.',403);
  if(mutacion&&!mismoOrigen(request))throw new ErrorPreferencias('La petición debe proceder de esta aplicación.',403);
  return yo;
}
export async function entradaPreferencias(request:Request):Promise<unknown>{
  const max=8192;
  if(Number(request.headers.get('content-length'))>max)throw new ErrorPreferencias('Solicitud demasiado grande: máximo 8 KiB.',413);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ErrorPreferencias('Se requiere JSON.',400);
  const lector=request.body?.getReader();if(!lector)throw new ErrorPreferencias('Falta la solicitud.');
  let total=0;const partes:Uint8Array[]=[];
  while(true){const {done,value}=await lector.read();if(done)break;total+=value.byteLength;if(total>max){await lector.cancel();throw new ErrorPreferencias('Solicitud demasiado grande: máximo 8 KiB.',413);}partes.push(value);}
  try{return JSON.parse(Buffer.concat(partes).toString('utf8'));}catch{throw new ErrorPreferencias('JSON inválido.');}
}
export function respuestaPreferencias(valor:unknown,status=200){return Response.json(valor,{status,headers:{'Cache-Control':'private, no-store'}});}
export function errorPreferencias(error:unknown){
  if(error instanceof ErrorPreferencias)return respuestaPreferencias({error:error.message},error.status);
  if(error instanceof z.ZodError)return respuestaPreferencias({error:'Comprueba las preferencias: sólo se admiten los campos indicados y texto literal.'},400);
  if(['40001','40P01'].includes((error as {code?:string})?.code??''))return respuestaPreferencias({error:'Las preferencias cambiaron durante la operación. Recarga y compara.'},409);
  return respuestaPreferencias({error:'No se pudieron consultar o guardar las preferencias. Inténtalo de nuevo.'},503);
}
