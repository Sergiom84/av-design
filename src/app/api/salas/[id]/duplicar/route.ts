import { duplicarSalaDiseno } from '@/lib/revisiones-diseno-repositorio';
import { usuarioRevisionDiseno, entradaRevisionDiseno, esquemaDuplicarDiseno, respuestaRevisionDiseno, errorRevisionDiseno, sql } from '@/lib/revisiones-diseno-http';
import { revalidatePath } from 'next/cache';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {const yo=await usuarioRevisionDiseno(request,true);const {id}=await params;const datos=esquemaDuplicarDiseno.parse(await entradaRevisionDiseno(request));const resultado=await duplicarSalaDiseno(sql,id,datos.nombre,datos.codigo||null,yo.id,datos.base);revalidatePath('/salas');revalidatePath(`/salas/${id}`,'layout');revalidatePath('/proyectos');return respuestaRevisionDiseno(resultado,201);}catch(e){return errorRevisionDiseno(e);}
}
