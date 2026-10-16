import { z } from 'zod';
import { ejecutar } from '@/lib/requisitos/http';
import { ErrorRequisito,uuid,validar } from '@/lib/requisitos/modelo';
import { exigir,identidad } from '@/lib/requisitos/fuentes';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){return ejecutar(req,false,async(r,p,u)=>{
  const q=validar(z.object({articuloId:uuid,destino:z.enum(['articulo','tecnico','puerto'])}).strict(),Object.fromEntries(new URL(req.url).searchParams));
  if(q.destino!=='articulo')return p.baseTecnica(u,q.articuloId,q.destino);
  exigir(await identidad(r.db,u),['catalogo','proyectos','salas']);
  const [articulo]=await r.db`select id,marca,modelo,revision,unidad,tipo,referencia,categoria,activo from articulos where id=${q.articuloId}`;
  if(!articulo)throw new ErrorRequisito('NO_EXISTE','La referencia no existe.',404);return {articulo:{...articulo,revision:Number(articulo.revision)}};
});}
