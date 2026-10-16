import { z } from 'zod';
import { ejecutar,leerJson } from '@/lib/requisitos/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request,c:{params:Promise<{id:string}>}){return ejecutar(req,true,async(_r,p,u)=>{await leerJson(req,z.object({}).strict());return p.preview(u,(await c.params).id);});}
