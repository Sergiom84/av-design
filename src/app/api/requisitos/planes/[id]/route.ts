import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { editarPlanSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Contexto={params:Promise<{id:string}>};
export async function GET(req:Request,c:Contexto){return ejecutar(req,false,async(_r,p,u)=>p.obtener(u,(await c.params).id));}
export async function PATCH(req:Request,c:Contexto){return ejecutar(req,true,async(_r,p,u)=>p.editar(u,(await c.params).id,await leerJson(req,editarPlanSchema)));}
