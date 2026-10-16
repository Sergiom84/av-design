import { atenderResultado } from '@/lib/resultados-propuestas/http';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return atenderResultado(req,'detalle',(await params).id);}
