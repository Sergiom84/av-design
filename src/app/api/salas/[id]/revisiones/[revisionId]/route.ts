import { obtenerRevisionDiseno, restaurarRevisionDiseno } from '@/lib/revisiones-diseno-repositorio';
import { usuarioRevisionDiseno, entradaRevisionDiseno, esquemaRestaurarRevision, respuestaRevisionDiseno, errorRevisionDiseno, sql } from '@/lib/revisiones-diseno-http';
import { revalidatePath } from 'next/cache';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string;revisionId:string}>}) {
  try {await usuarioRevisionDiseno(request);const {id,revisionId}=await params;return respuestaRevisionDiseno(await obtenerRevisionDiseno(sql,id,revisionId));}catch(e){return errorRevisionDiseno(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string;revisionId:string}>}) {
  try {const yo=await usuarioRevisionDiseno(request,true);const {id,revisionId}=await params;const datos=esquemaRestaurarRevision.parse(await entradaRevisionDiseno(request));if(datos.revisionId!==revisionId)return respuestaRevisionDiseno({error:'Revisión ajena a la solicitud.'},400);const revision=await restaurarRevisionDiseno(sql,id,revisionId,yo.id,datos.base);revalidatePath(`/salas/${id}`,'layout');return respuestaRevisionDiseno(revision,201);}catch(e){return errorRevisionDiseno(e);}
}
