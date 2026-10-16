import { sql } from '@/lib/db';
import { consultarCatalogoPreferido } from '@/lib/preferencias-usuario-repositorio';
import { ErrorPreferencias } from '@/lib/preferencias-usuario';
import { errorPreferencias,respuestaPreferencias,usuarioHttpPreferencias } from '@/lib/preferencias-usuario-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const yo=await usuarioHttpPreferencias(request);
  if(new URL(request.url).search)throw new ErrorPreferencias('La consulta usa tus preferencias guardadas, sin parámetros adicionales.');
  return respuestaPreferencias(await consultarCatalogoPreferido(sql,yo));
}catch(error){return errorPreferencias(error);}}
