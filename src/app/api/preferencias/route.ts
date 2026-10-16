import { sql } from '@/lib/db';
import { cambiarPreferencias, leerPreferencias } from '@/lib/preferencias-usuario-repositorio';
import { ErrorPreferencias, esquemaCambioPreferencias, esquemaRestablecerPreferencias } from '@/lib/preferencias-usuario';
import { entradaPreferencias,errorPreferencias,respuestaPreferencias,usuarioHttpPreferencias } from '@/lib/preferencias-usuario-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const yo=await usuarioHttpPreferencias(request);const parametros=new URL(request.url).searchParams;const grupo=parametros.get('grupo');
  if((grupo!=='panel'&&grupo!=='catalogo')||[...parametros.keys()].some(k=>k!=='grupo')||parametros.getAll('grupo').length!==1)throw new ErrorPreferencias('Indica un único grupo: panel o catalogo.');
  return respuestaPreferencias(await leerPreferencias(sql,yo,grupo));
}catch(error){return errorPreferencias(error);}}
export async function PUT(request:Request){try{
  const yo=await usuarioHttpPreferencias(request,true);const p=esquemaCambioPreferencias.parse(await entradaPreferencias(request));
  return respuestaPreferencias(await cambiarPreferencias(sql,yo,p.grupo,p.version,p.valor));
}catch(error){return errorPreferencias(error);}}
export async function DELETE(request:Request){try{
  const yo=await usuarioHttpPreferencias(request,true);const p=esquemaRestablecerPreferencias.parse(await entradaPreferencias(request));
  return respuestaPreferencias(await cambiarPreferencias(sql,yo,p.grupo,p.version,{},true));
}catch(error){return errorPreferencias(error);}}
