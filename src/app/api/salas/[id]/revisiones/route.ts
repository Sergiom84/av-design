import { historialDiseno, crearRevisionDiseno } from '@/lib/revisiones-diseno-repositorio';
import { usuarioRevisionDiseno, entradaRevisionDiseno, esquemaCrearRevision, respuestaRevisionDiseno, errorRevisionDiseno, sql } from '@/lib/revisiones-diseno-http';
import { revalidatePath } from 'next/cache';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await usuarioRevisionDiseno(request);const {id}=await params;const pagina=Number(new URL(request.url).searchParams.get('pagina')??1);return respuestaRevisionDiseno(await historialDiseno(sql,id,pagina));}catch(e){return errorRevisionDiseno(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {const yo=await usuarioRevisionDiseno(request,true);const {id}=await params;const datos=esquemaCrearRevision.parse(await entradaRevisionDiseno(request));const revision=await crearRevisionDiseno(sql,id,datos.nombre,yo.id,datos.base);revalidatePath(`/salas/${id}`,'layout');return respuestaRevisionDiseno(revision,201);}catch(e){return errorRevisionDiseno(e);}
}
