import { atenderCostes } from '@/lib/costes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return atenderCostes(req, 'corte-preparar'); }
