import { atenderCostes } from '@/lib/costes/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request,contexto:{params:Promise<{id:string}>}) {return atenderCostes(req,'laboral-historial',await contexto.params);}
