import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { confirmarSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request,c:{params:Promise<{id:string}>}){return ejecutar(req,true,async(_r,p,u)=>p.confirmar(u,(await c.params).id,await leerJson(req,confirmarSchema)));}
