import { atenderResultado } from '@/lib/resultados-propuestas/http';
export const runtime='nodejs';
export const POST=(req:Request)=>atenderResultado(req,'preparar');
