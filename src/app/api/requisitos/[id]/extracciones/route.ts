import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { extraerSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request,c:{params:Promise<{id:string}>}){return ejecutar(req,true,async(r,_p,u)=>r.extraer(u,(await c.params).id,await leerJson(req,extraerSchema),req.signal));}
