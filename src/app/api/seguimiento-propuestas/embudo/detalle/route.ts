import { atenderSeguimiento } from '@/lib/seguimiento-propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return atenderSeguimiento(req, 'lista'); }
