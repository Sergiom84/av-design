import { ejecutar,leerJson } from '@/lib/requisitos/http';
import { crearPlanSchema } from '@/lib/requisitos/modelo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){return ejecutar(req,true,async(_r,p,u)=>p.crear(u,await leerJson(req,crearPlanSchema)));}
