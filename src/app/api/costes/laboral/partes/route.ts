import { atenderCostes } from '@/lib/costes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return atenderCostes(req, 'laboral-partes'); }
