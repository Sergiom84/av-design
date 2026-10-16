import { atenderCostes } from '@/lib/costes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, contexto: { params: Promise<{ serieId: string }> }) { return atenderCostes(req, 'tarifa', await contexto.params); }
export async function POST(req: Request, contexto: { params: Promise<{ serieId: string }> }) { return atenderCostes(req, 'tarifa', await contexto.params); }
