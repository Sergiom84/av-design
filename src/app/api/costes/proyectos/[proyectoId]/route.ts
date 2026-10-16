import { atenderCostes } from '@/lib/costes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, contexto: { params: Promise<{ proyectoId: string }> }) { return atenderCostes(req, 'proyecto', await contexto.params); }
