import { compararRevisionesDiseno, compararAlternativaDiseno } from '@/lib/revisiones-diseno-repositorio';
import { usuarioRevisionDiseno, respuestaRevisionDiseno, errorRevisionDiseno, sql } from '@/lib/revisiones-diseno-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await usuarioRevisionDiseno(request);const {id}=await params;const q=new URL(request.url).searchParams;const otra=q.get('salaId');const diferencias=otra ? await compararAlternativaDiseno(sql,id,otra) : await compararRevisionesDiseno(sql,id,q.get('revisionA')??'',q.get('revisionB')??'');return respuestaRevisionDiseno(diferencias);}catch(e){return errorRevisionDiseno(e);}
}
