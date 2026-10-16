import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { retirarSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Contexto={params:Promise<{id:string}>};
export async function GET(req:Request,c:Contexto){return ejecutar(req,false,async(r,_p,u)=>r.detalle(u,(await c.params).id));}
export async function PATCH(req:Request,c:Contexto){return ejecutar(req,true,async(r,_p,u)=>r.retirar(u,(await c.params).id,await leerJson(req,retirarSchema)));}
