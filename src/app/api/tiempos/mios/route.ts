import { atenderTiempo } from '@/lib/tiempos/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return atenderTiempo(req, 'mios'); }
export async function POST(req: Request) { return atenderTiempo(req, 'mios'); }
