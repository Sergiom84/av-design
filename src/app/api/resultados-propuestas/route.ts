import { atenderResultado } from '@/lib/resultados-propuestas/http';
export const runtime='nodejs';
export const GET=(req:Request)=>atenderResultado(req,'raiz');
export const POST=(req:Request)=>atenderResultado(req,'raiz');
