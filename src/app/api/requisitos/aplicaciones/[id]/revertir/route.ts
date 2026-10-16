import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { revertirSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request,c:{params:Promise<{id:string}>}){return ejecutar(req,true,async(_r,p,u)=>p.revertir(u,(await c.params).id,await leerJson(req,revertirSchema)));}
